-- Phase 2: Project / CRM Module
-- Schema: freelancing_demo
-- Safe to re-run: adds missing columns if projects table already exists

-- ============================================================================
-- 1. PROJECTS TABLE (Kanban CRM)
-- ============================================================================

CREATE TABLE IF NOT EXISTS freelancing_demo.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns when table was created earlier without them
ALTER TABLE freelancing_demo.projects
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES freelancing_demo.clients(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'todo',
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS budget DECIMAL(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
    ADD COLUMN IF NOT EXISTS deadline DATE,
    ADD COLUMN IF NOT EXISTS external_link TEXT,
    ADD COLUMN IF NOT EXISTS gmail_message_id TEXT,
    ADD COLUMN IF NOT EXISTS email_sender TEXT;

-- Backfill defaults for existing rows
UPDATE freelancing_demo.projects SET status = 'todo' WHERE status IS NULL;
UPDATE freelancing_demo.projects SET source = 'manual' WHERE source IS NULL;
UPDATE freelancing_demo.projects SET budget = 0 WHERE budget IS NULL;
UPDATE freelancing_demo.projects SET currency = 'INR' WHERE currency IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON freelancing_demo.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON freelancing_demo.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_source ON freelancing_demo.projects(source);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON freelancing_demo.projects(client_id);

-- Only create after gmail_message_id column exists (added above)
DROP INDEX IF EXISTS freelancing_demo.idx_projects_user_gmail_msg;
CREATE UNIQUE INDEX idx_projects_user_gmail_msg
    ON freelancing_demo.projects(user_id, gmail_message_id)
    WHERE gmail_message_id IS NOT NULL;

-- ============================================================================
-- 2. PLATFORM CONNECTIONS (Upwork / Fiverr API credentials)
-- ============================================================================

CREATE TABLE IF NOT EXISTS freelancing_demo.platform_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform_name TEXT NOT NULL CHECK (platform_name IN ('upwork', 'fiverr')),
    api_key_encrypted TEXT,
    api_secret_encrypted TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    last_synced_at TIMESTAMPTZ,
    sync_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, platform_name)
);

ALTER TABLE freelancing_demo.platform_connections
    ADD COLUMN IF NOT EXISTS api_key_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS api_secret_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sync_notes TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_platform_connections_user ON freelancing_demo.platform_connections(user_id);

-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE freelancing_demo.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE freelancing_demo.platform_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own projects" ON freelancing_demo.projects;
CREATE POLICY "Users manage own projects" ON freelancing_demo.projects
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own platform connections" ON freelancing_demo.platform_connections;
CREATE POLICY "Users manage own platform connections" ON freelancing_demo.platform_connections
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON freelancing_demo.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON freelancing_demo.platform_connections TO authenticated;

-- ============================================================================
-- 4. UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION freelancing_demo.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_updated_at ON freelancing_demo.projects;
CREATE TRIGGER projects_updated_at
    BEFORE UPDATE ON freelancing_demo.projects
    FOR EACH ROW EXECUTE FUNCTION freelancing_demo.set_updated_at();

DROP TRIGGER IF EXISTS platform_connections_updated_at ON freelancing_demo.platform_connections;
CREATE TRIGGER platform_connections_updated_at
    BEFORE UPDATE ON freelancing_demo.platform_connections
    FOR EACH ROW EXECUTE FUNCTION freelancing_demo.set_updated_at();

COMMENT ON TABLE freelancing_demo.projects IS 'Kanban CRM projects — manual, Gmail, Upwork, Fiverr';
COMMENT ON TABLE freelancing_demo.platform_connections IS 'Encrypted Upwork/Fiverr API credentials per freelancer';
