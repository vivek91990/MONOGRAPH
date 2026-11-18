# MONOGRAPH

A calm, private-first personal finance workspace. Track income, expenses, budgets and savings goals.

## Stack

- React + Vite
- Supabase Auth, Postgres and Row Level Security
- Vercel deployment

## Local development

1. Install Node.js 20+.
2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable key.
3. Run `npm install` and `npm run dev`.

## Authentication

Accounts use a username and password. Registration is handled by the `register-username` Supabase Edge Function, which creates a Supabase Auth user with a reserved internal email alias. Passwords are handled by Supabase Auth and are never stored in application tables.

## Data isolation

All finance tables are protected by Row Level Security. Each row is scoped to `auth.uid()` and the client never uses a service-role key.

## Environment variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (Supabase publishable key)

Never place a Supabase service-role key in this repository or a browser environment variable.
