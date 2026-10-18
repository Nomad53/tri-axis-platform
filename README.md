# Tri Axis v0.1.1 — Supabase Connected

First working milestone for Tri Axis Supply Company.

## Current scope
- Dashboard
- Prospect discovery workspace
- Industry/city/relevance filtering
- Evidence-first prospect cards
- High/Medium/Low relevance model
- Duplicate protection utility
- Supabase-backed prospect API
- Responsive UI

## Deliberately not included yet
- Contact intelligence
- Email automation
- RFQ processing
- Quotations
- Orders / receivables
- Supplier management
- AI assistant

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000

## Next build
Supabase persistence is now connected. Next build: add the first live discovery provider and write validated prospects into the companies table.


## Environment variables

Set these in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The app reads the `public.companies` table through Supabase REST.
