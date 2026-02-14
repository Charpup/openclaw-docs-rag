/**
 * Document Fetcher - Crawl OpenClaw documentation
 */
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const cheerio = require('cheerio');

const BASE_URL = 'https://docs.openclaw.ai';

/**
 * Fetch sitemap and extract all documentation URLs
 */
async function fetchSitemap() {
  try {
    const response = await fetch(`${BASE_URL}/sitemap.xml`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    
    const urls = [];
    $('url loc').each((i, elem) => {
      const url = $(elem).text();
      if (url.startsWith(BASE_URL)) {
        urls.push(url);
      }
    });
    
    return urls;
  } catch (error) {
    console.error('Failed to fetch sitemap:', error);
    // Fallback: return known documentation URLs
    return getFallbackUrls();
  }
}

/**
 * Fetch a single documentation page
 */
async function fetchPage(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract main content (adjust selector based on docs site structure)
    const title = $('h1').first().text() || $('title').text();
    const content = $('main, article, .content, #content').first().text() || $('body').text();
    
    // Calculate checksum for change detection
    const checksum = calculateChecksum(content);
    
    return {
      url,
      title: title.trim(),
      content: content.trim(),
      checksum,
      fetchedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    return null;
  }
}

/**
 * Calculate MD5 checksum for content
 */
function calculateChecksum(content) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Fallback URLs if sitemap fails
 */
function getFallbackUrls() {
  const sections = [
    '/start/getting-started',
    '/start/setup',
    '/start/faq',
    '/gateway/configuration',
    '/gateway/configuration-examples',
    '/gateway/security',
    '/gateway/troubleshooting',
    '/providers/discord',
    '/providers/telegram',
    '/providers/whatsapp',
    '/providers/slack',
    '/concepts/agent',
    '/concepts/sessions',
    '/concepts/models',
    '/concepts/queues',
    '/tools/bash',
    '/tools/browser',
    '/tools/skills',
    '/automation/cron-jobs',
    '/automation/webhook',
    '/cli/gateway',
    '/install/docker',
    '/platforms/linux'
  ];
  
  return sections.map(s => `${BASE_URL}${s}`);
}

/**
 * Fetch all documentation pages
 */
async function fetchAllDocs(options = {}) {
  const { onProgress, limit, offset = 0 } = options;
  
  console.log('Fetching documentation sitemap...');
  let urls = await fetchSitemap();
  console.log(`Found ${urls.length} documentation URLs`);
  
  // Apply offset
  if (offset > 0) {
    urls = urls.slice(offset);
    console.log(`Skipped first ${offset} URLs, remaining: ${urls.length}`);
  }
  
  // Apply limit
  if (limit) {
    urls = urls.slice(0, limit);
    console.log(`Limited to ${urls.length} URLs`);
  }
  
  const docs = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`[${i + 1}/${urls.length}] Fetching: ${url}`);
    
    const doc = await fetchPage(url);
    if (doc) {
      docs.push(doc);
    }
    
    if (onProgress) {
      onProgress(i + 1, urls.length, doc);
    }
    
    // Rate limiting: 100ms between requests
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`Successfully fetched ${docs.length} pages`);
  return docs;
}

module.exports = {
  fetchSitemap,
  fetchPage,
  fetchAllDocs,
  calculateChecksum
};
