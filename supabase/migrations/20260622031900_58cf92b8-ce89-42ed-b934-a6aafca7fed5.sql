-- Drop unused Supabase-side tables.
-- These were scaffolded but never read or written by the client.
-- The authoritative copies live in the Rust state store (op-web) and
-- identity sled. Auth identity is the caller's WireGuard public key,
-- so Supabase auth-linked tables (user_roles, user_keypairs) are also
-- unused and removed.

DROP TABLE IF EXISTS public.alerts CASCADE;
DROP TABLE IF EXISTS public.dbus_objects CASCADE;
DROP TABLE IF EXISTS public.logs CASCADE;
DROP TABLE IF EXISTS public.nodes CASCADE;
DROP TABLE IF EXISTS public.saved_queries CASCADE;
DROP TABLE IF EXISTS public.services CASCADE;
DROP TABLE IF EXISTS public.traces CASCADE;
DROP TABLE IF EXISTS public.user_keypairs CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- Drop the helper functions tied to the removed tables.
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.setup_new_user(uuid, text, text) CASCADE;

-- Drop the app_role enum (no longer referenced).
DROP TYPE IF EXISTS public.app_role CASCADE;
