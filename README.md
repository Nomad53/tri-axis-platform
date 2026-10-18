TRI AXIS v0.1.5
Prospect Table Discovery

WHY THIS VERSION EXISTS

The previous UI showed too much research text in large cards.
The user needs a prospect database, not a research report.

This version changes Discover into a compact company table aligned to the Supabase companies table.

LIVE CANDIDATE TABLE COLUMNS

company_name
website
industry
business_type
city
province
country
description
factory_evidence
industrial_relevance
source_url
source_type
status
last_checked
action

SEARCH SCOPE

If City contains a value:
Search that city.

If City is blank:
Search across Pakistan using multiple industrial-location queries.

Pakistan-wide search currently rotates through:
Karachi
Lahore
Faisalabad
Gujranwala
Sialkot
Rawalpindi
Islamabad
Multan
Hyderabad
Hub
Sheikhupura
Kasur

A single request is intentionally bounded.
The route currently returns up to 30 validated company candidates per batch rather than pretending one request can discover every industrial company in Pakistan.

IMPORTANT

Tavily is still a web-search source, not a corporate registry.

The code therefore:
- rejects obvious junk pages
- deduplicates domains
- inspects root websites
- extracts company identity
- requires industrial evidence
- maps the final record to Supabase columns
- saves nothing automatically

FILES

1. tri-axis-v0.1.5-discover-route.txt
   -> app/api/discover/route.js

2. tri-axis-v0.1.5-discover-page.txt
   -> app/discover/page.js

3. tri-axis-v0.1.5-css-addon.txt
   -> APPEND to app/globals.css

4. tri-axis-v0.1.5-layout.txt
   -> app/layout.js

5. tri-axis-v0.1.5-package-json.txt
   -> package.json
