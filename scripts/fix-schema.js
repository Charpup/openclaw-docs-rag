#!/usr/bin/env node
/**
 * 修复 docs-rag 数据库 schema - 添加 ON CONFLICT 需要的唯一约束
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

async function fixSchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing docs-rag database schema...\n');
    
    // Check if constraint already exists
    console.log('Step 1: Checking existing constraints...');
    const constraintCheck = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = '${TABLE_NAME}' 
      AND constraint_type = 'UNIQUE'
    `);
    
    console.log('Existing unique constraints:', constraintCheck.rows.map(r => r.constraint_name));
    
    // Drop existing data (clean slate for sync restart)
    console.log('\nStep 2: Clearing existing data (clean restart)...');
    await client.query(`TRUNCATE TABLE ${TABLE_NAME}`);
    console.log('✅ Table cleared\n');
    
    // Add unique constraint
    console.log('Step 3: Adding unique constraint (source, checksum)...');
    await client.query(`
      ALTER TABLE ${TABLE_NAME} 
      ADD CONSTRAINT unique_source_checksum 
      UNIQUE (source, checksum)
    `);
    console.log('✅ Unique constraint added\n');
    
    // Create index on checksum
    console.log('Step 4: Creating checksum index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_checksum 
      ON ${TABLE_NAME}(checksum)
    `);
    console.log('✅ Checksum index created\n');
    
    // Verify
    console.log('Step 5: Verifying schema...');
    const verify = await client.query(`
      SELECT constraint_name, column_name
      FROM information_schema.constraint_column_usage
      WHERE table_name = '${TABLE_NAME}'
      AND constraint_name = 'unique_source_checksum'
    `);
    console.log('Constraint columns:', verify.rows.map(r => r.column_name));
    
    console.log('\n✅ Schema fix complete! Ready for sync restart.');
    
  } catch (error) {
    console.error('❌ Schema fix failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixSchema()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
