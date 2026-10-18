TRI AXIS v0.1.4
Company Entity Discovery

WHAT THIS VERSION CHANGES

The discovery engine no longer treats raw web-search results as companies.

The new server-side discovery route explicitly:

1. Builds multiple targeted search queries.
2. Retrieves raw Tavily search results.
3. Rejects jobs, careers, social media, PDFs, news, directories, rankings, top-company lists, generic reports, startup lists, and other obvious non-company pages.
4. Deduplicates domains before deeper inspection.
5. Fetches each remaining page where possible.
6. Extracts page title, description, and readable text.
7. Resolves a possible company name.
8. Requires both company identity evidence and industrial-operation evidence.
9. Classifies business type using explicit words found on the page.
10. Assigns industrial relevance only after the company/entity checks.
11. Deduplicates again using company name and domain.
12. Returns no more than 10 reviewable company candidates.
13. Saves nothing automatically.

FILES TO REPLACE

1. app/api/discover/route.js
   Use: tri-axis-v0.1.4-discover-route.txt

2. app/discover/page.js
   Use: tri-axis-v0.1.4-discover-page.txt

3. app/layout.js
   Use: tri-axis-v0.1.4-layout.txt

4. package.json
   Use: tri-axis-v0.1.4-package-json.txt

ENVIRONMENT VARIABLE REQUIRED

TAVILY_API_KEY

The key must be configured as a Vercel server-side Secret.
Do not prefix it with NEXT_PUBLIC_.

VALIDATION TEST

Industry:
Engineering & Fabrication

City:
Karachi

Expected behavior:
The page should return a short list of identifiable companies with company names, website links, business type, evidence, source type, and relevance.

Unacceptable results:
- job pages
- "Top companies..." articles
- generic lists
- directories shown as if they are companies
- market reports
- careers pages
- competitor articles
- social media pages

If no page satisfies the evidence rules, returning 0 companies is correct. The system should never invent a company just to fill the screen.
