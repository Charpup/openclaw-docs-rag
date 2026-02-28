/**
 * Vector Store - PostgreSQL + pgvector storage
 */
const { Pool } = require('pg');

class VectorStore {
  constructor(config = {}) {
    this.pool = new Pool({
      host: config.host || 'localhost',
      port: config.port || 5432,
      database: config.database || 'memu_db',
      user: config.user || 'memu',
      password: config.password || process.env.PGPASSWORD || 'memu_secure_password'
    });
    
    this.tableName = config.tableName || 'openclaw_docs_chunks';
  }

  /**
   * Initialize database schema
   */
  async init() {
    const client = await this.pool.connect();
    try {
      // Enable pgvector extension
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      
      // Create table for document embeddings
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id SERIAL PRIMARY KEY,
          text TEXT NOT NULL,
          embedding VECTOR(1536),
          source VARCHAR(500),
          title VARCHAR(500),
          heading VARCHAR(500),
          checksum VARCHAR(32),
          fetched_at TIMESTAMP,
          chunk_type VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(source, checksum)
        )
      `);
      
      // Create index for similarity search
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_embedding 
        ON ${this.tableName} USING ivfflat (embedding vector_cosine_ops)
      `);
      
      // Create index for source lookup
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_source 
        ON ${this.tableName}(source)
      `);
      
      console.log('Vector store initialized successfully');
    } finally {
      client.release();
    }
  }

  /**
   * Store embedded chunks with explicit transaction
   * Deduplicates by (source, checksum) within the batch to avoid conflicts
   */
  async storeChunks(chunks) {
    // Deduplicate by (source, checksum) within the batch
    // Keep the first occurrence of each unique combination
    const seen = new Set();
    const uniqueChunks = chunks.filter(chunk => {
      const key = `${chunk.metadata.source}::${chunk.metadata.checksum}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
    
    if (uniqueChunks.length < chunks.length) {
      console.log(`   🔄 Deduplicated: ${chunks.length} → ${uniqueChunks.length} unique chunks`);
    }

    const client = await this.pool.connect();
    try {
      // Begin transaction for atomic batch write
      await client.query('BEGIN');
      
      const query = `
        INSERT INTO ${this.tableName} 
        (text, embedding, source, title, heading, checksum, fetched_at, chunk_type)
        VALUES ($1, $2::vector, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (source, checksum) DO UPDATE SET
        text = EXCLUDED.text,
        embedding = EXCLUDED.embedding,
        created_at = CURRENT_TIMESTAMP
        RETURNING id
      `;
      
      const ids = [];
      for (const chunk of uniqueChunks) {
        const result = await client.query(query, [
          chunk.text,
          '[' + chunk.embedding.join(',') + ']',
          chunk.metadata.source,
          chunk.metadata.title,
          chunk.metadata.heading,
          chunk.metadata.checksum,
          chunk.metadata.fetchedAt,
          chunk.metadata.chunkType
        ]);
        ids.push(result.rows[0].id);
      }
      
      // Commit transaction
      await client.query('COMMIT');
      console.log(`   💾 Transaction committed: ${ids.length} chunks stored`);
      
      return ids;
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      console.error(`   ❌ Transaction rolled back:`, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Search for similar vectors
   */
  async search(queryVector, options = {}) {
    const { topK = 5, filter = {} } = options;
    
    const client = await this.pool.connect();
    try {
      // Build filter conditions
      let whereClause = '';
      const params = [JSON.stringify(queryVector), topK];
      let paramIndex = 3;
      
      if (filter.source) {
        whereClause += ` AND source = $${paramIndex++}`;
        params.push(filter.source);
      }
      
      const query = `
        SELECT 
          id,
          text,
          source,
          title,
          heading,
          1 - (embedding <=> $1::vector) as similarity
        FROM ${this.tableName}
        WHERE 1=1 ${whereClause}
        ORDER BY embedding <=> $1::vector
        LIMIT $2
      `;
      
      const result = await client.query(query, params);
      return result.rows.map(row => ({
        id: row.id,
        text: row.text,
        metadata: {
          source: row.source,
          title: row.title,
          heading: row.heading
        },
        score: parseFloat(row.similarity)
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Clear all data
   */
  async clear() {
    const client = await this.pool.connect();
    try {
      await client.query(`TRUNCATE TABLE ${this.tableName}`);
      console.log('Vector store cleared');
    } finally {
      client.release();
    }
  }

  /**
   * Get statistics
   */
  async getStats() {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total_chunks,
          COUNT(DISTINCT source) as total_sources
        FROM ${this.tableName}
      `);
      return result.rows[0];
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

module.exports = VectorStore;
