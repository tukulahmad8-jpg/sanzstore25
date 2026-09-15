# SanzStore25

Cloudflare Pages build settings:
- Root directory: repository root (leave empty)
- Build command: npm run build
- Build output directory: apps/web/dist
- Node.js: 22

Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Cloudflare production build environment before deployment. Only use the publishable/anon key, never service-role credentials.

Backend is managed separately in Supabase.
