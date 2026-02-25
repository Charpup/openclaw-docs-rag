#!/bin/bash
# version-check.sh - Check OpenClaw version and record changes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

echo "=== OpenClaw Version Check ==="

# Run version check
node -e "
const VersionDetector = require('./src/version-detector.js');
const VersionStore = require('./src/version-store.js');

async function main() {
  const detector = new VersionDetector();
  const store = new VersionStore();
  
  try {
    // Initialize tables
    await store.init();
    
    // Get current version from database
    const dbVersion = await store.getCurrentVersion();
    console.log('📦 Current recorded version:', dbVersion ? dbVersion.version : 'none');
    
    // Fetch latest version from docs
    console.log('🌐 Fetching version from docs.openclaw.ai...');
    const latestVersion = await detector.fetchCurrentVersion();
    console.log('📥 Detected version:', latestVersion.version);
    
    if (latestVersion.version === 'unknown') {
      console.log('⚠️ Could not detect version');
      process.exit(1);
    }
    
    // Check if this is a new version
    if (!dbVersion || dbVersion.version !== latestVersion.version) {
      console.log('✨ New version detected!');
      
      // Record the new version
      const record = await store.recordVersion(latestVersion);
      console.log('✅ Version recorded:', record.recorded ? 'yes' : 'already exists');
      
      // If there's a previous version, record the change
      if (dbVersion) {
        const changeInfo = detector.detectChanges(dbVersion.version, latestVersion.version);
        if (changeInfo.changed) {
          await store.recordChangelog(changeInfo);
          console.log('📝 Changelog recorded');
          
          // Generate What's New
          const whatsNew = detector.generateWhatsNew(changeInfo);
          console.log('\\n🎉 What\\'s New:');
          console.log('  Title:', whatsNew.title);
          console.log('  Type:', whatsNew.changeType);
          console.log('  Summary:', whatsNew.summary);
        }
      }
    } else {
      console.log('✓ Version unchanged');
    }
    
    // Show version history
    const history = await store.getVersionHistory(5);
    console.log('\\n📜 Recent Versions:');
    history.forEach((v, i) => {
      const current = v.is_current ? ' (current)' : '';
      console.log(\`  \${i + 1}. \${v.version} - \${new Date(v.detected_at).toLocaleDateString()}\${current}\`);
    });
    
    // Show latest changelog
    const changelog = await store.getChangelog(3);
    if (changelog.length > 0) {
      console.log('\\n🔄 Recent Changes:');
      changelog.forEach((c, i) => {
        console.log(\`  \${i + 1}. \${c.old_version} → \${c.version} (\${c.change_type})\`);
      });
    }
    
    await store.close();
    console.log('\\n✅ Version check complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await store.close();
    process.exit(1);
  }
}

main();
"
