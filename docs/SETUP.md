# Setup: accounts and keys

Everything runs locally with no accounts at all (stubs for AI, seeded data for integrations).
These steps make the hosted demo fully live.
Each one is free.

The production URL is assumed to be `https://front-desk-prototype.vercel.app`.
If the name differs, replace it everywhere below.

## 1. Gemini API key (answers, embeddings, AI privacy review, voice)

1. Open https://aistudio.google.com/apikey and create a key in a project with no billing attached.
   With no billing, the key cannot spend money: past the free quota, calls fail and the app falls back to its free paths.
2. Put it in `.env.local` as `GEMINI_API_KEY=...` (and in Vercel later).

## 2. Supabase (hosted database)

Nothing to copy by hand.
The database comes from the Supabase integration in the Vercel Marketplace, which injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` into the Vercel project automatically.
Locally, `.env.local` points at the Docker stack from `npx supabase start` instead.
To run a script against production, pull the project's variables into a git-ignored file: `npx vercel env pull .env.vercel.production --environment production`.

## 3. Notion public integration (OAuth)

1. https://www.notion.so/profile/integrations > New integration > type **Public**.
2. Name: "Front Desk (prototype)". Capabilities: Read content only. No user info with email needed.
3. Redirect URIs: `https://front-desk-prototype.vercel.app/api/integrations/notion/callback` and `http://localhost:3000/api/integrations/notion/callback`.
4. Copy the OAuth client ID and secret into `NOTION_CLIENT_ID` and `NOTION_CLIENT_SECRET`.
5. So "Open in Notion" works for anyone, publish the two demo pages ("Front Desk demo · Sunflower Valley" and "Front Desk demo · Harbor Kids"): Share > Publish > Publish to web, with subpages included.
   Put the site's domain (for example `yourname.notion.site`) in `NOTION_PUBLIC_SITE` and reseed.
   The demo content is fictional, including the "staff-only" pages.

## 4. Google Cloud OAuth client (Drive Picker + Calendar)

1. https://console.cloud.google.com > new project "front-desk-prototype".
2. Enable APIs: Google Drive API, Google Picker API, Google Calendar API.
3. OAuth consent screen: External, app name "Front Desk (prototype)", testing mode.
   Scopes: `drive.file` (non-sensitive) and `calendar.readonly` (sensitive, fine in testing mode).
   Test users: your Google account, plus any interviewer emails you want to let connect their own calendar.
4. Credentials > OAuth client ID > Web application.
   Authorized JavaScript origins: the production URL and `http://localhost:3000`.
   Redirect URIs: `<origin>/api/integrations/google/callback` for both origins.
   Copy into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Credentials > API key, restricted to the Picker API and to the two origins.
   Copy into `GOOGLE_PICKER_API_KEY`.
   The project number (IAM & Admin > Settings) goes into `GOOGLE_APP_ID`.

## 5. Vercel

`vercel link`, then add every variable above plus `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY` (32+ random characters each), `APP_URL` and `CRON_SECRET`, then `vercel deploy`.
