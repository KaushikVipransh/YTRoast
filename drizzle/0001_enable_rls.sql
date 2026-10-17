-- Supabase serves public tables through its Data API (anon key). RLS with no policies denies that path entirely;
-- the app connects as the table owner through the pooler and is unaffected.
ALTER TABLE "roasts" ENABLE ROW LEVEL SECURITY;
