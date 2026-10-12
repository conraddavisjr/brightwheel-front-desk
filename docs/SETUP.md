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

1. Create a free project at https://supabase.com/dashboard (region: us-west).
2. Copy the project URL and the `service_role` key (Project Settings > API).
3. Locally: `npx supabase link --project-ref <ref>` then `npx supabase db push`, then `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed`.

## 3. Notion public integration (OAuth)

1. https://www.notion.so/profile/integrations > New integration > type **Public**.
2. Name: "Front Desk (prototype)". Capabilities: Read content only. No user info with email needed.
3. Redirect URIs: `https://front-desk-prototype.vercel.app/api/integrations/notion/callback` and `http://localhost:3000/api/integrations/notion/callback`.
4. Copy the OAuth client ID and secret into `NOTION_CLIENT_ID` and `NOTION_CLIENT_SECRET`.

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

## 5. Slack app (optional, for gap alerts with an Answer button)

1. https://api.slack.com/apps > Create New App > From a manifest, pick your workspace, paste `docs/slack-manifest.json`.
2. Install to the workspace, invite the bot to a channel (`/invite @Front Desk`), and copy:
   the Bot User OAuth token into `SLACK_BOT_TOKEN`, the Signing Secret into `SLACK_SIGNING_SECRET`, and the channel ID into `SLACK_CHANNEL_ID`.

## 6. Vercel

`vercel link`, then add every variable above plus `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY` (32+ random characters each), `APP_URL` and `CRON_SECRET`, then `vercel deploy`.
