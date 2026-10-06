-- Feed search matches regardless of accents ("zluva" finds "Žluva").
-- unaccent ships with Postgres and is a trusted extension, so the app's own
-- database role can enable it.
CREATE EXTENSION IF NOT EXISTS "unaccent";
