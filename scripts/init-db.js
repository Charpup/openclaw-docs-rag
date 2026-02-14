/**
 * Database initialization script for docs-rag
 * Creates tables and indexes for OpenClaw documentation vector storage
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'memu_db',
  user: process.env.PGUSER || 'memu',
  password: process.env.MEMU_DB_PASSWORD || 'memu_secure_password'
});

const TABLE_NAME = 'openclaw_docs_chunks';

async function initDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Initializing docs-rag database...\n');
    
    // Enable pgvector extension
    console.log('Step 1: Enabling pgvector extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('✅ pgvector extension enabled\n');
    
    // Create docs table
    console.log('Step 2: Creating docs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        embedding VECTOR(1536),
        source VARCHAR(500),
        title VARCHAR(500),
        heading VARCHAR(500),
        checksum VARCHAR(32),
        fetched_at TIMESTAMP,
        chunk_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log(`✅ Table '${TABLE_NAME}' created\n`);
    
    // Create index for similarity search
    console.log('Step 3: Creating vector index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_embedding 
      ON ${TABLE_NAME} USING ivfflat (embedding vector_cosine_ops)
    `);
    console.log('✅ Vector index created\n');
    
    // Create index on source for filtering
    console.log('Step 4: Creating source index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_source 
      ON ${TABLE_NAME}(source)
    `);
    console.log('✅ Source index created\n');
    
    // Create unique constraint for upsert (ON CONFLICT support)
    console.log('Step 5: Creating unique constraint for checksum...');
    try {
      await client.query(`
        ALTER TABLE ${TABLE_NAME} 
        ADD CONSTRAINT unique_source_checksum 
        UNIQUE (source, checksum)
      `);
      console.log('✅ Unique constraint created\n');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('ℹ️  Unique constraint already exists\n');
      } else {
        throw e;
      }
    }
    
    // Create index on checksum for deduplication
    console.log('Step 6: Creating checksum index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_checksum 
      ON ${TABLE_NAME}(checksum)
    `);
    console.log('✅ Checksum index created\n');
    
    // Verify table structure
    console.log('Step 5: Verifying table structure...');
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = '${TABLE_NAME}'
      ORDER BY ordinal_position
    `);
    
    console.log('Table columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    console.log('\n✅ Database initialization complete!');
    
  } catch (error) {
    console.error('❌ Initialization failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { initDatabase, TABLE_NAME };
