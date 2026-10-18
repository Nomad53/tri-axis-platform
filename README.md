# Tri Axis v0.1.2 — Industrial Prospect Intelligence

Current working milestone for Tri Axis Supply Company.

## What changed in v0.1.2

- Correct dashboard metric logic
  - Companies Discovered = all saved companies
  - High Relevance = only `industrial_relevance = High`
  - Reviewed = only `status = Reviewed`
  - Cities Covered = unique, non-empty cities
- Better dashboard empty state
- Discover page loading and connection states
- Discover page no-match state
- Industry filter now includes industries found in live Supabase data
- More tolerant matching for status, relevance, industry and city values
- Existing Supabase connection remains unchanged

## Current scope

- Dashboard
- Supabase-backed prospect database
- Prospect discovery workspace
- Industry/city/relevance filtering
- Evidence-first prospect cards
- High/Medium/Low/Unknown relevance model
- Duplicate protection utility
- Responsive UI

## Deliberately not included yet

- Live company discovery provider
- Contact intelligence
- Email automation
- RFQ processing
- Quotations
- Orders / receivables
- Supplier management
- AI assistant

## Next milestone

Build the live Pakistan company discovery engine, validate the first 100 prospects, then freeze the discovery baseline.
