-- SQLite cannot use CURRENT_TIMESTAMP as a default when adding a NOT NULL column
-- to a table that already has rows. Add nullable columns, backfill, then rely on
-- application inserts for new rows.
ALTER TABLE documents ADD COLUMN created_at TIMESTAMP;
UPDATE documents SET created_at = datetime('now') WHERE created_at IS NULL;
ALTER TABLE documents ADD COLUMN issued_date TIMESTAMP;
ALTER TABLE documents ADD COLUMN expire_date TIMESTAMP;
