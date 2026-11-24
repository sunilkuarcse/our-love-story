# Supabase setup

The app has no Supabase credentials in source control. Configure the project locally before signing in.

## Required project values

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` in the project root.
3. Set `VITE_SUPABASE_URL` to the project's Project URL.
4. Set `VITE_SUPABASE_ANON_KEY` to its publishable/anon key from Project Settings > API Keys.

The URL and publishable/anon key are browser-visible values. RLS is the security boundary. Do not put a `service_role` or secret key in any `VITE_` variable, source file, or browser code.

## Authorize two accounts

1. In Supabase Authentication > Providers, enable Email/Password and disable public sign-ups.
2. Create/invite exactly two users from the Supabase dashboard. Users set their own passwords through Auth; never add passwords to SQL or the app.
3. Copy both Auth user UUIDs from the dashboard.
4. Replace `REPLACE_WITH_FIRST_AUTH_USER_UUID` and `REPLACE_WITH_SECOND_AUTH_USER_UUID` at the bottom of `setup.sql` with those UUIDs.
5. Run `setup.sql` once in Supabase SQL Editor. It creates a new couple and allowlists those two IDs. The membership table has no client write policy and enforces a two-user maximum.
6. Add `http://localhost:5173/`, `http://127.0.0.1:5173/`, and the production origin to Authentication > URL Configuration > Redirect URLs. Set the production Site URL as well.
7. Configure Supabase Auth email delivery/SMTP for password-reset messages.

The authenticated client calls `current_couple_id()` before rendering the private homepage. If membership is missing or the schema has not been applied, access stays blocked.

## Local environment

Create `.env.local` (never commit it):

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Restart Vite after changing environment variables. In PowerShell, use `npm.cmd run dev` if the `npm` PowerShell shim is blocked by execution policy.

## Local memory migration

After signing in, use **Migrate local memories** in the site navigation. The migration copies IndexedDB photos, timeline events, letters, and the relationship start date to Supabase. It does not delete or alter local records. The migration uses local record IDs and photo SHA-256 hashes to skip repeated imports; photo uploads are limited to JPG/JPEG, PNG, or WEBP up to 10 MiB. Keep the browser open until it reports completion.

The local IndexedDB database remains available as a backup. Cloud mode uses Supabase after authentication; there is no automatic destructive local-data cleanup.

## Security model

- `couple_members` is seeded only by the project owner in SQL; clients have no insert, update, or delete policy for membership.
- RLS checks the authenticated user's couple membership for shared tables.
- The `couple-memories` bucket is private. Storage policies require the couple UUID as the first object-path segment.
- Photo access uses authenticated signed URLs; no object is public.
- Public account creation is not exposed by the app. Passwords are handled only by Supabase Auth.

Remote login, email reset delivery, RLS execution, and two-account synchronization require the project values, SQL setup, and both accounts above; those cannot be tested until a real Supabase project is configured.
