const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seedSetup() {
  try {
    console.log('🌱 Loading setup data...');

    const sql = fs.readFileSync('./seeds/001_setup_data.sql', 'utf8');
    await pool.query(sql);

    console.log('✅ Setup data loaded successfully');

    // Show what was created
    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM wiki.libraries) as libraries,
        (SELECT COUNT(*) FROM wiki.users) as users,
        (SELECT COUNT(*) FROM wiki.wikis) as wikis,
        (SELECT COUNT(*) FROM wiki.sections) as sections,
        (SELECT COUNT(*) FROM wiki.pages) as pages
    `);

    console.log('\n📊 Database summary:');
    console.log(`  Libraries: ${counts.rows[0].libraries}`);
    console.log(`  Users: ${counts.rows[0].users}`);
    console.log(`  Wikis: ${counts.rows[0].wikis} (Folio, OpenRS, Site)`);
    console.log(`  Sections: ${counts.rows[0].sections}`);
    console.log(`  Pages: ${counts.rows[0].pages}`);

    // Show Site wiki home page
    const homePage = await pool.query(`
      SELECT '/wiki/' || w.slug || '/' || s.slug || '/' || p.slug as path
      FROM wiki.pages p
      JOIN wiki.sections s ON p.section_id = s.id
      JOIN wiki.wikis w ON s.wiki_id = w.id
      WHERE w.slug = 'site' AND s.slug = 'main' AND p.slug = 'home'
    `);

    if (homePage.rowCount > 0) {
      console.log(`\n🏠 Platform home: ${homePage.rows[0].path}`);
    }

    await pool.end();
  } catch (err) {
    console.error('❌ Error loading setup data:', err.message);
    await pool.end();
    process.exit(1);
  }
}

seedSetup();
