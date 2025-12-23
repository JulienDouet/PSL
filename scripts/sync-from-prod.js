#!/usr/bin/env node

/**
 * Sync Supabase DEV database with production data
 * 
 * Usage:
 *   1. Create .env.local with DEV database URL
 *   2. Create .env.prod with PROD database URL
 *   3. Run: node scripts/sync-from-prod.js
 * 
 * This will:
 *   1. Dump all data from PROD Supabase
 *   2. Clear DEV Supabase tables (keeping schema)
 *   3. Import PROD data into DEV
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Helper to parse env file
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=["']?([^"'\n]+)["']?$/);
    if (match) env[match[1]] = match[2];
  });
  return env;
}

// Load URLs
const envLocal = parseEnvFile(path.join(process.cwd(), '.env.local'));
const envProd = parseEnvFile(path.join(process.cwd(), '.env.prod'));

const DEV_DATABASE_URL = envLocal.DATABASE_URL;
const PROD_DATABASE_URL = envProd.DATABASE_URL;

// Validation
if (!PROD_DATABASE_URL) {
  console.error('❌ PROD DATABASE_URL not found!');
  console.error('');
  console.error('Create a .env.prod file with:');
  console.error('  DATABASE_URL="postgresql://postgres:PASSWORD@aws-xxx.pooler.supabase.com:5432/postgres"');
  process.exit(1);
}

if (!DEV_DATABASE_URL) {
  console.error('❌ DEV DATABASE_URL not found in .env.local!');
  console.error('');
  console.error('Create a .env.local file with:');
  console.error('  DATABASE_URL="postgresql://postgres:PASSWORD@aws-xxx.pooler.supabase.com:5432/postgres"');
  process.exit(1);
}

if (PROD_DATABASE_URL === DEV_DATABASE_URL) {
  console.error('❌ PROD and DEV URLs are the same! This would overwrite production!');
  process.exit(1);
}

// Extract host from URLs for display (hide password)
function maskUrl(url) {
  try {
    const match = url.match(/@([^:\/]+)/);
    return match ? match[1] : 'unknown';
  } catch {
    return 'unknown';
  }
}

const prodHost = maskUrl(PROD_DATABASE_URL);
const devHost = maskUrl(DEV_DATABASE_URL);

console.log('═══════════════════════════════════════════════');
console.log('🔒 SAFETY CHECK');
console.log('═══════════════════════════════════════════════');
console.log('');
console.log(`  📤 SOURCE (READ ONLY):  ${prodHost}`);
console.log(`  📥 TARGET (WILL WRITE): ${devHost}`);
console.log('');
console.log('  ⚠️  This will ERASE all data in the DEV database');
console.log('      and replace it with PROD data.');
console.log('');
console.log('      PROD will NOT be modified (read only).');
console.log('');

// Confirmation interactive
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('  Type "sync" to confirm: ', (answer) => {
  rl.close();
  
  if (answer.toLowerCase() !== 'sync') {
    console.log('\n❌ Cancelled.');
    process.exit(0);
  }
  
  console.log('');
  runSync();
});

function runSync() {
  console.log('🔄 Syncing PROD → DEV Supabase databases...\n');

  const dumpFile = '/tmp/psl_prod_dump.sql';

  try {
    // Step 1: Dump production (schema + data)
    console.log('📤 Step 1/3: Dumping production database...');
    execSync(`pg_dump "${PROD_DATABASE_URL}" --clean --if-exists --no-owner --no-acl > ${dumpFile}`, {
      stdio: ['pipe', 'pipe', 'inherit']
    });
    console.log('   ✓ Dump complete\n');
    
    // Step 2: Apply migrations to DEV (ensure schema is up to date)
    console.log('🔧 Step 2/3: Applying migrations to DEV...');
    try {
      execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: DEV_DATABASE_URL }
      });
    } catch (e) {
      console.log('   ⚠ Migrations may have already been applied, continuing...\n');
    }
    
    // Step 3: Import dump into DEV
    console.log('📥 Step 3/3: Importing data into DEV...');
    execSync(`psql "${DEV_DATABASE_URL}" < ${dumpFile}`, {
      stdio: ['pipe', 'pipe', 'inherit']
    });
    console.log('   ✓ Import complete\n');
    
    // Cleanup
    fs.unlinkSync(dumpFile);
    
    console.log('═══════════════════════════════════════════════');
    console.log('✅ Sync complete!');
    console.log('═══════════════════════════════════════════════');
    console.log('');
    console.log('Your DEV Supabase database now has a copy of PROD data.');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run `npm run dev` to start the local server');
    console.log('  2. Test your changes safely!');
    console.log('');
    
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    
    if (error.message.includes('pg_dump') || error.message.includes('psql')) {
      console.error('\n💡 Make sure PostgreSQL client tools are installed:');
      console.error('   sudo apt install postgresql-client');
    }
    
    if (error.message.includes('connection')) {
      console.error('\n💡 Check your database URLs in .env.local and .env.prod');
      console.error('   Make sure you can connect to both databases.');
    }
    
    // Cleanup on error
    if (fs.existsSync(dumpFile)) {
      fs.unlinkSync(dumpFile);
    }
    
    process.exit(1);
  }
}
