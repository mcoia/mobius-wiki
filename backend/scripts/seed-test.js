const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seedTest() {
  try {
    console.log('🧪 Loading test data...');

    // Check if setup data exists first
    const setupCheck = await pool.query('SELECT COUNT(*) FROM wiki.wikis WHERE id <= 10');

    if (parseInt(setupCheck.rows[0].count) === 0) {
      console.error('❌ No setup data found. Please run "npm run db:seed" first.');
      await pool.end();
      process.exit(1);
    }

    const sql = fs.readFileSync('./seeds/002_test_data.sql', 'utf8');
    await pool.query(sql);

    console.log('✅ Test data loaded successfully');

    // Show summary
    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM wiki.libraries) as libraries,
        (SELECT COUNT(*) FROM wiki.users) as users,
        (SELECT COUNT(*) FROM wiki.wikis) as wikis,
        (SELECT COUNT(*) FROM wiki.sections) as sections,
        (SELECT COUNT(*) FROM wiki.pages) as pages
    `);

    console.log('\n📊 Total database records:');
    console.log(`  Libraries: ${counts.rows[0].libraries}`);
    console.log(`  Users: ${counts.rows[0].users}`);
    console.log(`  Wikis: ${counts.rows[0].wikis}`);
    console.log(`  Sections: ${counts.rows[0].sections}`);
    console.log(`  Pages: ${counts.rows[0].pages}`);

    await pool.end();
  } catch (err) {
    console.error('❌ Error loading test data:', err.message);
    await pool.end();
    process.exit(1);
  }
}

seedTest();
