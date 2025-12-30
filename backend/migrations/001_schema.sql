-- =============================================================================
-- MOBIUS Wiki - Complete Database Schema (Corrected)
-- =============================================================================
-- This file creates all 14 tables for the MOBIUS Wiki platform
--
-- Tables:
--   1. libraries          - Member library organizations
--   2. users              - User accounts with roles
--   3. wikis              - Top-level wiki containers
--   4. sections           - Organizational groupings within wikis
--   5. pages              - Actual content with full-text search
--   6. page_versions      - Full-snapshot version history
--   7. tags               - Content tags
--   8. page_tags          - Page-to-tag many-to-many junction
--   9. files              - First-class file entities
--  10. file_links         - Polymorphic file linking
--  11. access_rules       - Polymorphic ACL
--  12. page_views         - Page view tracking
--  13. redirects          - 301 redirects for slug changes
--  14. sessions           - PostgreSQL session storage
-- =============================================================================

-- =============================================================================
-- 1. LIBRARIES TABLE
-- =============================================================================
-- Member library organizations
-- Note: Audit FKs (created_by, updated_by, deleted_by) added later via ALTER TABLE

CREATE TABLE wiki.libraries (
                           id SERIAL PRIMARY KEY,
                           name VARCHAR(255) NOT NULL,
                           slug VARCHAR(255) NOT NULL UNIQUE,
                           created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                           updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                           created_by INTEGER,
                           updated_by INTEGER,
                           deleted_at TIMESTAMP,
                           deleted_by INTEGER
);

CREATE INDEX idx_libraries_slug ON wiki.libraries(slug);
CREATE INDEX idx_libraries_deleted_at ON wiki.libraries(deleted_at);

-- =============================================================================
-- 2. USERS TABLE
-- =============================================================================
-- User accounts with roles (library_staff, mobius_staff, site_admin)

CREATE TABLE wiki.users (
                       id SERIAL PRIMARY KEY,
                       email VARCHAR(255) NOT NULL UNIQUE,
                       password_hash VARCHAR(255) NOT NULL,
                       name VARCHAR(255) NOT NULL,
                       role VARCHAR(20) NOT NULL CHECK (role IN ('library_staff', 'mobius_staff', 'site_admin')),
                       library_id INTEGER REFERENCES wiki.libraries(id) ON DELETE SET NULL,
                       is_active BOOLEAN NOT NULL DEFAULT true,
                       created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                       updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                       created_by INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL,
                       updated_by INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL,
                       deleted_at TIMESTAMP,
                       deleted_by INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_users_email ON wiki.users(email);
CREATE INDEX idx_users_library_id ON wiki.users(library_id);
CREATE INDEX idx_users_role ON wiki.users(role);
CREATE INDEX idx_users_deleted_at ON wiki.users(deleted_at);

-- =============================================================================
-- Add deferred foreign keys from libraries -> users
-- =============================================================================

ALTER TABLE wiki.libraries
    ADD CONSTRAINT fk_libraries_created_by FOREIGN KEY (created_by) REFERENCES wiki.users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_libraries_updated_by FOREIGN KEY (updated_by) REFERENCES wiki.users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_libraries_deleted_by FOREIGN KEY (deleted_by) REFERENCES wiki.users(id) ON DELETE SET NULL;

-- =============================================================================
-- 3. WIKIS TABLE
-- =============================================================================
-- Top-level wiki containers

CREATE TABLE wiki.wikis (
                       id SERIAL PRIMARY KEY,
                       title VARCHAR(255) NOT NULL,
                       slug VARCHAR(255) NOT NULL UNIQUE,
                       description TEXT,
                       sort_order INTEGER NOT NULL DEFAULT 0,
                       created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                       updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                       created_by INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL,
                       updated_by INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL,
                       deleted_at TIMESTAMP,
                       deleted_by INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_wikis_slug ON wiki.wikis(slug);
CREATE INDEX idx_wikis_deleted_at ON wiki.wikis(deleted_at);

-- =============================================================================
-- 4. SECTIONS TABLE
-- =============================================================================
-- Organizational groupings within wikis

CREATE TABLE wiki.sections (
                          id SERIAL PRIMARY KEY,
                          wiki_id INTEGER NOT NULL REFERENCES wiki.wikis(id) ON DELETE CASCADE,
                          title VARCHAR(255) NOT NULL,
                          slug VARCHAR(255) NOT NULL,
                          description TEXT,
                          sort_order INTEGER NOT NULL DEFAULT 0,
                          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                          created_by INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL,
                          updated_by INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL,
                          deleted_at TIMESTAMP,
                          deleted_by INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL,
                          UNIQUE(wiki_id, slug)
);

CREATE INDEX idx_sections_wiki_id ON wiki.sections(wiki_id);
CREATE INDEX idx_sections_wiki_slug ON wiki.sections(wiki_id, slug);
CREATE INDEX idx_sections_deleted_at ON wiki.sections(deleted_at);

-- =============================================================================
-- 5. PAGES TABLE
-- =============================================================================
-- Actual content with full-text search

CREATE TABLE wiki.pages (
                       id SERIAL PRIMARY KEY,
                       section_id INTEGER NOT NULL REFERENCES wiki.sections(id) ON DELETE CASCADE,
                       title VARCHAR(255) NOT NULL,
                       slug VARCHAR(255) NOT NULL,
                       content TEXT NOT NULL DEFAULT '',
                       scripts TEXT DEFAULT NULL,
                       allow_scripts BOOLEAN NOT NULL DEFAULT false,
                       status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
                       sort_order INTEGER NOT NULL DEFAULT 0,
                       published_at TIMESTAMP,
                       search_vector TSVECTOR,
                       created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                       updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                       created_by INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL,
                       updated_by INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL,
                       deleted_at TIMESTAMP,
                       deleted_by INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL,
                       UNIQUE(section_id, slug)
);

CREATE INDEX idx_pages_section_id ON wiki.pages(section_id);
CREATE INDEX idx_pages_section_slug ON wiki.pages(section_id, slug);
CREATE INDEX idx_pages_status ON wiki.pages(status);
CREATE INDEX idx_pages_deleted_at ON wiki.pages(deleted_at);
CREATE INDEX idx_pages_search_vector ON wiki.pages USING GIN(search_vector);

-- Trigger function to auto-update search_vector
CREATE OR REPLACE FUNCTION pages_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
                                     COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, '')
                         );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pages_search_vector_trigger
    BEFORE INSERT OR UPDATE ON wiki.pages
    FOR EACH ROW EXECUTE FUNCTION pages_search_vector_update();

-- =============================================================================
-- 6. PAGE_VERSIONS TABLE
-- =============================================================================
-- Full-snapshot version history (permanent, no soft delete)
-- Note: created_by is nullable to allow ON DELETE SET NULL

CREATE TABLE wiki.page_versions (
                               id SERIAL PRIMARY KEY,
                               page_id INTEGER NOT NULL REFERENCES wiki.pages(id) ON DELETE CASCADE,
                               content TEXT NOT NULL,
                               scripts TEXT DEFAULT NULL,
                               title VARCHAR(255) NOT NULL,
                               version_number INTEGER NOT NULL,
                               created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                               created_by INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL,
                               UNIQUE(page_id, version_number)
);

CREATE INDEX idx_page_versions_page_id ON wiki.page_versions(page_id);

-- =============================================================================
-- 7. TAGS TABLE
-- =============================================================================
-- Content tags

CREATE TABLE wiki.tags (
                      id SERIAL PRIMARY KEY,
                      name VARCHAR(255) NOT NULL,
                      slug VARCHAR(255) NOT NULL UNIQUE,
                      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                      created_by INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_tags_slug ON wiki.tags(slug);

-- =============================================================================
-- 8. PAGE_TAGS TABLE
-- =============================================================================
-- Page-to-tag many-to-many junction

CREATE TABLE wiki.page_tags (
                           page_id INTEGER NOT NULL REFERENCES wiki.pages(id) ON DELETE CASCADE,
                           tag_id INTEGER NOT NULL REFERENCES wiki.tags(id) ON DELETE CASCADE,
                           PRIMARY KEY (page_id, tag_id)
);

CREATE INDEX idx_page_tags_page_id ON wiki.page_tags(page_id);
CREATE INDEX idx_page_tags_tag_id ON wiki.page_tags(tag_id);

-- =============================================================================
-- 9. FILES TABLE
-- =============================================================================
-- First-class file entities
-- Note: uploaded_by is nullable to allow ON DELETE SET NULL

CREATE TABLE wiki.files (
                       id SERIAL PRIMARY KEY,
                       filename VARCHAR(255) NOT NULL,
                       storage_path VARCHAR(500) NOT NULL,
                       mime_type VARCHAR(100) NOT NULL,
                       size_bytes INTEGER NOT NULL,
                       uploaded_by INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL,
                       uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
                       created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                       updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                       deleted_at TIMESTAMP,
                       deleted_by INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_files_uploaded_by ON wiki.files(uploaded_by);
CREATE INDEX idx_files_deleted_at ON wiki.files(deleted_at);

-- =============================================================================
-- 10. FILE_LINKS TABLE
-- =============================================================================
-- Polymorphic file linking (wiki/section/page/user)
-- Note: linkable_id cannot have FK constraint due to polymorphic nature;
--       enforce referential integrity at application layer

CREATE TABLE wiki.file_links (
                            id SERIAL PRIMARY KEY,
                            file_id INTEGER NOT NULL REFERENCES wiki.files(id) ON DELETE CASCADE,
                            linkable_type VARCHAR(20) NOT NULL CHECK (linkable_type IN ('wiki', 'section', 'page', 'user')),
                            linkable_id INTEGER NOT NULL,
                            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                            created_by INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL,
                            UNIQUE(file_id, linkable_type, linkable_id)
);

CREATE INDEX idx_file_links_file_id ON wiki.file_links(file_id);
CREATE INDEX idx_file_links_linkable ON wiki.file_links(linkable_type, linkable_id);

-- =============================================================================
-- 11. ACCESS_RULES TABLE
-- =============================================================================
-- Polymorphic ACL with 5 rule types (public, link, role, library, user)
-- Note: ruleable_id cannot have FK constraint due to polymorphic nature;
--       enforce referential integrity at application layer

CREATE TABLE wiki.access_rules (
                              id SERIAL PRIMARY KEY,
                              ruleable_type VARCHAR(20) NOT NULL CHECK (ruleable_type IN ('wiki', 'section', 'page', 'file')),
                              ruleable_id INTEGER NOT NULL,
                              rule_type VARCHAR(20) NOT NULL CHECK (rule_type IN ('public', 'link', 'role', 'library', 'user')),
                              rule_value VARCHAR(255),
                              expires_at TIMESTAMP,
                              created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                              created_by INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL,
                              UNIQUE(ruleable_type, ruleable_id, rule_type, rule_value)
);

CREATE INDEX idx_access_rules_ruleable ON wiki.access_rules(ruleable_type, ruleable_id);
CREATE INDEX idx_access_rules_type ON wiki.access_rules(rule_type);

-- =============================================================================
-- 12. PAGE_VIEWS TABLE
-- =============================================================================
-- Page view tracking (permanent, no soft delete)
-- Consider partitioning by viewed_at for high-volume deployments

CREATE TABLE wiki.page_views (
                            id SERIAL PRIMARY KEY,
                            page_id INTEGER NOT NULL REFERENCES wiki.pages(id) ON DELETE CASCADE,
                            user_id INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL,
                            viewed_at TIMESTAMP NOT NULL DEFAULT NOW(),
                            session_id VARCHAR(255),
                            referrer VARCHAR(500)
);

CREATE INDEX idx_page_views_page_id ON wiki.page_views(page_id);
CREATE INDEX idx_page_views_user_id ON wiki.page_views(user_id);
CREATE INDEX idx_page_views_viewed_at ON wiki.page_views(viewed_at);

-- =============================================================================
-- 13. REDIRECTS TABLE
-- =============================================================================
-- 301 redirects for slug changes (permanent, no soft delete)

CREATE TABLE wiki.redirects (
                           id SERIAL PRIMARY KEY,
                           old_path VARCHAR(500) NOT NULL UNIQUE,
                           new_path VARCHAR(500) NOT NULL,
                           created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                           created_by INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL
);

-- Note: UNIQUE constraint on old_path already creates an index;
--       explicit unique index is redundant but kept for clarity
CREATE INDEX idx_redirects_old_path ON wiki.redirects(old_path);

-- =============================================================================
-- 14. SESSIONS TABLE
-- =============================================================================
-- PostgreSQL session storage for connect-pg-simple
-- Note: Run periodic cleanup job: DELETE FROM wiki.sessions WHERE expire < NOW()

CREATE TABLE wiki.sessions (
                          sid VARCHAR(255) PRIMARY KEY,
                          sess JSON NOT NULL,
                          expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX idx_sessions_expire ON wiki.sessions(expire);

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
