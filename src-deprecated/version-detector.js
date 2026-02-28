/**
 * Version Detector - Check OpenClaw documentation version
 * Fetches version info from docs site and tracks changes
 */
const fetch = require('node-fetch');
const cheerio = require('cheerio');

class VersionDetector {
  constructor(options = {}) {
    this.docsUrl = options.docsUrl || 'https://docs.openclaw.ai';
    this.changelogUrl = options.changelogUrl || 'https://docs.openclaw.ai/changelog';
    this.versionCachePath = options.versionCachePath || './data/versions.json';
  }

  /**
   * Fetch current OpenClaw version from documentation
   */
  async fetchCurrentVersion() {
    try {
      // Try to fetch version from main docs page
      const response = await fetch(this.docsUrl, {
        headers: {
          'User-Agent': 'OpenClaw-Docs-RAG/3.0.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Look for version in meta tags or footer
      let version = this.extractVersionFromHtml($);
      
      // If not found on main page, try changelog
      if (!version) {
        version = await this.fetchVersionFromChangelog();
      }
      
      return {
        version: version || 'unknown',
        fetchedAt: new Date().toISOString(),
        source: this.docsUrl
      };
    } catch (error) {
      console.error('Failed to fetch version:', error.message);
      return {
        version: 'unknown',
        fetchedAt: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Extract version from HTML using multiple strategies
   */
  extractVersionFromHtml($) {
    // Strategy 1: Meta tag with version
    let version = $('meta[name="version"]').attr('content');
    if (version) return version;
    
    // Strategy 2: Footer version text
    const footerText = $('footer').text() || '';
    const versionMatch = footerText.match(/v?\d+\.\d+\.\d+[-\w.]*/);
    if (versionMatch) return versionMatch[0];
    
    // Strategy 3: Look in page title
    const titleText = $('title').text() || '';
    const titleMatch = titleText.match(/v?\d+\.\d+\.\d+/);
    if (titleMatch) return titleMatch[0];
    
    // Strategy 4: Look for version in any element with 'version' class or id
    const versionEl = $('[class*="version"], [id*="version"]').first();
    if (versionEl.length) {
      const text = versionEl.text().trim();
      const elMatch = text.match(/v?\d+\.\d+\.\d+/);
      if (elMatch) return elMatch[0];
    }
    
    return null;
  }

  /**
   * Fetch version from changelog page
   */
  async fetchVersionFromChangelog() {
    try {
      const response = await fetch(this.changelogUrl, {
        headers: {
          'User-Agent': 'OpenClaw-Docs-RAG/3.0.0'
        }
      });
      
      if (!response.ok) return null;
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Look for version in headings (usually latest version is first)
      const headings = $('h1, h2, h3');
      for (let i = 0; i < Math.min(headings.length, 5); i++) {
        const text = $(headings[i]).text();
        const match = text.match(/v?(\d+\.\d+\.\d+[-\w.]*)/);
        if (match) return match[1];
      }
      
      return null;
    } catch (error) {
      console.error('Failed to fetch changelog:', error.message);
      return null;
    }
  }

  /**
   * Compare two versions to detect changes
   */
  detectChanges(oldVersion, newVersion) {
    if (oldVersion === newVersion) {
      return { changed: false };
    }
    
    const oldParts = oldVersion.split('.').map(Number);
    const newParts = newVersion.split('.').map(Number);
    
    let changeType = 'patch';
    if (oldParts[0] !== newParts[0]) {
      changeType = 'major';
    } else if (oldParts[1] !== newParts[1]) {
      changeType = 'minor';
    }
    
    return {
      changed: true,
      oldVersion,
      newVersion,
      changeType,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate "What's New" summary for a version change
   */
  generateWhatsNew(changeInfo) {
    if (!changeInfo.changed) {
      return null;
    }
    
    const { oldVersion, newVersion, changeType } = changeInfo;
    
    return {
      title: `OpenClaw ${newVersion} Released`,
      summary: `Updated from ${oldVersion} to ${newVersion}`,
      changeType,
      highlights: [
        `Version bump: ${oldVersion} → ${newVersion}`,
        `Change type: ${changeType}`,
        `Synced at: ${changeInfo.timestamp}`
      ],
      actionRequired: changeType === 'major' ? 'Review breaking changes' : 'No action required'
    };
  }
}

module.exports = VersionDetector;
