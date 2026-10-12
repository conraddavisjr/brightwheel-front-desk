import "server-only";

/**
 * The only module that reads environment variables. Everything else imports
 * `config`, so a missing or misnamed variable shows up in one place.
 */

function optional(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

function int(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export const config = {
  appUrl: optional("APP_URL", "http://localhost:3000").replace(/\/$/, ""),
  supabase: {
    url: optional("SUPABASE_URL", "http://127.0.0.1:55421"),
    serviceKey: optional("SUPABASE_SERVICE_ROLE_KEY"),
  },
  sessionSecret: optional("SESSION_SECRET", "local-dev-session-secret-change-me-0123456789"),
  tokenKey: optional("TOKEN_ENCRYPTION_KEY", "local-dev-token-key-change-me-0123456789abcdef"),

  ai: {
    /** Empty means every model call runs on the deterministic stubs in lib/ai/stub.ts. */
    geminiKey: optional("GEMINI_API_KEY"),
    answerModel: optional("AI_ANSWER_MODEL", "gemini-3.5-flash"),
    classifierModel: optional("AI_CLASSIFIER_MODEL", "gemini-3.5-flash-lite"),
    embeddingModel: optional("AI_EMBEDDING_MODEL", "gemini-embedding-001"),
    ttsModel: optional("AI_TTS_MODEL", "gemini-3.8-flash-lite-tts"),
    ttsVoice: optional("AI_TTS_VOICE", "Aoede"),
    /** Hard cap on model calls per UTC day across the whole demo, so a busy day stays on the free tier. */
    dailyCallCap: int("AI_DAILY_CALL_CAP", 1200),
    /** Force stubs even with a key (e2e, evals in CI). */
    forceStub: optional("AI_STUB") === "1",
  },

  limits: {
    /** Questions per parent (or per IP when signed out) per 10 minutes. */
    askPer10Min: int("ASK_LIMIT_PER_10_MIN", 30),
    askPerDayPerIp: int("ASK_LIMIT_PER_DAY_PER_IP", 300),
    questionMaxChars: 500,
  },

  integrations: {
    notion: {
      clientId: optional("NOTION_CLIENT_ID"),
      clientSecret: optional("NOTION_CLIENT_SECRET"),
    },
    google: {
      clientId: optional("GOOGLE_CLIENT_ID"),
      clientSecret: optional("GOOGLE_CLIENT_SECRET"),
      /** Browser key for the Drive Picker (restricted to our origin). */
      pickerApiKey: optional("GOOGLE_PICKER_API_KEY"),
      appId: optional("GOOGLE_APP_ID"),
    },
    slack: {
      botToken: optional("SLACK_BOT_TOKEN"),
      signingSecret: optional("SLACK_SIGNING_SECRET"),
      channelId: optional("SLACK_CHANNEL_ID"),
    },
  },

  eval: {
    enabled: optional("EVAL_ENABLED") === "true",
    secret: optional("EVAL_SECRET"),
  },
  cronSecret: optional("CRON_SECRET"),
} as const;

export const aiLive = () => Boolean(config.ai.geminiKey) && !config.ai.forceStub;
