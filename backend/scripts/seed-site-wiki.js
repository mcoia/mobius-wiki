const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seedSiteWiki() {
  try {
    const seedSQL = fs.readFileSync('./seeds/002_site_wiki.sql', 'utf8');

    await pool.query(seedSQL);
    console.log('✅ Site wiki seed data inserted successfully');

    const wikiResult = await pool.query(
      'SELECT id, title, slug FROM wiki.wikis WHERE slug = $1',
      ['site']
    );
    console.log('Site wiki created:', wikiResult.rows[0]);

    const pagesResult = await pool.query(
      `SELECT p.id, p.title, p.slug, s.slug as section_slug
       FROM wiki.pages p
       JOIN wiki.sections s ON p.section_id = s.id
       WHERE s.wiki_id = $1
       ORDER BY p.id`,
      [wikiResult.rows[0].id]
    );

    console.log('Pages created:', pagesResult.rowCount);
    pagesResult.rows.forEach(page => {
      console.log(`  - /wiki/site/${page.section_slug}/${page.slug} - ${page.title}`);
    });

    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

seedSiteWiki();
