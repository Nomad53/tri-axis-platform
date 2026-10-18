# Tri Axis v0.1.3 — Live Discovery Foundation

Current scope:
- Supabase-backed prospect database
- Dashboard counters
- Live company discovery search
- Evidence snippets and source URLs
- Candidate review before save
- Duplicate protection on save
- Saved prospect filtering

## Environment variables

Existing:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

New for live discovery:
- TAVILY_API_KEY

`TAVILY_API_KEY` must be added in Vercel as a Secret environment variable. Do not prefix it with `NEXT_PUBLIC_`.

## Discovery philosophy

Search results are candidates, not verified customers. Tri Axis shows the source and evidence first, and a user explicitly saves a candidate after review.
