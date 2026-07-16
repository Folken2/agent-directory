DROP INDEX IF EXISTS "idx_page_views_dedupe";
DROP INDEX IF EXISTS "idx_page_views_user_id";
DROP INDEX IF EXISTS "idx_page_views_is_bot";
DROP INDEX IF EXISTS "idx_page_views_visitor_id";
DROP INDEX IF EXISTS "idx_page_views_path";
DROP INDEX IF EXISTS "idx_page_views_country";
DROP INDEX IF EXISTS "idx_page_views_created_at";
DROP TABLE IF EXISTS "page_views";
