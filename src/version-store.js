/**
 * Version Store - Manages version history in PostgreSQL
 */
const { Pool } = require('pg');

class VersionStore {
  constructor(config = {}) {
    this.pool = new Pool({
      host: config.host || 'localhost',
      port: config.port || 5432,
      database: config.database || 'memu_db',
      user: config.user || 'memu',
      password: config.password || process.env.PGPASSWORD || 'memu_secure_password'
    });
    
    this.tableName = config.versionTable || 'openclaw_versions';
    this.changelogTable = config.changelogTable || 'openclaw_changelog';
  }

  /**
   * Initialize version tables
   */
  async init() {
    const client = await this.pool.connect();
    try {
      // Create versions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id SERIAL PRIMARY KEY,
          version VARCHAR(50) NOT NULL,
          detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          source VARCHAR(200),
          is_current BOOLEAN DEFAULT false,
          UNIQUE(version)
        )
      `);
      
      // Create changelog table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.changelogTable} (
          id SERIAL PRIMARY KEY,
          version VARCHAR(50) NOT NULL,
          change_type VARCHAR(20) NOT NULL,
          old_version VARCHAR(50),
          summary TEXT,
          details JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_detected 
        ON ${this.tableName}(detected_at DESC)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.changelogTable}_version 
        ON ${this.changelogTable}(version)
      `);
      
      console.log('Version store initialized successfully');
    } finally {
      client.release();
    }
  }

  /**
   * Record a new version detection
   */
  async recordVersion(versionInfo) {
    const client = await this.pool.connect();
    try {
      // Check if version already exists
      const existing = await client.query(
        `SELECT id FROM ${this.tableName} WHERE version = $1`,
        [versionInfo.version]
      );
      
      if (existing.rows.length > 0) {
        return { recorded: false, id: existing.rows[0].id, message: 'Version already exists' };
      }
      
      // Mark previous versions as not current
      await client.query(
        `UPDATE ${this.tableName} SET is_current = false WHERE is_current = true`
      );
      
      // Insert new version
      const result = await client.query(
        `INSERT INTO ${this.tableName} (version, detected_at, source, is_current)
         VALUES ($1, $2, $3, true)
         RETURNING id`,
        [versionInfo.version, versionInfo.fetchedAt, versionInfo.source]
      );
      
      return { recorded: true, id: result.rows[0].id };
    } finally {
      client.release();
    }
  }

  /**
   * Record a changelog entry
   */
  async recordChangelog(changeInfo) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO ${this.changelogTable} 
         (version, change_type, old_version, summary, details)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          changeInfo.newVersion,
          changeInfo.changeType,
          changeInfo.oldVersion,
          `Updated from ${changeInfo.oldVersion} to ${changeInfo.newVersion}`,
          JSON.stringify(changeInfo)
        ]
      );
      
      return { recorded: true, id: result.rows[0].id };
    } finally {
      client.release();
    }
  }

  /**
   * Get current version
   */
  async getCurrentVersion() {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT version, detected_at FROM ${this.tableName} 
         WHERE is_current = true 
         ORDER BY detected_at DESC 
         LIMIT 1`
      );
      
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Get version history
   */
  async getVersionHistory(limit = 10) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT version, detected_at, is_current 
         FROM ${this.tableName} 
         ORDER BY detected_at DESC 
         LIMIT $1`,
        [limit]
      );
      
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Get changelog entries
   */
  async getChangelog(limit = 10) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT version, change_type, old_version, summary, created_at 
         FROM ${this.changelogTable} 
         ORDER BY created_at DESC 
         LIMIT $1`,
        [limit]
      );
      
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Get "What's New" for latest version
   */
  async getWhatsNew() {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT c.version, c.change_type, c.old_version, c.summary, c.created_at,
                v.detected_at
         FROM ${this.changelogTable} c
         JOIN ${this.tableName} v ON c.version = v.version
         ORDER BY c.created_at DESC 
         LIMIT 1`
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        version: row.version,
        previousVersion: row.old_version,
        changeType: row.change_type,
        summary: row.summary,
        detectedAt: row.detected_at,
        changelogAt: row.created_at
      };
    } finally {
      client.release();
    }
  }

  /**
   * Close connection
   */
  async close() {
    await this.pool.end();
  }
}

module.exports = VersionStore;
