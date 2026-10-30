require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');

const app = express();

// ---------------- MIDDLEWARE & RATE LIMITING ---------------- //
const allowedOrigins = [
  'http://localhost:3000',
  'https://susansbeautyconsulting.com',
  'https://www.susansbeautyconsulting.com'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ Blocked unauthorized CORS request from origin: ${origin}`);
      callback(new Error('Access denied by CORS policy'));
    }
  },
  credentials: true
}));

// Surgically bypass express.json() for the Stripe webhook so it retains the raw buffer
app.use((req, res, next) => {
  if (req.originalUrl === '/webhook/stripe') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10, 
  message: 'Too many authentication attempts, please try again after 15 minutes'
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------- EMAIL TRANSPORTER & SECURITY HELPERS (IONOS SMTP + HTTPS FALLBACK) ---------------- //
const dns = require('dns');
const tls = require('tls');

const cleanEnv = (val) => (val || '').toString().trim().replace(/^["']|["']$/g, '');

const escapeHtml = (unsafe = '') =>
  String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const normalizeEmail = (rawEmail = '') => String(rawEmail || '').toLowerCase().trim();

const escapeRegex = (str = '') => String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getMemberDiscountInfo = (tier = '') => {
  const cleanTier = String(tier || '').toLowerCase().trim();
  if (cleanTier === 'radiance') {
    return { rate: 0.25, label: '25% Radiance Elite Member Discount' };
  }
  if (cleanTier === 'luminary') {
    return { rate: 0.10, label: '10% Luminary Circle Member Discount' };
  }
  return { rate: 0, label: '' };
};

const smtpHost = cleanEnv(process.env.SMTP_HOST) || 'smtp.ionos.com';
const configuredPort = Number(cleanEnv(process.env.SMTP_PORT)) || 465;

// Preserve exact casing from .env (e.g. Susan.Coke@SusansBeautyConsulting.com)
const rawSmtpUser = cleanEnv(process.env.SMTP_USER) || 'Susan.Coke@SusansBeautyConsulting.com';
const lowerSmtpUser = rawSmtpUser.toLowerCase();
const canonicalSmtpUser =
  lowerSmtpUser === 'susan.coke@susansbeautyconsulting.com'
    ? 'Susan.Coke@SusansBeautyConsulting.com'
    : rawSmtpUser;

const smtpUser = rawSmtpUser;
const smtpPass = cleanEnv(process.env.SMTP_PASS);
const resendApiKey = cleanEnv(process.env.RESEND_API_KEY);
const brevoApiKey = cleanEnv(process.env.BREVO_API_KEY);

const getPrimaryAdminEmail = () => rawSmtpUser || 'Susan.Coke@SusansBeautyConsulting.com';

// Deduplicated list of username casings to try automatically:
// 1. Exact .env value, 2. Mixed-case canonical (Susan.Coke@...), 3. Lowercase (susan.coke@...)
const getCandidateSmtpUsers = () => {
  const seen = new Set();
  const list = [];
  for (const u of [rawSmtpUser, canonicalSmtpUser, lowerSmtpUser]) {
    if (u && !seen.has(u)) {
      seen.add(u);
      list.push(u);
    }
  }
  return list;
};

// Creates a Nodemailer transporter for IONOS with IPv4 enforcement (family: 4),
// explicit auth user casing, and configurable TLS strictness.
const createIonosTransporter = ({ port, secure, user, strictTls = true }) =>
  nodemailer.createTransport({
    host: smtpHost,
    port,
    secure, // true for 465 (Implicit SSL/TLS), false for 587/2525 (STARTTLS)
    requireTLS: !secure,
    family: 4, // Force IPv4 resolution to prevent IPv6 ETIMEDOUT stalls on cloud hosts
    connectionTimeout: 9000,
    greetingTimeout: 9000,
    socketTimeout: 12000,
    auth: {
      user,
      pass: smtpPass,
    },
    tls: {
      minVersion: 'TLSv1.2',
      servername: smtpHost,
      rejectUnauthorized: strictTls
    }
  });

let cachedWorkingCandidate = null;

// Builds the ordered candidate matrix of (port, secure, strictTls, userCasing)
const buildSmtpCandidateMatrix = () => {
  const users = getCandidateSmtpUsers();
  const primaryPort = configuredPort === 587 ? 587 : 465;
  const secondaryPort = primaryPort === 465 ? 587 : 465;

  const portProfiles = [
    { port: primaryPort, secure: primaryPort === 465, strictTls: true, label: `${primaryPort} (${primaryPort === 465 ? 'SSL/TLS' : 'STARTTLS'})` },
    { port: secondaryPort, secure: secondaryPort === 465, strictTls: true, label: `${secondaryPort} (${secondaryPort === 465 ? 'SSL/TLS' : 'STARTTLS'})` },
    { port: 465, secure: true, strictTls: false, label: '465 (SSL/TLS - Relaxed Cert Check)' },
    { port: 587, secure: false, strictTls: false, label: '587 (STARTTLS - Relaxed Cert Check)' },
    { port: 2525, secure: false, strictTls: false, label: '2525 (Alternate STARTTLS)' }
  ];

  const matrix = [];
  if (cachedWorkingCandidate) {
    matrix.push(cachedWorkingCandidate);
  }

  for (const profile of portProfiles) {
    for (const userVariant of users) {
      const key = `${profile.port}-${profile.secure}-${profile.strictTls}-${userVariant}`;
      if (!matrix.some(m => m.key === key)) {
        matrix.push({
          key,
          port: profile.port,
          secure: profile.secure,
          strictTls: profile.strictTls,
          user: userVariant,
          label: `${smtpHost}:${profile.label} as ${userVariant}`
        });
      }
    }
  }
  return matrix;
};

let activeSmtpPort = configuredPort;
let activeSmtpUser = rawSmtpUser;

// Translates raw Nodemailer/IONOS error codes into actionable guidance for Susan
const buildSmtpTroubleshootingAdvice = (attempts = [], envWarnings = []) => {
  const advice = [...envWarnings];
  const combinedErrors = attempts.map(a => `${a.code || ''} ${a.error || ''}`).join(' | ');

  if (/535|Authentication credentials invalid|Invalid login|bad-credentials/i.test(combinedErrors)) {
    advice.push(
      'IONOS returned 535 Authentication Failed: (1) Verify that Susan.Coke@SusansBeautyConsulting.com is a full IONOS Basic/Business Mailbox with its own inbox and password — NOT a "Forwarding-Only" address. (2) Log into https://mail.ionos.com once in a browser to clear any first-login activation prompt. (3) If your password in .env contains a "#" character, wrap the password in double quotes: SMTP_PASS="your#password".'
    );
  }
  if (/ETIMEDOUT|ECONNREFUSED|ESOCKET|Connection timeout/i.test(combinedErrors)) {
    advice.push(
      'Outbound SMTP ports 465 and 587 timed out or were blocked by your hosting provider (common on Render Free tier, DigitalOcean, or AWS). Either upgrade the host plan to unblock outbound SMTP ports, or add RESEND_API_KEY or BREVO_API_KEY to .env to use our built-in HTTPS (port 443) email fallback.'
    );
  }
  if (/550|Sender address is not allowed|not owned by user/i.test(combinedErrors)) {
    advice.push(
      'IONOS rejected the From address (550 Sender not allowed): Ensure SMTP_FROM in .env is either omitted or matches your exact IONOS mailbox (Susan.Coke@SusansBeautyConsulting.com).'
    );
  }
  if (advice.length === 0) {
    advice.push(
      'Verify SMTP_HOST=smtp.ionos.com, SMTP_PORT=465, SMTP_USER="Susan.Coke@SusansBeautyConsulting.com", and SMTP_PASS="<your_password>" in your server .env file.'
    );
  }
  return advice;
};

const inspectSmtpEnvWarnings = () => {
  const warnings = [];
  const rawEnvPass = process.env.SMTP_PASS || '';
  if (!smtpUser) warnings.push('SMTP_USER is missing in .env.');
  if (!smtpPass) {
    warnings.push('SMTP_PASS is empty in .env. Note: if your password starts with "#", dotenv treats "#" as a comment unless wrapped in quotes: SMTP_PASS="your_password".');
  } else if (rawEnvPass !== smtpPass) {
    warnings.push('Leading/trailing whitespace or quotes in SMTP_PASS were automatically trimmed.');
  }
  return warnings;
};

const verifySmtpConnection = async () => {
  const envWarnings = inspectSmtpEnvWarnings();
  if (!smtpPass) {
    return {
      verified: false,
      host: smtpHost,
      error: 'SMTP_PASS is missing in environment variables.',
      envWarnings,
      troubleshootingAdvice: buildSmtpTroubleshootingAdvice([], envWarnings)
    };
  }

  let dnsResolution = null;
  try {
    dnsResolution = await dns.promises.lookup(smtpHost, { family: 4 });
  } catch (dnsErr) {
    dnsResolution = { error: dnsErr.message };
  }

  const candidates = buildSmtpCandidateMatrix();
  const attempts = [];

  for (const candidate of candidates.slice(0, 6)) {
    const client = createIonosTransporter(candidate);
    const startMs = Date.now();
    try {
      await client.verify();
      cachedWorkingCandidate = candidate;
      activeSmtpPort = candidate.port;
      activeSmtpUser = candidate.user;
      console.log(`✧ IONOS SMTP Verified (${candidate.label}, IPv4) in ${Date.now() - startMs}ms`);
      return {
        verified: true,
        host: smtpHost,
        port: candidate.port,
        secure: candidate.secure,
        authUserUsed: candidate.user,
        dnsResolution,
        attempts: [...attempts, { label: candidate.label, status: 'PASSED', durationMs: Date.now() - startMs }],
        envWarnings
      };
    } catch (err) {
      attempts.push({
        label: candidate.label,
        port: candidate.port,
        secure: candidate.secure,
        user: candidate.user,
        status: 'FAILED',
        code: err.code || err.responseCode || 'ERR',
        error: err.message,
        durationMs: Date.now() - startMs
      });
      console.warn(`⚠️ SMTP verify failed on ${candidate.label}: ${err.message}`);
    }
  }

  return {
    verified: false,
    host: smtpHost,
    dnsResolution,
    triedPorts: [...new Set(attempts.map(a => a.port))],
    attempts,
    envWarnings,
    error: attempts[0]?.error || 'All IONOS SMTP verification attempts failed.',
    troubleshootingAdvice: buildSmtpTroubleshootingAdvice(attempts, envWarnings)
  };
};

// Optional HTTPS Port 443 Fallback (Resend or Brevo) when cloud hosts block outbound SMTP ports 465/587
const sendViaHttpsFallback = async (to, subject, htmlContent, textContent) => {
  const fromAddress = getPrimaryAdminEmail();
  if (resendApiKey) {
    const resp = await axios.post(
      'https://api.resend.com/emails',
      {
        from: `Susan's Beauty Consulting <${fromAddress}>`,
        to: [to],
        subject,
        html: htmlContent,
        text: textContent
      },
      {
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 12000
      }
    );
    return {
      info: { messageId: resp.data?.id || 'resend-https' },
      portUsed: 443,
      secureUsed: true,
      authUserUsed: fromAddress,
      deliveryTransport: 'Resend HTTPS API (Port 443)'
    };
  }

  if (brevoApiKey) {
    const resp = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { name: "Susan's Beauty Consulting", email: fromAddress },
        to: [{ email: to }],
        subject,
        htmlContent,
        textContent
      },
      {
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json'
        },
        timeout: 12000
      }
    );
    return {
      info: { messageId: resp.data?.messageId || 'brevo-https' },
      portUsed: 443,
      secureUsed: true,
      authUserUsed: fromAddress,
      deliveryTransport: 'Brevo HTTPS API (Port 443)'
    };
  }

  return null;
};

const sendEmail = async (to, subject, htmlContent, textContent, extraHeaders = {}) => {
  const envWarnings = inspectSmtpEnvWarnings();

  if (!smtpPass && !resendApiKey && !brevoApiKey) {
    const configErr = new Error(
      'SMTP_PASS is missing in environment variables. Add SMTP_PASS="your_ionos_password" to .env.'
    );
    console.error(`⚠️ Cannot send email to ${to}:`, configErr.message);
    throw configErr;
  }

  const candidates = smtpPass ? buildSmtpCandidateMatrix() : [];
  const attempts = [];

  for (const candidate of candidates.slice(0, 6)) {
    const client = createIonosTransporter(candidate);
    // Strictly align From header and SMTP envelope with the exact authenticated IONOS mailbox
    // so IONOS never rejects with 550-5.7.1 "Sender address is not allowed"
    const mailOptions = {
      from: {
        name: "Susan's Beauty Consulting",
        address: candidate.user
      },
      replyTo: candidate.user,
      envelope: {
        from: candidate.user,
        to
      },
      to,
      subject,
      text: textContent,
      html: htmlContent
    };

    if (extraHeaders && typeof extraHeaders === 'object') {
      if (extraHeaders.inReplyTo) {
        mailOptions.inReplyTo = String(extraHeaders.inReplyTo).trim();
      }
      if (extraHeaders.references) {
        mailOptions.references = String(extraHeaders.references).trim();
      }
    }

    const startMs = Date.now();
    try {
      const info = await client.sendMail(mailOptions);
      cachedWorkingCandidate = candidate;
      activeSmtpPort = candidate.port;
      activeSmtpUser = candidate.user;
      console.log(`✉️ Email dispatched via ${candidate.label} to ${to}: "${subject}"`);
      return {
        info,
        portUsed: candidate.port,
        secureUsed: candidate.secure,
        authUserUsed: candidate.user,
        deliveryTransport: `IONOS SMTP (${candidate.label})`,
        attempts: [...attempts, { label: candidate.label, status: 'SENT', durationMs: Date.now() - startMs }]
      };
    } catch (err) {
      attempts.push({
        label: candidate.label,
        port: candidate.port,
        user: candidate.user,
        status: 'FAILED',
        code: err.code || err.responseCode || 'ERR',
        error: err.message,
        durationMs: Date.now() - startMs
      });
      console.warn(`⚠️ SMTP send failed on ${candidate.label} to ${to}: ${err.message}`);
    }
  }

  // Try HTTPS API fallback (Port 443) if configured and SMTP ports failed
  try {
    const httpsResult = await sendViaHttpsFallback(to, subject, htmlContent, textContent);
    if (httpsResult) {
      console.log(`✉️ Email dispatched via ${httpsResult.deliveryTransport} to ${to}`);
      return { ...httpsResult, attempts };
    }
  } catch (httpsErr) {
    attempts.push({
      label: 'HTTPS Port 443 Fallback',
      status: 'FAILED',
      error: httpsErr?.response?.data?.message || httpsErr.message
    });
  }

  const advice = buildSmtpTroubleshootingAdvice(attempts, envWarnings);
  const detailedError = new Error(
    `IONOS SMTP delivery failed (${attempts[0]?.error || 'Connection error'}). ${advice[0] || ''}`
  );
  detailedError.attempts = attempts;
  detailedError.troubleshootingAdvice = advice;
  throw detailedError;
};

// ---------------- NATIVE TLS IONOS IMAP CLIENT ENGINE (imap.ionos.com:993) ---------------- //
// Connects directly to IONOS IMAP over Implicit SSL/TLS (Port 993) using Node's built-in `tls` module.
// Requires zero external npm packages and persists incoming messages idempotently to InboundEmail.

const imapHost = cleanEnv(process.env.IMAP_HOST) || 'imap.ionos.com';
const imapPort = Number(cleanEnv(process.env.IMAP_PORT)) || 993;

let isImapSyncRunning = false;
let imapTelemetryState = {
  host: imapHost,
  port: imapPort,
  configuredUser: rawSmtpUser,
  activeUser: activeSmtpUser || rawSmtpUser,
  connected: false,
  lastSyncAt: null,
  lastSyncStatus: 'IDLE',
  lastSyncFetchedCount: 0,
  lastSyncNewCount: 0,
  lastError: null
};

// Decodes RFC 2047 encoded-word strings in email headers (e.g. =?UTF-8?B?...?= or =?UTF-8?Q?...?=)
const decodeRfc2047Header = (raw = '') => {
  if (!raw) return '';
  return String(raw).replace(/=\?([^?]+)\?([BQbq])\?([^?]*?)\?=/g, (_, charset, encoding, text) => {
    try {
      const enc = String(encoding).toUpperCase();
      if (enc === 'B') {
        return Buffer.from(text, 'base64').toString('utf8');
      }
      if (enc === 'Q') {
        const qText = text.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (__, hex) =>
          String.fromCharCode(parseInt(hex, 16))
        );
        return Buffer.from(qText, 'binary').toString('utf8');
      }
    } catch (e) {}
    return text;
  });
};

// Decodes Quoted-Printable email bodies into UTF-8 text
const decodeQuotedPrintable = (input = '') => {
  if (!input) return '';
  const softLineStripped = String(input).replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < softLineStripped.length; i++) {
    if (softLineStripped[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(softLineStripped.slice(i + 1, i + 3))) {
      bytes.push(parseInt(softLineStripped.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(softLineStripped.charCodeAt(i));
    }
  }
  try {
    return Buffer.from(bytes).toString('utf8');
  } catch (e) {
    return softLineStripped;
  }
};

// Decodes a MIME body part according to its Content-Transfer-Encoding header
const decodeMimePartBody = (rawBody = '', transferEncoding = '') => {
  const enc = String(transferEncoding || '').toLowerCase().trim();
  if (enc === 'base64') {
    try {
      return Buffer.from(String(rawBody).replace(/\s+/g, ''), 'base64').toString('utf8');
    } catch (e) {
      return rawBody;
    }
  }
  if (enc === 'quoted-printable') {
    return decodeQuotedPrintable(rawBody);
  }
  return String(rawBody || '');
};

// Strips HTML tags cleanly to generate a plain-text fallback or snippet
const stripHtmlToText = (html = '') =>
  String(html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// Parses unfolded RFC 5322 headers into a lowercase-key dictionary
const parseRfc5322Headers = (headerBlock = '') => {
  const unfolded = String(headerBlock || '').replace(/\r?\n[ \t]+/g, ' ');
  const lines = unfolded.split(/\r?\n/);
  const headers = {};
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx <= 0) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const val = line.slice(colonIdx + 1).trim();
    if (headers[key]) {
      headers[key] += `, ${val}`;
    } else {
      headers[key] = val;
    }
  }
  return headers;
};

// Extracts { name, email } from a raw From/To header like `"Jane Doe" <jane@example.com>`
const parseEmailAddressField = (rawField = '') => {
  const decoded = decodeRfc2047Header(rawField).trim();
  if (!decoded) return { name: '', email: '' };
  const angleMatch = decoded.match(/^(.*?)<([^>]+)>/);
  if (angleMatch) {
    const cleanName = angleMatch[1].trim().replace(/^["']|["']$/g, '').trim();
    const cleanAddr = normalizeEmail(angleMatch[2]);
    return {
      name: cleanName || cleanAddr.split('@')[0] || 'Client',
      email: cleanAddr
    };
  }
  const emailMatch = decoded.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
  if (emailMatch) {
    const cleanAddr = normalizeEmail(emailMatch[0]);
    return {
      name: cleanAddr.split('@')[0] || 'Client',
      email: cleanAddr
    };
  }
  return { name: decoded, email: normalizeEmail(decoded) };
};

// Recursively extracts text/plain and text/html bodies from single-part or multipart MIME messages
const extractMimeBodies = (rawHeaders = {}, rawBody = '') => {
  const contentType = String(rawHeaders['content-type'] || 'text/plain').toLowerCase();
  const transferEncoding = String(rawHeaders['content-transfer-encoding'] || '');

  const boundaryMatch = String(rawHeaders['content-type'] || '').match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  if (contentType.includes('multipart/') && boundaryMatch) {
    const boundary = boundaryMatch[1] || boundaryMatch[2];
    const delimiter = `--${boundary}`;
    const segments = String(rawBody || '').split(delimiter);
    let collectedText = '';
    let collectedHtml = '';

    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];
      if (!seg || seg.startsWith('--')) break;
      const trimmedSeg = seg.replace(/^\r?\n/, '');
      const splitMatch = trimmedSeg.match(/\r?\n\r?\n/);
      if (!splitMatch) continue;
      const partHeaderBlock = trimmedSeg.slice(0, splitMatch.index);
      const partBodyBlock = trimmedSeg.slice(splitMatch.index + splitMatch[0].length);
      const partHeaders = parseRfc5322Headers(partHeaderBlock);
      const partDisposition = String(partHeaders['content-disposition'] || '').toLowerCase();
      if (partDisposition.includes('attachment')) continue;

      const subResult = extractMimeBodies(partHeaders, partBodyBlock);
      if (subResult.textBody && !collectedText) collectedText = subResult.textBody;
      if (subResult.htmlBody && !collectedHtml) collectedHtml = subResult.htmlBody;
    }

    if (!collectedText && collectedHtml) {
      collectedText = stripHtmlToText(collectedHtml);
    }
    return { textBody: collectedText.trim(), htmlBody: collectedHtml.trim() };
  }

  const decoded = decodeMimePartBody(rawBody, transferEncoding);
  if (contentType.includes('text/html')) {
    return {
      textBody: stripHtmlToText(decoded),
      htmlBody: decoded.trim()
    };
  }
  return {
    textBody: decoded.trim(),
    htmlBody: ''
  };
};

// Parses a full raw RFC 5322 email message into structured fields for InboundEmail
const parseRawRfc5322Message = (rawEmail = '', uid = 0, flagsStr = '') => {
  const rawStr = String(rawEmail || '');
  const splitMatch = rawStr.match(/\r?\n\r?\n/);
  const headerBlock = splitMatch ? rawStr.slice(0, splitMatch.index) : rawStr;
  const bodyBlock = splitMatch ? rawStr.slice(splitMatch.index + splitMatch[0].length) : '';

  const headers = parseRfc5322Headers(headerBlock);
  const fromParsed = parseEmailAddressField(headers['from'] || '');
  const toParsed = parseEmailAddressField(headers['to'] || getPrimaryAdminEmail());
  const subject = decodeRfc2047Header(headers['subject'] || '').trim() || '(No Subject)';

  const rawMsgId = String(headers['message-id'] || '').trim();
  const dateHeader = headers['date'] ? new Date(headers['date']) : new Date();
  const receivedAt = !isNaN(dateHeader.getTime()) ? dateHeader : new Date();

  const messageId =
    rawMsgId ||
    `<ionos-uid-${uid || 0}-${ crypto.createHash('sha1').update(`${fromParsed.email}|${subject}|${receivedAt.toISOString()}`).digest('hex').slice(0, 16) }@susansbeautyconsulting.com>`;

  const { textBody, htmlBody } = extractMimeBodies(headers, bodyBlock);
  const cleanText = textBody || stripHtmlToText(htmlBody) || '';
  const snippet = cleanText.replace(/\s+/g, ' ').trim().slice(0, 220);

  const upperFlags = String(flagsStr || '').toUpperCase();
  const isSeenOnServer = upperFlags.includes('\\SEEN');
  const isFlaggedOnServer = upperFlags.includes('\\FLAGGED');

  return {
    uid: Number(uid) || 0,
    messageId,
    fromName: fromParsed.name || fromParsed.email || 'Valued Client',
    fromEmail: fromParsed.email || 'unknown@client.com',
    to: toParsed.email || getPrimaryAdminEmail(),
    subject,
    textBody: cleanText,
    htmlBody: htmlBody || '',
    snippet,
    inReplyTo: String(headers['in-reply-to'] || '').trim(),
    references: String(headers['references'] || '').trim(),
    receivedAt,
    isSeenOnServer,
    isFlaggedOnServer
  };
};

// Quotes a string safely for IMAP command arguments
const quoteImapString = (val = '') =>
  `"${String(val || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

// Connects to imap.ionos.com:993 with a single candidate user & TLS profile and fetches the latest messages
const fetchIonosInboxViaTlsSession = ({ user, pass, strictTls = true, maxFetch = 45 }) =>
  new Promise((resolve, reject) => {
    let settled = false;
    let socket = null;

    const finishWithError = (err) => {
      if (settled) return;
      settled = true;
      try {
        if (socket && !socket.destroyed) socket.destroy();
      } catch (e) {}
      reject(err);
    };

    const finishWithSuccess = (result) => {
      if (settled) return;
      settled = true;
      try {
        if (socket && !socket.destroyed) socket.end();
      } catch (e) {}
      resolve(result);
    };

    const timeoutTimer = setTimeout(() => {
      finishWithError(new Error(`IONOS IMAP connection timed out on ${imapHost}:${imapPort}`));
    }, 18000);

    try {
      socket = tls.connect(
        {
          host: imapHost,
          port: imapPort,
          servername: imapHost,
          rejectUnauthorized: strictTls,
          family: 4
        },
        () => {}
      );
    } catch (connectErr) {
      clearTimeout(timeoutTimer);
      return finishWithError(connectErr);
    }

    let buffer = '';
    let step = 'GREETING';

    const sendCommand = (cmdLine) => {
      if (socket && !socket.destroyed) {
        socket.write(`${cmdLine}\r\n`);
      }
    };

    socket.on('error', (err) => {
      clearTimeout(timeoutTimer);
      finishWithError(err);
    });

    socket.on('close', () => {
      clearTimeout(timeoutTimer);
      if (!settled) {
        finishWithError(new Error('IONOS IMAP socket closed before sync completed.'));
      }
    });

    socket.on('data', (chunk) => {
      buffer += chunk.toString('binary');

      if (step === 'GREETING') {
        if (/^\* OK/m.test(buffer)) {
          buffer = '';
          step = 'LOGIN';
          sendCommand(`A001 LOGIN ${quoteImapString(user)} ${quoteImapString(pass)}`);
        } else if (/^\* (?:NO|BAD)/m.test(buffer)) {
          clearTimeout(timeoutTimer);
          finishWithError(new Error(`IONOS IMAP rejected greeting: ${buffer.trim()}`));
        }
        return;
      }

      if (step === 'LOGIN') {
        if (/^A001 OK/m.test(buffer)) {
          buffer = '';
          step = 'SELECT';
          sendCommand('A002 SELECT "INBOX"');
        } else if (/^A001 (?:NO|BAD)/m.test(buffer)) {
          clearTimeout(timeoutTimer);
          finishWithError(new Error(`IONOS IMAP authentication failed for ${user} on ${imapHost}:${imapPort}`));
        }
        return;
      }

      if (step === 'SELECT') {
        if (/^A002 OK/m.test(buffer)) {
          buffer = '';
          step = 'SEARCH';
          sendCommand('A003 UID SEARCH ALL');
        } else if (/^A002 (?:NO|BAD)/m.test(buffer)) {
          clearTimeout(timeoutTimer);
          finishWithError(new Error(`IONOS IMAP could not open INBOX for ${user}`));
        }
        return;
      }

      if (step === 'SEARCH') {
        if (/^A003 OK/m.test(buffer)) {
          const searchMatch = buffer.match(/\* SEARCH([0-9 ]*)/i);
          const allUids = searchMatch && searchMatch[1]
            ? searchMatch[1]
                .trim()
                .split(/\s+/)
                .map((n) => parseInt(n, 10))
                .filter((n) => !isNaN(n) && n > 0)
            : [];

          buffer = '';
          if (allUids.length === 0) {
            step = 'LOGOUT';
            sendCommand('A005 LOGOUT');
            clearTimeout(timeoutTimer);
            return finishWithSuccess({ messages: [], totalUidsInInbox: 0 });
          }

          const targetUids = allUids.slice(-Math.max(1, Math.min(100, Number(maxFetch) || 45)));
          step = 'FETCH';
          sendCommand(`A004 UID FETCH ${targetUids.join(',')} (UID FLAGS BODY.PEEK[])`);
          socket._totalUidsInInbox = allUids.length;
        } else if (/^A003 (?:NO|BAD)/m.test(buffer)) {
          clearTimeout(timeoutTimer);
          finishWithError(new Error('IONOS IMAP UID SEARCH ALL failed.'));
        }
        return;
      }

      if (step === 'FETCH') {
        if (/^A004 OK/m.test(buffer)) {
          const rawFetchTranscript = buffer;
          buffer = '';
          step = 'LOGOUT';
          sendCommand('A005 LOGOUT');
          clearTimeout(timeoutTimer);

          // Parse each `* <seq> FETCH (... {byteLen} + rawMessage)` block from the transcript
          const parsedMessages = [];
          const fetchHeaderRegex = /\* \d+ FETCH \(([^\r\n]*?)\{(\d+)\}\r\n/gi;
          let match;
          while ((match = fetchHeaderRegex.exec(rawFetchTranscript)) !== null) {
            const metaPart = match[1] || '';
            const literalByteLen = parseInt(match[2], 10) || 0;
            const literalStart = fetchHeaderRegex.lastIndex;
            const rawLiteral = rawFetchTranscript.slice(literalStart, literalStart + literalByteLen);

            const uidMatch = metaPart.match(/UID\s+(\d+)/i);
            const flagsMatch = metaPart.match(/FLAGS\s*\(([^)]*)\)/i);
            const uid = uidMatch ? parseInt(uidMatch[1], 10) : 0;
            const flagsStr = flagsMatch ? flagsMatch[1] : '';

            const rawUtf8 = Buffer.from(rawLiteral, 'binary').toString('utf8');
            const parsed = parseRawRfc5322Message(rawUtf8, uid, flagsStr);
            if (parsed && parsed.fromEmail) {
              parsedMessages.push(parsed);
            }
          }

          return finishWithSuccess({
            messages: parsedMessages,
            totalUidsInInbox: socket._totalUidsInInbox || parsedMessages.length
          });
        } else if (/^A004 (?:NO|BAD)/m.test(buffer)) {
          clearTimeout(timeoutTimer);
          finishWithError(new Error('IONOS IMAP UID FETCH failed.'));
        }
      }
    });
  });

// Synchronizes Susan's IONOS Inbox (imap.ionos.com:993) into the MongoDB InboundEmail collection
const syncIonosImapInbox = async ({ maxFetch = 45 } = {}) => {
  if (isImapSyncRunning) {
    return {
      status: 'already_running',
      fetchedCount: 0,
      newCount: 0,
      telemetry: imapTelemetryState
    };
  }

  if (!smtpPass) {
    imapTelemetryState = {
      ...imapTelemetryState,
      connected: false,
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: 'SKIPPED_NO_PASSWORD',
      lastError: 'SMTP_PASS is not configured in .env. Set SMTP_PASS to sync incoming IONOS emails.'
    };
    return {
      status: 'skipped_no_password',
      fetchedCount: 0,
      newCount: 0,
      telemetry: imapTelemetryState
    };
  }

  isImapSyncRunning = true;
  const candidateUsers = getCandidateSmtpUsers();
  const attempts = [];

  try {
    for (const userCandidate of candidateUsers) {
      for (const strictTls of [true, false]) {
        try {
          const sessionResult = await fetchIonosInboxViaTlsSession({
            user: userCandidate,
            pass: smtpPass,
            strictTls,
            maxFetch
          });

          const messages = Array.isArray(sessionResult.messages) ? sessionResult.messages : [];
          let newCount = 0;

          for (const msg of messages) {
            const existing = await InboundEmail.findOne({ messageId: msg.messageId }).select('_id').lean();
            if (!existing) {
              newCount++;
            }

            await InboundEmail.findOneAndUpdate(
              { messageId: msg.messageId },
              {
                $set: {
                  uid: msg.uid || 0,
                  fromName: msg.fromName || msg.fromEmail,
                  fromEmail: msg.fromEmail,
                  to: msg.to || getPrimaryAdminEmail(),
                  subject: msg.subject || '(No Subject)',
                  textBody: msg.textBody || '',
                  htmlBody: msg.htmlBody || '',
                  snippet: msg.snippet || '',
                  inReplyTo: msg.inReplyTo || '',
                  references: msg.references || '',
                  receivedAt: msg.receivedAt || new Date(),
                  folder: 'INBOX',
                  source: 'ionos_imap'
                },
                $setOnInsert: {
                  isRead: Boolean(msg.isSeenOnServer),
                  isStarred: Boolean(msg.isFlaggedOnServer),
                  isArchived: false,
                  repliedAt: null,
                  lastReplyPreview: ''
                }
              },
              { upsert: true, returnDocument: 'after' }
            );
          }

          imapTelemetryState = {
            host: imapHost,
            port: imapPort,
            configuredUser: rawSmtpUser,
            activeUser: userCandidate,
            connected: true,
            lastSyncAt: new Date().toISOString(),
            lastSyncStatus: 'SYNCED',
            lastSyncFetchedCount: messages.length,
            lastSyncNewCount: newCount,
            totalUidsInInbox: sessionResult.totalUidsInInbox || messages.length,
            lastError: null
          };

          if (newCount > 0) {
            console.log(`📥 IONOS IMAP synced ${newCount} new incoming email(s) for ${userCandidate} (${imapHost}:${imapPort})`);
          }

          return {
            status: 'synced',
            fetchedCount: messages.length,
            newCount,
            totalUidsInInbox: sessionResult.totalUidsInInbox || messages.length,
            telemetry: imapTelemetryState
          };
        } catch (err) {
          attempts.push({
            user: userCandidate,
            strictTls,
            error: err.message
          });
        }
      }
    }

    const primaryErr = attempts[0]?.error || `Could not connect to ${imapHost}:${imapPort}`;
    imapTelemetryState = {
      ...imapTelemetryState,
      connected: false,
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: 'ERROR',
      lastError: primaryErr
    };

    return {
      status: 'error',
      fetchedCount: 0,
      newCount: 0,
      error: primaryErr,
      attempts,
      telemetry: imapTelemetryState
    };
  } finally {
    isImapSyncRunning = false;
  }
};

// Computes live inbox badge counters (total, unread, starred, replied, archived)
const buildInboundInboxCounts = async () => {
  const [total, unread, starred, replied, archived] = await Promise.all([
    InboundEmail.countDocuments({ isArchived: { $ne: true } }),
    InboundEmail.countDocuments({ isArchived: { $ne: true }, isRead: false }),
    InboundEmail.countDocuments({ isArchived: { $ne: true }, isStarred: true }),
    InboundEmail.countDocuments({ isArchived: { $ne: true }, repliedAt: { $ne: null } }),
    InboundEmail.countDocuments({ isArchived: true })
  ]);

  return {
    total,
    unread,
    starred,
    replied,
    archived
  };
};


// ---------------- MONGODB SCHEMAS ---------------- //
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['client', 'staff', 'admin'], 
    default: 'client',
    index: true 
  },
  membershipTier: { type: String, default: 'luminary' },
  authProvider: {
    type: String,
    enum: ['local', 'google', 'linkedin', 'facebook', 'x', 'tiktok', 'reddit'],
    default: 'local',
    index: true
  },
  avatarUrl: { type: String, default: '' },
  googleId: { type: String, default: '', index: true },
  linkedinId: { type: String, default: '', index: true },
  facebookId: { type: String, default: '', index: true },
  xId: { type: String, default: '', index: true },
  tiktokId: { type: String, default: '', index: true },
  redditId: { type: String, default: '', index: true },
  socialProfiles: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  recommendedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  description: { type: String },
  durationInMinutes: { type: Number, required: true },
  price: { type: Number, required: true },
  imageUrl: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
const Service = mongoose.model('Service', serviceSchema);

const appointmentSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, index: true },
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: false, index: true },
  startTime: { type: Date, required: true, index: true },
  endTime: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'completed', 'cancelled'], 
    default: 'confirmed',
    index: true
  },
  depositPaid: { type: Boolean, default: false },
  notes: { type: String, default: '' },
  meetingLink: { type: String, default: '' },
  rescheduledBy: {
    type: String,
    enum: ['admin', 'client', null],
    default: null
  },
  previousStartTime: { type: Date, default: null },
  reminderSentAt: { type: Date, default: null, index: true }
}, { timestamps: true });
appointmentSchema.index({ staffId: 1, startTime: 1, endTime: 1 });
const Appointment = mongoose.model('Appointment', appointmentSchema);

const reviewSchema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const Review = mongoose.model('Review', reviewSchema);

const consultationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  skinType: String,
  primaryGoal: String,
  climate: String,
  skinSensitivity: String,
  complexion: String,
  undertone: String,
  eyeColor: String,
  faceShape: String,
  makeupVibe: String,
  routineFocus: String,
  blueprintAnalysis: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});
const Consultation = mongoose.model('Consultation', consultationSchema);

const productSchema = new mongoose.Schema({
  title: { type: String, required: true, index: true },
  cjPid: { type: String, default: '', index: true },
  cjSku: { type: String, default: '', index: true },
  normalizedTitleKey: { type: String, default: '', index: true },
  customTitleLocked: { type: Boolean, default: false },
  lastSyncedAt: { type: Date, default: null },
  description: String,
  imageUrl: String,
  tags: { type: [String], index: true },
  skinTypes: { type: [String], default: [], index: true },
  skinConcerns: { type: [String], default: [], index: true },
  sensitivitySafe: { type: Boolean, default: true, index: true },
  sensitivityLabel: { type: String, default: 'Gentle • High-Sensitivity Safe' },
  ritualStep: { type: String, default: 'Step 3: Serum & Essence', index: true },
  keyActives: { type: [String], default: [] },
  viewCount: { type: Number, default: 0, index: true },
  cartAddCount: { type: Number, default: 0, index: true },
  purchaseCount: { type: Number, default: 0, index: true },
  curatedCount: { type: Number, default: 0 },
  lastViewedAt: { type: Date, default: null },
  price: { type: Number, default: 0 },
  wholesalePriceUsd: { type: Number, default: 2.50 },
  markupMultiplier: { type: Number, default: 6.5 },
  estimatedWeightGrams: { type: Number, default: 120 },
  originCountryCode: { type: String, default: 'CN' },
  selectedLogisticName: { type: String, default: 'CJPacket Sensitive' },
  shippingCostUsd: { type: Number, default: 4.49 },
  shippingIncludedInPrice: { type: Boolean, default: true },
  availableLogistics: { type: Array, default: [] },
  customLabelConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({
      enabled: false,
      labelType: 'NONE',
      packagingVid: '',
      packagingName: "Susan's Rose-Gold Custom Box & Seal",
      customBrandText: "Susan's Beauty Consulting ✧",
      logoUrl: '',
      packagingCostUsd: 0
    })
  },
  variants: [{
    sku: { type: String, required: true },
    variantName: String, 
    price: Number,
    wholesalePriceUsd: Number,
    imageUrl: String 
  }],
  rawCjData: { type: mongoose.Schema.Types.Mixed }
});
const Product = mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
  items: Array,
  totalAmount: Number,
  shipping_address: { type: mongoose.Schema.Types.Mixed },
  customerEmail: { type: String, index: true },
  status: { type: String, default: 'Pending', index: true },
  tracking_code: { type: String, default: '' },
  logisticName: { type: String, default: '' },
  selectedLogisticName: { type: String, default: 'CJPacket Sensitive' },
  fromCountryCode: { type: String, default: 'CN' },
  shippingCostUsd: { type: Number, default: 0 },
  customLabelConfig: { type: mongoose.Schema.Types.Mixed, default: null },
  cjOrderId: { type: String, default: '' },
  cjOrderStatus: { type: String, default: '' },
  estimatedWholesaleCost: { type: Number, default: 0 },
  estimatedProfit: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

const emailLogSchema = new mongoose.Schema({
  to: { type: String, required: true, index: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  inReplyToMessageId: { type: String, default: '' },
  inboundEmailId: { type: mongoose.Schema.Types.ObjectId, ref: 'InboundEmail', default: null },
  sentAt: { type: Date, default: Date.now }
});
const EmailLog = mongoose.model('EmailLog', emailLogSchema);

// Incoming Emails synced from IONOS IMAP (imap.ionos.com:993) for Susan.Coke@SusansBeautyConsulting.com
const inboundEmailSchema = new mongoose.Schema({
  uid: { type: Number, default: 0, index: true },
  messageId: { type: String, required: true, unique: true, index: true },
  fromName: { type: String, default: '' },
  fromEmail: { type: String, required: true, index: true },
  to: { type: String, default: 'Susan.Coke@SusansBeautyConsulting.com', index: true },
  subject: { type: String, default: '(No Subject)' },
  textBody: { type: String, default: '' },
  htmlBody: { type: String, default: '' },
  snippet: { type: String, default: '' },
  inReplyTo: { type: String, default: '' },
  references: { type: String, default: '' },
  folder: { type: String, default: 'INBOX', index: true },
  source: { type: String, enum: ['ionos_imap', 'webhook', 'system_seed'], default: 'ionos_imap' },
  receivedAt: { type: Date, default: Date.now, index: true },
  isRead: { type: Boolean, default: false, index: true },
  isStarred: { type: Boolean, default: false, index: true },
  isArchived: { type: Boolean, default: false, index: true },
  repliedAt: { type: Date, default: null },
  lastReplyPreview: { type: String, default: '' }
});
const InboundEmail = mongoose.model('InboundEmail', inboundEmailSchema);

const inboxItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  message: { type: String, default: "Susan has hand-selected this specifically for your custom beauty profile ✧" },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const InboxItem = mongoose.model('InboxItem', inboxItemSchema);

// Odie's Long-Term Persistent Memory Bank (Facts, Preferences, VIP Client Notes & Business Rules)
const odieMemorySchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['preference', 'business_rule', 'vip_client', 'financial_goal', 'general'],
    default: 'general',
    index: true
  },
  key: { type: String, required: true, index: true },
  content: { type: String, required: true },
  source: {
    type: String,
    enum: ['susan_manual', 'odie_auto', 'system_seed'],
    default: 'odie_auto'
  },
  pinned: { type: Boolean, default: true, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const OdieMemory = mongoose.model('OdieMemory', odieMemorySchema);

// Odie's Persistent Multi-Session Conversation History with Susan
const odieChatHistorySchema = new mongoose.Schema({
  adminEmail: { type: String, default: 'susan.coke@susansbeautyconsulting.com', index: true },
  role: { type: String, enum: ['user', 'model'], required: true },
  text: { type: String, required: true },
  actionsTaken: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now, index: true }
});
const OdieChatHistory = mongoose.model('OdieChatHistory', odieChatHistorySchema);

// Treasury Ledger for Stripe Bank Payouts ("Money Dumps") & Stripe -> CJ Dropshipping Transfers
const treasuryTransferSchema = new mongoose.Schema({
  transferType: {
    type: String,
    enum: ['STRIPE_BANK_PAYOUT', 'STRIPE_TO_CJ_BRIDGE', 'CJ_ORDER_WALLET_PAYMENT', 'CJ_WALLET_CARD_TOPUP'],
    required: true,
    index: true
  },
  amountUsd: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  status: { type: String, default: 'COMPLETED', index: true },
  stripePayoutId: { type: String, default: '' },
  checkoutSessionId: { type: String, default: '', index: true },
  cardBrand: { type: String, default: '' },
  cardLast4: { type: String, default: '' },
  payoutMethod: { type: String, default: 'standard' },
  cjOrdersPaid: { type: Array, default: [] },
  wholesaleReserveUsd: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  triggeredBy: { type: String, enum: ['susan', 'odie'], default: 'susan' },
  createdAt: { type: Date, default: Date.now, index: true }
});
const TreasuryTransfer = mongoose.model('TreasuryTransfer', treasuryTransferSchema);

// Behavioral Event Telemetry & Curation Intelligence Schema (Analytics Phase 1)
const VALID_ANALYTICS_EVENT_TYPES = [
  'PAGE_VIEW',
  'PRODUCT_VIEW',
  'ADD_TO_CART',
  'REMOVE_FROM_CART',
  'CHECKOUT_INITIATED',
  'FILTER_USED',
  'SEARCH_QUERY',
  'QUIZ_STARTED',
  'QUIZ_COMPLETED'
];

const analyticsEventSchema = new mongoose.Schema({
  eventType: {
    type: String,
    enum: VALID_ANALYTICS_EVENT_TYPES,
    required: true,
    index: true
  },
  page: { type: String, default: '' },
  sessionId: { type: String, default: '', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, default: null },
  userEmail: { type: String, default: '' },
  membershipTier: { type: String, default: 'guest' },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: false, default: null, index: true },
  productTitle: { type: String, default: '' },
  ritualStep: { type: String, default: '' },
  filterType: { type: String, default: '' },
  filterValue: { type: String, default: '' },
  searchQuery: { type: String, default: '' },
  cartValueUsd: { type: Number, default: 0 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true }
});
const AnalyticsEvent = mongoose.model('AnalyticsEvent', analyticsEventSchema);

// Profit-Protected Monthly Membership Box Schema (CJ Phase 2 — Strict <=25% Cost Cap)
const memberMonthlyBoxSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  memberName: { type: String, default: '' },
  memberEmail: { type: String, default: '', index: true },
  membershipTier: {
    type: String,
    enum: ['luminary', 'radiance'],
    default: 'luminary',
    index: true
  },
  billingMonth: { type: String, required: true, index: true }, // e.g. '2026-10'
  subscriptionPriceUsd: { type: Number, default: 49 },
  maxAllowedCostUsd: { type: Number, default: 12.25 }, // Strictly 25% of subscriptionPriceUsd
  requiredPieceCount: { type: Number, default: 3 },
  blueprintSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    title: { type: String, default: '' },
    sku: { type: String, default: '' },
    vid: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    ritualStep: { type: String, default: '' },
    wholesaleCostUsd: { type: Number, default: 0 },
    shippingShareUsd: { type: Number, default: 0 },
    retailPriceUsd: { type: Number, default: 0 },
    matchScore: { type: Number, default: 0 },
    matchReasons: { type: [String], default: [] }
  }],
  selectedLogisticName: { type: String, default: 'CJPacket Sensitive' },
  consolidatedShippingUsd: { type: Number, default: 0 },
  customLabelConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({
      enabled: true,
      labelType: 'CJ_CUSTOM_PACKAGING',
      packagingVid: 'CJ-PKG-ROSEGOLD-BOX-01',
      packagingName: "Susan's Rose-Gold Custom Box & Seal",
      customBrandText: "Susan's Beauty Consulting ✧",
      logoUrl: 'https://susansbeautyconsulting.com/susans-logo.png',
      packagingCostUsd: 0.65
    })
  },
  customLabelCostUsd: { type: Number, default: 0.65 },
  totalWholesaleCostUsd: { type: Number, default: 0 },
  totalAllInCostUsd: { type: Number, default: 0 },
  costPercentageOfMembership: { type: Number, default: 0 },
  estimatedNetProfitUsd: { type: Number, default: 0 },
  withinBudgetCap: { type: Boolean, default: true },
  status: {
    type: String,
    enum: ['CURATED_DRAFT', 'APPROVED_READY', 'DISPATCHED_TO_CJ', 'SHIPPED'],
    default: 'CURATED_DRAFT',
    index: true
  },
  cjOrderId: { type: String, default: '' },
  localOrderId: { type: String, default: '' },
  trackingCode: { type: String, default: '' },
  curatedBy: { type: String, enum: ['odie', 'susan'], default: 'odie' },
  notes: { type: String, default: '' }
}, { timestamps: true });
memberMonthlyBoxSchema.index({ userId: 1, billingMonth: 1 }, { unique: true });
const MemberMonthlyBox = mongoose.model('MemberMonthlyBox', memberMonthlyBoxSchema);

// ---------------- AUTHENTICATION & RBAC MIDDLEWARE ---------------- //

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
    
    const user = await User.findById(decoded._id).select('_id name email role membershipTier');
    
    if (!user) {
      return res.status(401).json({ error: 'The user associated with this token no longer exists.' });
    }

    req.user = user; 
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid or tampered token.' });
    }
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
};

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'Access denied. Role information missing.' });
    }

    const isLegacyAdmin = req.user.membershipTier === 'admin' && allowedRoles.includes('admin');

    if (allowedRoles.includes(req.user.role) || isLegacyAdmin) {
      next();
    } else {
      return res.status(403).json({ 
        error: `Access restricted. This action requires one of the following roles: ${allowedRoles.join(', ')}.` 
      });
    }
  };
};

const requireAdmin = requireRole(['admin']);
const requireStaffOrAdmin = requireRole(['admin', 'staff']);
const requireClient = requireRole(['client', 'admin']); 


// ---------------- CJ DROPSHIPPING API INTEGRATION (FULL BEAUTY & SKINCARE MULTI-QUERY SYNC) ---------------- //
const CJ_BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';
const CJ_MAX_PAGES = Math.max(1, Number(cleanEnv(process.env.CJ_MAX_PAGES)) || 120);
const CJ_MAX_PRODUCTS = Math.max(1, Number(cleanEnv(process.env.CJ_MAX_PRODUCTS)) || 2500);
const CJ_PAGE_SIZE = Math.min(100, Math.max(20, Number(cleanEnv(process.env.CJ_PAGE_SIZE)) || 100));

// Normalizes a product title into a canonical alphanumeric key so near-identical CJ listings match
const normalizeCjTitleForDedupe = (rawTitle = '') =>
  String(rawTitle || '')
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(hot sale|new arrival|dropshipping|wholesale|free shipping|fast shipping|1pc|1pcs|pcs)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Targeted Beauty, Skincare, Cosmetics & Personal Care search queries used to actively pull
// all beauty & skincare items from CJ Dropshipping rather than scanning random general-merchandise pages.
const CJ_BEAUTY_SEARCH_QUERIES = [
  'skincare',
  'skin care',
  'facial serum',
  'face cream',
  'moisturizer',
  'facial cleanser',
  'face toner',
  'facial mask',
  'sheet mask',
  'eye cream',
  'eye patch',
  'hyaluronic acid',
  'retinol',
  'vitamin c serum',
  'collagen',
  'niacinamide',
  'sunscreen',
  'acne patch',
  'lip gloss',
  'lipstick',
  'lip balm',
  'lip oil',
  'foundation',
  'concealer',
  'blush',
  'highlighter',
  'eyeshadow',
  'mascara',
  'eyeliner',
  'eyebrow',
  'makeup brush',
  'beauty sponge',
  'gua sha',
  'jade roller',
  'facial massager',
  'body lotion',
  'body scrub',
  'essential oil',
  'hair oil',
  'hair mask',
  'shampoo',
  'conditioner',
  'nail gel',
  'perfume'
];

const getCjHeaders = () => {
  const token = cleanEnv(process.env.CJ_ACCESS_TOKEN);
  if (!token) {
    console.warn("⚠ CJ_ACCESS_TOKEN is missing in environment.");
    return null;
  }
  return {
    'CJ-Access-Token': token,
    'Content-Type': 'application/json'
  };
};

// Word-boundary exclusion list to reject non-beauty items that previously matched substrings
// like "chair" (matched "hair"), "phone skin" (matched "skin"), "clock face" (matched "face"), or "ice cream" (matched "cream").
const NON_BEAUTY_EXCLUSION_REGEX = /\b(chair|armchair|wheelchair|stool|sofa|couch|table|desk|bed|mattress|pillowcase|curtain|rug|carpet|lamp|lighting|chandelier|kitchen|cookware|frying|baking|pan|pot|knife|cutlery|utensil|mug|tumbler|thermos|water bottle|ice cream|coffee|tea|toaster|blender|microwave|vacuum|broom|mop|detergent|laundry|toilet|plunger|hardware|tool|drill|wrench|screwdriver|hammer|saw|welding|plumbing|solder|phone|iphone|samsung|xiaomi|huawei|ipad|tablet|laptop|computer|pc|keyboard|mouse|monitor|tv|television|camera|tripod|earphone|headphone|earbud|speaker|microphone|charger|cable|adapter|power bank|phone case|screen protector|controller|playstation|xbox|nintendo|gaming|console|drone|smartwatch|watch|clock|shirt|t-shirt|blouse|hoodie|sweater|cardigan|jacket|coat|parka|vest|dress|skirt|pants|jeans|trousers|shorts|leggings|tracksuit|suit|blazer|underwear|bra|panties|lingerie|briefs|boxer|socks|stockings|swimwear|bikini|swimsuit|pajama|nightgown|shoe|shoes|boot|boots|sneaker|sandal|slipper|heels|loafer|hat|beanie|baseball cap|scarf|gloves|mitten|belt|handbag|crossbody|shoulder bag|tote|backpack|wallet|luggage|suitcase|necklace|earring|bracelet|ring|anklet|pendant|brooch|jewelry|jewellery|sunglasses|eyeglasses|spectacles|car|auto|automotive|vehicle|truck|suv|sedan|motorcycle|motorbike|bicycle|bike|scooter|tire|wheel|helmet|windshield|wiper|bumper|fender|pet|dog|cat|puppy|kitten|aquarium|fish tank|bird|hamster|collar|leash|harness|litter|kennel|toy|doll|plush|stuffed|puzzle|lego|board game|action figure|fidget|rc|fishing|camping|tent|sleeping bag|golf|football|basketball|soccer|baseball|tennis|badminton|tactical|hunting|archery|stationery|notebook|binder|stapler|printer|ink cartridge|garden|lawn|mower|hose|plant pot|seed|fertilizer)\b/i;

// Non-beauty top-level CJ category names to reject immediately if present
const NON_BEAUTY_CATEGORY_REGEX = /\b(computer|office|electronics|phone|automotive|automobile|motorcycle|home improvement|lighting|furniture|kitchen|dining|pet|toy|hobbies|sports|outdoors|apparel|clothing|shoes|bags|luggage|jewelry|watches|security|industrial|mother & kids|kids|baby)\b/i;

// Legitimate Health, Beauty & Skincare category indicators in CJ's category tree
const HEALTH_BEAUTY_CATEGORY_REGEX = /\b(health|beauty|cosmetic|cosmetics|skincare|skin care|skin|makeup|make-up|make up|personal care|fragrance|perfume|nail|manicure|pedicure|hair care|haircare|hair styling|hair|wig|extensions|salon|spa|hygiene|oral care|dental|body care|bath|shower|facial|face|massage|relaxation|wellness|shaving|epilator|grooming|eyelash|brow|lip|eye care)\b/i;

// Comprehensive Beauty & Skincare product terms (matched on word boundaries)
const HEALTH_BEAUTY_PRODUCT_REGEX = /\b(skincare|skin care|facial|face care|cosmetic|cosmetics|makeup|make-up|beauty|serum|cleanser|cleansing|toner|moisturizer|moisturizing|lotion|cream|face cream|night cream|day cream|eye cream|hand cream|foot cream|body cream|bb cream|cc cream|balm|ointment|essence|ampoule|emulsion|gel|exfoliant|exfoliating|scrub|peel|peeling|mask|facial mask|face mask|sheet mask|clay mask|mud mask|eye mask|eye patch|eye patches|hydrogel|sleeping mask|lip mask|lip balm|lip gloss|lipgloss|lipstick|lip liner|lip oil|lip tint|lip stain|lip scrub|lip plumper|lip clay|lip glaze|foundation|concealer|primer|blush|blusher|bronzer|highlighter|illuminator|contour|palette|setting powder|loose powder|pressed powder|compact powder|setting spray|makeup fixer|eyeshadow|eye shadow|eyeliner|eye liner|mascara|eyebrow|brow|false lashes|eyelash|lash extension|lash lift|lash curler|lash serum|makeup brush|brush set|kabuki|beauty sponge|makeup sponge|blender sponge|powder puff|makeup remover|micellar|cleansing oil|cleansing balm|cotton pad|nail polish|gel nail|nail gel|nail art|nail file|nail drill|nail lamp|uv lamp|cuticle|manicure|pedicure|press on nails|poly gel|acrylic nail|shampoo|conditioner|hair mask|hair oil|hair serum|hair spray|hair mist|hair wax|hair treatment|scalp|keratin|argan|biotin|rosemary|edge control|hair growth|beard oil|beard balm|curl cream|detangler|comb|hairbrush|flat iron|curling iron|hair straightener|hair dryer|diffuser|epilator|trimmer|shaver|razor|waxing|wax beans|depilatory|collagen|retinol|retinoid|hyaluronic|vitamin c|vitamin e|niacinamide|nicotinamide|salicylic|glycolic|lactic acid|aha|bha|pha|azelaic|ceramide|peptide|squalane|centella|cica|snail|mucin|tea tree|aloe vera|rosehip|turmeric|kojic|bakuchiol|spf|sunscreen|sunblock|self tanner|tanning|aftersun|fragrance|perfume|parfum|cologne|eau de|body mist|deodorant|antiperspirant|body wash|shower gel|bath bomb|bath salt|body butter|body scrub|body lotion|body oil|essential oil|aromatherapy|gua sha|jade roller|quartz roller|ice roller|derma roller|microneedle|led mask|light therapy|facial steamer|nano mister|blackhead|pore|ultrasonic scrubber|acne|pimple patch|blemish|spot treatment|anti-aging|anti aging|anti-wrinkle|wrinkle|whitening|brightening|hydrating|hydration|firming|lifting|soothing|repairing|barrier|massager|cupping|posture corrector|heating pad|sleep mask|teeth whitening|whitening strips|toothbrush|water flosser|oral irrigator|tongue scraper)\b/i;

const isStrictHealthAndBeautyProduct = (title = '', categoryName = '', description = '', fromBeautySource = false) => {
  const cleanTitle = String(title || '').trim();
  const cleanCategory = String(categoryName || '').trim();
  const cleanDesc = String(description || '').replace(/<[^>]*>?/gm, ' ').slice(0, 400);
  if (!cleanTitle) return false;

  const combinedTitleAndCat = `${cleanTitle} ${cleanCategory}`;

  // 1. Hard exclusion gate: immediately reject if title or category hits any non-beauty exclusion keyword
  if (NON_BEAUTY_EXCLUSION_REGEX.test(combinedTitleAndCat)) {
    return false;
  }

  // 2. Reject if CJ explicitly placed the item in a non-beauty category (unless the category also says beauty/health/skincare/personal care)
  if (cleanCategory && NON_BEAUTY_CATEGORY_REGEX.test(cleanCategory) && !HEALTH_BEAUTY_CATEGORY_REGEX.test(cleanCategory)) {
    return false;
  }

  // 3. Accept if title or category matches our comprehensive Beauty & Skincare product regex
  if (HEALTH_BEAUTY_PRODUCT_REGEX.test(combinedTitleAndCat)) {
    return true;
  }

  // 4. If fetched from a verified CJ Beauty category or beauty search query, also check category + short description
  if ((fromBeautySource || HEALTH_BEAUTY_CATEGORY_REGEX.test(cleanCategory)) &&
      (HEALTH_BEAUTY_CATEGORY_REGEX.test(combinedTitleAndCat) || HEALTH_BEAUTY_PRODUCT_REGEX.test(cleanDesc))) {
    return true;
  }

  return false;
};

const extractCleanTags = (categoryName = '', title = '') => {
  const rawTokens = `${categoryName} ${title}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const allowedTagSet = new Set([
    'health', 'beauty', 'skincare', 'cosmetics', 'makeup', 'serum', 'cleanser',
    'toner', 'moisturizer', 'lotion', 'cream', 'mask', 'facial', 'lip', 'eye',
    'nail', 'manicure', 'hair', 'shampoo', 'conditioner', 'scalp', 'fragrance',
    'perfume', 'bath', 'body', 'wellness', 'massage', 'oral', 'hydration',
    'brightening', 'anti-aging', 'acne', 'sensitive', 'collagen', 'retinol',
    'sunscreen', 'hyaluronic', 'niacinamide', 'vitamin', 'exfoliant', 'scrub'
  ]);

  const tags = [];
  for (const token of rawTokens) {
    if (allowedTagSet.has(token) && !tags.includes(token)) {
      tags.push(token);
    }
  }
  if (tags.length === 0) tags.push('beauty', 'skincare');
  return tags;
};

// ---------------- BLUEPRINT PRODUCT CLASSIFIER & DIAGNOSTIC DOSSIER ENGINE ---------------- //

const parseStringOrArrayField = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map(v => String(v || '').trim()).filter(Boolean);
  }
  return String(val)
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
};

// Deterministically labels any CJ or custom boutique product with structured Blueprint compatibility fields:
// - skinTypes: ['Dry', 'Oily', 'Combination', 'Normal', 'All Skin Types']
// - skinConcerns: ['Hydration', 'Anti-Aging', 'Acne/Texture', 'Brightening', 'Barrier & Soothing', 'Luminous Makeup']
// - sensitivitySafe (Boolean) & sensitivityLabel (String)
// - ritualStep: 'Step 1: Cleanser' | 'Step 2: Toner & Mist' | 'Step 3: Serum & Essence' | 'Step 4: Moisturizer & Cream' | 'Step 5: Eye, Lip & SPF' | 'Makeup & Artistry' | 'Beauty Tool & Spa'
// - keyActives: Array of notable hero actives or formulation highlights
const classifyProductForBlueprint = (title = '', categoryName = '', description = '', customFields = {}) => {
  const cleanTitle = String(title || '').trim();
  const cleanCat = String(categoryName || '').trim();
  const cleanDesc = String(description || '').replace(/<[^>]*>?/gm, ' ').slice(0, 800);
  const customTagsList = parseStringOrArrayField(customFields?.tags);
  const corpus = `${cleanTitle} ${cleanCat} ${cleanDesc} ${customTagsList.join(' ')}`.toLowerCase();

  // 1. Determine Ritual Step
  let ritualStep = 'Step 3: Serum & Essence';
  if (customFields?.ritualStep && String(customFields.ritualStep).trim()) {
    ritualStep = String(customFields.ritualStep).trim();
  } else if (/\b(foundation|concealer|primer|blush|blusher|bronzer|highlighter|illuminator|contour|palette|setting powder|loose powder|pressed powder|compact powder|setting spray|makeup fixer|eyeshadow|eye shadow|eyeliner|eye liner|mascara|eyebrow|brow|false lashes|eyelash|lipstick|lip gloss|lipgloss|lip liner|lip tint|lip stain|lip clay|lip glaze|bb cream|cc cream|makeup|cosmetic)\b/i.test(corpus)) {
    ritualStep = 'Makeup & Artistry';
  } else if (/\b(gua sha|jade roller|quartz roller|ice roller|derma roller|microneedle|led mask|light therapy|facial steamer|nano mister|ultrasonic|massager|makeup brush|brush set|kabuki|beauty sponge|makeup sponge|blender sponge|powder puff|lash curler|nail|manicure|pedicure|shampoo|conditioner|hair oil|hair mask|hair serum|scalp|perfume|fragrance|parfum|cologne|body mist|bath bomb|bath salt)\b/i.test(corpus)) {
    ritualStep = 'Beauty Tool & Spa';
  } else if (/\b(cleanser|cleansing|face wash|facial wash|micellar|makeup remover|exfoliant|exfoliating|scrub|peel|peeling|blackhead remover|foam wash)\b/i.test(corpus)) {
    ritualStep = 'Step 1: Cleanser';
  } else if (/\b(toner|facial mist|face mist|rosewater|hydrosol|essence water|toning|refining water|balancing water)\b/i.test(corpus)) {
    ritualStep = 'Step 2: Toner & Mist';
  } else if (/\b(eye cream|eye patch|eye patches|eye mask|eye serum|eye gel|under eye|lip balm|lip mask|lip oil|lip scrub|lip plumper|lip sleeping|sunscreen|sunblock|spf|uv protection)\b/i.test(corpus)) {
    ritualStep = 'Step 5: Eye, Lip & SPF';
  } else if (/\b(moisturizer|moisturizing|face cream|night cream|day cream|neck cream|barrier cream|lotion|body lotion|body butter|body cream|emulsion|gel cream|balm|sleeping mask|ointment)\b/i.test(corpus)) {
    ritualStep = 'Step 4: Moisturizer & Cream';
  } else {
    ritualStep = 'Step 3: Serum & Essence';
  }

  // 2. Determine Skin Concerns / Primary Goals
  const explicitConcerns = parseStringOrArrayField(customFields?.skinConcerns);
  const skinConcerns = [...explicitConcerns];
  const addConcern = (c) => {
    if (c && !skinConcerns.includes(c)) skinConcerns.push(c);
  };

  if (explicitConcerns.length === 0) {
    if (/\b(hydrat|hyaluronic|moisture|moisturiz|dry|plump|dewy|water|squalane|glycerin|aloe|snail|mucin|hydrogel|lotion|cream|balm|mist|lip oil|lip balm)\b/i.test(corpus)) {
      addConcern('Hydration');
    }
    if (/\b(anti-aging|anti aging|anti-wrinkle|wrinkle|fine line|firming|lifting|retinol|retinoid|peptide|collagen|elasticity|youth|age-defying|bakuchiol|eye cream|neck|gua sha|jade roller|led mask|massager)\b/i.test(corpus)) {
      addConcern('Anti-Aging');
    }
    if (/\b(acne|blemish|pimple|pore|blackhead|salicylic|bha|aha|pha|glycolic|lactic|exfoliat|scrub|peel|clay|mud|charcoal|tea tree|niacinamide|nicotinamide|oil control|mattif|sebum|purifying|cleanser|scrubber)\b/i.test(corpus)) {
      addConcern('Acne/Texture');
    }
    if (/\b(brighten|whitening|vitamin c|ascorbic|dark spot|hyperpigmentation|even tone|glow|radiance|radiant|luminous|kojic|turmeric|arbutin|pearl|illuminat|niacinamide)\b/i.test(corpus)) {
      addConcern('Brightening');
    }
    if (/\b(sensitive|soothing|calming|barrier|ceramide|centella|cica|aloe|chamomile|rose|panthenol|allantoin|redness|repair|gentle|fragrance-free|micellar|oat)\b/i.test(corpus)) {
      addConcern('Barrier & Soothing');
    }
    if (ritualStep === 'Makeup & Artistry' || /\b(makeup|cosmetic|foundation|concealer|blush|highlighter|lipstick|lip gloss|eyeshadow|mascara|eyeliner|brow|contour|powder|palette)\b/i.test(corpus)) {
      addConcern('Luminous Makeup');
    }

    // Fallback by ritualStep so no product ever has an empty skinConcerns array
    if (skinConcerns.length === 0) {
      if (ritualStep === 'Step 1: Cleanser') {
        addConcern('Acne/Texture');
        addConcern('Barrier & Soothing');
      } else if (ritualStep === 'Step 2: Toner & Mist') {
        addConcern('Hydration');
        addConcern('Barrier & Soothing');
      } else if (ritualStep === 'Step 4: Moisturizer & Cream') {
        addConcern('Hydration');
        addConcern('Barrier & Soothing');
      } else if (ritualStep === 'Step 5: Eye, Lip & SPF') {
        addConcern('Hydration');
        addConcern('Anti-Aging');
      } else if (ritualStep === 'Beauty Tool & Spa') {
        addConcern('Anti-Aging');
        addConcern('Barrier & Soothing');
      } else {
        addConcern('Hydration');
        addConcern('Brightening');
      }
    }
  }

  // 3. Determine Best-Fit Skin Types (Normal, Dry, Oily, Combination, All Skin Types)
  const explicitSkinTypes = parseStringOrArrayField(customFields?.skinTypes);
  const skinTypes = [...explicitSkinTypes];
  const addSkinType = (st) => {
    if (st && !skinTypes.includes(st)) skinTypes.push(st);
  };

  if (explicitSkinTypes.length === 0) {
    if (/\b(dry skin|thirsty|dehydrated|rich cream|nourishing|hydrating|hyaluronic|ceramide|squalane|shea|argan|balm|facial oil|sleeping mask|moisture|night cream|lip oil|lip balm)\b/i.test(corpus) || skinConcerns.includes('Hydration')) {
      addSkinType('Dry');
    }
    if (/\b(oily skin|oil control|mattifying|matte|sebum|salicylic|bha|clay|mud|charcoal|pore|blackhead|tea tree|acne|blemish|pimple|foaming|gel cleanser|lightweight|water gel|setting powder|loose powder)\b/i.test(corpus) || skinConcerns.includes('Acne/Texture')) {
      addSkinType('Oily');
    }
    if (/\b(combination skin|balancing|niacinamide|toner|mist|serum|essence|gel cream|lotion|sheet mask|micellar|vitamin c|cleanser)\b/i.test(corpus) || (skinTypes.includes('Dry') && skinTypes.includes('Oily'))) {
      addSkinType('Combination');
    }
    if (/\b(normal skin|all skin|daily|gentle|balanced|vitamin c|peptide|collagen|brightening|eye|lip|sunscreen|spf)\b/i.test(corpus) || skinConcerns.includes('Brightening') || skinConcerns.includes('Anti-Aging')) {
      addSkinType('Normal');
    }

    if (
      ritualStep === 'Makeup & Artistry' ||
      ritualStep === 'Beauty Tool & Spa' ||
      ritualStep === 'Step 5: Eye, Lip & SPF' ||
      skinTypes.length === 0 ||
      skinTypes.length >= 3
    ) {
      if (skinTypes.length === 0) {
        addSkinType('Normal');
        addSkinType('Dry');
        addSkinType('Combination');
        addSkinType('Oily');
      }
      addSkinType('All Skin Types');
    } else if (skinTypes.length === 1) {
      // Pair single skin types with their natural companion so members get accurate matches
      if (skinTypes[0] === 'Dry') addSkinType('Normal');
      else if (skinTypes[0] === 'Oily') addSkinType('Combination');
      else if (skinTypes[0] === 'Combination') addSkinType('Normal');
      else if (skinTypes[0] === 'Normal') addSkinType('All Skin Types');
    }
  }

  // 4. Determine Sensitivity Profile
  const hasPotentActives = /\b(retinol|retinoid|aha|bha|pha|glycolic|salicylic|lactic acid|peel|peeling|scrub|exfoliant|exfoliating|microneedle|derma roller)\b/i.test(corpus);
  const sensitivitySafe = customFields?.sensitivitySafe !== undefined
    ? Boolean(customFields.sensitivitySafe)
    : !hasPotentActives;

  const sensitivityLabel = (customFields?.sensitivityLabel && String(customFields.sensitivityLabel).trim())
    ? String(customFields.sensitivityLabel).trim()
    : (sensitivitySafe
        ? 'Gentle • High-Sensitivity Safe'
        : 'Active Formula • Best for Low/Moderate Sensitivity');

  // 5. Extract Key Actives / Formulation Highlights
  const explicitActives = parseStringOrArrayField(customFields?.keyActives);
  const keyActives = [...explicitActives];
  const addActive = (act) => {
    if (act && !keyActives.includes(act) && keyActives.length < 4) keyActives.push(act);
  };

  if (explicitActives.length === 0) {
    const activeRules = [
      { regex: /\b(hyaluronic|sodium hyaluronate)\b/i, name: 'Hyaluronic Acid' },
      { regex: /\b(ceramide)\b/i, name: 'Barrier Ceramides' },
      { regex: /\b(niacinamide|nicotinamide|vitamin b3)\b/i, name: 'Niacinamide (B3)' },
      { regex: /\b(vitamin c|ascorbic)\b/i, name: 'Vitamin C Complex' },
      { regex: /\b(peptide|matrixyl|argireline)\b/i, name: 'Firming Peptides' },
      { regex: /\b(collagen)\b/i, name: 'Hydrolyzed Collagen' },
      { regex: /\b(retinol|retinoid|bakuchiol)\b/i, name: 'Retinol / Cellular Renewal' },
      { regex: /\b(salicylic|bha|tea tree)\b/i, name: 'Clarifying BHA / Tea Tree' },
      { regex: /\b(glycolic|lactic|aha|pha|exfoli)\b/i, name: 'Smoothing AHA Complex' },
      { regex: /\b(centella|cica|aloe|chamomile|calendula|green tea)\b/i, name: 'Soothing Botanical Cica' },
      { regex: /\b(squalane|argan|rosehip|jojoba|shea|vitamin e)\b/i, name: 'Nourishing Lipid Oils' },
      { regex: /\b(snail|mucin)\b/i, name: 'Snail Mucin Filtrate' },
      { regex: /\b(rose|rosewater)\b/i, name: 'Botanical Rosewater' },
      { regex: /\b(clay|kaolin|bentonite|charcoal|mud)\b/i, name: 'Purifying Mineral Clay' },
      { regex: /\b(spf|sunscreen|uv|zinc|titanium)\b/i, name: 'Broad-Spectrum UV Shield' }
    ];

    for (const rule of activeRules) {
      if (rule.regex.test(corpus)) addActive(rule.name);
    }

    if (keyActives.length === 0) {
      if (ritualStep === 'Makeup & Artistry') {
        addActive('Luminous Mineral Pigments');
        addActive('Weightless Breathable Wear');
      } else if (ritualStep === 'Beauty Tool & Spa') {
        addActive('Lymphatic Micro-Circulation');
        addActive('Artisan Spa Craft');
      } else {
        addActive('Hydrating Botanical Complex');
        addActive('pH-Balanced Conditioning');
      }
    }
  }

  // 6. Enrich legacy flat tags array so search & tag queries work seamlessly
  const baseTags = extractCleanTags(cleanCat, cleanTitle);
  const mergedTags = [...new Set([
    ...baseTags,
    ...customTagsList.map(t => t.toLowerCase()),
    ...skinTypes.map(t => t.toLowerCase()),
    ...skinConcerns.map(c => c.toLowerCase())
  ])];

  return {
    skinTypes,
    skinConcerns,
    sensitivitySafe,
    sensitivityLabel,
    ritualStep,
    keyActives,
    tags: mergedTags
  };
};

// Backfills structured Blueprint labels onto all existing products in MongoDB
const backfillProductBlueprintLabels = async (forceAll = false) => {
  try {
    const query = forceAll
      ? {}
      : {
          $or: [
            { skinTypes: { $exists: false } },
            { skinTypes: { $size: 0 } },
            { skinConcerns: { $exists: false } },
            { skinConcerns: { $size: 0 } },
            { ritualStep: { $exists: false } },
            { ritualStep: '' }
          ]
        };

    const productsToUpdate = await Product.find(query).lean();
    if (!productsToUpdate.length) {
      return { updatedCount: 0, totalCount: await Product.countDocuments() };
    }

    let updatedCount = 0;
    const bulkOps = [];

    for (const prod of productsToUpdate) {
      const catName = prod.rawCjData?.categoryName || (Array.isArray(prod.tags) ? prod.tags.join(' ') : '');
      const classified = classifyProductForBlueprint(
        prod.title,
        catName,
        prod.description,
        forceAll ? { tags: prod.tags } : {
          skinTypes: prod.skinTypes,
          skinConcerns: prod.skinConcerns,
          sensitivitySafe: prod.sensitivitySafe,
          sensitivityLabel: prod.sensitivityLabel,
          ritualStep: prod.ritualStep,
          keyActives: prod.keyActives,
          tags: prod.tags
        }
      );

      bulkOps.push({
        updateOne: {
          filter: { _id: prod._id },
          update: {
            $set: {
              skinTypes: classified.skinTypes,
              skinConcerns: classified.skinConcerns,
              sensitivitySafe: classified.sensitivitySafe,
              sensitivityLabel: classified.sensitivityLabel,
              ritualStep: classified.ritualStep,
              keyActives: classified.keyActives,
              tags: classified.tags
            }
          }
        }
      });
      updatedCount++;
    }

    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps);
      console.log(`🏷️ Labeled ${updatedCount} boutique product(s) with Skin Types, Skin Conditions & Ritual Steps.`);
    }

    const totalCount = await Product.countDocuments();
    return { updatedCount, totalCount };
  } catch (err) {
    console.error('⚠️ Error backfilling product blueprint labels:', err.message);
    return { updatedCount: 0, totalCount: 0, error: err.message };
  }
};

// Synthesizes a rich, personalized Beauty Blueprint Dossier from the member's 10 quiz answers
const generateBlueprintAnalysis = (bp = {}) => {
  const skinType = String(bp.skinType || 'Normal').trim();
  const primaryGoal = String(bp.primaryGoal || 'Hydration').trim();
  const climate = String(bp.climate || 'Temperate').trim();
  const skinSensitivity = String(bp.skinSensitivity || 'Moderate').trim();
  const complexion = String(bp.complexion || 'Medium').trim();
  const undertone = String(bp.undertone || 'Neutral').trim();
  const eyeColor = String(bp.eyeColor || 'Brown').trim();
  const faceShape = String(bp.faceShape || 'Oval').trim();
  const makeupVibe = String(bp.makeupVibe || 'Soft Glam').trim();
  const routineFocus = String(bp.routineFocus || 'Balanced').trim();

  // 1. Archetype Title & Executive Diagnostic Summary
  const archetypeMap = {
    'Dry_Hydration': 'The Velvet Moisture Sanctuary',
    'Dry_Anti-Aging': 'The Cashmere Youth Elixir',
    'Dry_Brightening': 'The Dewy Rosewater Luminary',
    'Dry_Acne/Texture': 'The Silk Barrier Clarifier',
    'Oily_Acne/Texture': 'The Clarifying Satin Refiner',
    'Oily_Hydration': 'The Weightless Hydro-Balance Ritual',
    'Oily_Anti-Aging': 'The Sculpted Velvet Renewal',
    'Oily_Brightening': 'The Glass-Skin Radiance Edit',
    'Combination_Hydration': 'The Harmonious Dual-Zone Sanctuary',
    'Combination_Acne/Texture': 'The Balanced Pore & Texture Edit',
    'Combination_Anti-Aging': 'The Ageless Equilibrium Ritual',
    'Combination_Brightening': 'The Luminous Equilibrium Protocol',
    'Normal_Hydration': 'The Porcelain Dew Sanctuary',
    'Normal_Anti-Aging': 'The Timeless Cellular Radiance Ritual',
    'Normal_Brightening': 'The Golden Hour Luminosity Edit',
    'Normal_Acne/Texture': 'The Polished Silk Refinement'
  };

  const archetypeTitle =
    archetypeMap[`${skinType}_${primaryGoal}`] ||
    `The Bespoke ${skinType} & ${primaryGoal} Sanctuary`;

  const climateDescriptions = {
    'Dry': 'your arid, low-humidity environment continuously pulls moisture from the epidermis (transepidermal water loss), requiring humectants sealed beneath barrier lipids',
    'Humid': 'your humid climate amplifies surface sebum and sweat, calling for breathable, gel-serum hydration and non-comedogenic pore refinement',
    'Cold': 'your cold, harsh climate stresses the lipid barrier and triggers micro-chapping, requiring ceramide-rich cushioning and soothing protection',
    'Temperate': 'your temperate climate supports balanced cellular turnover when paired with consistent morning antioxidant protection and evening hydration'
  };

  const sensitivityDescriptions = {
    'High': 'Because your skin has High Sensitivity, every step prioritizes calming barrier protection (`Gentle • High-Sensitivity Safe` labels) over aggressive acids.',
    'Moderate': 'With Moderate Sensitivity, your skin thrives on buffered actives paired with soothing Centella, rosewater, and barrier-supporting ceramides.',
    'Low': 'Your resilient, Low-Sensitivity canvas tolerates both gentle daily hydrators and targeted resurfacing or cellular-renewal actives.'
  };

  const executiveSummary =
    `Your diagnostic profile reveals a ${skinType} skin temperament focused on ${primaryGoal}. ` +
    `Because ${climateDescriptions[climate] || climateDescriptions['Temperate']}, your ritual is architected to deliver ${primaryGoal.toLowerCase()} without overwhelming your natural barrier. ` +
    `${sensitivityDescriptions[skinSensitivity] || sensitivityDescriptions['Moderate']}`;

  // 2. Recommended Boutique Product Labels (for instant cross-referencing in the Boutique)
  const targetSkinTypes = [skinType, 'All Skin Types'];
  const targetSkinConcerns = [primaryGoal];
  if (skinSensitivity === 'High' || skinSensitivity === 'Moderate' || climate === 'Dry' || climate === 'Cold') {
    if (!targetSkinConcerns.includes('Barrier & Soothing')) targetSkinConcerns.push('Barrier & Soothing');
  }
  if ((skinType === 'Dry' || climate === 'Dry' || climate === 'Cold') && !targetSkinConcerns.includes('Hydration')) {
    targetSkinConcerns.push('Hydration');
  }
  if (!targetSkinConcerns.includes('Luminous Makeup')) {
    targetSkinConcerns.push('Luminous Makeup');
  }

  const sensitivityBadge =
    skinSensitivity === 'High'
      ? 'Gentle • High-Sensitivity Safe'
      : skinSensitivity === 'Moderate'
      ? 'Gentle • Barrier Balanced'
      : 'All Formulas & Actives Compatible';

  const allBadges = [
    {
      label: `${skinType} Skin`,
      category: 'Skin Type',
      filterType: 'skinType',
      filterValue: skinType,
      description: `Formulated specifically for ${skinType.toLowerCase()} skin behavior.`
    },
    {
      label: primaryGoal,
      category: 'Primary Condition',
      filterType: 'skinConcern',
      filterValue: primaryGoal,
      description: `Directly targets your primary vision: ${primaryGoal}.`
    },
    ...(targetSkinConcerns.includes('Barrier & Soothing') && primaryGoal !== 'Barrier & Soothing'
      ? [{
          label: 'Barrier & Soothing',
          category: 'Sensitivity & Climate Care',
          filterType: 'skinConcern',
          filterValue: 'Barrier & Soothing',
          description: `Protects your ${skinSensitivity.toLowerCase()}-sensitivity skin in a ${climate.toLowerCase()} climate.`
        }]
      : []),
    ...(targetSkinConcerns.includes('Hydration') && primaryGoal !== 'Hydration'
      ? [{
          label: 'Hydration',
          category: 'Moisture Balance',
          filterType: 'skinConcern',
          filterValue: 'Hydration',
          description: `Prevents dehydration and tightness in ${climate.toLowerCase()} conditions.`
        }]
      : []),
    {
      label: sensitivityBadge,
      category: 'Sensitivity Safety',
      filterType: 'sensitivity',
      filterValue: skinSensitivity === 'High' ? 'safe' : 'all',
      description: skinSensitivity === 'High'
        ? 'Look for products marked Gentle • High-Sensitivity Safe.'
        : 'Compatible with your skin reactivity threshold.'
    }
  ];

  // 3. Hero Ingredients to Seek vs. Avoid
  const heroIngredients = [];
  const addHero = (name, benefit, targetConcern) => {
    if (!heroIngredients.some(h => h.name === name) && heroIngredients.length < 5) {
      heroIngredients.push({ name, benefit, targetConcern });
    }
  };

  if (primaryGoal === 'Hydration' || skinType === 'Dry' || climate === 'Dry') {
    addHero('Multi-Molecular Hyaluronic Acid', 'Draws moisture deep into thirsty skin layers for instant plumping and softness.', 'Hydration');
    addHero('Barrier Ceramides & Squalane', 'Seals the lipid barrier so arid air cannot strip away your natural hydration.', 'Barrier & Soothing');
  }
  if (primaryGoal === 'Anti-Aging') {
    addHero('Bio-Active Peptides & Collagen', 'Supports firmness, bounce, and smooths the appearance of fine expression lines.', 'Anti-Aging');
    addHero(
      skinSensitivity === 'High' ? 'Bakuchiol & Gentle Botanical Renewal' : 'Encapsulated Retinol / Retinoid Complex',
      skinSensitivity === 'High'
        ? 'Delivers retinol-like cellular renewal without redness or peeling for sensitive skin.'
        : 'Accelerates evening cellular turnover to refine wrinkles and elasticity.',
      'Anti-Aging'
    );
  }
  if (primaryGoal === 'Acne/Texture' || skinType === 'Oily' || skinType === 'Combination') {
    addHero('Niacinamide (Vitamin B3)', 'Balances sebum production, visibly tightens enlarged pores, and calms redness.', 'Acne/Texture');
    addHero(
      skinSensitivity === 'High' ? 'Purifying Kaolin Clay & Tea Tree Hydrosol' : 'Salicylic Acid (BHA) & Gentle AHA',
      skinSensitivity === 'High'
        ? 'Draws out congestion gently without stripping your delicate moisture barrier.'
        : 'Dissolves pore-clogging oil and smooths uneven surface texture.',
      'Acne/Texture'
    );
  }
  if (primaryGoal === 'Brightening') {
    addHero('Stabilized Vitamin C Complex', 'Neutralizes dullness, brightens dark spots, and boosts natural luminosity.', 'Brightening');
    addHero('Botanical Rosewater & Licorice Root', 'Evens out skin tone while keeping the complexion calm and dewy.', 'Brightening');
  }
  if (skinSensitivity === 'High' || skinSensitivity === 'Moderate' || heroIngredients.length < 4) {
    addHero('Centella Asiatica (Cica) & Aloe', 'Calms reactivity, reduces visible redness, and reinforces skin resilience.', 'Barrier & Soothing');
    addHero('Hydrolyzed Collagen & Vitamin E', 'Cushions the complexion against environmental stress and free radicals.', 'Hydration');
  }

  const avoidIngredients = [];
  if (skinSensitivity === 'High') {
    avoidIngredients.push(
      { name: 'High-Percentage Unbuffered Glycolic / Peel Acids', reason: 'Can compromise a high-sensitivity lipid barrier and trigger stinging or flushing.' },
      { name: 'Coarse Physical Nut/Shell Scrubs', reason: 'Creates micro-tears on reactive skin; opt for silky gel cleansers or enzyme care instead.' },
      { name: 'Drying Denatured Alcohol Toners', reason: 'Strips protective surface lipids and accelerates redness.' }
    );
  } else if (skinType === 'Dry' || climate === 'Dry' || climate === 'Cold') {
    avoidIngredients.push(
      { name: 'High-Sulfate Stripping Foam Cleansers', reason: 'Leaves dry or cold-exposed skin feeling tight and depleted.' },
      { name: 'Unsealed Clay Masks Used Daily', reason: 'Absorbs essential surface oils unless followed immediately by a rich hydrating serum.' },
      { name: 'Alcohol-Heavy Setting Sprays', reason: 'Can dehydrate your complexion canvas throughout the day.' }
    );
  } else if (skinType === 'Oily' || climate === 'Humid') {
    avoidIngredients.push(
      { name: 'Heavy Occlusive Petrolatum Balms (Daytime)', reason: 'Can trap heat and excess sebum in humid environments.' },
      { name: 'Pore-Congesting Coconut Oil Bases', reason: 'May congest T-zone pores on oily or combination temperaments.' },
      { name: 'Over-Exfoliating Multiple Times Daily', reason: 'Triggers rebound oil production when the barrier feels stripped.' }
    );
  } else {
    avoidIngredients.push(
      { name: 'Stacking Retinol + Strong Exfoliating Acids in the Same Night', reason: 'Can disrupt your balanced barrier; alternate renewal nights with hydration nights.' },
      { name: 'Harsh Alkaline Bar Soaps', reason: 'Disrupts your natural acid mantle pH.' },
      { name: 'Skipping Morning UV / Antioxidant Protection', reason: 'Allows daily environmental UV exposure to undo brightening and firming progress.' }
    );
  }

  // 4. Bespoke AM & PM Ritual Architecture (Tailored to routineFocus: Minimalist=3, Balanced=4, Luxurious=5)
  const stepLimit = routineFocus === 'Minimalist' ? 3 : routineFocus === 'Balanced' ? 4 : 5;

  const fullAmSteps = [
    {
      stepNumber: 1,
      ritualStep: 'Step 1: Cleanser',
      title: skinType === 'Dry' || skinSensitivity === 'High' ? 'Gentle Barrier Awakening Cleanse' : 'Purifying Morning Refresh Cleanse',
      instruction: `Cleanse with lukewarm water to refresh your ${skinType.toLowerCase()} canvas without stripping essential morning lipids.`,
      lookForLabel: 'Step 1: Cleanser'
    },
    {
      stepNumber: 2,
      ritualStep: 'Step 2: Toner & Mist',
      title: 'pH-Balancing Botanical Prep Mist',
      instruction: `Mist or press into damp skin to prime your epidermis and counter ${climate.toLowerCase()}-climate dehydration.`,
      lookForLabel: 'Step 2: Toner & Mist'
    },
    {
      stepNumber: 3,
      ritualStep: 'Step 3: Serum & Essence',
      title: `Targeted ${primaryGoal} Day Serum`,
      instruction: `Press 2–3 drops of a ${primaryGoal.toLowerCase()} serum into face and neck to deliver concentrated daytime actives.`,
      lookForLabel: 'Step 3: Serum & Essence'
    },
    {
      stepNumber: 4,
      ritualStep: 'Step 4: Moisturizer & Cream',
      title: skinType === 'Oily' || climate === 'Humid' ? 'Weightless Hydro-Lock Emulsion' : 'Velvet Barrier-Sealing Day Cream',
      instruction: `Lock in your serum and cushion your ${skinSensitivity.toLowerCase()}-sensitivity barrier for smooth makeup prep.`,
      lookForLabel: 'Step 4: Moisturizer & Cream'
    },
    {
      stepNumber: 5,
      ritualStep: 'Step 5: Eye, Lip & SPF',
      title: 'Luminous Eye, Lip & UV Sanctuary Shield',
      instruction: 'Tap brightening care around the orbital bone, nourish lips, and seal with broad-spectrum UV protection.',
      lookForLabel: 'Step 5: Eye, Lip & SPF'
    }
  ];

  const fullPmSteps = [
    {
      stepNumber: 1,
      ritualStep: 'Step 1: Cleanser',
      title: 'Evening Melt & Pore Detox Cleanse',
      instruction: `Dissolve daily SPF, ${makeupVibe.toLowerCase()} makeup, and environmental impurities thoroughly yet gently.`,
      lookForLabel: 'Step 1: Cleanser'
    },
    {
      stepNumber: 2,
      ritualStep: 'Step 2: Toner & Mist',
      title: 'Soothing Hydration Drench',
      instruction: 'Replenish moisture immediately after cleansing so evening recovery actives absorb evenly.',
      lookForLabel: 'Step 2: Toner & Mist'
    },
    {
      stepNumber: 3,
      ritualStep: 'Step 3: Serum & Essence',
      title: `Overnight ${primaryGoal} & Cellular Repair Elixir`,
      instruction: `Apply your targeted ${primaryGoal.toLowerCase()} treatment while skin permeability peaks during sleep.`,
      lookForLabel: 'Step 3: Serum & Essence'
    },
    {
      stepNumber: 4,
      ritualStep: 'Step 4: Moisturizer & Cream',
      title: 'Restorative Night Sanctuary Cream',
      instruction: `Seal in overnight nutrients and prevent moisture loss in your ${climate.toLowerCase()} environment.`,
      lookForLabel: 'Step 4: Moisturizer & Cream'
    },
    {
      stepNumber: 5,
      ritualStep: 'Beauty Tool & Spa',
      title: 'Eye/Lip Sleeping Mask & Gua Sha Lymphatic Ritual',
      instruction: 'Finish with nourishing eye/lip care and 2 minutes of upward facial massage to release tension and sculpt.',
      lookForLabel: 'Beauty Tool & Spa'
    }
  ];

  const selectStepsByFocus = (steps) => {
    if (stepLimit === 3) {
      // Cleanser, Serum, Moisturizer
      return [steps[0], steps[2], steps[3]].map((s, i) => ({ ...s, stepNumber: i + 1 }));
    }
    if (stepLimit === 4) {
      // Cleanser, Toner/Mist, Serum, Moisturizer
      return [steps[0], steps[1], steps[2], steps[3]].map((s, i) => ({ ...s, stepNumber: i + 1 }));
    }
    return steps;
  };

  const amRitual = selectStepsByFocus(fullAmSteps);
  const pmRitual = selectStepsByFocus(fullPmSteps);

  // 5. Complexion, Undertone, Eye Color & Facial Silhouette Artistry Guide
  const undertoneHarmony = {
    'Cool': {
      base: `Choose ${complexion} foundations and concealers with rosy, pink, or cool-neutral undertones so your base never looks yellow or brassy.`,
      blushLip: 'Berry, rose-petal pink, cool mauve, cherry, and plum lip oils and blushes illuminate your natural cool undertone.'
    },
    'Warm': {
      base: `Select ${complexion} complexion products with golden, peach, or warm-honey undertones to harmonize with your natural warmth.`,
      blushLip: 'Warm terracotta, apricot, coral,honey-nude, and bronze-gold highlighters make your complexion glow effortlessly.'
    },
    'Neutral': {
      base: `Look for balanced ${complexion} neutral shades that bridge rose and golden pigments without pulling too pink or too orange.`,
      blushLip: 'Soft rosewood, dusty peach,champagne pearl, and berry-nude tones flatter your versatile neutral canvas.'
    }
  };

  const eyeHarmony = {
    'Brown': 'Rich bronze, champagne gold, warm plum, and espresso liners intensify the depth and warmth of your brown eyes.',
    'Blue': 'Warm copper, toasted terracotta, champagne-peach, and bronze eyeshadows create striking contrast that makes blue eyes pop.',
    'Green': 'Rose-gold, mulberry, garnet, and softtaupe shimmers spotlight the emerald and hazel flecks in your eyes.'
  };

  const faceShapeGuide = {
    'Oval': 'Your balanced oval silhouette shines with soft blush swept along the apples of the cheeks toward the temples and a touch of highlighter on the high cheekbones.',
    'Round': 'Create lifted dimension by sweeping bronzer slightly beneath the cheekbones toward the temples and focusing highlighter along the center bridge and brow bone.',
    'Square/Heart': 'Soften angles by diffusing blush in a rounded upward sweep on the cheeks and adding a luminous kiss of highlighter to the cheekbones and Cupid’s bow.'
  };

  const vibeGuide = {
    'Natural': 'Focus on skin-first "Barely There" luminosity: sheer hydrating tints, brushed-up brows, a swipe of nourishing lip oil, and dewy cream highlighter.',
    'Soft Glam': 'Build "Elevated Everyday Elegance": seamless satin-finish complexion, softly defined lash line, diffused rose/peach cheek drape, and a plush glossed lip.',
    'Full Glam': 'Embrace "Sculpted High-Impact Artistry": primed long-wear base, multi-dimensional eye shadow placement, sculpted contour, and a statement defined lip.'
  };

  const selectedUndertone = undertoneHarmony[undertone] || undertoneHarmony['Neutral'];

  const artistryProfile = {
    headline: `${complexion} Canvas • ${undertone} Undertone • ${makeupVibe} Artistry`,
    foundationAndBase: selectedUndertone.base,
    blushAndLipHarmony: selectedUndertone.blushLip,
    eyeEnhancement: eyeHarmony[eyeColor] || eyeHarmony['Brown'],
    sculptingPlacement: faceShapeGuide[faceShape] || faceShapeGuide['Oval'],
    signatureFinish: vibeGuide[makeupVibe] || vibeGuide['Soft Glam']
  };

  return {
    archetypeTitle,
    executiveSummary,
    recommendedLabels: {
      skinTypes: targetSkinTypes,
      skinConcerns: targetSkinConcerns,
      sensitivityBadge,
      climateContext: `${climate} Climate Care`,
      routineTier: `${routineFocus} (${stepLimit}-Step Ritual)`,
      allBadges
    },
    heroIngredients,
    avoidIngredients,
    amRitual,
    pmRitual,
    artistryProfile,
    generatedAt: new Date().toISOString()
  };
};

// Backfills blueprintAnalysis onto any existing Consultation documents in MongoDB
const backfillConsultationAnalyses = async () => {
  try {
    const consultations = await Consultation.find({}).lean();
    let updatedCount = 0;
    for (const c of consultations) {
      if (!c.blueprintAnalysis || !c.blueprintAnalysis.archetypeTitle) {
        const analysis = generateBlueprintAnalysis(c);
        await Consultation.findByIdAndUpdate(c._id, { $set: { blueprintAnalysis: analysis } });
        updatedCount++;
      }
    }
    if (updatedCount > 0) {
      console.log(`✨ Generated rich Blueprint Dossier analysis for ${updatedCount} existing member consultation(s).`);
    }
    return updatedCount;
  } catch (err) {
    console.warn('⚠️ Error backfilling consultation analyses:', err.message);
    return 0;
  }
};

// Purges any previously synced CJ products in MongoDB that fail the strict Health & Beauty filter,
// while preserving Susan's manually added custom boutique products.
const purgeNonBeautyCjProducts = async () => {
  try {
    const cjProducts = await Product.find({ rawCjData: { $exists: true, $ne: null } }).lean();
    const idsToDelete = [];

    for (const prod of cjProducts) {
      const catName = prod.rawCjData?.categoryName || (Array.isArray(prod.tags) ? prod.tags.join(' ') : '');
      const price = Number(prod.variants?.[0]?.price ?? prod.price ?? 0);
      const isValidBeauty = isStrictHealthAndBeautyProduct(prod.title, catName, prod.description, false);

      if (!isValidBeauty || !(price > 0)) {
        idsToDelete.push(prod._id);
      }
    }

    if (idsToDelete.length > 0) {
      await Product.deleteMany({ _id: { $in: idsToDelete } });
      await User.updateMany(
        { recommendedProducts: { $in: idsToDelete } },
        { $pull: { recommendedProducts: { $in: idsToDelete } } }
      );
      await InboxItem.deleteMany({ productId: { $in: idsToDelete } });
      console.log(`🧹 Purged ${idsToDelete.length} non-Health/Beauty or invalid CJ products from MongoDB.`);
    }

    return idsToDelete.length;
  } catch (err) {
    console.error("⚠️ Error purging non-beauty CJ products:", err.message);
    return 0;
  }
};

// Discovers CJ's dedicated Health, Beauty & Skincare category IDs from /product/getCategory
const fetchCjBeautyCategoryIds = async (headers) => {
  try {
    const res = await axios.get(`${CJ_BASE_URL}/product/getCategory`, { headers, timeout: 15000 });
    const firstList = res.data?.data || [];
    if (!Array.isArray(firstList)) return [];

    const beautyCatIds = [];
    const seenIds = new Set();

    const addCatId = (id, name) => {
      const cleanId = String(id || '').trim();
      const cleanName = String(name || '').trim();
      if (!cleanId || seenIds.has(cleanId)) return;
      if (NON_BEAUTY_EXCLUSION_REGEX.test(cleanName)) return;
      seenIds.add(cleanId);
      beautyCatIds.push({ id: cleanId, name: cleanName });
    };

    for (const first of firstList) {
      const firstName = String(first.categoryFirstName || first.nameEn || first.name || '');
      const firstIsBeauty = HEALTH_BEAUTY_CATEGORY_REGEX.test(firstName) && !NON_BEAUTY_CATEGORY_REGEX.test(firstName);
      const children1 = first.categoryFirstChildList || first.children || [];

      for (const second of (Array.isArray(children1) ? children1 : [])) {
        const secondName = String(second.categorySecondName || second.nameEn || second.name || '');
        const secondIsBeauty = firstIsBeauty || (HEALTH_BEAUTY_CATEGORY_REGEX.test(secondName) && !NON_BEAUTY_CATEGORY_REGEX.test(secondName));
        const children2 = second.categorySecondChildList || second.children || [];

        if (secondIsBeauty && second.categorySecondId) {
          addCatId(second.categorySecondId, `${firstName} > ${secondName}`);
        }

        for (const third of (Array.isArray(children2) ? children2 : [])) {
          const thirdName = String(third.categoryName || third.nameEn || third.name || '');
          const thirdId = third.categoryId || third.id;
          if ((secondIsBeauty || HEALTH_BEAUTY_CATEGORY_REGEX.test(thirdName)) && thirdId) {
            addCatId(thirdId, `${firstName} > ${secondName} > ${thirdName}`);
          }
        }
      }
    }

    return beautyCatIds.slice(0, 45);
  } catch (err) {
    console.warn("⚠️ Could not fetch CJ category list (falling back to keyword search):", err.message);
    return [];
  }
};

let isCjSyncRunning = false;
let isCatalogSanitizeRunning = false;

let cjCatalogSyncTelemetry = {
  lastSyncAt: null,
  lastSyncStatus: 'IDLE',
  lastSyncedCount: 0,
  lastNewAddedCount: 0,
  lastUpdatedCount: 0,
  lastSanitizedAt: null,
  lastDuplicatesPurgedCount: 0,
  lastNonBeautyPurgedCount: 0,
  activeCatalogTotal: 0,
  nextScheduledSync: 'Daily at 3:00 AM CST (America/Chicago)',
  timezone: 'America/Chicago'
};

// Scans the entire MongoDB Product collection, purges non-beauty items, backfills cjPid/cjSku/normalizedTitleKey,
// groups duplicate products (by cjPid, cjSku, normalizedTitleKey, or identical CJ image), merges analytics counters,
// re-points all foreign keys in Order, InboxItem, User.recommendedProducts, and MemberMonthlyBox, and deletes duplicates.
const sanitizeAndDeduplicateCatalog = async () => {
  if (isCatalogSanitizeRunning) {
    return {
      status: 'already_running',
      nonBeautyPur
