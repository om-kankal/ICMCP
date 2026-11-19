import nodemailer from 'nodemailer'
import crypto from 'crypto'
import { env } from '../config/env.js'

let transporter = null

/**
 * PROVIDER PRESETS
 *
 * The previous version of this file hard-coded Gmail's host/port and
 * derived `secure` from `port === 465`. That happened to work for Gmail,
 * but is wrong for Outlook/Office 365: Microsoft's SMTP AUTH endpoint
 * (smtp.office365.com:587) uses STARTTLS, not implicit TLS, so it needs
 * `secure: false` *plus* `requireTLS: true` — without `requireTLS`,
 * Nodemailer will silently send unencrypted if the server doesn't upgrade,
 * which Microsoft's servers will simply reject/drop. This was the concrete
 * reason mail sent with an Outlook/Office 365 "from" account was not
 * arriving: the transporter was never configured for how Outlook's SMTP
 * actually authenticates.
 *
 * Set SMTP_PROVIDER=office365 (or leave SMTP_HOST/SMTP_PORT unset with an
 * @outlook.com/@hotmail.com/@office365-tenant SMTP_USER) to use these
 * defaults; SMTP_HOST/SMTP_PORT always override the preset if set.
 */
const PROVIDER_PRESETS = {
  gmail: { host: 'smtp.gmail.com', port: 465, secure: true, requireTLS: false },
  office365: { host: 'smtp.office365.com', port: 587, secure: false, requireTLS: true },
  outlook: { host: 'smtp-mail.outlook.com', port: 587, secure: false, requireTLS: true }
}

function resolveProviderPreset() {
  const explicit = (env.smtpProvider || '').toLowerCase()
  if (explicit && PROVIDER_PRESETS[explicit]) return PROVIDER_PRESETS[explicit]

  // No explicit provider set — infer from the "from" address's domain so an
  // Outlook/Office 365 mailbox gets the right defaults out of the box.
  const fromDomain = (env.smtpFrom || env.smtpUser || '').split('@')[1]?.toLowerCase() || ''
  if (/outlook\.com$|hotmail\.com$|live\.com$|office365\.com$|onmicrosoft\.com$/.test(fromDomain)) {
    return PROVIDER_PRESETS.office365
  }
  return PROVIDER_PRESETS.gmail
}

/**
 * Lazily builds the SMTP transporter. If SMTP_USER/SMTP_PASS aren't
 * configured (e.g. local dev), every send*Email() function below falls back
 * to logging to the console so flows stay testable without real email.
 */
function getTransporter() {
  if (!env.smtpUser || !env.smtpPass) return null
  if (!transporter) {
    const preset = resolveProviderPreset()
    const host = env.smtpHost || preset.host
    const port = env.smtpPort || preset.port
    // Only fall back to the preset's secure/requireTLS when the host/port
    // weren't explicitly overridden away from the preset — an explicit
    // SMTP_PORT still drives `secure` the historical way (465 → implicit TLS).
    const secure = env.smtpHost ? env.smtpPort === 465 : preset.secure
    const requireTLS = env.smtpHost ? env.smtpPort !== 465 : preset.requireTLS

    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS,
      auth: { user: env.smtpUser, pass: env.smtpPass },
      // A stable, resolvable HELO/EHLO name and pool settings matter for
      // deliverability at scale (bulk-import welcome emails can mean
      // dozens of sends in a row for 50+ committees) — pooled connections
      // avoid re-authenticating/re-handshaking on every single message.
      pool: true,
      maxConnections: 3,
      maxMessages: 50
    })
  }
  return transporter
}

/**
 * Dynamically resolves the current institution name set by the Admin in Settings,
 * falling back to env.institutionName.
 */
export async function getActiveInstitutionName() {
  try {
    const Settings = (await import('../models/Settings.js')).default
    const doc = await Settings.getSingleton()
    if (doc?.collegeName?.trim()) {
      return doc.collegeName.split('\n')[0].trim()
    }
  } catch {
    // Non-critical fallback
  }
  return env.institutionName || 'Institution Name'
}

/**
 * Every system email goes through here. Ensures envelope, Message-ID, and
 * deliverability headers match Outlook/SMTP requirements.
 */
async function send({ to, subject, html, text }) {
  const client = getTransporter()
  if (!client) {
    console.log(`[mail:dev-mode] No SMTP configured — would send "${subject}" to ${to}`)
    return { delivered: false, mode: 'console' }
  }

  const institutionName = await getActiveInstitutionName()
  const fromAddress = env.smtpFrom || env.smtpUser
  await client.sendMail({
    from: `"${institutionName}" <${fromAddress}>`,
    to,
    replyTo: fromAddress,
    subject,
    html,
    text: text || htmlToPlainText(html),
    // Explicit envelope so the SMTP MAIL FROM matches the authenticated
    // account exactly — a mismatch here is a common reason Outlook/Exchange
    // spam-folders a message even when the visible From header looks fine.
    envelope: { from: fromAddress, to },
    messageId: `<${crypto.randomUUID()}@${(fromAddress.split('@')[1] || 'icmcp.local')}>`,
    headers: { 'X-Mailer': 'ICMCP' }
  })

  return { delivered: true, mode: 'smtp' }
}

function htmlToPlainText(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const PURPOSE_COPY = {
  email_change: {
    subject: 'Confirm your new email address',
    heading: 'Confirm your new email address',
    body: 'Use the code below to confirm this is really you before we update your login email.'
  },
  password_change: {
    subject: 'Confirm your password change',
    heading: 'Confirm your password change',
    body: 'Use the code below to confirm this is really you before we update your password.'
  }
}

/**
 * Sends a 6-digit OTP for an email or password change.
 */
export async function sendOtpEmail(toEmail, otp, purpose) {
  const copy = PURPOSE_COPY[purpose] || PURPOSE_COPY.password_change
  const institutionName = await getActiveInstitutionName()
  return send({
    to: toEmail,
    subject: `${copy.subject} — ${institutionName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#1e344f;">${copy.heading}</h2>
        <p style="color:#334155;">${copy.body}</p>
        <p style="font-size:32px; font-weight:bold; letter-spacing:6px; color:#1e344f; margin:24px 0;">${otp}</p>
        <p style="color:#64748b; font-size:13px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
        <p style="color:#94a3b8; font-size:12px; margin-top:24px;">${institutionName}</p>
      </div>
    `
  })
}

/**
 * Sent once, to a user created via the Admin's bulk Excel import. Their
 * account starts on the shared default password — this link is how they
 * set their own before ever logging in with it.
 */
export async function sendWelcomeAccountEmail(toEmail, name, resetLink) {
  const institutionName = await getActiveInstitutionName()
  return send({
    to: toEmail,
    subject: `Your ${institutionName} account has been created`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#1e344f;">Welcome, ${escapeHtml(name)}</h2>
        <p style="color:#334155;">An account has been created for you on the ${escapeHtml(institutionName)} committee portal.</p>
        <p style="color:#334155;">For security, please set your own password before signing in:</p>
        <p style="margin:24px 0;">
          <a href="${resetLink}" style="background:#1e344f;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Set your password</a>
        </p>
        <p style="color:#64748b; font-size:13px;">This link expires in 24 hours. If the button doesn't work, copy and paste this URL into your browser:<br>${resetLink}</p>
        <p style="color:#94a3b8; font-size:12px; margin-top:24px;">${institutionName}</p>
      </div>
    `
  })
}

/** Sent when an Admin resets a user's password on their behalf via a link (as opposed to setting one directly). */
export async function sendPasswordResetLinkEmail(toEmail, name, resetLink) {
  const institutionName = await getActiveInstitutionName()
  return send({
    to: toEmail,
    subject: `Reset your ${institutionName} password`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#1e344f;">Password reset requested</h2>
        <p style="color:#334155;">Hello ${escapeHtml(name)}, an administrator has requested a password reset for your account.</p>
        <p style="margin:24px 0;">
          <a href="${resetLink}" style="background:#1e344f;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Reset your password</a>
        </p>
        <p style="color:#64748b; font-size:13px;">This link expires in 24 hours. If you didn't expect this, contact your administrator.</p>
        <p style="color:#94a3b8; font-size:12px; margin-top:24px;">${institutionName}</p>
      </div>
    `
  })
}

/**
 * Relays an in-portal email directly to the participants' real email accounts (e.g. Outlook)
 * via SMTP with full HTML formatting and direct reply-to the sender.
 */
export async function sendUserMail({
  fromUser,
  toEmails = [],
  ccEmails = [],
  bccEmails = [],
  subject,
  body
}) {
  const client = getTransporter()
  const allRecipients = [...new Set([...toEmails, ...ccEmails, ...bccEmails].filter(Boolean))]
  if (allRecipients.length === 0) return { delivered: false }

  if (!client) {
    console.log(
      `[mail:dev-mode] No SMTP configured — would relay email "${subject}" from ${fromUser?.email} to: ${allRecipients.join(', ')}`
    )
    return { delivered: false, mode: 'console' }
  }

  const institutionName = await getActiveInstitutionName()
  const fromAddress = env.smtpFrom || env.smtpUser

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
      <div style="padding: 12px 0; border-bottom: 2px solid #e2e8f0; margin-bottom: 20px;">
        <span style="font-size: 14px; font-weight: 700; color: #1e344f; text-transform: uppercase; letter-spacing: 0.5px;">
          ${escapeHtml(institutionName)}
        </span>
        <span style="font-size: 12px; color: #64748b; margin-left: 8px;">· Committee Portal</span>
      </div>
      <div style="white-space: pre-wrap; font-size: 15px; color: #0f172a; margin-bottom: 28px; line-height: 1.7;">
${escapeHtml(body || '')}
      </div>
      <div style="padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
        <p style="margin: 0 0 4px 0;"><strong>Sent by:</strong> ${escapeHtml(fromUser?.name || 'Portal User')} (${escapeHtml(fromUser?.role || 'Member')})</p>
        <p style="margin: 0 0 6px 0;"><strong>Sender email:</strong> <a href="mailto:${escapeHtml(fromUser?.email)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(fromUser?.email)}</a></p>
        <p style="margin: 10px 0 0 0; color: #94a3b8; font-size: 11px;">
          Replies to this email will be delivered directly to ${escapeHtml(fromUser?.name || 'the sender')} (${escapeHtml(fromUser?.email)}).
        </p>
      </div>
    </div>
  `

  await client.sendMail({
    from: `"${fromUser?.name || 'ICMCP'} via ${institutionName}" <${fromAddress}>`,
    to: toEmails.length ? toEmails : undefined,
    cc: ccEmails.length ? ccEmails : undefined,
    bcc: bccEmails.length ? bccEmails : undefined,
    replyTo: fromUser?.email ? `"${fromUser.name}" <${fromUser.email}>` : fromAddress,
    subject: subject || '(no subject)',
    html,
    text: body,
    envelope: { from: fromAddress, to: allRecipients },
    messageId: `<${crypto.randomUUID()}@${(fromAddress.split('@')[1] || 'icmcp.local')}>`,
    headers: {
      'X-Mailer': 'ICMCP',
      'X-Original-Sender': fromUser?.email || ''
    }
  })

  return { delivered: true, mode: 'smtp' }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

/**
 * SECURITY (CWE-338 — use of a weak PRNG in a security-sensitive context):
 * `Math.random()` is not cryptographically secure. OTPs gate email/password
 * changes, so the generator uses Node's CSPRNG-backed `crypto.randomInt`.
 */
export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000))
}

/** A URL-safe, unguessable token for password-reset links (see PasswordResetToken model). */
export function generateResetToken() {
  return crypto.randomBytes(32).toString('base64url')
}

export function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}
