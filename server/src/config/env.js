import dotenv from 'dotenv'

dotenv.config()

function required(name, fallback) {
  const value = process.env[name] ?? fallback
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',

  mongoUri: required('MONGO_URI', 'mongodb://127.0.0.1:27017/icmcp'),

  accessTokenSecret: required('ACCESS_TOKEN_SECRET', 'dev_access_secret_change_me'),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenSecret: required('REFRESH_TOKEN_SECRET', 'dev_refresh_secret_change_me'),
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || '7d',
  refreshTokenTtlMs: Number(process.env.REFRESH_TOKEN_TTL_MS) || 7 * 24 * 60 * 60 * 1000,

  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  // SECURITY (OWASP A05 — Security Misconfiguration): Express's
  // `trust proxy` setting controls whether `req.ip` / `X-Forwarded-For`
  // are trusted, which `express-rate-limit` relies on to key limits per
  // real client. Left disabled (`false`) by default — trusting forwarded
  // headers when the app is *not* actually behind a reverse proxy would
  // let any client spoof `X-Forwarded-For` and bypass rate limiting
  // entirely. Only enable this, with the correct hop count for your
  // infra, when genuinely deployed behind a reverse proxy/load balancer.
  trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : false,

  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  presignTtlMs: Number(process.env.PRESIGN_TTL_MS) || 5 * 60 * 1000,

  institutionName: process.env.INSTITUTION_NAME || 'Institution Name',
  institutionTagline:
    process.env.INSTITUTION_TAGLINE || 'Institutional Committee Management & Compliance Portal',

  // Free SMTP relay used to send OTP emails for email/password changes.
  // No third-party transactional-email service — just a Gmail account with
  // an "App Password" (Google Account → Security → 2-Step Verification →
  // App passwords). Leave unset in dev and OTPs are logged to the console
  // instead of actually being emailed.
  // SMTP_HOST/SMTP_PORT, when set, always win. Otherwise SMTP_PROVIDER
  // ('gmail' | 'office365' | 'outlook') picks the right host/port/TLS mode
  // — see utils/mailer.js for why Outlook/Office 365 needs different
  // settings than Gmail. Leaving both unset infers the provider from
  // SMTP_FROM/SMTP_USER's domain (an @outlook.com or tenant address will
  // automatically use the Office 365 preset).
  smtpProvider: process.env.SMTP_PROVIDER || '',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 0,
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  otpTtlMs: Number(process.env.OTP_TTL_MS) || 10 * 60 * 1000,
  resetTokenTtlMs: Number(process.env.RESET_TOKEN_TTL_MS) || 24 * 60 * 60 * 1000,

  // SCALE (item 3 — 50+ concurrent committees): bounds how many simultaneous
  // MongoDB connections the driver keeps open. Mongoose's own default
  // (100) is already generous, but it's made explicit/tunable here rather
  // than left implicit, since it's the first thing to raise if the DB host
  // has a lower connection ceiling (e.g. a shared Atlas free/shared tier).
  mongoMaxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 50,
  mongoMinPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE) || 2,

  // Default academic-year window used by bulk import when the sheet gives
  // no academic year (India: new academic year starts in June).
  bulkImportBatchTtlMs: Number(process.env.BULK_IMPORT_BATCH_TTL_MS) || 30 * 60 * 1000,
  bulkImportDefaultPassword: process.env.BULK_IMPORT_DEFAULT_PASSWORD || '01234567890'
}

/**
 * Security hardening (OWASP A05 - Security Misconfiguration / A07 -
 * Identification & Authentication Failures): the dev-mode fallback secrets
 * above exist purely so `npm run dev` works out of the box on a fresh
 * clone. They must never reach production. Fail loudly and refuse to
 * start rather than silently running an internet-facing deployment with
 * guessable JWT signing secrets.
 */
if (env.isProd) {
  const insecureDefaults = {
    ACCESS_TOKEN_SECRET: 'dev_access_secret_change_me',
    REFRESH_TOKEN_SECRET: 'dev_refresh_secret_change_me'
  }
  const stillDefault = Object.entries(insecureDefaults)
    .filter(([envVar, defaultValue]) => (process.env[envVar] ?? defaultValue) === defaultValue)
    .map(([envVar]) => envVar)

  if (stillDefault.length > 0) {
    throw new Error(
      `Refusing to start in production with insecure default secret(s): ${stillDefault.join(', ')}. ` +
        'Set these in your environment/.env before deploying — see server/.env.example.'
    )
  }
  if (env.accessTokenSecret.length < 32 || env.refreshTokenSecret.length < 32) {
    throw new Error(
      'ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must each be at least 32 characters in production.'
    )
  }
}
