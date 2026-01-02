# Article Worker (Railway)

## What it does
- Polls Supabase `article_jobs` table
- Claims one pending job atomically (`claim_next_article_job`)
- Runs Firecrawl deep research + agent
- Stores final article JSON into `articles.doc`
- Updates job status to completed/failed

## Required env vars
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- FIRECRAWL_API_KEY
- SITE_BASE_URL (optional)

## Railway
- Create new Railway project
- Deploy from GitHub repo
- Add env vars above
- Set start command: `npm run build && npm start`
