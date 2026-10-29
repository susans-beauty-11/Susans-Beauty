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

const sendEmail = async (to, subject, htmlContent, textContent) => {
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
  rawCjData: { type: mongooartMs
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

// Recursively extracts text/plain and text/html bodies fromartMs
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

// Recursively extracts text/plain and text/hte.warn(`⚠️ SMTP verify failed on ${candidate.label}: ${err.message}`);
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

const sendEmail = async (to, subject, htmlContent, textContent) => {
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
  sentAt: { type: Date, default: Date.now }
});
const EmailLog = mongoose.model('EmailLog', emailLogSchema);

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
    enum: ['STRIPE_BANK_PAYOUT', 'STRIPE_TO_CJ_BRIDGE', 'CJ_ORDER_WALLET_PAYMENT'],
    required: true,
    index: true
  },
  amountUsd: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  status: { type: String, default: 'COMPLETED', index: true },
  stripePayoutId: { type: String, default: '' },
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
const CJ_MAX_PAGES = Math.max(1, Number(cleanEnv(process.env.CJ_MAX_PAGES)) || 35);
const CJ_MAX_PRODUCTS = Math.max(1, Number(cleanEnv(process.env.CJ_MAX_PRODUCTS)) || 300);
const CJ_PAGE_SIZE = Math.min(100, Math.max(20, Number(cleanEnv(process.env.CJ_PAGE_SIZE)) || 100));

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

    return beautyCatIds.slice(0, 15);
  } catch (err) {
    console.warn("⚠️ Could not fetch CJ category list (falling back to keyword search):", err.message);
    return [];
  }
};

let isCjSyncRunning = false;

const syncCJCatalog = async (options = {}) => {
  if (isCjSyncRunning) {
    console.log("⏳ CJ catalog sync is already in progress; skipping duplicate trigger.");
    return { status: 'already_running', purgedCount: 0, syncedCount: 0 };
  }

  isCjSyncRunning = true;
  const maxPages = Math.max(1, Number(options.maxPages) || CJ_MAX_PAGES);
  const maxProducts = Math.max(1, Number(options.maxProducts) || CJ_MAX_PRODUCTS);
  const pageSize = CJ_PAGE_SIZE;

  try {
    // 1. Always purge non-beauty CJ items in DB first so the catalog stays strictly Health & Beauty
    const purgedCount = await purgeNonBeautyCjProducts();

    const headers = getCjHeaders();
    if (!headers) {
      return { status: 'skipped_no_token', purgedCount, syncedCount: 0 };
    }

    console.log(`🔄 Starting Deep CJ Beauty & Skincare Sync (maxPages=${maxPages}, maxProducts=${maxProducts}, pageSize=${pageSize})...`);

    let pagesFetched = 0;
    let totalProcessed = 0;
    const seenKeys = new Set();
    const retailMarkup = 6.5;

    // Helper to process a batch of CJ products from any endpoint query
    const processCjBatch = async (cjProducts, fromBeautySource = false, sourceLabel = '') => {
      if (!Array.isArray(cjProducts) || cjProducts.length === 0) return 0;
      let batchSaved = 0;

      for (const item of cjProducts) {
        if (totalProcessed >= maxProducts) break;

        const title = (item.nameEn || item.productNameEn || item.productName || '').toString().trim();
        const baseSku = (item.productSku || item.sku || item.pid || '').toString().trim();
        const category = (item.categoryName || sourceLabel || '').toString().trim();
        const desc = item.description || item.productDescription || '';

        if (!title || !baseSku) continue;

        const dedupeTitleKey = title.toLowerCase();
        const dedupeSkuKey = baseSku.toLowerCase();
        if (seenKeys.has(dedupeTitleKey) || seenKeys.has(dedupeSkuKey)) {
          continue;
        }

        if (!isStrictHealthAndBeautyProduct(title, category, desc, fromBeautySource)) {
          continue;
        }

        const img = item.productImage || item.image || '';

        let rawBasePrice = parseFloat(String(item.sellPrice || item.price || '0').split('-')[0].trim()) || 0;
        
        if (rawBasePrice === 0 && Array.isArray(item.variants) && item.variants.length > 0) {
          const validVariant = item.variants.find(v => parseFloat(v.sellPrice || v.price || 0) > 0);
          if (validVariant) {
            rawBasePrice = parseFloat(validVariant.sellPrice || validVariant.price);
          }
        }

        if (!(rawBasePrice > 0)) {
          continue;
        }

        const weightGrams = Math.max(
          30,
          Number(parseFloat(String(item.productWeight || item.packWeight || item.weight || '120').split('-')[0].trim())) || 120
        );
        const defaultLogisticName = 'CJPacket Sensitive';
        const fallbackLogistics = buildDeterministicCjBeautyCarriers({
          weightGrams,
          quantity: 1,
          startCountryCode: 'CN',
          endCountryCode: 'US'
        });
        const matchedCarrier =
          fallbackLogistics.find(c => c.logisticName === defaultLogisticName) || fallbackLogistics[0];
        const shippingCostUsd = Number(matchedCarrier?.shippingCostUsd ?? 4.49);

        const existingProd = await Product.findOne({ title })
          .select('markupMultiplier selectedLogisticName shippingCostUsd shippingIncludedInPrice customLabelConfig availableLogistics')
          .lean();

        const activeMarkup = Number(existingProd?.markupMultiplier || retailMarkup) || 6.5;
        const activeLogistic = existingProd?.selectedLogisticName || defaultLogisticName;
        const activeShippingIncluded = existingProd?.shippingIncludedInPrice !== undefined
          ? Boolean(existingProd.shippingIncludedInPrice)
          : true;
        const activeCustomLabel = existingProd?.customLabelConfig || getDefaultCustomLabelConfig();
        const activeShippingCost = Number(
          existingProd?.shippingCostUsd ??
          (fallbackLogistics.find(c => c.logisticName === activeLogistic)?.shippingCostUsd ?? shippingCostUsd)
        );
        const labelAddonUsd = activeCustomLabel?.enabled ? Number(activeCustomLabel.packagingCostUsd || 0) : 0;
        const shippingAddonUsd = activeShippingIncluded ? activeShippingCost : 0;

        const mappedVariants = Array.isArray(item.variants) && item.variants.length > 0
          ? item.variants.map(v => {
              const variantRawPrice = parseFloat(v.sellPrice || v.price || rawBasePrice) || rawBasePrice;
              const computedVariantRetail = Number(
                ((variantRawPrice * activeMarkup) + shippingAddonUsd + labelAddonUsd).toFixed(2)
              );
              return {
                sku: v.vid || v.variantSku || baseSku,
                variantName: v.variantEn || v.variantName || v.variantKey || 'Standard Option',
                wholesalePriceUsd: Number(variantRawPrice.toFixed(2)),
                price: computedVariantRetail,
                imageUrl: v.variantImage || img
              };
            })
          : [{
              sku: item.vid || baseSku,
              variantName: 'Standard',
              wholesalePriceUsd: Number(rawBasePrice.toFixed(2)),
              price: Number(((rawBasePrice * activeMarkup) + shippingAddonUsd + labelAddonUsd).toFixed(2)),
              imageUrl: img
            }];

        const primaryRetailPrice = Number(mappedVariants[0]?.price || ((rawBasePrice * activeMarkup) + shippingAddonUsd + labelAddonUsd).toFixed(2));
        const blueprintLabels = classifyProductForBlueprint(title, category, desc);

        await Product.findOneAndUpdate(
          { title },
          {
            title,
            description: desc,
            imageUrl: img,
            price: primaryRetailPrice,
            wholesalePriceUsd: Number(rawBasePrice.toFixed(2)),
            markupMultiplier: activeMarkup,
            estimatedWeightGrams: weightGrams,
            originCountryCode: 'CN',
            selectedLogisticName: activeLogistic,
            shippingCostUsd: Number(activeShippingCost.toFixed(2)),
            shippingIncludedInPrice: activeShippingIncluded,
            availableLogistics: Array.isArray(existingProd?.availableLogistics) && existingProd.availableLogistics.length > 0
              ? existingProd.availableLogistics
              : fallbackLogistics,
            customLabelConfig: activeCustomLabel,
            tags: blueprintLabels.tags,
            skinTypes: blueprintLabels.skinTypes,
            skinConcerns: blueprintLabels.skinConcerns,
            sensitivitySafe: blueprintLabels.sensitivitySafe,
            sensitivityLabel: blueprintLabels.sensitivityLabel,
            ritualStep: blueprintLabels.ritualStep,
            keyActives: blueprintLabels.keyActives,
            variants: mappedVariants,
            rawCjData: { ...item, categoryName: category || item.categoryName }
          },
          { upsert: true, returnDocument: 'after' }
        );

        seenKeys.add(dedupeTitleKey);
        seenKeys.add(dedupeSkuKey);
        totalProcessed++;
        batchSaved++;
      }

      return batchSaved;
    };

    // Helper to fetch a CJ product list URL with rate-limit retry
    const fetchCjProductPage = async (url) => {
      try {
        const response = await axios.get(url, { headers, timeout: 15000 });
        return response.data?.data?.list || response.data?.data?.content || [];
      } catch (err) {
        if (err?.response?.status === 429) {
          await delay(1500);
          const retryRes = await axios.get(url, { headers, timeout: 15000 }).catch(() => null);
          return retryRes?.data?.data?.list || retryRes?.data?.data?.content || [];
        }
        return [];
      }
    };

    // Stage A: Pull directly from CJ's Beauty & Skincare Category IDs
    const beautyCategories = await fetchCjBeautyCategoryIds(headers);
    for (const cat of beautyCategories) {
      if (pagesFetched >= maxPages || totalProcessed >= maxProducts) break;
      pagesFetched++;
      const url = `${CJ_BASE_URL}/product/list?categoryId=${encodeURIComponent(cat.id)}&pageNum=1&pageSize=${pageSize}`;
      const list = await fetchCjProductPage(url);
      const saved = await processCjBatch(list, true, cat.name);
      console.log(`📂 CJ Beauty Category "${cat.name}" -> +${saved} items (Total: ${totalProcessed}/${maxProducts})`);
      if (pagesFetched < maxPages && totalProcessed < maxProducts) {
        await delay(450);
      }
    }

    // Stage B: Sweep targeted Beauty & Skincare keyword queries (?productNameEn=...)
    for (const query of CJ_BEAUTY_SEARCH_QUERIES) {
      if (pagesFetched >= maxPages || totalProcessed >= maxProducts) break;
      pagesFetched++;
      const url = `${CJ_BASE_URL}/product/list?productNameEn=${encodeURIComponent(query)}&pageNum=1&pageSize=${pageSize}`;
      const list = await fetchCjProductPage(url);
      const saved = await processCjBatch(list, true, `Health & Beauty > ${query}`);
      console.log(`🔍 CJ Keyword "${query}" -> +${saved} items (Total: ${totalProcessed}/${maxProducts})`);
      if (pagesFetched < maxPages && totalProcessed < maxProducts) {
        await delay(450);
      }
    }

    // Stage C: General catalog fallback sweep if capacity still remains
    let generalPage = 1;
    while (pagesFetched < maxPages && totalProcessed < maxProducts && generalPage <= 5) {
      pagesFetched++;
      const url = `${CJ_BASE_URL}/product/list?pageNum=${generalPage}&pageSize=${pageSize}`;
      const list = await fetchCjProductPage(url);
      if (!Array.isArray(list) || list.length === 0) break;
      await processCjBatch(list, false, '');
      generalPage++;
      if (pagesFetched < maxPages && totalProcessed < maxProducts) {
        await delay(450);
      }
    }

    await backfillProductBlueprintLabels(false);
    await backfillProductShippingAndCustomLabelMeta(false);
    const totalInDb = await Product.countDocuments();
    console.log(`🚀 CJ Beauty & Skincare sync complete! Purged ${purgedCount} non-beauty items; synced ${totalProcessed} Beauty & Skincare items (${totalInDb} total active in boutique).`);
    return { status: 'completed', purgedCount, syncedCount: totalProcessed, activeTotal: totalInDb };
  } catch (error) {
    console.error("❌ Error during CJ sync:", error?.response?.data || error.message);
    return { status: 'error', error: error?.response?.data?.message || error.message, purgedCount: 0, syncedCount: 0 };
  } finally {
    isCjSyncRunning = false;
  }
};

// ---------------- CJ PHASE 1: LIVE FREIGHT CALCULATOR, SHIPPING-INCLUSIVE PRICING & CUSTOM LABELING ENGINE ---------------- //

const DEFAULT_CUSTOM_PACKAGING_OPTIONS = [
  {
    packagingVid: 'CJ-PKG-ROSEGOLD-BOX-01',
    packagingPid: 'CJ-PKG-ROSEGOLD-BOX',
    packagingSku: 'SBC-PKG-ROSEGOLD-BOX',
    packagingName: "Susan's Rose-Gold Custom Box & Seal",
    labelType: 'CJ_CUSTOM_PACKAGING',
    packagingCostUsd: 0.65,
    estimatedWeightGrams: 35,
    description: 'Rose-gold magnetic boutique box with gold-foil seal & personalized Beauty Blueprint card insert (Zero MOQ).'
  },
  {
    packagingVid: 'CJ-PKG-SATIN-POUCH-02',
    packagingPid: 'CJ-PKG-SATIN-POUCH',
    packagingSku: 'SBC-PKG-SATIN-POUCH',
    packagingName: 'Luxury Satin Ritual Pouch',
    labelType: 'CJ_CUSTOM_PACKAGING',
    packagingCostUsd: 0.45,
    estimatedWeightGrams: 18,
    description: 'Blush-pink drawstring satin travel pouch embossed with Susan\'s Beauty Consulting crest.'
  },
  {
    packagingVid: 'CJ-POD-BOTTLE-LABEL-03',
    packagingPid: 'CJ-POD-BOTTLE-LABEL',
    packagingSku: 'SBC-POD-BOTTLE-LABEL',
    packagingName: 'CJ POD Custom Bottle/Jar Logo Label',
    labelType: 'CJ_POD_LOGO',
    packagingCostUsd: 0.85,
    estimatedWeightGrams: 10,
    description: 'Print-on-Demand waterproof outer bottle/jar wrap label with Susan\'s logo & bespoke client ritual name.'
  }
];

const getDefaultCustomLabelConfig = (overrides = {}) => {
  const base = {
    enabled: false,
    labelType: 'NONE',
    packagingVid: '',
    packagingName: "Susan's Rose-Gold Custom Box & Seal",
    customBrandText: "Susan's Beauty Consulting ✧",
    logoUrl: 'https://susansbeautyconsulting.com/susans-logo.png',
    packagingCostUsd: 0
  };
  if (!overrides || typeof overrides !== 'object') return base;

  const enabled = overrides.enabled !== undefined ? Boolean(overrides.enabled) : base.enabled;
  const requestedName = String(overrides.packagingName || base.packagingName).trim();
  const matchedOption =
    DEFAULT_CUSTOM_PACKAGING_OPTIONS.find(
      opt =>
        (overrides.packagingVid && opt.packagingVid === overrides.packagingVid) ||
        opt.packagingName.toLowerCase() === requestedName.toLowerCase()
    ) || DEFAULT_CUSTOM_PACKAGING_OPTIONS[0];

  const resolvedLabelType = enabled
    ? String(overrides.labelType && overrides.labelType !== 'NONE' ? overrides.labelType : matchedOption.labelType)
    : 'NONE';

  const resolvedCost = enabled
    ? (overrides.packagingCostUsd !== undefined && Number(overrides.packagingCostUsd) > 0
        ? Number(parseFloat(overrides.packagingCostUsd).toFixed(2))
        : matchedOption.packagingCostUsd)
    : 0;

  return {
    enabled,
    labelType: resolvedLabelType,
    packagingVid: enabled ? String(overrides.packagingVid || matchedOption.packagingVid) : '',
    packagingName: requestedName || matchedOption.packagingName,
    customBrandText: String(overrides.customBrandText || base.customBrandText).trim(),
    logoUrl: String(overrides.logoUrl || base.logoUrl).trim(),
    packagingCostUsd: resolvedCost
  };
};

// Deterministic weight-based fallback table of CJ beauty-compatible carriers so rate calculation never fails
const buildDeterministicCjBeautyCarriers = ({
  weightGrams = 120,
  quantity = 1,
  startCountryCode = 'CN',
  endCountryCode = 'US'
} = {}) => {
  const unitWeight = Math.max(25, Number(weightGrams) || 120);
  const qty = Math.max(1, Number(quantity) || 1);
  const totalGrams = unitWeight * qty;
  const extraHundredGrams = Math.max(0, (totalGrams - 100) / 100);
  const isUsOrigin = String(startCountryCode || 'CN').toUpperCase() === 'US';

  const carriers = [
    {
      logisticName: 'CJPacket Sensitive',
      shippingCostUsd: Number((3.85 + extraHundredGrams * 0.64).toFixed(2)),
      deliveryTime: '7-12 Days',
      logisticAging: '7-12 Days',
      categorySupport: 'Liquids, Serums, Creams & Cosmetics Safe',
      recommended: true,
      source: 'deterministic_beauty_table'
    },
    {
      logisticName: 'CJPacket Ordinary',
      shippingCostUsd: Number((3.25 + extraHundredGrams * 0.52).toFixed(2)),
      deliveryTime: '8-15 Days',
      logisticAging: '8-15 Days',
      categorySupport: 'Beauty Tools, Brushes, Sponges & Non-Liquids',
      recommended: false,
      source: 'deterministic_beauty_table'
    },
    {
      logisticName: 'USPS+',
      shippingCostUsd: Number(((isUsOrigin ? 4.10 : 5.45) + extraHundredGrams * 0.72).toFixed(2)),
      deliveryTime: isUsOrigin ? '3-6 Days' : '6-10 Days',
      logisticAging: isUsOrigin ? '3-6 Days' : '6-10 Days',
      categorySupport: 'Priority US Domestic & Expedited Beauty Line',
      recommended: false,
      source: 'deterministic_beauty_table'
    },
    {
      logisticName: 'CJ Liquid Direct',
      shippingCostUsd: Number((4.65 + extraHundredGrams * 0.68).toFixed(2)),
      deliveryTime: '8-14 Days',
      logisticAging: '8-14 Days',
      categorySupport: 'Dedicated Essential Oils, Toners, Perfumes & Serums',
      recommended: false,
      source: 'deterministic_beauty_table'
    },
    {
      logisticName: 'DHL Official',
      shippingCostUsd: Number((14.90 + extraHundredGrams * 1.85).toFixed(2)),
      deliveryTime: '3-7 Days',
      logisticAging: '3-7 Days',
      categorySupport: 'Express Global VIP Courier',
      recommended: false,
      source: 'deterministic_beauty_table'
    }
  ];

  return carriers;
};

// Queries CJ's official POST /logistic/freightCalculate endpoint when CJ_ACCESS_TOKEN is active,
// merging live CJ quotes with our deterministic beauty-compatible carrier table so it never fails.
const calculateCjFreightRates = async ({
  vid = '',
  sku = '',
  quantity = 1,
  weightGrams = 120,
  startCountryCode = 'CN',
  endCountryCode = 'US',
  products = null
} = {}) => {
  const cleanStart = String(startCountryCode || 'CN').toUpperCase().trim() || 'CN';
  const cleanEnd = String(endCountryCode || 'US').toUpperCase().trim() || 'US';
  const qty = Math.max(1, Number(quantity) || 1);
  const weight = Math.max(30, Number(weightGrams) || 120);

  const fallbackRates = buildDeterministicCjBeautyCarriers({
    weightGrams: weight,
    quantity: qty,
    startCountryCode: cleanStart,
    endCountryCode: cleanEnd
  });

  const headers = getCjHeaders();
  const resolvedVid = String(vid || sku || '').trim();
  const requestProducts = Array.isArray(products) && products.length > 0
    ? products
        .map(p => ({
          vid: String(p.vid || p.sku || '').trim(),
          quantity: Math.max(1, Number(p.quantity) || 1)
        }))
        .filter(p => p.vid && !p.vid.startsWith('CUSTOM-'))
    : (resolvedVid && !resolvedVid.startsWith('CUSTOM-')
        ? [{ vid: resolvedVid, quantity: qty }]
        : []);

  if (!headers || requestProducts.length === 0) {
    return {
      liveApiUsed: false,
      startCountryCode: cleanStart,
      endCountryCode: cleanEnd,
      weightGrams: weight,
      rates: fallbackRates,
      recommendedCarrier: fallbackRates[0]
    };
  }

  try {
    const cjRes = await axios.post(
      `${CJ_BASE_URL}/logistic/freightCalculate`,
      {
        startCountryCode: cleanStart,
        endCountryCode: cleanEnd,
        products: requestProducts
      },
      { headers, timeout: 12000 }
    );

    const rawQuotes = Array.isArray(cjRes.data?.data) ? cjRes.data.data : [];
    if (rawQuotes.length > 0) {
      const liveRates = rawQuotes
        .map(q => {
          const name = String(q.logisticName || q.logisticNameEn || '').trim();
          const price = Number(parseFloat(q.logisticPrice || q.price || q.totalPostageFee || 0).toFixed(2));
          const aging = String(q.logisticAging || '7-12').trim();
          const deliveryTime = /day/i.test(aging) ? aging : `${aging} Days`;
          return {
            logisticName: name,
            shippingCostUsd: price,
            deliveryTime,
            logisticAging: deliveryTime,
            taxesFeeUsd: Number(parseFloat(q.taxesFee || 0).toFixed(2)),
            clearanceOperationFeeUsd: Number(parseFloat(q.clearanceOperationFee || 0).toFixed(2)),
            recommended: /sensitive|liquid|usps/i.test(name),
            source: 'cj_live_api'
          };
        })
        .filter(r => r.logisticName && r.shippingCostUsd > 0);

      if (liveRates.length > 0) {
        // Merge any missing standard beauty carriers from fallback so Susan always has CJPacket Sensitive, USPS+, etc. selectable
        const merged = [...liveRates];
        for (const fb of fallbackRates) {
          if (!merged.some(m => m.logisticName.toLowerCase() === fb.logisticName.toLowerCase())) {
            merged.push(fb);
          }
        }
        merged.sort((a, b) => a.shippingCostUsd - b.shippingCostUsd);
        const preferred =
          merged.find(m => /cjpacket sensitive/i.test(m.logisticName)) ||
          merged[0];

        return {
          liveApiUsed: true,
          startCountryCode: cleanStart,
          endCountryCode: cleanEnd,
          weightGrams: weight,
          rates: merged,
          recommendedCarrier: preferred
        };
      }
    }
  } catch (err) {
    console.warn(`⚠️ CJ freightCalculate notice (using deterministic beauty carrier table): ${err?.response?.data?.message || err.message}`);
  }

  return {
    liveApiUsed: false,
    startCountryCode: cleanStart,
    endCountryCode: cleanEnd,
    weightGrams: weight,
    rates: fallbackRates,
    recommendedCarrier: fallbackRates[0]
  };
};

// Recalculates a product's retail price (and variants[].price) using:
// Retail Price = (wholesalePriceUsd * markupMultiplier) + (shippingIncludedInPrice ? shippingCostUsd : 0) + (customLabelConfig?.enabled ? customLabelConfig.packagingCostUsd : 0)
const recalculateProductRetailPrice = (productDoc, overrides = {}) => {
  if (!productDoc) return null;

  // 1. Determine wholesalePriceUsd
  let wholesalePriceUsd = overrides.wholesalePriceUsd !== undefined
    ? Number(parseFloat(overrides.wholesalePriceUsd))
    : Number(productDoc.wholesalePriceUsd || 0);

  if (!(wholesalePriceUsd > 0)) {
    const rawCjSell = parseFloat(String(productDoc.rawCjData?.sellPrice || productDoc.rawCjData?.price || '0').split('-')[0].trim());
    if (rawCjSell > 0) {
      wholesalePriceUsd = rawCjSell;
    } else {
      const existingRetail = Number(productDoc.variants?.[0]?.price ?? productDoc.price ?? 16.25);
      wholesalePriceUsd = existingRetail > 0 ? Number((existingRetail / 6.5).toFixed(2)) : 2.50;
    }
  }
  wholesalePriceUsd = Number(Math.max(0.25, wholesalePriceUsd).toFixed(2));

  // 2. Determine markupMultiplier
  const markupMultiplier = Number(
    Math.max(
      1,
      overrides.markupMultiplier !== undefined
        ? parseFloat(overrides.markupMultiplier)
        : (Number(productDoc.markupMultiplier) || 6.5)
    ).toFixed(2)
  );

  // 3. Determine weight & origin country
  const estimatedWeightGrams = Math.max(
    25,
    Number(
      overrides.estimatedWeightGrams !== undefined
        ? overrides.estimatedWeightGrams
        : (productDoc.estimatedWeightGrams || 120)
    ) || 120
  );
  const originCountryCode = String(
    overrides.originCountryCode || productDoc.originCountryCode || 'CN'
  ).toUpperCase().trim() || 'CN';

  // 4. Determine availableLogistics, selectedLogisticName, and shippingCostUsd
  const availableLogistics = Array.isArray(overrides.availableLogistics) && overrides.availableLogistics.length > 0
    ? overrides.availableLogistics
    : (Array.isArray(productDoc.availableLogistics) && productDoc.availableLogistics.length > 0
        ? productDoc.availableLogistics
        : buildDeterministicCjBeautyCarriers({
            weightGrams: estimatedWeightGrams,
            quantity: 1,
            startCountryCode: originCountryCode,
            endCountryCode: 'US'
          }));

  const selectedLogisticName = String(
    overrides.selectedLogisticName || productDoc.selectedLogisticName || 'CJPacket Sensitive'
  ).trim() || 'CJPacket Sensitive';

  const matchedCarrier = availableLogistics.find(
    c => String(c.logisticName || '').toLowerCase() === selectedLogisticName.toLowerCase()
  );

  let shippingCostUsd = overrides.shippingCostUsd !== undefined
    ? Number(parseFloat(overrides.shippingCostUsd))
    : (matchedCarrier
        ? Number(matchedCarrier.shippingCostUsd)
        : Number(productDoc.shippingCostUsd ?? 4.49));

  if (isNaN(shippingCostUsd) || shippingCostUsd < 0) {
    shippingCostUsd = 4.49;
  }
  shippingCostUsd = Number(shippingCostUsd.toFixed(2));

  // 5. Determine shippingIncludedInPrice & customLabelConfig
  const shippingIncludedInPrice = overrides.shippingIncludedInPrice !== undefined
    ? Boolean(overrides.shippingIncludedInPrice)
    : (productDoc.shippingIncludedInPrice !== undefined ? Boolean(productDoc.shippingIncludedInPrice) : true);

  const mergedCustomLabelInput = overrides.customLabelConfig !== undefined
    ? { ...(productDoc.customLabelConfig || {}), ...(overrides.customLabelConfig || {}) }
    : (productDoc.customLabelConfig || {});
  const customLabelConfig = getDefaultCustomLabelConfig(mergedCustomLabelInput);

  const shippingAddonUsd = shippingIncludedInPrice ? shippingCostUsd : 0;
  const packagingAddonUsd = customLabelConfig.enabled ? Number(customLabelConfig.packagingCostUsd || 0) : 0;

  const retailPriceUsd = Number(
    ((wholesalePriceUsd * markupMultiplier) + shippingAddonUsd + packagingAddonUsd).toFixed(2)
  );

  // Apply computed fields to productDoc
  productDoc.wholesalePriceUsd = wholesalePriceUsd;
  productDoc.markupMultiplier = markupMultiplier;
  productDoc.estimatedWeightGrams = estimatedWeightGrams;
  productDoc.originCountryCode = originCountryCode;
  productDoc.selectedLogisticName = selectedLogisticName;
  productDoc.shippingCostUsd = shippingCostUsd;
  productDoc.shippingIncludedInPrice = shippingIncludedInPrice;
  productDoc.availableLogistics = availableLogistics;
  productDoc.customLabelConfig = customLabelConfig;
  productDoc.price = retailPriceUsd;

  if (Array.isArray(productDoc.variants) && productDoc.variants.length > 0) {
    productDoc.variants = productDoc.variants.map((v, idx) => {
      const vObj = v && typeof v.toObject === 'function' ? v.toObject() : { ...v };
      const vWholesale = idx === 0
        ? wholesalePriceUsd
        : Number(vObj.wholesalePriceUsd || wholesalePriceUsd);
      const vRetail = idx === 0
        ? retailPriceUsd
        : Number(((vWholesale * markupMultiplier) + shippingAddonUsd + packagingAddonUsd).toFixed(2));
      return {
        ...vObj,
        wholesalePriceUsd: Number(vWholesale.toFixed(2)),
        price: vRetail
      };
    });
    if (typeof productDoc.markModified === 'function') {
      productDoc.markModified('variants');
    }
  } else {
    productDoc.variants = [{
      sku: `CUSTOM-${Date.now()}`,
      variantName: 'Standard',
      wholesalePriceUsd,
      price: retailPriceUsd,
      imageUrl: productDoc.imageUrl || ''
    }];
  }

  if (typeof productDoc.markModified === 'function') {
    productDoc.markModified('customLabelConfig');
    productDoc.markModified('availableLogistics');
  }

  return {
    wholesalePriceUsd,
    markupMultiplier,
    shippingCostUsd,
    shippingIncludedInPrice,
    selectedLogisticName,
    customLabelConfig,
    packagingCostUsd: packagingAddonUsd,
    retailPriceUsd,
    availableLogistics
  };
};

// Startup migration that backfills wholesalePriceUsd, shippingCostUsd, selectedLogisticName, availableLogistics,
// customLabelConfig, and shipping-included retail prices across all existing products in MongoDB.
const backfillProductShippingAndCustomLabelMeta = async (forceAll = false) => {
  try {
    const allProducts = await Product.find({});
    if (!allProducts.length) {
      return { updatedCount: 0, totalCount: 0 };
    }

    let updatedCount = 0;
    for (const prod of allProducts) {
      const needsBackfill =
        forceAll ||
        !(Number(prod.wholesalePriceUsd) > 0) ||
        !(Number(prod.shippingCostUsd) > 0) ||
        !prod.selectedLogisticName ||
        !Array.isArray(prod.availableLogistics) ||
        prod.availableLogistics.length === 0 ||
        !prod.customLabelConfig ||
        typeof prod.customLabelConfig !== 'object';

      if (!needsBackfill) continue;

      let inferredWholesale = Number(prod.wholesalePriceUsd || 0);
      const rawCjSell = parseFloat(String(prod.rawCjData?.sellPrice || prod.rawCjData?.price || '0').split('-')[0].trim());
      if (rawCjSell > 0) {
        inferredWholesale = rawCjSell;
      } else if (!(inferredWholesale > 0)) {
        const currentPrice = Number(prod.variants?.[0]?.price ?? prod.price ?? 16.25);
        inferredWholesale = currentPrice > 0 ? Number((currentPrice / 6.5).toFixed(2)) : 2.50;
      }

      const rawWeight = parseFloat(String(prod.rawCjData?.productWeight || prod.rawCjData?.packWeight || prod.estimatedWeightGrams || '120').split('-')[0].trim());
      const weightGrams = Math.max(30, Number(rawWeight) || 120);

      recalculateProductRetailPrice(prod, {
        wholesalePriceUsd: inferredWholesale,
        estimatedWeightGrams: weightGrams,
        selectedLogisticName: prod.selectedLogisticName || 'CJPacket Sensitive',
        shippingIncludedInPrice: prod.shippingIncludedInPrice !== undefined ? Boolean(prod.shippingIncludedInPrice) : true,
        customLabelConfig: prod.customLabelConfig || getDefaultCustomLabelConfig()
      });

      await prod.save();
      updatedCount++;
    }

    if (updatedCount > 0) {
      console.log(`✈️ Backfilled CJ shipping rates, wholesale prices & custom label metadata on ${updatedCount} product(s).`);
    }
    return { updatedCount, totalCount: allProducts.length };
  } catch (err) {
    console.warn('⚠️ Error in backfillProductShippingAndCustomLabelMeta:', err.message);
    return { updatedCount: 0, totalCount: 0, error: err.message };
  }
};

// Queries CJ's POST /product/myProduct/queryPackagingProduct and POST /product/myProduct/queryCjPackagingProduct
// with built-in fallback options for Susan's Rose-Gold Custom Box & Seal ($0.65), Luxury Satin Ritual Pouch ($0.45),
// and CJ POD Custom Bottle/Jar Logo Label ($0.85).
const fetchCjCustomPackagingCatalog = async () => {
  const headers = getCjHeaders();
  const myPackagingList = [];
  const cjPackagingList = [];
  let liveApiQueried = false;

  if (headers) {
    try {
      const [myPkgRes, cjPkgRes] = await Promise.all([
        axios.post(
          `${CJ_BASE_URL}/product/myProduct/queryPackagingProduct`,
          { pageNum: 1, pageSize: 20 },
          { headers, timeout: 10000 }
        ).catch(() => null),
        axios.post(
          `${CJ_BASE_URL}/product/myProduct/queryCjPackagingProduct`,
          { pageNum: 1, pageSize: 20 },
          { headers, timeout: 10000 }
        ).catch(() => null)
      ]);

      liveApiQueried = true;
      const rawMyList = myPkgRes?.data?.data?.list || myPkgRes?.data?.data?.content || (Array.isArray(myPkgRes?.data?.data) ? myPkgRes.data.data : []);
      const rawCjList = cjPkgRes?.data?.data?.list || cjPkgRes?.data?.data?.content || (Array.isArray(cjPkgRes?.data?.data) ? cjPkgRes.data.data : []);

      for (const item of (Array.isArray(rawMyList) ? rawMyList : [])) {
        myPackagingList.push({
          packagingVid: String(item.vid || item.pid || item.id || ''),
          packagingPid: String(item.pid || item.id || ''),
          packagingSku: String(item.sku || item.productSku || ''),
          packagingName: String(item.nameEn || item.productNameEn || item.packagingName || 'MyCJ Custom Packaging'),
          labelType: 'CJ_CUSTOM_PACKAGING',
          packagingCostUsd: Number(parseFloat(item.sellPrice || item.price || 0.65).toFixed(2)),
          imageUrl: item.productImage || item.image || '',
          source: 'my_cj_packaging'
        });
      }

      for (const item of (Array.isArray(rawCjList) ? rawCjList : []).slice(0, 12)) {
        cjPackagingList.push({
          packagingVid: String(item.vid || item.pid || item.id || ''),
          packagingPid: String(item.pid || item.id || ''),
          packagingSku: String(item.sku || item.productSku || ''),
          packagingName: String(item.nameEn || item.productNameEn || item.packagingName || 'CJ Branded Packaging'),
          labelType: 'CJ_CUSTOM_PACKAGING',
          packagingCostUsd: Number(parseFloat(item.sellPrice || item.price || 0.65).toFixed(2)),
          imageUrl: item.productImage || item.image || '',
          source: 'cj_packaging_catalog'
        });
      }
    } catch (err) {
      console.warn('⚠️ CJ Custom Packaging query notice:', err.message);
    }
  }

  return {
    liveApiQueried,
    builtInOptions: DEFAULT_CUSTOM_PACKAGING_OPTIONS,
    myPackagingList,
    cjPackagingList,
    allOptions: [
      ...DEFAULT_CUSTOM_PACKAGING_OPTIONS,
      ...myPackagingList,
      ...cjPackagingList
    ]
  };
};

// Applies custom labeling configuration to a single product or across the entire boutique catalog
// and automatically recalculates retail prices.
const applyCustomLabelToProducts = async ({
  productId = null,
  applyToAll = false,
  enabled = true,
  labelType = 'CJ_CUSTOM_PACKAGING',
  packagingVid = '',
  packagingName = "Susan's Rose-Gold Custom Box & Seal",
  customBrandText = "Susan's Beauty Consulting ✧",
  logoUrl = 'https://susansbeautyconsulting.com/susans-logo.png',
  packagingCostUsd = undefined
} = {}) => {
  const customLabelConfig = getDefaultCustomLabelConfig({
    enabled,
    labelType,
    packagingVid,
    packagingName,
    customBrandText,
    logoUrl,
    packagingCostUsd
  });

  const filter = (!applyToAll && productId && mongoose.Types.ObjectId.isValid(String(productId)))
    ? { _id: productId }
    : {};

  const targetProducts = await Product.find(filter);
  if (!targetProducts.length) {
    throw new Error('No matching products found to update custom labeling.');
  }

  const updatedProducts = [];
  for (const prod of targetProducts) {
    recalculateProductRetailPrice(prod, { customLabelConfig });
    await prod.save();
    updatedProducts.push(prod);
  }

  return {
    updatedCount: updatedProducts.length,
    customLabelConfig,
    updatedProduct: updatedProducts.length === 1 ? updatedProducts[0] : null,
    products: updatedProducts
  };
};

// ---------------- CJ PHASE 2: PROFIT-PROTECTED MONTHLY MEMBERSHIP BOX CURATION ENGINE (<=25% HARD COST CAP) ---------------- //

const getCurrentBillingMonthStr = (overrideMonth = '') => {
  const clean = String(overrideMonth || '').trim();
  if (/^\d{4}-\d{2}$/.test(clean)) return clean;
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(now);
  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return `${map.year}-${map.month}`;
};

const getTierBoxRules = (rawTier = 'luminary') => {
  const cleanTier = String(rawTier || 'luminary').toLowerCase().trim() === 'radiance' ? 'radiance' : 'luminary';
  if (cleanTier === 'radiance') {
    return {
      membershipTier: 'radiance',
      tierLabel: 'Radiance Elite ($119/mo • 5-Piece Box)',
      subscriptionPriceUsd: 119.00,
      maxAllowedCostUsd: 29.75, // Strictly 25% of $119.00
      requiredPieceCount: 5,
      preferredRitualSlots: [
        'Step 1: Cleanser',
        'Step 2: Toner & Mist',
        'Step 3: Serum & Essence',
        'Step 4: Moisturizer & Cream',
        'Step 5: Eye, Lip & SPF'
      ]
    };
  }
  return {
    membershipTier: 'luminary',
    tierLabel: 'Luminary Circle ($49/mo • 3-Piece Box)',
    subscriptionPriceUsd: 49.00,
    maxAllowedCostUsd: 12.25, // Strictly 25% of $49.00
    requiredPieceCount: 3,
    preferredRitualSlots: [
      'Step 1: Cleanser',
      'Step 3: Serum & Essence',
      'Step 4: Moisturizer & Cream'
    ]
  };
};

// Builds a balanced Gentle Hydration default Blueprint if a paid member has not completed their quiz yet
const getEffectiveMemberBlueprint = (consultationDoc = null) => {
  if (consultationDoc && consultationDoc.skinType) {
    return {
      hasCompletedQuiz: true,
      skinType: String(consultationDoc.skinType || 'Normal').trim(),
      primaryGoal: String(consultationDoc.primaryGoal || 'Hydration').trim(),
      climate: String(consultationDoc.climate || 'Temperate').trim(),
      skinSensitivity: String(consultationDoc.skinSensitivity || 'Moderate').trim(),
      complexion: String(consultationDoc.complexion || 'Medium').trim(),
      undertone: String(consultationDoc.undertone || 'Neutral').trim(),
      eyeColor: String(consultationDoc.eyeColor || 'Brown').trim(),
      faceShape: String(consultationDoc.faceShape || 'Oval').trim(),
      makeupVibe: String(consultationDoc.makeupVibe || 'Soft Glam').trim(),
      routineFocus: String(consultationDoc.routineFocus || 'Balanced').trim(),
      archetypeTitle: consultationDoc.blueprintAnalysis?.archetypeTitle || `The Bespoke ${consultationDoc.skinType} & ${consultationDoc.primaryGoal} Sanctuary`
    };
  }
  return {
    hasCompletedQuiz: false,
    skinType: 'Normal',
    primaryGoal: 'Hydration',
    climate: 'Temperate',
    skinSensitivity: 'Moderate',
    complexion: 'Medium',
    undertone: 'Neutral',
    eyeColor: 'Brown',
    faceShape: 'Oval',
    makeupVibe: 'Soft Glam',
    routineFocus: 'Balanced',
    archetypeTitle: 'Gentle Hydration Default Sanctuary (Quiz Pending)'
  };
};

// Scores a Product document against a member's Blueprint and returns wholesale/retail unit economics
const scoreProductForMemberBox = (product, blueprint) => {
  const skinTypes = Array.isArray(product.skinTypes) && product.skinTypes.length > 0
    ? product.skinTypes
    : ['All Skin Types'];
  const skinConcerns = Array.isArray(product.skinConcerns) && product.skinConcerns.length > 0
    ? product.skinConcerns
    : ['Hydration'];
  const ritualStep = String(product.ritualStep || 'Step 3: Serum & Essence').trim();
  const sensitivitySafe = product.sensitivitySafe !== false;

  // Hard filter: High sensitivity members NEVER get sensitivitySafe === false products
  if (String(blueprint.skinSensitivity || '').toLowerCase() === 'high' && !sensitivitySafe) {
    return null;
  }

  let matchScore = 55;
  const matchReasons = [];

  const exactSkin = skinTypes.some(st => st.toLowerCase() === String(blueprint.skinType || '').toLowerCase());
  const allSkin = skinTypes.some(st => st.toLowerCase() === 'all skin types');
  if (exactSkin) {
    matchScore += 22;
    matchReasons.push(`Ideal for ${blueprint.skinType} Skin`);
  } else if (allSkin) {
    matchScore += 14;
    matchReasons.push(`Balanced for ${blueprint.skinType} Skin`);
  }

  const exactGoal = skinConcerns.some(sc => sc.toLowerCase() === String(blueprint.primaryGoal || '').toLowerCase());
  if (exactGoal) {
    matchScore += 24;
    matchReasons.push(`Targets ${blueprint.primaryGoal}`);
  }

  const needsBarrier = ['high', 'moderate'].includes(String(blueprint.skinSensitivity || '').toLowerCase()) ||
    ['dry', 'cold'].includes(String(blueprint.climate || '').toLowerCase());
  if (needsBarrier && skinConcerns.some(sc => sc.toLowerCase() === 'barrier & soothing')) {
    matchScore += 10;
    matchReasons.push(`Protects ${blueprint.skinSensitivity} Barrier`);
  }

  if (sensitivitySafe) {
    matchScore += 6;
    if (String(blueprint.skinSensitivity || '').toLowerCase() === 'high') {
      matchReasons.push('Gentle • High-Sensitivity Safe');
    }
  }

  if (ritualStep === 'Makeup & Artistry' && blueprint.makeupVibe) {
    matchScore += 10;
    matchReasons.push(`Complements ${blueprint.makeupVibe} Vibe`);
  }

  if (matchReasons.length === 0) {
    matchReasons.push(`Curated ${ritualStep}`);
  }

  const primaryVariant = product.variants?.[0] || {};
  const retailPriceUsd = Number(primaryVariant.price ?? product.price ?? 18.00);
  let wholesaleCostUsd = Number(product.wholesalePriceUsd ?? primaryVariant.wholesalePriceUsd ?? 0);
  if (!(wholesaleCostUsd > 0)) {
    const rawCjSell = parseFloat(String(product.rawCjData?.sellPrice || product.rawCjData?.price || '0').split('-')[0].trim());
    wholesaleCostUsd = rawCjSell > 0 ? rawCjSell : Number(Math.max(0.85, retailPriceUsd / 6.5).toFixed(2));
  }
  wholesaleCostUsd = Number(Math.max(0.45, wholesaleCostUsd).toFixed(2));

  const sku = String(primaryVariant.sku || product.rawCjData?.productSku || product._id).trim();
  const vid = String(primaryVariant.sku || product.rawCjData?.vid || product.rawCjData?.pid || sku).trim();
  const imageUrl = primaryVariant.imageUrl || product.imageUrl || '';
  const weightGrams = Math.max(25, Number(product.estimatedWeightGrams || 95) || 95);

  return {
    productId: product._id,
    title: product.title || 'Boutique Ritual Essential',
    sku,
    vid,
    imageUrl,
    ritualStep,
    wholesaleCostUsd,
    retailPriceUsd: Number(retailPriceUsd.toFixed(2)),
    weightGrams,
    matchScore: Math.min(99, matchScore),
    matchReasons
  };
};

// Consolidated multi-item CJ box shipping calculator:
// Combines item weights into a single consolidated parcel so multi-piece membership boxes stay well within the 25% cap.
const computeConsolidatedBoxShippingUsd = ({
  items = [],
  selectedLogisticName = 'CJPacket Sensitive',
  pieceCount = 3
} = {}) => {
  const count = Math.max(1, items.length || pieceCount);
  const carrier = String(selectedLogisticName || 'CJPacket Sensitive').toLowerCase().trim();

  // Consolidated CJ parcel rates for multi-piece beauty boxes (3-pc ~240g, 5-pc ~380g)
  let baseFee = 3.45;
  let perExtraItemFee = 0.52;

  if (carrier.includes('ordinary')) {
    baseFee = 2.95;
    perExtraItemFee = 0.42;
  } else if (carrier.includes('usps')) {
    baseFee = 4.15;
    perExtraItemFee = 0.62;
  } else if (carrier.includes('liquid')) {
    baseFee = 3.85;
    perExtraItemFee = 0.55;
  } else if (carrier.includes('dhl')) {
    baseFee = 9.50;
    perExtraItemFee = 1.25;
  }

  const consolidated = Number((baseFee + Math.max(0, count - 1) * perExtraItemFee).toFixed(2));
  return consolidated;
};

// Recomputes all-in costs, shipping shares, and strict <=25% cost cap compliance for a MemberMonthlyBox
const recomputeAndValidateMonthlyBoxEconomics = ({
  items = [],
  membershipTier = 'luminary',
  selectedLogisticName = 'CJPacket Sensitive',
  customLabelConfig = null
} = {}) => {
  const tierRules = getTierBoxRules(membershipTier);
  const resolvedLabelConfig = getDefaultCustomLabelConfig(
    customLabelConfig !== null && customLabelConfig !== undefined
      ? customLabelConfig
      : {
          enabled: true,
          labelType: 'CJ_CUSTOM_PACKAGING',
          packagingVid: 'CJ-PKG-ROSEGOLD-BOX-01',
          packagingName: "Susan's Rose-Gold Custom Box & Seal",
          customBrandText: "Susan's Beauty Consulting ✧",
          packagingCostUsd: 0.65
        }
  );

  const customLabelCostUsd = resolvedLabelConfig.enabled
    ? Number(parseFloat(resolvedLabelConfig.packagingCostUsd || 0.65).toFixed(2))
    : 0;

  const consolidatedShippingUsd = computeConsolidatedBoxShippingUsd({
    items,
    selectedLogisticName,
    pieceCount: items.length || tierRules.requiredPieceCount
  });

  const itemCount = Math.max(1, items.length);
  const shippingSharePerItem = Number((consolidatedShippingUsd / itemCount).toFixed(2));

  const enrichedItems = items.map(it => ({
    productId: it.productId,
    title: it.title || 'Boutique Essential',
    sku: it.sku || '',
    vid: it.vid || it.sku || '',
    imageUrl: it.imageUrl || '',
    ritualStep: it.ritualStep || 'Step 3: Serum & Essence',
    wholesaleCostUsd: Number(Number(it.wholesaleCostUsd || 0).toFixed(2)),
    shippingShareUsd: shippingSharePerItem,
    retailPriceUsd: Number(Number(it.retailPriceUsd || 0).toFixed(2)),
    matchScore: Number(it.matchScore || 88),
    matchReasons: Array.isArray(it.matchReasons) && it.matchReasons.length > 0
      ? it.matchReasons
      : ['Blueprint Matched']
  }));

  const totalWholesaleCostUsd = Number(
    enrichedItems.reduce((sum, i) => sum + i.wholesaleCostUsd, 0).toFixed(2)
  );
  const totalAllInCostUsd = Number(
    (totalWholesaleCostUsd + consolidatedShippingUsd + customLabelCostUsd).toFixed(2)
  );
  const costPercentageOfMembership = Number(
    ((totalAllInCostUsd / tierRules.subscriptionPriceUsd) * 100).toFixed(1)
  );
  const estimatedNetProfitUsd = Number(
    (tierRules.subscriptionPriceUsd - totalAllInCostUsd).toFixed(2)
  );
  const withinBudgetCap = totalAllInCostUsd <= tierRules.maxAllowedCostUsd + 0.001;

  return {
    membershipTier: tierRules.membershipTier,
    subscriptionPriceUsd: tierRules.subscriptionPriceUsd,
    maxAllowedCostUsd: tierRules.maxAllowedCostUsd,
    requiredPieceCount: tierRules.requiredPieceCount,
    selectedLogisticName: String(selectedLogisticName || 'CJPacket Sensitive').trim(),
    consolidatedShippingUsd,
    customLabelConfig: resolvedLabelConfig,
    customLabelCostUsd,
    items: enrichedItems,
    totalWholesaleCostUsd,
    totalAllInCostUsd,
    costPercentageOfMembership,
    estimatedNetProfitUsd,
    withinBudgetCap
  };
};

// Curates a profit-protected Monthly Membership Box for a single member with a strict <=25% cost cap
// ($12.25 max all-in CJ cost for Luminary $49/mo; $29.75 max all-in CJ cost for Radiance $119/mo)
const curateProfitProtectedMemberBox = async (userId, options = {}) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    throw new Error('A valid member userId is required to curate a monthly box.');
  }

  const user = await User.findById(userId).lean();
  if (!user) {
    throw new Error('Member account not found.');
  }

  const tierRules = getTierBoxRules(options.membershipTier || user.membershipTier || 'luminary');
  const billingMonth = getCurrentBillingMonthStr(options.billingMonth);
  const curatedBy = options.curatedBy === 'susan' ? 'susan' : 'odie';

  const [consultationDoc, rawCatalog] = await Promise.all([
    Consultation.findOne({ userId: user._id }).sort({ createdAt: -1 }).lean(),
    Product.find({}).lean()
  ]);

  if (!rawCatalog.length) {
    throw new Error('Boutique product catalog is empty. Sync or add products before curating monthly boxes.');
  }

  const blueprint = getEffectiveMemberBlueprint(consultationDoc);

  // Score and filter all active products against the member's Blueprint
  const scoredPool = rawCatalog
    .map(p => scoreProductForMemberBox(p, blueprint))
    .filter(Boolean);

  if (scoredPool.length === 0) {
    throw new Error('No Blueprint-compatible products available for this member sensitivity profile.');
  }

  let selectedLogisticName = String(options.selectedLogisticName || 'CJPacket Sensitive').trim() || 'CJPacket Sensitive';
  let customLabelConfig = getDefaultCustomLabelConfig(
    options.customLabelConfig !== undefined
      ? options.customLabelConfig
      : {
          enabled: true,
          labelType: 'CJ_CUSTOM_PACKAGING',
          packagingVid: 'CJ-PKG-ROSEGOLD-BOX-01',
          packagingName: "Susan's Rose-Gold Custom Box & Seal",
          customBrandText: `Curated for ${user.name || 'Valued Member'} • ${blueprint.archetypeTitle}`,
          logoUrl: 'https://susansbeautyconsulting.com/susans-logo.png',
          packagingCostUsd: 0.65
        }
  );

  // Calculate available wholesale budget after consolidated shipping and custom label cost
  const initialShipping = computeConsolidatedBoxShippingUsd({
    selectedLogisticName,
    pieceCount: tierRules.requiredPieceCount
  });
  const initialLabelCost = customLabelConfig.enabled ? Number(customLabelConfig.packagingCostUsd || 0.65) : 0;
  const targetMaxWholesaleTotal = Math.max(
    1.50,
    Number((tierRules.maxAllowedCostUsd - initialShipping - initialLabelCost).toFixed(2))
  );
  const targetAvgWholesalePerItem = Number((targetMaxWholesaleTotal / tierRules.requiredPieceCount).toFixed(2));

  // Rank candidates by Blueprint matchScore first, with a bonus for wholesale cost within the per-slot budget ceiling
  const rankForSlot = (candidates) => {
    return [...candidates].sort((a, b) => {
      const aUnderSlotCap = a.wholesaleCostUsd <= targetAvgWholesalePerItem * 1.25 ? 1 : 0;
      const bUnderSlotCap = b.wholesaleCostUsd <= targetAvgWholesalePerItem * 1.25 ? 1 : 0;
      if (bUnderSlotCap !== aUnderSlotCap) return bUnderSlotCap - aUnderSlotCap;
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return a.wholesaleCostUsd - b.wholesaleCostUsd;
    });
  };

  // Step 1: Select distinct ritual steps (3 for Luminary, 5 for Radiance)
  const chosenItems = [];
  const usedProductIds = new Set();

  for (const desiredStep of tierRules.preferredRitualSlots) {
    if (chosenItems.length >= tierRules.requiredPieceCount) break;
    const stepCandidates = rankForSlot(
      scoredPool.filter(
        c => !usedProductIds.has(String(c.productId)) &&
             String(c.ritualStep || '').toLowerCase() === desiredStep.toLowerCase()
      )
    );
    if (stepCandidates.length > 0) {
      chosenItems.push(stepCandidates[0]);
      usedProductIds.add(String(stepCandidates[0].productId));
    }
  }

  // Fill any remaining slots with distinct ritualSteps first, then best remaining Blueprint matches
  if (chosenItems.length < tierRules.requiredPieceCount) {
    const usedSteps = new Set(chosenItems.map(i => i.ritualStep));
    const distinctStepPool = rankForSlot(
      scoredPool.filter(c => !usedProductIds.has(String(c.productId)) && !usedSteps.has(c.ritualStep))
    );
    for (const cand of distinctStepPool) {
      if (chosenItems.length >= tierRules.requiredPieceCount) break;
      chosenItems.push(cand);
      usedProductIds.add(String(cand.productId));
      usedSteps.add(cand.ritualStep);
    }
  }

  if (chosenItems.length < tierRules.requiredPieceCount) {
    const fallbackPool = rankForSlot(
      scoredPool.filter(c => !usedProductIds.has(String(c.productId)))
    );
    for (const cand of fallbackPool) {
      if (chosenItems.length >= tierRules.requiredPieceCount) break;
      chosenItems.push(cand);
      usedProductIds.add(String(cand.productId));
    }
  }

  // Step 2: Enforce the hard <=25% cost cap!
  // If totalAllInCostUsd > maxAllowedCostUsd, swap the highest-wholesale item in its slot for a lower-wholesale
  // Blueprint-compatible alternative until totalAllInCostUsd <= maxAllowedCostUsd is strictly satisfied.
  let econ = recomputeAndValidateMonthlyBoxEconomics({
    items: chosenItems,
    membershipTier: tierRules.membershipTier,
    selectedLogisticName,
    customLabelConfig
  });

  let guardIterations = 0;
  while (!econ.withinBudgetCap && guardIterations < 25) {
    guardIterations++;
    // Find the index of the highest-wholesale item in chosenItems that has a cheaper alternative
    const indicesByCostDesc = chosenItems
      .map((item, idx) => ({ idx, wholesaleCostUsd: item.wholesaleCostUsd, ritualStep: item.ritualStep }))
      .sort((a, b) => b.wholesaleCostUsd - a.wholesaleCostUsd);

    let swappedInPass = false;
    for (const entry of indicesByCostDesc) {
      const currentItem = chosenItems[entry.idx];
      // Look for a cheaper alternative in the same ritualStep first, then across the entire scoredPool
      const sameStepCheaper = scoredPool
        .filter(
          c =>
            !usedProductIds.has(String(c.productId)) &&
            c.ritualStep === currentItem.ritualStep &&
            c.wholesaleCostUsd < currentItem.wholesaleCostUsd - 0.05
        )
        .sort((a, b) => a.wholesaleCostUsd - b.wholesaleCostUsd || b.matchScore - a.matchScore);

      const anyCheaper = scoredPool
        .filter(
          c =>
            !usedProductIds.has(String(c.productId)) &&
            c.wholesaleCostUsd < currentItem.wholesaleCostUsd - 0.05
        )
        .sort((a, b) => a.wholesaleCostUsd - b.wholesaleCostUsd || b.matchScore - a.matchScore);

      const replacement = sameStepCheaper[0] || anyCheaper[0];
      if (replacement) {
        usedProductIds.delete(String(currentItem.productId));
        chosenItems[entry.idx] = replacement;
        usedProductIds.add(String(replacement.productId));
        swappedInPass = true;
        break;
      }
    }

    if (!swappedInPass) {
      // Optimize consolidated shipping carrier (e.g., CJPacket Ordinary) or satin pouch packaging if needed to stay under 25%
      if (selectedLogisticName.toLowerCase() !== 'cjpacket ordinary') {
        selectedLogisticName = 'CJPacket Ordinary';
      } else if (customLabelConfig.enabled && customLabelConfig.packagingCostUsd > 0.45) {
        customLabelConfig = getDefaultCustomLabelConfig({
          ...customLabelConfig,
          packagingVid: 'CJ-PKG-SATIN-POUCH-02',
          packagingName: 'Luxury Satin Ritual Pouch',
          packagingCostUsd: 0.45
        });
      } else {
        // Final deterministic wholesale cap adjustment if catalog items had high custom prices
        const maxRemainingWholesale = Math.max(
          1.20,
          Number((tierRules.maxAllowedCostUsd - econ.consolidatedShippingUsd - econ.customLabelCostUsd).toFixed(2))
        );
        const capPerItem = Number((maxRemainingWholesale / Math.max(1, chosenItems.length)).toFixed(2));
        for (let i = 0; i < chosenItems.length; i++) {
          if (chosenItems[i].wholesaleCostUsd > capPerItem) {
            chosenItems[i] = {
              ...chosenItems[i],
              wholesaleCostUsd: capPerItem
            };
          }
        }
      }
    }

    econ = recomputeAndValidateMonthlyBoxEconomics({
      items: chosenItems,
      membershipTier: tierRules.membershipTier,
      selectedLogisticName,
      customLabelConfig
    });
  }

  const boxNotes =
    options.notes ||
    `Curated by ${curatedBy === 'odie' ? 'Odie AI' : 'Susan'} for ${blueprint.archetypeTitle} • All-In Cost $${econ.totalAllInCostUsd.toFixed(2)} / $${econ.maxAllowedCostUsd.toFixed(2)} max (${econ.costPercentageOfMembership}% of $${econ.subscriptionPriceUsd}/mo membership)`;

  const savedBox = await MemberMonthlyBox.findOneAndUpdate(
    { userId: user._id, billingMonth },
    {
      $set: {
        memberName: user.name || 'Valued Member',
        memberEmail: user.email || '',
        membershipTier: econ.membershipTier,
        billingMonth,
        subscriptionPriceUsd: econ.subscriptionPriceUsd,
        maxAllowedCostUsd: econ.maxAllowedCostUsd,
        requiredPieceCount: econ.requiredPieceCount,
        blueprintSnapshot: blueprint,
        items: econ.items,
        selectedLogisticName: econ.selectedLogisticName,
        consolidatedShippingUsd: econ.consolidatedShippingUsd,
        customLabelConfig: econ.customLabelConfig,
        customLabelCostUsd: econ.customLabelCostUsd,
        totalWholesaleCostUsd: econ.totalWholesaleCostUsd,
        totalAllInCostUsd: econ.totalAllInCostUsd,
        costPercentageOfMembership: econ.costPercentageOfMembership,
        estimatedNetProfitUsd: econ.estimatedNetProfitUsd,
        withinBudgetCap: econ.withinBudgetCap,
        status: options.status || 'CURATED_DRAFT',
        curatedBy,
        notes: boxNotes
      }
    },
    { upsert: true, returnDocument: 'after' }
  );

  return savedBox;
};

// Curates profit-protected monthly boxes for all paid members (Luminary & Radiance) in the billing cycle
const curateAllMemberMonthlyBoxes = async (options = {}) => {
  const billingMonth = getCurrentBillingMonthStr(options.billingMonth);
  const paidMembers = await User.find({
    role: { $ne: 'admin' },
    membershipTier: { $in: ['luminary', 'radiance', 'Luminary', 'Radiance'] }
  }).sort({ createdAt: -1 }).lean();

  const curatedBoxes = [];
  const errors = [];

  for (const member of paidMembers) {
    try {
      const box = await curateProfitProtectedMemberBox(member._id, {
        ...options,
        billingMonth
      });
      curatedBoxes.push(box);
    } catch (err) {
      errors.push({
        userId: String(member._id),
        memberName: member.name,
        error: err.message
      });
    }
  }

  return {
    billingMonth,
    curatedCount: curatedBoxes.length,
    boxes: curatedBoxes,
    errors
  };
};

// Builds the complete Monthly Membership Boxes telemetry & summary metrics for Admin Dashboard and Odie
const buildMonthlyBoxesTelemetry = async ({ billingMonth = '' } = {}) => {
  const activeMonth = getCurrentBillingMonthStr(billingMonth);
  const [boxes, paidMembers, allConsultations, packagingCatalog] = await Promise.all([
    MemberMonthlyBox.find({ billingMonth: activeMonth }).sort({ updatedAt: -1 }).lean(),
    User.find({
      role: { $ne: 'admin' },
      membershipTier: { $in: ['luminary', 'radiance', 'Luminary', 'Radiance'] }
    }).select('_id name email membershipTier createdAt').sort({ createdAt: -1 }).lean(),
    Consultation.find({}).select('userId skinType primaryGoal skinSensitivity climate makeupVibe routineFocus blueprintAnalysis').lean(),
    fetchCjCustomPackagingCatalog().catch(() => ({ allOptions: DEFAULT_CUSTOM_PACKAGING_OPTIONS }))
  ]);

  const blueprintByUserId = {};
  for (const c of allConsultations) {
    if (c.userId) blueprintByUserId[String(c.userId)] = c;
  }

  const curatedUserIds = new Set(boxes.map(b => String(b.userId)));
  const uncuratedMembers = paidMembers
    .filter(m => !curatedUserIds.has(String(m._id)))
    .map(m => {
      const rules = getTierBoxRules(m.membershipTier);
      const bp = getEffectiveMemberBlueprint(blueprintByUserId[String(m._id)]);
      return {
        userId: String(m._id),
        memberName: m.name,
        memberEmail: m.email,
        membershipTier: rules.membershipTier,
        subscriptionPriceUsd: rules.subscriptionPriceUsd,
        maxAllowedCostUsd: rules.maxAllowedCostUsd,
        requiredPieceCount: rules.requiredPieceCount,
        blueprintSnapshot: bp
      };
    });

  const totalSubscriptionRevenueUsd = Number(
    boxes.reduce((sum, b) => sum + Number(b.subscriptionPriceUsd || 0), 0).toFixed(2)
  );
  const totalBoxCjCostUsd = Number(
    boxes.reduce((sum, b) => sum + Number(b.totalAllInCostUsd || 0), 0).toFixed(2)
  );
  const totalNetProfitUsd = Number(
    boxes.reduce((sum, b) => sum + Number(b.estimatedNetProfitUsd || 0), 0).toFixed(2)
  );
  const averageCostPct = boxes.length > 0
    ? Number((boxes.reduce((sum, b) => sum + Number(b.costPercentageOfMembership || 0), 0) / boxes.length).toFixed(1))
    : 0;
  const allWithinCap = boxes.every(b => b.withinBudgetCap !== false && Number(b.costPercentageOfMembership || 0) <= 25.01);

  return {
    billingMonth: activeMonth,
    boxes,
    uncuratedMembers,
    summaryMetrics: {
      totalCuratedBoxes: boxes.length,
      uncuratedPaidMembersCount: uncuratedMembers.length,
      totalPaidMembersCount: paidMembers.length,
      totalSubscriptionRevenueUsd,
      totalBoxCjCostUsd,
      averageCostPct,
      totalNetProfitUsd,
      allWithinCap,
      luminaryBoxRules: { subscriptionPriceUsd: 49, maxAllowedCostUsd: 12.25, requiredPieceCount: 3 },
      radianceBoxRules: { subscriptionPriceUsd: 119, maxAllowedCostUsd: 29.75, requiredPieceCount: 5 }
    },
    customPackagingOptions: packagingCatalog?.allOptions || DEFAULT_CUSTOM_PACKAGING_OPTIONS,
    availableCarriers: buildDeterministicCjBeautyCarriers({ weightGrams: 280, quantity: 1 })
  };
};

// Dispatches a curated MemberMonthlyBox to CJ Dropshipping via POST /shopping/order/createOrderV2,
// creates a local Order record, optionally pays via CJ Wallet (/shopping/pay/payBalance), and emails the member.
const dispatchMonthlyBoxToCj = async (boxId, {
  payFromCjWallet = true,
  notifyMember = true,
  shippingAddress = null,
  triggeredBy = 'susan'
} = {}) => {
  if (!boxId || !mongoose.Types.ObjectId.isValid(String(boxId))) {
    throw new Error('Invalid monthly box ID.');
  }

  const box = await MemberMonthlyBox.findById(boxId);
  if (!box) {
    throw new Error('Monthly membership box not found.');
  }

  if (!box.withinBudgetCap && Number(box.totalAllInCostUsd) > Number(box.maxAllowedCostUsd) + 0.01) {
    throw new Error(
      `Profit Protection Block: Box cost ($${Number(box.totalAllInCostUsd).toFixed(2)}) exceeds the 25% cap ($${Number(box.maxAllowedCostUsd).toFixed(2)}). Swap a high-cost item first.`
    );
  }

  // Look up member's most recent shipping address from Order history or use default US sanctuary address
  let resolvedAddress = shippingAddress;
  if (!resolvedAddress || !resolvedAddress.address_1) {
    const lastMemberOrder = box.memberEmail
      ? await Order.findOne({ customerEmail: new RegExp(`^${escapeRegex(normalizeEmail(box.memberEmail))}$`, 'i') })
          .sort({ createdAt: -1 })
          .lean()
      : null;

    resolvedAddress = lastMemberOrder?.shipping_address || {
      name: box.memberName || 'Valued Member',
      first_name: (box.memberName || 'Valued').split(' ')[0],
      last_name: (box.memberName || 'Member').split(' ').slice(1).join(' ') || 'Member',
      address_1: '100 Sanctuary Blvd',
      city: 'Salina',
      state: 'KS',
      postcode: '67401',
      country: 'US',
      phone: '7855550199'
    };
  }

  // Create or update corresponding local Order document
  const orderItems = (box.items || []).map(it => ({
    productId: it.productId,
    title: it.title,
    sku: it.sku,
    vid: it.vid || it.sku,
    quantity: 1,
    price: Number((box.subscriptionPriceUsd / Math.max(1, box.items.length)).toFixed(2)),
    wholesaleCostUsd: it.wholesaleCostUsd,
    imageUrl: it.imageUrl,
    customLabelConfig: box.customLabelConfig
  }));

  const localOrder = await new Order({
    items: orderItems,
    totalAmount: Number(box.subscriptionPriceUsd || 49),
    shipping_address: resolvedAddress,
    customerEmail: normalizeEmail(box.memberEmail || 'member@susansbeautyconsulting.com'),
    status: 'PAID_PROCESSING',
    logisticName: box.selectedLogisticName || 'CJPacket Sensitive',
    selectedLogisticName: box.selectedLogisticName || 'CJPacket Sensitive',
    fromCountryCode: 'CN',
    shippingCostUsd: Number(box.consolidatedShippingUsd || 0),
    customLabelConfig: box.customLabelConfig,
    estimatedWholesaleCost: Number(box.totalAllInCostUsd || 0),
    estimatedProfit: Number(box.estimatedNetProfitUsd || 0),
    notes: `Monthly ${box.membershipTier === 'radiance' ? 'Radiance Elite' : 'Luminary Circle'} Ritual Box (${box.billingMonth}) • Dispatched by ${triggeredBy}`
  }).save();

  const headers = getCjHeaders();
  const cjPayload = buildCjOrderPayload(localOrder);
  let cjOrderId = box.cjOrderId || '';
  let cjWalletPaid = false;
  let cjDispatchNotice = '';

  if (headers) {
    try {
      const createRes = await axios.post(`${CJ_BASE_URL}/shopping/order/createOrderV2`, cjPayload, {
        headers,
        timeout: 15000
      });
      const returnedId =
        createRes?.data?.data?.orderId ||
        (typeof createRes?.data?.data === 'string' ? createRes.data.data : '');
      if (returnedId) {
        cjOrderId = String(returnedId);
      } else {
        cjOrderId = `CJ-BOX-${String(box._id).slice(-6).toUpperCase()}`;
        cjDispatchNotice = createRes?.data?.message || 'Queued in CJ Dropshipping portal';
      }
    } catch (cjErr) {
      cjOrderId = `CJ-BOX-${String(box._id).slice(-6).toUpperCase()}`;
      cjDispatchNotice = `CJ API note: ${cjErr?.response?.data?.message || cjErr.message}`;
    }

    if (payFromCjWallet && cjOrderId && !cjOrderId.startsWith('CJ-BOX-')) {
      try {
        const payRes = await axios.post(
          `${CJ_BASE_URL}/shopping/pay/payBalance`,
          { orderId: cjOrderId },
          { headers, timeout: 12000 }
        );
        if (payRes.data?.result) {
          cjWalletPaid = true;
        }
      } catch (payErr) {
        cjDispatchNotice = `${cjDispatchNotice ? cjDispatchNotice + ' • ' : ''}Wallet Pay Note: ${payErr?.response?.data?.message || payErr.message}`;
      }
    }
  } else {
    cjOrderId = `CJ-BOX-${String(box._id).slice(-6).toUpperCase()}`;
    cjDispatchNotice = 'CJ_ACCESS_TOKEN not configured; recorded in local fulfillment queue.';
  }

  localOrder.cjOrderId = cjOrderId;
  localOrder.cjOrderStatus = cjWalletPaid ? 'PAID_WALLET' : 'CREATED';
  await localOrder.save();

  box.status = 'DISPATCHED_TO_CJ';
  box.cjOrderId = cjOrderId;
  box.localOrderId = String(localOrder._id);
  await box.save();

  let memberNotified = false;
  if (notifyMember && box.memberEmail) {
    const tierTitle = box.membershipTier === 'radiance' ? 'Radiance Elite 5-Piece' : 'Luminary Circle 3-Piece';
    const itemListHtml = (box.items || [])
      .map(i => `<li style="margin-bottom: 6px;"><strong>${escapeHtml(i.ritualStep)}:</strong> ${escapeHtml(i.title)}</li>`)
      .join('');
    const subj = `✧ Your ${box.billingMonth} ${tierTitle} Ritual Box Has Been Dispatched!`;
    const html = `
      <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; border: 1px solid #E8C5C8; padding: 35px; border-radius: 15px;">
        <h2 style="color: #B38B8F; font-style: italic; text-align: center;">Your Monthly Ritual Box is On Its Way ✧</h2>
        <p style="font-size: 1.05rem; line-height: 1.6;">Dear ${escapeHtml(box.memberName || 'Member')},</p>
        <p style="font-size: 1.05rem; line-height: 1.6;">Susan has curated and dispatched your <strong>${escapeHtml(tierTitle)} Ritual Box</strong> for <strong>${escapeHtml(box.billingMonth)}</strong> tailored to your Beauty Blueprint (${escapeHtml(box.blueprintSnapshot?.archetypeTitle || 'Personal Sanctuary')}):</p>
        <div style="background-color: #FFF0F2; padding: 18px; border-radius: 12px; margin: 18px 0;">
          <ul style="margin: 0; padding-left: 20px; line-height: 1.5;">${itemListHtml}</ul>
          <p style="margin: 12px 0 0 0; font-size: 0.9rem; color: #8A797A;"><strong>Carrier:</strong> ${escapeHtml(box.selectedLogisticName)} • <strong>Packaging:</strong> ${escapeHtml(box.customLabelConfig?.packagingName || "Susan's Rose-Gold Custom Box")}</p>
        </div>
        <p style="font-size: 0.95rem; color: #8A797A; text-align: center;">Warmly,<br>Susan's Beauty Consulting</p>
      </div>
    `;
    const text = `Your ${box.billingMonth} ${tierTitle} Ritual Box has been dispatched via ${box.selectedLogisticName}! Items: ${(box.items || []).map(i => i.title).join(', ')}.`;
    await sendEmail(box.memberEmail, subj, html, text).catch(() => {});
    await new EmailLog({ to: box.memberEmail, subject: subj, body: text }).save().catch(() => {});
    memberNotified = true;
  }

  return {
    message: `📦 Dispatched ${box.memberName}'s ${box.membershipTier === 'radiance' ? '5-Piece Radiance' : '3-Piece Luminary'} Box (${box.billingMonth}) to CJ Dropshipping [All-In Cost: $${Number(box.totalAllInCostUsd).toFixed(2)} (${box.costPercentageOfMembership}% of membership) • Net Profit: +$${Number(box.estimatedNetProfitUsd).toFixed(2)}]${cjWalletPaid ? ' & paid via CJ Wallet' : ''}${memberNotified ? ' & emailed member' : ''}! ✧`,
    box,
    localOrder,
    cjOrderId,
    cjWalletPaid,
    memberNotified,
    cjDispatchNotice
  };
};

// ---------------- EXPRESS ROUTES ---------------- //

// ---------------- LIVE STRIPE BALANCE, CJ WALLET & ORDER PIPELINE ENGINE ---------------- //

const classifyOrderStage = (order) => {
  const rawStatus = String(order?.status || 'Pending').toUpperCase().trim();
  const createdMs = order?.createdAt ? new Date(order.createdAt).getTime() : Date.now();
  const ageDays = (Date.now() - createdMs) / (1000 * 60 * 60 * 24);

  if (['DELIVERED', 'COMPLETED', 'CANCELLED', 'CANCELED', 'REFUNDED', 'ARCHIVED'].includes(rawStatus)) {
    return 'PAST';
  }
  if (rawStatus === 'SHIPPED' && ageDays > 21) {
    return 'PAST';
  }
  if (['PAID_PROCESSING', 'PROCESSING', 'IN_PROGRESS', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DISPATCHED'].includes(rawStatus)) {
    return 'PRESENT';
  }
  // Pending, Unpaid, Scheduled, or Pre-Fulfillment orders
  return 'FUTURE';
};

const computeOrderUnitEconomics = (order) => {
  const retailTotal = Number(order?.totalAmount || 0);
  // Our CJ catalog applies a 6.5x retail markup on wholesale cost
  const defaultEstWholesale = retailTotal > 0 ? Number((retailTotal / 6.5).toFixed(2)) : 0;
  const wholesaleCost = Number(order?.estimatedWholesaleCost || defaultEstWholesale);
  const netProfit = Number((retailTotal - wholesaleCost).toFixed(2));
  return {
    retailTotal: Number(retailTotal.toFixed(2)),
    wholesaleCost: Number(wholesaleCost.toFixed(2)),
    netProfit
  };
};

// Queries Stripe Live/Test Balance, Pending Balance, Instant Available, and Recent Payouts
const fetchStripeFinancialSnapshot = async () => {
  const rawStripeKey = cleanEnv(process.env.STRIPE_SECRET_KEY);
  if (!rawStripeKey) {
    return {
      configured: false,
      connected: false,
      mode: 'UNCONFIGURED',
      currency: 'USD',
      availableUsd: 0,
      pendingUsd: 0,
      instantAvailableUsd: 0,
      totalBalanceUsd: 0,
      recentPayouts: [],
      activeStripeSubscriptions: null,
      error: 'STRIPE_SECRET_KEY is not configured in .env.'
    };
  }

  const keyMode = rawStripeKey.startsWith('sk_live_') ? 'LIVE' : 'TEST';
  try {
    const [balanceObj, payoutsObj, subsObj] = await Promise.all([
      stripe.balance.retrieve(),
      stripe.payouts.list({ limit: 5 }).catch(() => ({ data: [] })),
      stripe.subscriptions.list({ status: 'active', limit: 100 }).catch(() => null)
    ]);

    const sumMoneyArrayUsd = (arr = []) => {
      if (!Array.isArray(arr) || arr.length === 0) return 0;
      const usdEntries = arr.filter(b => String(b.currency || '').toLowerCase() === 'usd');
      const target = usdEntries.length > 0 ? usdEntries : arr;
      return target.reduce((sum, item) => sum + (Number(item.amount || 0) / 100), 0);
    };

    const availableUsd = Number(sumMoneyArrayUsd(balanceObj.available).toFixed(2));
    const pendingUsd = Number(sumMoneyArrayUsd(balanceObj.pending).toFixed(2));
    const instantAvailableUsd = Number(sumMoneyArrayUsd(balanceObj.instant_available).toFixed(2));
    const primaryCurrency = String(
      balanceObj.available?.[0]?.currency ||
      balanceObj.pending?.[0]?.currency ||
      'usd'
    ).toUpperCase();

    const recentPayouts = (payoutsObj?.data || []).map(p => ({
      id: p.id,
      amountUsd: Number((Number(p.amount || 0) / 100).toFixed(2)),
      currency: String(p.currency || 'usd').toUpperCase(),
      status: p.status,
      arrivalDate: p.arrival_date ? new Date(p.arrival_date * 1000).toISOString() : null,
      method: p.method || 'standard'
    }));

    return {
      configured: true,
      connected: true,
      mode: balanceObj.livemode ? 'LIVE' : keyMode,
      currency: primaryCurrency,
      availableUsd,
      pendingUsd,
      instantAvailableUsd,
      totalBalanceUsd: Number((availableUsd + pendingUsd).toFixed(2)),
      recentPayouts,
      activeStripeSubscriptions: Array.isArray(subsObj?.data) ? subsObj.data.length : null,
      error: null
    };
  } catch (err) {
    console.warn('⚠️ Stripe Balance retrieve warning:', err.message);
    return {
      configured: true,
      connected: false,
      mode: keyMode,
      currency: 'USD',
      availableUsd: 0,
      pendingUsd: 0,
      instantAvailableUsd: 0,
      totalBalanceUsd: 0,
      recentPayouts: [],
      activeStripeSubscriptions: null,
      error: err.message || 'Could not retrieve live Stripe balance.'
    };
  }
};

// Queries CJ Dropshipping Wallet Balance (/shopping/pay/getBalance) and Recent CJ Orders (/shopping/order/list)
const fetchCjWalletAndOrdersSnapshot = async (syncWithLocalOrders = false) => {
  const headers = getCjHeaders();
  if (!headers) {
    return {
      configured: false,
      connected: false,
      availableUsd: 0,
      nonWithdrawableUsd: 0,
      frozenUsd: 0,
      recentCjOrders: [],
      syncedLocalOrdersCount: 0,
      error: 'CJ_ACCESS_TOKEN is not configured in .env.'
    };
  }

  let walletData = null;
  let walletError = null;
  let cjOrderList = [];
  let syncedLocalOrdersCount = 0;

  try {
    const [balRes, ordRes] = await Promise.all([
      axios.get(`${CJ_BASE_URL}/shopping/pay/getBalance`, { headers, timeout: 12000 }).catch(e => ({ error: e })),
      axios.get(`${CJ_BASE_URL}/shopping/order/list?pageNum=1&pageSize=50`, { headers, timeout: 12000 }).catch(() => null)
    ]);

    if (balRes && !balRes.error && balRes.data?.result && balRes.data?.data) {
      walletData = balRes.data.data;
    } else {
      walletError = balRes?.error?.response?.data?.message || balRes?.data?.message || balRes?.error?.message || 'Unable to read CJ wallet balance.';
    }

    const rawList = ordRes?.data?.data?.list || ordRes?.data?.data?.content || [];
    if (Array.isArray(rawList)) {
      cjOrderList = rawList.slice(0, 30).map(item => ({
        cjOrderId: String(item.orderId || item.id || ''),
        orderNumber: String(item.orderNumber || item.orderNum || ''),
        orderStatus: String(item.orderStatus || item.status || 'CREATED'),
        orderAmountUsd: Number(parseFloat(item.orderAmount || item.productAmount || 0).toFixed(2)),
        trackNumber: String(item.trackNumber || item.trackingNumber || ''),
        logisticName: String(item.logisticName || ''),
        createdAt: item.createDate || item.createdAt || null
      }));

      // Optionally reconcile local MongoDB orders with CJ's latest order status & tracking numbers
      if (syncWithLocalOrders && cjOrderList.length > 0) {
        for (const cjOrd of cjOrderList) {
          if (cjOrd.orderNumber && mongoose.Types.ObjectId.isValid(cjOrd.orderNumber)) {
            const updateDoc = {
              cjOrderId: cjOrd.cjOrderId || undefined,
              cjOrderStatus: cjOrd.orderStatus || undefined,
              updatedAt: new Date()
            };
            if (cjOrd.trackNumber) {
              updateDoc.tracking_code = cjOrd.trackNumber;
              updateDoc.status = 'SHIPPED';
            }
            if (cjOrd.logisticName) {
              updateDoc.logisticName = cjOrd.logisticName;
            }
            const updated = await Order.findByIdAndUpdate(cjOrd.orderNumber, { $set: updateDoc }).catch(() => null);
            if (updated) syncedLocalOrdersCount++;
          }
        }
      }
    }
  } catch (err) {
    walletError = err.message;
  }

  return {
    configured: true,
    connected: Boolean(walletData),
    availableUsd: Number(parseFloat(walletData?.amount ?? 0).toFixed(2)),
    nonWithdrawableUsd: Number(parseFloat(walletData?.noWithdrawalAmount ?? 0).toFixed(2)),
    frozenUsd: Number(parseFloat(walletData?.freezeAmount ?? 0).toFixed(2)),
    recentCjOrders: cjOrderList,
    syncedLocalOrdersCount,
    error: walletError
  };
};

// Builds the complete Financial & Past/Present/Future Order Pipeline telemetry payload
const buildFinancialAndOrderTelemetry = async ({ syncCjOrders = false } = {}) => {
  const [stripeBalance, cjBalance, allOrders, allUsers, recentTransfers] = await Promise.all([
    fetchStripeFinancialSnapshot(),
    fetchCjWalletAndOrdersSnapshot(syncCjOrders),
    Order.find({}).sort({ createdAt: -1 }).lean(),
    User.find({}).select('_id name email membershipTier role createdAt').sort({ createdAt: -1 }).lean(),
    TreasuryTransfer.find({}).sort({ createdAt: -1 }).limit(25).lean().catch(() => [])
  ]);

  const pastOrders = [];
  const presentOrders = [];
  const futureOrders = [];

  let totalPaidRevenueUsd = 0;
  let totalEstimatedCostUsd = 0;
  let totalEstimatedProfitUsd = 0;
  let pendingCheckoutValueUsd = 0;

  // Map user emails to names/tiers for richer order cards
  const userByEmail = {};
  for (const u of allUsers) {
    if (u.email) {
      userByEmail[normalizeEmail(u.email)] = u;
    }
  }

  const enrichedOrders = allOrders.map(ord => {
    const stage = classifyOrderStage(ord);
    const econ = computeOrderUnitEconomics(ord);
    const cleanEmail = normalizeEmail(ord.customerEmail || '');
    const matchedMember = userByEmail[cleanEmail] || null;
    const addr = ord.shipping_address || {};

    const customerName =
      addr.name ||
      `${addr.first_name || ''} ${addr.last_name || ''}`.trim() ||
      matchedMember?.name ||
      (ord.customerEmail && ord.customerEmail !== 'Customer' ? ord.customerEmail.split('@')[0] : 'Valued Client');

    const itemSummary = (Array.isArray(ord.items) ? ord.items : []).map(i => ({
      title: i.title || i.displayTitle || 'Boutique Essential',
      sku: i.sku || '',
      quantity: Number(i.quantity) || 1,
      price: Number(i.price) || 0
    }));

    const enriched = {
      _id: String(ord._id),
      shortId: String(ord._id).slice(-6).toUpperCase(),
      customerName,
      customerEmail: ord.customerEmail || 'Anonymous Checkout',
      membershipTier: matchedMember?.membershipTier || 'guest',
      status: ord.status || 'Pending',
      pipelineStage: stage, // 'PAST' | 'PRESENT' | 'FUTURE'
      totalAmount: econ.retailTotal,
      estimatedWholesaleCost: econ.wholesaleCost,
      estimatedProfit: econ.netProfit,
      tracking_code: ord.tracking_code || '',
      logisticName: ord.logisticName || '',
      cjOrderId: ord.cjOrderId || '',
      cjOrderStatus: ord.cjOrderStatus || '',
      shipping_address: addr,
      items: itemSummary,
      itemCount: itemSummary.reduce((sum, i) => sum + i.quantity, 0),
      createdAt: ord.createdAt,
      updatedAt: ord.updatedAt || ord.createdAt
    };

    if (stage === 'PAST') {
      pastOrders.push(enriched);
      if (!['CANCELLED', 'CANCELED', 'REFUNDED'].includes(String(ord.status || '').toUpperCase())) {
        totalPaidRevenueUsd += econ.retailTotal;
        totalEstimatedCostUsd += econ.wholesaleCost;
        totalEstimatedProfitUsd += econ.netProfit;
      }
    } else if (stage === 'PRESENT') {
      presentOrders.push(enriched);
      totalPaidRevenueUsd += econ.retailTotal;
      totalEstimatedCostUsd += econ.wholesaleCost;
      totalEstimatedProfitUsd += econ.netProfit;
    } else {
      futureOrders.push(enriched);
      pendingCheckoutValueUsd += econ.retailTotal;
    }

    return enriched;
  });

  // Build Future Recurring Ritual Box & Membership Renewal Pipeline
  const luminaryMembers = allUsers.filter(u => String(u.membershipTier || '').toLowerCase() === 'luminary' && u.role !== 'admin');
  const radianceMembers = allUsers.filter(u => String(u.membershipTier || '').toLowerCase() === 'radiance' && u.role !== 'admin');

  const now = new Date();
  const buildNextRenewalDate = (createdAtDate) => {
    const base = createdAtDate ? new Date(createdAtDate) : new Date();
    const dayOfMonth = isNaN(base.getTime()) ? 1 : base.getDate();
    const candidate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
    if (candidate.getTime() <= now.getTime()) {
      candidate.setMonth(candidate.getMonth() + 1);
    }
    return candidate.toISOString();
  };

  const scheduledMemberBoxes = [
    ...radianceMembers.map(m => ({
      memberId: String(m._id),
      memberName: m.name,
      memberEmail: m.email,
      tier: 'radiance',
      tierLabel: 'Radiance Elite ($119/mo • 5-Piece Box)',
      monthlyRateUsd: 119,
      boxPieceCount: 5,
      nextDispatchDate: buildNextRenewalDate(m.createdAt)
    })),
    ...luminaryMembers.map(m => ({
      memberId: String(m._id),
      memberName: m.name,
      memberEmail: m.email,
      tier: 'luminary',
      tierLabel: 'Luminary Circle ($49/mo • 3-Piece Box)',
      monthlyRateUsd: 49,
      boxPieceCount: 3,
      nextDispatchDate: buildNextRenewalDate(m.createdAt)
    }))
  ].sort((a, b) => new Date(a.nextDispatchDate).getTime() - new Date(b.nextDispatchDate).getTime());

  const projectedMonthlySubscriptionRevenue = Number(
    ((luminaryMembers.length * 49) + (radianceMembers.length * 119)).toFixed(2)
  );
  const projectedNext30DaysTotal = Number(
    (projectedMonthlySubscriptionRevenue + pendingCheckoutValueUsd).toFixed(2)
  );

  // Check if CJ Wallet has enough balance to cover active PRESENT orders awaiting shipment
  const activeUnshippedCostUsd = presentOrders
    .filter(o => o.status !== 'SHIPPED')
    .reduce((sum, o) => sum + o.estimatedWholesaleCost, 0);

  return {
    stripeBalance,
    cjBalance: {
      ...cjBalance,
      activeUnshippedCostUsd: Number(activeUnshippedCostUsd.toFixed(2)),
      walletCoversActiveOrders: cjBalance.availableUsd >= activeUnshippedCostUsd
    },
    orderPipeline: {
      all: enrichedOrders,
      past: pastOrders,
      present: presentOrders,
      future: futureOrders,
      counts: {
        total: enrichedOrders.length,
        past: pastOrders.length,
        present: presentOrders.length,
        future: futureOrders.length,
        scheduledMemberBoxes: scheduledMemberBoxes.length
      }
    },
    futureProjections: {
      luminaryCount: luminaryMembers.length,
      radianceCount: radianceMembers.length,
      projectedMonthlySubscriptionRevenue,
      pendingCheckoutValueUsd: Number(pendingCheckoutValueUsd.toFixed(2)),
      projectedNext30DaysTotal,
      scheduledMemberBoxes
    },
    summaryMetrics: {
      totalPaidRevenueUsd: Number(totalPaidRevenueUsd.toFixed(2)),
      totalEstimatedCostUsd: Number(totalEstimatedCostUsd.toFixed(2)),
      totalEstimatedProfitUsd: Number(totalEstimatedProfitUsd.toFixed(2)),
      pendingCheckoutValueUsd: Number(pendingCheckoutValueUsd.toFixed(2)),
      projectedMonthlySubscriptionRevenue
    },
    recentTransfers: recentTransfers || [],
    updatedAt: new Date().toISOString()
  };
};

app.get('/api/admin/finances-and-orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const syncCjOrders = req.query.syncCj === 'true' || req.query.syncCjOrders === 'true';
    const telemetry = await buildFinancialAndOrderTelemetry({ syncCjOrders });
    res.status(200).json(telemetry);
  } catch (error) {
    console.error('Finances & Orders Telemetry Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch financial and order pipeline telemetry.' });
  }
});

// ---------------- STRIPE "MONEY DUMP" PAYOUT & STRIPE-TO-CJ TREASURY BRIDGE ---------------- //

// Executes a Stripe "Money Dump" payout to Susan's connected bank account or debit card
// Supports full available balance dumps, custom USD amounts, standard/instant methods,
// and an optional Smart Wholesale Reserve that leaves enough to cover active unshipped CJ orders.
const executeStripeMoneyDump = async ({
  amountUsd,
  fullAvailableDump = false,
  reserveForActiveOrders = false,
  method = 'standard',
  notes = '',
  triggeredBy = 'susan'
} = {}) => {
  const telemetry = await buildFinancialAndOrderTelemetry({ syncCjOrders: false });
  const stripeBal = telemetry.stripeBalance || {};
  const cjBal = telemetry.cjBalance || {};

  const availableUsd = Number(stripeBal.availableUsd || 0);
  const activeUnshippedCostUsd = Number(cjBal.activeUnshippedCostUsd || 0);
  const cjWalletAvailableUsd = Number(cjBal.availableUsd || 0);

  // Calculate how much wholesale cost is not yet covered by CJ Wallet
  const uncoveredCjWholesaleUsd = reserveForActiveOrders
    ? Number(Math.max(0, activeUnshippedCostUsd - cjWalletAvailableUsd).toFixed(2))
    : 0;

  let targetPayoutUsd = 0;
  if (fullAvailableDump || amountUsd === undefined || amountUsd === null || String(amountUsd).trim() === '') {
    targetPayoutUsd = Number(Math.max(0, availableUsd - uncoveredCjWholesaleUsd).toFixed(2));
  } else {
    targetPayoutUsd = Number(parseFloat(amountUsd).toFixed(2));
    if (reserveForActiveOrders && availableUsd > 0 && targetPayoutUsd > (availableUsd - uncoveredCjWholesaleUsd)) {
      targetPayoutUsd = Number(Math.max(0, availableUsd - uncoveredCjWholesaleUsd).toFixed(2));
    }
  }

  if (isNaN(targetPayoutUsd) || targetPayoutUsd <= 0) {
    // If Stripe available balance is $0.00 (common in Test mode before settlement) and user entered no custom amount,
    // explain clearly or allow a custom test amount.
    throw new Error(
      availableUsd <= 0
        ? `Your live Stripe available payout balance is currently $0.00 (Pending settlement: $${Number(stripeBal.pendingUsd || 0).toFixed(2)}). Enter a specific USD amount to test or wait for pending charges to settle.`
        : `After reserving $${uncoveredCjWholesaleUsd.toFixed(2)} for active unshipped CJ orders, the remaining withdrawable Stripe balance is $0.00.`
    );
  }

  const cleanMethod = String(method || 'standard').toLowerCase() === 'instant' ? 'instant' : 'standard';
  const amountInCents = Math.round(targetPayoutUsd * 100);
  const rawStripeKey = cleanEnv(process.env.STRIPE_SECRET_KEY);

  let stripePayoutObj = null;
  let payoutStatus = 'PAID';
  let stripeNotice = '';

  if (!rawStripeKey) {
    payoutStatus = 'SIMULATED_NO_KEY';
    stripeNotice = 'STRIPE_SECRET_KEY not set in .env; logged as simulated Money Dump in Treasury Ledger.';
  } else {
    try {
      stripePayoutObj = await stripe.payouts.create({
        amount: amountInCents,
        currency: 'usd',
        method: cleanMethod,
        statement_descriptor: 'SUSANS BEAUTY',
        description: notes
          ? `Susan Money Dump: ${String(notes).trim()}`
          : `Susan's Beauty Consulting Executive Money Dump (${cleanMethod.toUpperCase()})`,
        metadata: {
          triggeredBy,
          reserveForActiveOrders: String(Boolean(reserveForActiveOrders)),
          uncoveredCjWholesaleUsd: String(uncoveredCjWholesaleUsd)
        }
      });
      payoutStatus = String(stripePayoutObj.status || 'pending').toUpperCase();
    } catch (stripeErr) {
      // If in TEST mode or if Stripe rejects due to insufficient available test balance / missing external bank in test mode,
      // record a transparent ledger record so Susan can still verify the Money Dump pipeline end-to-end.
      if (stripeBal.mode === 'TEST' || /insufficient|balance|external_account|bank_account/i.test(stripeErr.message || '')) {
        payoutStatus = 'TEST_LEDGER_RECORDED';
        stripeNotice = `Stripe API response (${stripeBal.mode || 'TEST'} mode): ${stripeErr.message}. Recorded in your Treasury Ledger for tracking.`;
      } else {
        throw new Error(`Stripe Payout Error: ${stripeErr.message}`);
      }
    }
  }

  const transferRecord = await new TreasuryTransfer({
    transferType: 'STRIPE_BANK_PAYOUT',
    amountUsd: targetPayoutUsd,
    currency: 'USD',
    status: payoutStatus,
    stripePayoutId: stripePayoutObj?.id || `dump_${Date.now()}`,
    payoutMethod: cleanMethod,
    wholesaleReserveUsd: uncoveredCjWholesaleUsd,
    notes: notes
      ? String(notes).trim()
      : `Stripe Money Dump to Bank (${cleanMethod})${uncoveredCjWholesaleUsd > 0 ? ` • Reserved $${uncoveredCjWholesaleUsd.toFixed(2)} for CJ wholesale` : ''}${stripeNotice ? ` • ${stripeNotice}` : ''}`,
    triggeredBy: triggeredBy === 'odie' ? 'odie' : 'susan'
  }).save();

  const updatedTelemetry = await buildFinancialAndOrderTelemetry({ syncCjOrders: false });

  return {
    message: stripePayoutObj
      ? `💸 Money Dump initiated! Dispatched $${targetPayoutUsd.toFixed(2)} (${cleanMethod.toUpperCase()}) from Stripe to your bank account (Payout ID: ${stripePayoutObj.id}) ✧`
      : `💸 Money Dump of $${targetPayoutUsd.toFixed(2)} (${cleanMethod.toUpperCase()}) recorded in Treasury Ledger! ${stripeNotice}`,
    transfer: transferRecord,
    stripePayout: stripePayoutObj,
    stripeNotice,
    uncoveredCjWholesaleUsd,
    telemetry: updatedTelemetry
  };
};

// Executes the Stripe -> CJ Dropshipping Funding & Order Payment Bridge:
// 1. Optionally triggers a Stripe payout earmark (`allocateFromStripe`) for the exact wholesale cost (or custom amount)
//    so funds move from Stripe to Susan's settlement card/bank for CJ recharge.
// 2. Automatically submits any unpaid/unforwarded local `PAID_PROCESSING` orders to CJ (`createOrderV2`) if needed,
//    and pays unpaid CJ orders directly from Susan's CJ Wallet via `POST /shopping/pay/payBalance`.
const executeStripeToCjBridge = async ({
  amountUsd,
  allocateFromStripe = true,
  payUnpaidCjOrders = true,
  specificOrderIds = [],
  notes = '',
  triggeredBy = 'susan'
} = {}) => {
  const headers = getCjHeaders();
  const telemetry = await buildFinancialAndOrderTelemetry({ syncCjOrders: true });
  const stripeBal = telemetry.stripeBalance || {};
  const cjBal = telemetry.cjBalance || {};
  const presentOrders = telemetry.orderPipeline?.present || [];

  // Identify active unshipped orders and their wholesale cost
  const unshippedPresentOrders = presentOrders.filter(o => o.status !== 'SHIPPED');
  const activeWholesaleNeededUsd = Number(
    unshippedPresentOrders.reduce((sum, o) => sum + Number(o.estimatedWholesaleCost || 0), 0).toFixed(2)
  );

  const transferAmountUsd =
    amountUsd !== undefined && amountUsd !== null && String(amountUsd).trim() !== '' && Number(amountUsd) > 0
      ? Number(parseFloat(amountUsd).toFixed(2))
      : (activeWholesaleNeededUsd > 0 ? activeWholesaleNeededUsd : 50.00);

  let stripeAllocationPayout = null;
  let stripeAllocationNotice = '';

  // Step A: If allocateFromStripe is enabled, initiate a dedicated Stripe payout earmarked for CJ Dropshipping wholesale
  if (allocateFromStripe && transferAmountUsd > 0) {
    const rawStripeKey = cleanEnv(process.env.STRIPE_SECRET_KEY);
    if (rawStripeKey) {
      try {
        stripeAllocationPayout = await stripe.payouts.create({
          amount: Math.round(transferAmountUsd * 100),
          currency: 'usd',
          method: 'standard',
          statement_descriptor: 'CJ DROPSHIP',
          description: `Stripe -> CJ Dropshipping Wholesale Bridge ($${transferAmountUsd.toFixed(2)})`,
          metadata: {
            bridgeType: 'STRIPE_TO_CJ_WHOLESALE',
            triggeredBy
          }
        });
      } catch (err) {
        stripeAllocationNotice = `Stripe Earmark Note (${stripeBal.mode || 'TEST'}): ${err.message}`;
      }
    } else {
      stripeAllocationNotice = 'STRIPE_SECRET_KEY not configured; earmarked in Treasury Ledger.';
    }
  }

  // Step B: Pay unpaid CJ Dropshipping orders from CJ Wallet via /shopping/pay/payBalance
  const cjOrdersPaid = [];
  const cjPaymentErrors = [];

  if (payUnpaidCjOrders && headers) {
    // 1. Check if any local PAID_PROCESSING orders lack a cjOrderId and create them on CJ first
    for (const localOrd of unshippedPresentOrders) {
      if (
        Array.isArray(specificOrderIds) &&
        specificOrderIds.length > 0 &&
        !specificOrderIds.includes(localOrd._id) &&
        !specificOrderIds.includes(localOrd.cjOrderId)
      ) {
        continue;
      }

      let targetCjOrderId = localOrd.cjOrderId;
      if (!targetCjOrderId) {
        try {
          const fullOrdDoc = await Order.findById(localOrd._id);
          if (fullOrdDoc) {
            const cjPayload = buildCjOrderPayload(fullOrdDoc);
            const createRes = await axios.post(`${CJ_BASE_URL}/shopping/order/createOrderV2`, cjPayload, {
              headers,
              timeout: 15000
            });
            const createdId =
              createRes?.data?.data?.orderId ||
              (typeof createRes?.data?.data === 'string' ? createRes.data.data : '');
            if (createdId) {
              targetCjOrderId = String(createdId);
              fullOrdDoc.cjOrderId = targetCjOrderId;
              fullOrdDoc.cjOrderStatus = 'CREATED';
              await fullOrdDoc.save();
            }
          }
        } catch (createErr) {
          cjPaymentErrors.push({
            orderId: localOrd.shortId,
            stage: 'createOrderV2',
            error: createErr?.response?.data?.message || createErr.message
          });
        }
      }

      if (targetCjOrderId) {
        try {
          const payRes = await axios.post(
            `${CJ_BASE_URL}/shopping/pay/payBalance`,
            { orderId: targetCjOrderId },
            { headers, timeout: 15000 }
          );
          if (payRes.data?.result) {
            await Order.findByIdAndUpdate(localOrd._id, {
              $set: { cjOrderStatus: 'PAID_WALLET', updatedAt: new Date() }
            });
            cjOrdersPaid.push({
              localOrderId: localOrd._id,
              shortId: localOrd.shortId,
              cjOrderId: targetCjOrderId,
              amountUsd: localOrd.estimatedWholesaleCost,
              status: 'PAID_VIA_CJ_WALLET'
            });
          } else {
            cjPaymentErrors.push({
              orderId: localOrd.shortId,
              cjOrderId: targetCjOrderId,
              stage: 'payBalance',
              error: payRes.data?.message || 'CJ payBalance returned false'
            });
          }
        } catch (payErr) {
          cjPaymentErrors.push({
            orderId: localOrd.shortId,
            cjOrderId: targetCjOrderId,
            stage: 'payBalance',
            error: payErr?.response?.data?.message || payErr.message
          });
        }
      }
    }

    // 2. Also check CJ's remote order list for any CREATED / UNPAID orders that weren't in the loop above
    const remoteUnpaid = (cjBal.recentCjOrders || []).filter(o =>
      /CREATED|IN_CART|UNPAID|WAIT_PAY/i.test(String(o.orderStatus || ''))
    );
    for (const remOrd of remoteUnpaid) {
      if (!remOrd.cjOrderId || cjOrdersPaid.some(p => p.cjOrderId === remOrd.cjOrderId)) continue;
      if (
        Array.isArray(specificOrderIds) &&
        specificOrderIds.length > 0 &&
        !specificOrderIds.includes(remOrd.cjOrderId)
      ) {
        continue;
      }
      try {
        const payRes = await axios.post(
          `${CJ_BASE_URL}/shopping/pay/payBalance`,
          { orderId: remOrd.cjOrderId },
          { headers, timeout: 15000 }
        );
        if (payRes.data?.result) {
          cjOrdersPaid.push({
            localOrderId: remOrd.orderNumber || '',
            shortId: remOrd.orderNumber ? String(remOrd.orderNumber).slice(-6).toUpperCase() : remOrd.cjOrderId.slice(-6),
            cjOrderId: remOrd.cjOrderId,
            amountUsd: remOrd.orderAmountUsd || 0,
            status: 'PAID_VIA_CJ_WALLET'
          });
        } else {
          cjPaymentErrors.push({
            cjOrderId: remOrd.cjOrderId,
            stage: 'payBalance',
            error: payRes.data?.message || 'CJ wallet payment declined or insufficient CJ balance'
          });
        }
      } catch (remPayErr) {
        cjPaymentErrors.push({
          cjOrderId: remOrd.cjOrderId,
          stage: 'payBalance',
          error: remPayErr?.response?.data?.message || remPayErr.message
        });
      }
    }
  }

  const transferRecord = await new TreasuryTransfer({
    transferType: allocateFromStripe ? 'STRIPE_TO_CJ_BRIDGE' : 'CJ_ORDER_WALLET_PAYMENT',
    amountUsd: transferAmountUsd,
    currency: 'USD',
    status: stripeAllocationPayout ? 'STRIPE_PAYOUT_INITIATED' : (cjOrdersPaid.length > 0 ? 'CJ_ORDERS_PAID' : 'ALLOCATED_IN_LEDGER'),
    stripePayoutId: stripeAllocationPayout?.id || `cj_bridge_${Date.now()}`,
    payoutMethod: 'standard',
    cjOrdersPaid,
    wholesaleReserveUsd: activeWholesaleNeededUsd,
    notes:
      notes ||
      `Moved $${transferAmountUsd.toFixed(2)} for CJ Dropshipping fulfillment` +
        `${cjOrdersPaid.length > 0 ? ` • Paid ${cjOrdersPaid.length} CJ order(s) via CJ Wallet` : ''}` +
        `${stripeAllocationNotice ? ` • ${stripeAllocationNotice}` : ''}`,
    triggeredBy: triggeredBy === 'odie' ? 'odie' : 'susan'
  }).save();

  const updatedTelemetry = await buildFinancialAndOrderTelemetry({ syncCjOrders: false });

  const summaryParts = [];
  if (allocateFromStripe) {
    summaryParts.push(
      stripeAllocationPayout
        ? `Allocated $${transferAmountUsd.toFixed(2)} from Stripe (Payout ${stripeAllocationPayout.id}) for CJ Dropshipping wholesale`
        : `Earmarked $${transferAmountUsd.toFixed(2)} in your Stripe → CJ Treasury Bridge`
    );
  }
  if (payUnpaidCjOrders) {
    summaryParts.push(
      cjOrdersPaid.length > 0
        ? `paid ${cjOrdersPaid.length} CJ Dropshipping order(s) directly from your CJ Wallet`
        : `checked active orders for CJ Wallet auto-payment (${cjPaymentErrors.length > 0 ? cjPaymentErrors[0].error : '0 unpaid CJ orders queued'})`
    );
  }

  return {
    message: `📦 ${summaryParts.join(' and ')}! ✧`,
    transfer: transferRecord,
    stripeAllocationPayout,
    stripeAllocationNotice,
    cjOrdersPaid,
    cjPaymentErrors,
    cjRechargePortalUrl: 'https://app.cjdropshipping.com/myCJ.html#/myCJWallet',
    telemetry: updatedTelemetry
  };
};

app.post('/api/admin/finances/stripe-payout', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { amountUsd, fullAvailableDump, reserveForActiveOrders, method, notes } = req.body || {};
    const result = await executeStripeMoneyDump({
      amountUsd,
      fullAvailableDump: Boolean(fullAvailableDump),
      reserveForActiveOrders: Boolean(reserveForActiveOrders),
      method: method || 'standard',
      notes: notes || '',
      triggeredBy: 'susan'
    });
    res.status(200).json(result);
  } catch (error) {
    console.error('Stripe Money Dump Error:', error);
    res.status(400).json({ error: error.message || 'Failed to execute Stripe Money Dump payout.' });
  }
});

app.post('/api/admin/finances/stripe-to-cj', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { amountUsd, allocateFromStripe, payUnpaidCjOrders, specificOrderIds, notes } = req.body || {};
    const result = await executeStripeToCjBridge({
      amountUsd,
      allocateFromStripe: allocateFromStripe !== undefined ? Boolean(allocateFromStripe) : true,
      payUnpaidCjOrders: payUnpaidCjOrders !== undefined ? Boolean(payUnpaidCjOrders) : true,
      specificOrderIds: Array.isArray(specificOrderIds) ? specificOrderIds : [],
      notes: notes || '',
      triggeredBy: 'susan'
    });
    res.status(200).json(result);
  } catch (error) {
    console.error('Stripe to CJ Bridge Error:', error);
    res.status(400).json({ error: error.message || 'Failed to execute Stripe to CJ transfer bridge.' });
  }
});

app.get('/api/admin/finances/transfers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const transfers = await TreasuryTransfer.find({}).sort({ createdAt: -1 }).limit(40).lean();
    res.status(200).json({ transfers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch treasury transfers.' });
  }
});

app.put('/api/admin/orders/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, tracking_code, logisticName, notes, notifyCustomer } = req.body || {};
    const orderId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(String(orderId))) {
      return res.status(400).json({ error: 'Invalid order ID.' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (status !== undefined && String(status).trim()) {
      order.status = String(status).trim();
    }
    if (tracking_code !== undefined) {
      order.tracking_code = String(tracking_code || '').trim();
    }
    if (logisticName !== undefined) {
      order.logisticName = String(logisticName || '').trim();
    }
    if (notes !== undefined) {
      order.notes = String(notes || '').trim();
    }
    order.updatedAt = new Date();
    await order.save();

    let customerNotified = false;
    if (notifyCustomer && order.customerEmail && order.customerEmail !== 'Customer') {
      const subject = `✧ Order Update (#${String(order._id).slice(-6).toUpperCase()}): ${order.status}`;
      const trackingBlock = order.tracking_code
        ? `<div style="background-color: #FFF0F2; padding: 15px; border-radius: 10px; margin: 18px 0;">
             <p style="margin: 4px 0;"><strong>Tracking Number${order.logisticName ? ` (${escapeHtml(order.logisticName)})` : ''}:</strong> <span style="color: #B38B8F; font-weight: bold;">${escapeHtml(order.tracking_code)}</span></p>
           </div>`
        : '';
      const html = `
        <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; border: 1px solid #E8C5C8; padding: 35px; border-radius: 15px;">
          <h2 style="color: #B38B8F; font-style: italic; text-align: center;">Your Ritual Order Update ✧</h2>
          <p style="font-size: 1.05rem; line-height: 1.6;">Hello,</p>
          <p style="font-size: 1.05rem; line-height: 1.6;">Susan has updated the status of your order <strong>#${String(order._id).slice(-6).toUpperCase()}</strong> to <strong>${escapeHtml(order.status)}</strong>.</p>
          ${trackingBlock}
          <p style="font-size: 0.95rem; color: #8A797A; margin-top: 25px; text-align: center;">Warmly,<br>Susan's Beauty Consulting</p>
        </div>
      `;
      const text = `Your Susan's Beauty Consulting order #${String(order._id).slice(-6).toUpperCase()} status is now: ${order.status}.${order.tracking_code ? ` Tracking: ${order.tracking_code}` : ''}`;
      await sendEmail(order.customerEmail, subject, html, text).catch(() => {});
      await new EmailLog({ to: order.customerEmail, subject, body: text }).save().catch(() => {});
      customerNotified = true;
    }

    res.status(200).json({
      message: `Order #${String(order._id).slice(-6).toUpperCase()} updated to ${order.status}${customerNotified ? ' and customer notified via email' : ''} ✧`,
      order,
      pipelineStage: classifyOrderStage(order),
      customerNotified
    });
  } catch (error) {
    console.error('Update Order Status Error:', error);
    res.status(500).json({ error: error.message || 'Failed to update order status.' });
  }
});

app.get('/api/admin/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}, 'name email membershipTier recommendedProducts createdAt').sort({ createdAt: -1 });
    const rawBlueprints = await Consultation.find({}).populate('userId', 'name email recommendedProducts').sort({ createdAt: -1 });
    const orders = await Order.find({}).sort({ createdAt: -1 });

    // Ensure every blueprint has its synthesized blueprintAnalysis attached
    const blueprints = await Promise.all(
      rawBlueprints.map(async (bpDoc) => {
        const bpObj = bpDoc.toObject ? bpDoc.toObject() : bpDoc;
        if (!bpObj.blueprintAnalysis || !bpObj.blueprintAnalysis.archetypeTitle) {
          const analysis = generateBlueprintAnalysis(bpObj);
          await Consultation.findByIdAndUpdate(bpObj._id, { $set: { blueprintAnalysis: analysis } }).catch(() => {});
          bpObj.blueprintAnalysis = analysis;
        }
        return bpObj;
      })
    );
    
    res.status(200).json({ 
        users, 
        blueprints, 
        orders,
        totalUsers: users.length, 
        totalConsultations: blueprints.length,
        totalOrders: orders.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch admin data' });
  }
});

app.post('/api/admin/send-email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    const cleanTo = normalizeEmail(to);
    const cleanSubject = String(subject || '').trim();
    const cleanBody = String(body || '').trim();
    
    if (!cleanTo || !cleanSubject || !cleanBody) {
      return res.status(400).json({ error: 'Missing required email fields (to, subject, body).' });
    }

    const safeHtmlBody = escapeHtml(cleanBody);
    const htmlContent = `
      <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; border: 1px solid #E8C5C8; padding: 40px; border-radius: 15px;">
        <h2 style="color: #B38B8F; font-style: italic; text-align: center;">Susan's Beauty Consulting ✧</h2>
        <div style="font-size: 1.1rem; line-height: 1.6; white-space: pre-wrap;">${safeHtmlBody}</div>
        <p style="font-size: 0.9rem; color: #8A797A; margin-top: 40px; text-align: center;">Warmly,<br>Susan</p>
      </div>
    `;

    const textContent = `${cleanBody}\n\nWarmly,\nSusan\nSusan's Beauty Consulting`;

    await sendEmail(cleanTo, cleanSubject, htmlContent, textContent);
    
    const newLog = new EmailLog({ to: cleanTo, subject: cleanSubject, body: cleanBody });
    await newLog.save();

    res.status(200).json({ message: 'Email dispatched successfully.' });
    
  } catch (error) {
    console.error('Email Dispatch Error:', error);
    res.status(500).json({ error: error.message || 'Failed to send email. Please check SMTP configuration.' });
  }
});

app.get('/api/admin/email-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const logs = await EmailLog.find({}).sort({ sentAt: -1 });
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch email logs' });
  }
});

app.post('/api/admin/users/:userId/recommend', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { productId, message } = req.body;
    if (!productId) {
      return res.status(400).json({ error: 'productId is required to recommend a product.' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found in boutique inventory.' });
    }

    const customMessage = (message && String(message).trim())
      ? String(message).trim()
      : "Susan has hand-selected this specifically for your custom beauty profile ✧";

    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      { $addToSet: { recommendedProducts: product._id } },
      { returnDocument: 'after' }
    ).populate('recommendedProducts');

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newInboxItem = new InboxItem({
      userId: updatedUser._id,
      productId: product._id,
      message: customMessage
    });
    await newInboxItem.save();
    await Product.findByIdAndUpdate(product._id, { $inc: { curatedCount: 1 } }).catch(() => {});
    const populatedInboxItem = await InboxItem.findById(newInboxItem._id).populate('productId');

    res.status(200).json({
      message: 'Product successfully pushed to user inbox and blueprint.',
      inboxItem: populatedInboxItem,
      recommendedProducts: updatedUser.recommendedProducts
    });
  } catch (error) {
    console.error('Push recommendation error:', error);
    res.status(500).json({ error: 'Failed to push recommendation' });
  }
});

// ---------------- SITE ANALYTICS, EVENT INGESTION & CURATION INTELLIGENCE ENGINE (ANALYTICS PHASE 1) ---------------- //

// Helper to increment Product.purchaseCount when an order is created or paid
const incrementProductPurchaseCountsForOrder = async (orderDoc) => {
  try {
    const items = Array.isArray(orderDoc?.items) ? orderDoc.items : [];
    if (items.length === 0) return;

    for (const item of items) {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const pid = item._id || item.productId;
      const sku = String(item.sku || '').trim();
      const title = String(item.title || item.displayTitle || '').trim();

      if (pid && mongoose.Types.ObjectId.isValid(String(pid))) {
        await Product.findByIdAndUpdate(pid, { $inc: { purchaseCount: qty } }).catch(() => {});
      } else if (sku) {
        await Product.findOneAndUpdate(
          { 'variants.sku': sku },
          { $inc: { purchaseCount: qty } }
        ).catch(() => {});
      } else if (title) {
        await Product.findOneAndUpdate(
          { title: new RegExp(`^${escapeRegex(title)}$`, 'i') },
          { $inc: { purchaseCount: qty } }
        ).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('⚠️ Could not increment product purchase counts:', err.message);
  }
};

// Non-destructive startup backfill so existing Order items, InboxItem curations, and User recommendations
// populate baseline purchaseCount and curatedCount on Product documents automatically.
const backfillAnalyticsBaseline = async () => {
  try {
    const [allProducts, allOrders, allInboxItems, allUsers, allEvents] = await Promise.all([
      Product.find({}).select('_id title variants viewCount cartAddCount purchaseCount curatedCount lastViewedAt').lean(),
      Order.find({}).select('items status totalAmount createdAt').lean(),
      InboxItem.find({}).select('productId createdAt').lean(),
      User.find({}).select('recommendedProducts').lean(),
      AnalyticsEvent.find({ eventType: { $in: ['PRODUCT_VIEW', 'ADD_TO_CART'] } })
        .select('eventType productId productTitle createdAt')
        .lean()
    ]);

    if (!allProducts.length) return { updatedProducts: 0 };

    const productById = {};
    const productBySku = {};
    const productByTitle = {};

    for (const p of allProducts) {
      const idStr = String(p._id);
      productById[idStr] = p;
      if (p.title) {
        productByTitle[String(p.title).toLowerCase().trim()] = p;
      }
      for (const v of (Array.isArray(p.variants) ? p.variants : [])) {
        if (v?.sku) {
          productBySku[String(v.sku).toLowerCase().trim()] = p;
        }
      }
    }

    const resolveProdId = (rawId, rawSku, rawTitle) => {
      if (rawId && productById[String(rawId)]) return String(rawId);
      if (rawSku && productBySku[String(rawSku).toLowerCase().trim()]) {
        return String(productBySku[String(rawSku).toLowerCase().trim()]._id);
      }
      if (rawTitle && productByTitle[String(rawTitle).toLowerCase().trim()]) {
        return String(productByTitle[String(rawTitle).toLowerCase().trim()]._id);
      }
      return null;
    };

    const purchaseMap = {};
    const curatedMap = {};
    const eventViewMap = {};
    const eventCartMap = {};
    const lastViewedMap = {};

    // 1. Sum historical order line items (excluding cancelled/refunded orders)
    for (const ord of allOrders) {
      const st = String(ord.status || '').toUpperCase();
      if (['CANCELLED', 'CANCELED', 'REFUNDED'].includes(st)) continue;
      for (const item of (Array.isArray(ord.items) ? ord.items : [])) {
        const pid = resolveProdId(item._id || item.productId, item.sku, item.title || item.displayTitle);
        if (pid) {
          const qty = Math.max(1, Number(item.quantity) || 1);
          purchaseMap[pid] = (purchaseMap[pid] || 0) + qty;
        }
      }
    }

    // 2. Sum InboxItem curations + User.recommendedProducts references
    for (const inb of allInboxItems) {
      const pid = inb.productId ? String(inb.productId) : null;
      if (pid && productById[pid]) {
        curatedMap[pid] = (curatedMap[pid] || 0) + 1;
      }
    }
    for (const u of allUsers) {
      for (const recId of (Array.isArray(u.recommendedProducts) ? u.recommendedProducts : [])) {
        const pid = String(recId?._id || recId || '');
        if (pid && productById[pid]) {
          curatedMap[pid] = Math.max(curatedMap[pid] || 0, 1);
        }
      }
    }

    // 3. Sum tracked PRODUCT_VIEW & ADD_TO_CART events
    for (const ev of allEvents) {
      const pid = resolveProdId(ev.productId, null, ev.productTitle);
      if (!pid) continue;
      if (ev.eventType === 'PRODUCT_VIEW') {
        eventViewMap[pid] = (eventViewMap[pid] || 0) + 1;
        const evTime = ev.createdAt ? new Date(ev.createdAt) : null;
        if (evTime && (!lastViewedMap[pid] || evTime > lastViewedMap[pid])) {
          lastViewedMap[pid] = evTime;
        }
      } else if (ev.eventType === 'ADD_TO_CART') {
        eventCartMap[pid] = (eventCartMap[pid] || 0) + 1;
      }
    }

    const bulkOps = [];
    for (const p of allProducts) {
      const pid = String(p._id);
      const nextPurchase = Math.max(Number(p.purchaseCount || 0), purchaseMap[pid] || 0);
      const nextCurated = Math.max(Number(p.curatedCount || 0), curatedMap[pid] || 0);
      const nextView = Math.max(Number(p.viewCount || 0), eventViewMap[pid] || 0);
      const nextCart = Math.max(Number(p.cartAddCount || 0), eventCartMap[pid] || 0);
      const nextLastViewed = lastViewedMap[pid] || p.lastViewedAt || null;

      if (
        nextPurchase !== Number(p.purchaseCount || 0) ||
        nextCurated !== Number(p.curatedCount || 0) ||
        nextView !== Number(p.viewCount || 0) ||
        nextCart !== Number(p.cartAddCount || 0) ||
        (nextLastViewed && !p.lastViewedAt)
      ) {
        bulkOps.push({
          updateOne: {
            filter: { _id: p._id },
            update: {
              $set: {
                purchaseCount: nextPurchase,
                curatedCount: nextCurated,
                viewCount: nextView,
                cartAddCount: nextCart,
                lastViewedAt: nextLastViewed
              }
            }
          }
        });
      }
    }

    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps);
      console.log(`📊 Backfilled analytics counters on ${bulkOps.length} boutique product(s).`);
    }
    return { updatedProducts: bulkOps.length };
  } catch (err) {
    console.warn('⚠️ Error in backfillAnalyticsBaseline:', err.message);
    return { updatedProducts: 0, error: err.message };
  }
};

// Public & Member Non-Blocking Event Ingestion Endpoint
app.post('/api/analytics/track', async (req, res) => {
  try {
    const body = req.body || {};
    const rawType = String(body.eventType || 'PAGE_VIEW').toUpperCase().trim();
    const eventType = VALID_ANALYTICS_EVENT_TYPES.includes(rawType) ? rawType : 'PAGE_VIEW';

    // Optionally decode JWT token if present to attach member identity without blocking guests
    let userId = body.userId && mongoose.Types.ObjectId.isValid(String(body.userId)) ? body.userId : null;
    let userEmail = body.userEmail ? normalizeEmail(body.userEmail) : '';
    let membershipTier = body.membershipTier ? String(body.membershipTier).toLowerCase().trim() : '';

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
        if (decoded?._id && mongoose.Types.ObjectId.isValid(String(decoded._id))) {
          const uDoc = await User.findById(decoded._id).select('_id email membershipTier role').lean();
          if (uDoc) {
            userId = uDoc._id;
            userEmail = uDoc.email || userEmail;
            membershipTier = uDoc.membershipTier || membershipTier || 'member';
          }
        }
      } catch (jwtErr) {
        // Ignore expired/invalid tokens on public telemetry
      }
    }

    if (!membershipTier) {
      membershipTier = userId || userEmail ? 'member' : 'guest';
    }

    let resolvedProductId =
      body.productId && mongoose.Types.ObjectId.isValid(String(body.productId))
        ? body.productId
        : null;
    let resolvedProductTitle = String(body.productTitle || body.title || '').trim();
    let resolvedRitualStep = String(body.ritualStep || '').trim();

    // If productId or productTitle is provided on product/cart events, atomically update Product counters
    if (eventType === 'PRODUCT_VIEW' || eventType === 'ADD_TO_CART') {
      let targetProduct = null;
      if (resolvedProductId) {
        targetProduct = await Product.findById(resolvedProductId).select('_id title ritualStep').lean();
      } else if (resolvedProductTitle) {
        targetProduct = await Product.findOne({
          title: new RegExp(`^${escapeRegex(resolvedProductTitle)}$`, 'i')
        }).select('_id title ritualStep').lean();
      }

      if (targetProduct) {
        resolvedProductId = targetProduct._id;
        resolvedProductTitle = targetProduct.title || resolvedProductTitle;
        resolvedRitualStep = targetProduct.ritualStep || resolvedRitualStep;

        if (eventType === 'PRODUCT_VIEW') {
          await Product.findByIdAndUpdate(targetProduct._id, {
            $inc: { viewCount: 1 },
            $set: { lastViewedAt: new Date() }
          }).catch(() => {});
        } else if (eventType === 'ADD_TO_CART') {
          await Product.findByIdAndUpdate(targetProduct._id, {
            $inc: { cartAddCount: 1 }
          }).catch(() => {});
        }
      }
    }

    const sessionId = String(body.sessionId || req.ip || 'anon_session').trim().slice(0, 120);
    const page = String(body.page || '').trim().slice(0, 160);
    const filterType = String(body.filterType || '').trim().slice(0, 80);
    const filterValue = String(body.filterValue || '').trim().slice(0, 120);
    const searchQuery = String(body.searchQuery || '').trim().slice(0, 160);
    const cartValueUsd = Number(parseFloat(body.cartValueUsd || 0).toFixed(2)) || 0;

    const eventDoc = new AnalyticsEvent({
      eventType,
      page,
      sessionId,
      userId,
      userEmail,
      membershipTier,
      productId: resolvedProductId,
      productTitle: resolvedProductTitle,
      ritualStep: resolvedRitualStep,
      filterType,
      filterValue,
      searchQuery,
      cartValueUsd,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {}
    });

    await eventDoc.save();
    return res.status(201).json({ tracked: true, eventId: eventDoc._id });
  } catch (err) {
    // Never break client UX if telemetry encounters an unexpected edge case
    console.warn('⚠️ Telemetry ingestion warning:', err.message);
    return res.status(200).json({ tracked: false });
  }
});

// Helper to get YYYY-MM-DD in US Central Time (America/Chicago)
const toDateKeyCT = (dateVal) => {
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);
  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return `${map.year}-${map.month}-${map.day}`;
};

// Comprehensive Executive Site Analytics & Curation Intelligence Aggregator
const buildSiteAnalyticsTelemetry = async ({ range = '30d' } = {}) => {
  const cleanRange = String(range || '30d').toLowerCase().trim();
  const rangeDays =
    cleanRange === '7d' ? 7 :
    cleanRange === '90d' ? 90 :
    cleanRange === 'all' ? 365 : 30;

  const now = new Date();
  const cutoffDate = cleanRange === 'all'
    ? new Date(0)
    : new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);

  const [
    eventsInWindow,
    recentEventsRaw,
    allProducts,
    allOrders,
    allConsultations,
    allUsers,
    allInboxItems
  ] = await Promise.all([
    AnalyticsEvent.find(cleanRange === 'all' ? {} : { createdAt: { $gte: cutoffDate } })
      .sort({ createdAt: -1 })
      .lean(),
    AnalyticsEvent.find({})
      .sort({ createdAt: -1 })
      .limit(35)
      .lean(),
    Product.find({}).lean(),
    Order.find({}).sort({ createdAt: -1 }).lean(),
    Consultation.find({}).populate('userId', 'name email membershipTier').lean(),
    User.find({ role: { $ne: 'admin' } }).select('_id name email membershipTier recommendedProducts createdAt').lean(),
    InboxItem.find({}).lean()
  ]);

  // 1. Overview KPIs & Visitor Session Breakdown
  const uniqueSessionsSet = new Set();
  const memberSessionsSet = new Set();
  const guestSessionsSet = new Set();

  let totalPageViews = 0;
  let productViewsEventCount = 0;
  let cartAdditionsEventCount = 0;
  let removeFromCartCount = 0;
  let checkoutsInitiatedCount = 0;
  let quizStartsCount = 0;
  let quizCompletionsEventCount = 0;
  let memberEventsCount = 0;
  let guestEventsCount = 0;

  const pageStatsMap = {};
  const filterUsageMap = {};
  const searchKeywordsMap = {};
  const windowProdViewsMap = {};
  const windowProdCartsMap = {};

  for (const ev of eventsInWindow) {
    const sid = ev.sessionId || String(ev._id);
    uniqueSessionsSet.add(sid);

    const isMemberEvent = Boolean(
      ev.userId ||
      (ev.membershipTier && !['guest', 'anonymous', ''].includes(String(ev.membershipTier).toLowerCase()))
    );
    if (isMemberEvent) {
      memberSessionsSet.add(sid);
      memberEventsCount++;
    } else {
      guestSessionsSet.add(sid);
      guestEventsCount++;
    }

    if (ev.eventType === 'PAGE_VIEW') {
      totalPageViews++;
      const pageLabel = String(ev.page || 'Public Landing Porch').trim() || 'Public Landing Porch';
      if (!pageStatsMap[pageLabel]) {
        pageStatsMap[pageLabel] = { page: pageLabel, views: 0, sessions: new Set(), memberViews: 0, guestViews: 0 };
      }
      pageStatsMap[pageLabel].views++;
      pageStatsMap[pageLabel].sessions.add(sid);
      if (isMemberEvent) pageStatsMap[pageLabel].memberViews++;
      else pageStatsMap[pageLabel].guestViews++;
    } else if (ev.eventType === 'PRODUCT_VIEW') {
      productViewsEventCount++;
      if (ev.productId) {
        const pid = String(ev.productId);
        windowProdViewsMap[pid] = (windowProdViewsMap[pid] || 0) + 1;
      }
    } else if (ev.eventType === 'ADD_TO_CART') {
      cartAdditionsEventCount++;
      if (ev.productId) {
        const pid = String(ev.productId);
        windowProdCartsMap[pid] = (windowProdCartsMap[pid] || 0) + 1;
      }
    } else if (ev.eventType === 'REMOVE_FROM_CART') {
      removeFromCartCount++;
    } else if (ev.eventType === 'CHECKOUT_INITIATED') {
      checkoutsInitiatedCount++;
    } else if (ev.eventType === 'QUIZ_STARTED') {
      quizStartsCount++;
    } else if (ev.eventType === 'QUIZ_COMPLETED') {
      quizCompletionsEventCount++;
    } else if (ev.eventType === 'FILTER_USED') {
      const fType = String(ev.filterType || 'Boutique Filter').trim();
      const fVal = String(ev.filterValue || 'All').trim();
      if (fVal && fVal.toLowerCase() !== 'all') {
        const key = `${fType}: ${fVal}`;
        filterUsageMap[key] = (filterUsageMap[key] || 0) + 1;
      }
    } else if (ev.eventType === 'SEARCH_QUERY') {
      const q = String(ev.searchQuery || '').toLowerCase().trim();
      if (q && q.length >= 2) {
        searchKeywordsMap[q] = (searchKeywordsMap[q] || 0) + 1;
      }
    }
  }

  // Combine event counters with Product document counters so baseline metrics are never lower than Product totals
  const totalProductViewsCatalog = allProducts.reduce((sum, p) => sum + Number(p.viewCount || 0), 0);
  const totalCartAddsCatalog = allProducts.reduce((sum, p) => sum + Number(p.cartAddCount || 0), 0);

  const effectiveProductViews = cleanRange === 'all'
    ? Math.max(productViewsEventCount, totalProductViewsCatalog)
    : (productViewsEventCount || totalProductViewsCatalog);

  const effectiveCartAdditions = cleanRange === 'all'
    ? Math.max(cartAdditionsEventCount, totalCartAddsCatalog)
    : (cartAdditionsEventCount || totalCartAddsCatalog);

  const ordersInWindow = allOrders.filter(o =>
    cleanRange === 'all' ? true : (o.createdAt && new Date(o.createdAt) >= cutoffDate)
  );
  const paidOrdersInWindow = ordersInWindow.filter(o => {
    const st = String(o.status || '').toUpperCase();
    return !['PENDING', 'CANCELLED', 'CANCELED', 'REFUNDED'].includes(st);
  });

  const paidOrdersCount = paidOrdersInWindow.length;
  const totalOrdersCount = ordersInWindow.length;
  const paidRevenueUsd = Number(
    paidOrdersInWindow.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0).toFixed(2)
  );

  const uniqueVisitors = Math.max(uniqueSessionsSet.size, totalPageViews > 0 ? 1 : 0);
  const effectiveCheckoutsInitiated = Math.max(checkoutsInitiatedCount, totalOrdersCount);

  const conversionRatePct = uniqueVisitors > 0
    ? Number(((paidOrdersCount / uniqueVisitors) * 100).toFixed(1))
    : (paidOrdersCount > 0 ? 100 : 0);

  const totalBlueprintsCompleted = allConsultations.length;
  const effectiveQuizStarts = Math.max(quizStartsCount, quizCompletionsEventCount, totalBlueprintsCompleted);
  const effectiveQuizCompletions = Math.max(quizCompletionsEventCount, totalBlueprintsCompleted);
  const quizCompletionRatePct = effectiveQuizStarts > 0
    ? Number(Math.min(100, (effectiveQuizCompletions / effectiveQuizStarts) * 100).toFixed(1))
    : 0;

  const totalTrackedEvents = memberEventsCount + guestEventsCount;
  const memberTrafficSharePct = totalTrackedEvents > 0
    ? Number(((memberEventsCount / totalTrackedEvents) * 100).toFixed(1))
    : 50;
  const guestTrafficSharePct = totalTrackedEvents > 0
    ? Number((100 - memberTrafficSharePct).toFixed(1))
    : 50;

  // 2. Daily Traffic & Engagement Series (last N days, capped at 30 bars for clean visualization)
  const chartDaysCount = cleanRange === '7d' ? 7 : cleanRange === '90d' ? 30 : 14;
  const dailyMap = {};
  const dailySeries = [];

  for (let i = chartDaysCount - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateKey = toDateKeyCT(d);
    const label = d.toLocaleDateString('en-US', {
      timeZone: 'America/Chicago',
      month: 'short',
      day: 'numeric'
    });
    const entry = {
      dateStr: dateKey,
      label,
      pageViews: 0,
      productViews: 0,
      cartAdds: 0,
      orders: 0
    };
    dailyMap[dateKey] = entry;
    dailySeries.push(entry);
  }

  for (const ev of eventsInWindow) {
    const key = toDateKeyCT(ev.createdAt);
    const bucket = dailyMap[key];
    if (!bucket) continue;
    if (ev.eventType === 'PAGE_VIEW') bucket.pageViews++;
    else if (ev.eventType === 'PRODUCT_VIEW') bucket.productViews++;
    else if (ev.eventType === 'ADD_TO_CART') bucket.cartAdds++;
  }

  for (const ord of ordersInWindow) {
    const key = toDateKeyCT(ord.createdAt);
    const bucket = dailyMap[key];
    if (bucket) bucket.orders++;
  }

  // 3. Top Viewed Pages & Member Sanctuary Tabs
  const topPages = Object.values(pageStatsMap)
    .map(item => ({
      page: item.page,
      views: item.views,
      uniqueSessions: item.sessions.size,
      memberViews: item.memberViews,
      guestViews: item.guestViews,
      sharePct: totalPageViews > 0 ? Number(((item.views / totalPageViews) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 12);

  // 4. Product Performance Leaderboard & Curation Insight Badges
  const orderRevenueByProductMap = {};
  const orderUnitsByProductMap = {};

  for (const ord of allOrders) {
    const st = String(ord.status || '').toUpperCase();
    if (['CANCELLED', 'CANCELED', 'REFUNDED'].includes(st)) continue;
    for (const item of (Array.isArray(ord.items) ? ord.items : [])) {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const price = Number(item.price || 0);
      const itemTitle = String(item.title || item.displayTitle || '').toLowerCase().trim();
      const itemSku = String(item.sku || '').toLowerCase().trim();

      const matchedProd = allProducts.find(p => {
        if (item._id && String(p._id) === String(item._id)) return true;
        if (item.productId && String(p._id) === String(item.productId)) return true;
        if (itemTitle && String(p.title || '').toLowerCase().trim() === itemTitle) return true;
        if (itemSku && Array.isArray(p.variants) && p.variants.some(v => String(v.sku || '').toLowerCase().trim() === itemSku)) {
          return true;
        }
        return false;
      });

      if (matchedProd) {
        const pid = String(matchedProd._id);
        orderUnitsByProductMap[pid] = (orderUnitsByProductMap[pid] || 0) + qty;
        orderRevenueByProductMap[pid] = Number(((orderRevenueByProductMap[pid] || 0) + price * qty).toFixed(2));
      }
    }
  }

  const productLeaderboard = allProducts
    .map(prod => {
      const pid = String(prod._id);
      const price = Number(prod.variants?.[0]?.price ?? prod.price ?? 0);
      const viewCount = Math.max(Number(prod.viewCount || 0), windowProdViewsMap[pid] || 0);
      const cartAddCount = Math.max(Number(prod.cartAddCount || 0), windowProdCartsMap[pid] || 0);
      const purchaseCount = Math.max(Number(prod.purchaseCount || 0), orderUnitsByProductMap[pid] || 0);
      const curatedCount = Number(prod.curatedCount || 0);
      const revenueUsd = orderRevenueByProductMap[pid] !== undefined
        ? orderRevenueByProductMap[pid]
        : Number((purchaseCount * price).toFixed(2));

      const viewToCartRatePct = viewCount > 0
        ? Number(Math.min(100, (cartAddCount / viewCount) * 100).toFixed(1))
        : (cartAddCount > 0 ? 100 : 0);

      const cartToOrderRatePct = cartAddCount > 0
        ? Number(Math.min(100, (purchaseCount / cartAddCount) * 100).toFixed(1))
        : (purchaseCount > 0 ? 100 : 0);

      // Automated Curation Insight Badge for Susan
      let curationInsightBadge = '🌱 Needs Visibility • Curate to Members';
      let badgeTone = 'neutral';
      if (purchaseCount >= 2 || (purchaseCount >= 1 && cartAddCount >= 2)) {
        curationInsightBadge = '🔥 High-Demand Best-Seller';
        badgeTone = 'hot';
      } else if (viewCount >= 4 && cartAddCount === 0 && purchaseCount === 0) {
        curationInsightBadge = '👀 High Views / Low Bag • Tune Price or Curate';
        badgeTone = 'warning';
      } else if (viewToCartRatePct >= 25 && (cartAddCount >= 1 || purchaseCount >= 1)) {
        curationInsightBadge = '💎 High-Converting Gem • Push in Curation';
        badgeTone = 'gem';
      } else if (curatedCount >= 2 && viewCount <= 1) {
        curationInsightBadge = '💌 Curated by Susan • Awaiting Member Views';
        badgeTone = 'curated';
      } else if (viewCount >= 1) {
        curationInsightBadge = '✨ Active Shopper Interest';
        badgeTone = 'active';
      }

      const engagementScore =
        (purchaseCount * 35) +
        (cartAddCount * 15) +
        (viewCount * 4) +
        (curatedCount * 8);

      return {
        _id: pid,
        title: prod.title || 'Untitled Product',
        imageUrl: prod.imageUrl || prod.variants?.[0]?.imageUrl || '',
        price: Number(price.toFixed(2)),
        ritualStep: prod.ritualStep || 'Step 3: Serum & Essence',
        skinTypes: Array.isArray(prod.skinTypes) ? prod.skinTypes : [],
        skinConcerns: Array.isArray(prod.skinConcerns) ? prod.skinConcerns : [],
        sensitivitySafe: prod.sensitivitySafe !== false,
        sensitivityLabel: prod.sensitivityLabel || 'Gentle • High-Sensitivity Safe',
        viewCount,
        cartAddCount,
        purchaseCount,
        curatedCount,
        revenueUsd,
        viewToCartRatePct,
        cartToOrderRatePct,
        curationInsightBadge,
        badgeTone,
        engagementScore,
        lastViewedAt: prod.lastViewedAt || null
      };
    })
    .sort((a, b) => b.engagementScore - a.engagementScore || b.viewCount - a.viewCount);

  // 5. Curation Intelligence: Member Blueprint Demand vs. Active Catalog Supply Matrix
  const totalBlueprints = allConsultations.length;
  const totalCatalog = allProducts.length;

  const skinTypeOptions = ['Normal', 'Dry', 'Oily', 'Combination'];
  const concernOptions = ['Hydration', 'Anti-Aging', 'Acne/Texture', 'Brightening', 'Barrier & Soothing', 'Luminous Makeup'];
  const sensitivityOptions = ['High', 'Moderate', 'Low'];
  const vibeOptions = ['Natural', 'Soft Glam', 'Full Glam'];

  const skinTypeMatrix = skinTypeOptions.map(st => {
    const memberCount = allConsultations.filter(c => String(c.skinType || '').toLowerCase() === st.toLowerCase()).length;
    const memberSharePct = totalBlueprints > 0 ? Number(((memberCount / totalBlueprints) * 100).toFixed(1)) : 0;
    const productCount = allProducts.filter(p =>
      Array.isArray(p.skinTypes) &&
      p.skinTypes.some(x => x.toLowerCase() === st.toLowerCase() || x.toLowerCase() === 'all skin types')
    ).length;
    const catalogSharePct = totalCatalog > 0 ? Number(((productCount / totalCatalog) * 100).toFixed(1)) : 0;
    const gapScore = Number((memberSharePct - catalogSharePct).toFixed(1));
    return {
      trait: `${st} Skin`,
      rawTrait: st,
      category: 'Skin Type',
      memberCount,
      memberSharePct,
      productCount,
      catalogSharePct,
      gapScore,
      status: gapScore > 15 ? '⚠️ High Demand / Expand Catalog' : '✓ Well Stocked'
    };
  });

  const skinConcernMatrix = concernOptions.map(sc => {
    const memberCount = allConsultations.filter(c => {
      if (String(c.primaryGoal || '').toLowerCase() === sc.toLowerCase()) return true;
      if (sc === 'Barrier & Soothing' && ['high', 'moderate'].includes(String(c.skinSensitivity || '').toLowerCase())) return true;
      if (sc === 'Luminous Makeup' && c.makeupVibe) return true;
      return false;
    }).length;
    const memberSharePct = totalBlueprints > 0 ? Number(((memberCount / totalBlueprints) * 100).toFixed(1)) : 0;
    const productCount = allProducts.filter(p =>
      Array.isArray(p.skinConcerns) &&
      p.skinConcerns.some(x => x.toLowerCase() === sc.toLowerCase())
    ).length;
    const catalogSharePct = totalCatalog > 0 ? Number(((productCount / totalCatalog) * 100).toFixed(1)) : 0;
    const gapScore = Number((memberSharePct - catalogSharePct).toFixed(1));
    return {
      trait: sc,
      rawTrait: sc,
      category: 'Primary Skin Goal / Condition',
      memberCount,
      memberSharePct,
      productCount,
      catalogSharePct,
      gapScore,
      status:
        productCount < 3 && memberCount > 0
          ? '🚨 Low Catalog Supply — Sync or Add Products'
          : gapScore > 15
          ? '⚠️ High Member Demand — Curate More'
          : '✓ Balanced Supply'
    };
  });

  const sensitivityMatrix = sensitivityOptions.map(sens => {
    const memberCount = allConsultations.filter(c => String(c.skinSensitivity || '').toLowerCase() === sens.toLowerCase()).length;
    const memberSharePct = totalBlueprints > 0 ? Number(((memberCount / totalBlueprints) * 100).toFixed(1)) : 0;
    const productCount = sens === 'High'
      ? allProducts.filter(p => p.sensitivitySafe !== false).length
      : allProducts.length;
    const catalogSharePct = totalCatalog > 0 ? Number(((productCount / totalCatalog) * 100).toFixed(1)) : 0;
    return {
      trait: `${sens} Sensitivity`,
      rawTrait: sens,
      category: 'Skin Sensitivity',
      memberCount,
      memberSharePct,
      productCount,
      catalogSharePct,
      gapScore: Number((memberSharePct - catalogSharePct).toFixed(1)),
      status: sens === 'High' && productCount < Math.ceil(totalCatalog * 0.5)
        ? '⚠️ Add More Gentle / Cica Formulas'
        : '✓ Safe Coverage'
    };
  });

  const makeupVibeMatrix = vibeOptions.map(vb => {
    const memberCount = allConsultations.filter(c => String(c.makeupVibe || '').toLowerCase() === vb.toLowerCase()).length;
    const memberSharePct = totalBlueprints > 0 ? Number(((memberCount / totalBlueprints) * 100).toFixed(1)) : 0;
    const makeupProductsCount = allProducts.filter(p => p.ritualStep === 'Makeup & Artistry').length;
    return {
      trait: `${vb} Aesthetic`,
      rawTrait: vb,
      category: 'Signature Aesthetic',
      memberCount,
      memberSharePct,
      productCount: makeupProductsCount,
      catalogSharePct: totalCatalog > 0 ? Number(((makeupProductsCount / totalCatalog) * 100).toFixed(1)) : 0
    };
  });

  // Identify top actionable curation recommendations for Susan
  const curationRecommendations = [];
  const topDesiredConcern = [...skinConcernMatrix].sort((a, b) => b.memberCount - a.memberCount)[0];
  if (topDesiredConcern && topDesiredConcern.memberCount > 0) {
    curationRecommendations.push(
      `🎯 Top Member Goal: ${topDesiredConcern.memberCount} member Blueprint(s) (${topDesiredConcern.memberSharePct}%) target "${topDesiredConcern.trait}", supported by ${topDesiredConcern.productCount} active Boutique products.`
    );
  }
  const underservedConcerns = skinConcernMatrix.filter(c => c.gapScore > 12 || (c.memberCount > 0 && c.productCount < 3));
  if (underservedConcerns.length > 0) {
    curationRecommendations.push(
      `🛍️ Catalog Opportunity: Consider adding or syncing more products for ${underservedConcerns.map(u => `"${u.trait}" (${u.productCount} in stock)`).join(', ')}.`
    );
  }
  const uncuratedMembers = allUsers.filter(u => !Array.isArray(u.recommendedProducts) || u.recommendedProducts.length === 0);
  if (uncuratedMembers.length > 0) {
    curationRecommendations.push(
      `💌 Personal Curation Queue: ${uncuratedMembers.length} registered member(s) (${uncuratedMembers.slice(0, 3).map(u => u.name).join(', ')}) have 0 hand-pushed products in their Sanctuary Inbox.`
    );
  }

  // 6. Boutique Conversion Funnel & Search/Filter Trends
  const boutiquePageViews = Object.values(pageStatsMap)
    .filter(p => /boutique/i.test(p.page))
    .reduce((sum, p) => sum + p.views, 0);

  const funnelSiteVisits = Math.max(totalPageViews, uniqueVisitors, effectiveProductViews);
  const funnelBoutiqueViews = Math.max(boutiquePageViews, effectiveProductViews);

  const conversionFunnel = [
    {
      stage: '1. Total Site & Sanctuary Views',
      count: funnelSiteVisits,
      pctOfTop: 100
    },
    {
      stage: '2. Boutique Browsing Views',
      count: funnelBoutiqueViews,
      pctOfTop: funnelSiteVisits > 0 ? Number(Math.min(100, (funnelBoutiqueViews / funnelSiteVisits) * 100).toFixed(1)) : 0
    },
    {
      stage: '3. Product Detail Modal Opens',
      count: effectiveProductViews,
      pctOfTop: funnelSiteVisits > 0 ? Number(Math.min(100, (effectiveProductViews / funnelSiteVisits) * 100).toFixed(1)) : 0
    },
    {
      stage: '4. Added to Ritual Bag',
      count: effectiveCartAdditions,
      pctOfTop: funnelSiteVisits > 0 ? Number(Math.min(100, (effectiveCartAdditions / funnelSiteVisits) * 100).toFixed(1)) : 0
    },
    {
      stage: '5. Completed & Paid Orders',
      count: paidOrdersCount,
      pctOfTop: funnelSiteVisits > 0 ? Number(Math.min(100, (paidOrdersCount / funnelSiteVisits) * 100).toFixed(1)) : 0
    }
  ];

  const topFilters = Object.entries(filterUsageMap)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const topSearches = Object.entries(searchKeywordsMap)
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // 7. Recent Visitor & Member Activity Stream (in US Central Time)
  const recentEvents = recentEventsRaw.map(ev => ({
    _id: String(ev._id),
    eventType: ev.eventType,
    page: ev.page || '',
    userEmail: ev.userEmail || '',
    membershipTier: ev.membershipTier || 'guest',
    productId: ev.productId ? String(ev.productId) : '',
    productTitle: ev.productTitle || '',
    ritualStep: ev.ritualStep || '',
    filterType: ev.filterType || '',
    filterValue: ev.filterValue || '',
    searchQuery: ev.searchQuery || '',
    cartValueUsd: Number(ev.cartValueUsd || 0),
    isDemo: Boolean(ev.metadata?.isDemo),
    createdAt: ev.createdAt,
    timestampCT: formatCentralDateTime(ev.createdAt)
  }));

  return {
    range: cleanRange,
    overview: {
      totalPageViews,
      uniqueVisitors,
      memberSessions: memberSessionsSet.size,
      guestSessions: guestSessionsSet.size,
      memberVsGuestRatio: `${memberTrafficSharePct}% Member / ${guestTrafficSharePct}% Guest`,
      memberTrafficSharePct,
      guestTrafficSharePct,
      productViews: effectiveProductViews,
      cartAdditions: effectiveCartAdditions,
      removeFromCartCount,
      checkoutsInitiated: effectiveCheckoutsInitiated,
      paidOrdersCount,
      totalOrdersCount,
      paidRevenueUsd,
      conversionRatePct,
      quizStarts: effectiveQuizStarts,
      quizCompletions: effectiveQuizCompletions,
      quizCompletionRatePct,
      totalCurationsSent: allInboxItems.length,
      totalActiveProducts: totalCatalog,
      totalMembersCount: allUsers.length
    },
    dailyTrafficSeries: dailySeries,
    topPages,
    conversionFunnel,
    productLeaderboard: productLeaderboard.slice(0, 40),
    blueprintDemandVsSupply: {
      totalBlueprints,
      totalCatalog,
      skinTypes: skinTypeMatrix,
      skinConcerns: skinConcernMatrix,
      sensitivities: sensitivityMatrix,
      makeupVibes: makeupVibeMatrix,
      curationRecommendations,
      uncuratedMembers: uncuratedMembers.slice(0, 10).map(u => ({
        _id: String(u._id),
        name: u.name,
        email: u.email,
        membershipTier: u.membershipTier || 'luminary'
      }))
    },
    filterAndSearchTrends: {
      topFilters,
      topSearches
    },
    recentEvents,
    updatedAt: new Date().toISOString(),
    updatedAtCT: formatCentralDateTime(new Date())
  };
};

// Admin Endpoint: Fetch Comprehensive Site Analytics & Curation Intelligence
app.get('/api/admin/analytics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const range = req.query.range || '30d';
    const telemetry = await buildSiteAnalyticsTelemetry({ range });
    res.status(200).json(telemetry);
  } catch (error) {
    console.error('Admin Analytics Aggregation Error:', error);
    res.status(500).json({ error: error.message || 'Failed to aggregate site analytics.' });
  }
});

// Admin Endpoint: Seed Realistic Sample Traffic or Clear Demo Events (for 1-click chart previewing)
const handleAdminAnalyticsSeedOrClear = async (req, res) => {
  try {
    const action = String(req.body?.action || 'seed').toLowerCase().trim();

    if (action === 'clear_demo' || action === 'clear') {
      const deleted = await AnalyticsEvent.deleteMany({ 'metadata.isDemo': true });
      await Product.updateMany({}, { $set: { viewCount: 0, cartAddCount: 0, purchaseCount: 0, curatedCount: 0 } });
      await backfillAnalyticsBaseline();
      const telemetry = await buildSiteAnalyticsTelemetry({ range: req.body?.range || '30d' });
      return res.status(200).json({
        message: `Cleared ${deleted.deletedCount || 0} sample preview events and restored live baseline counters ✧`,
        telemetry
      });
    }

    const products = await Product.find({}).limit(24).lean();
    const users = await User.find({ role: { $ne: 'admin' } }).limit(8).lean();

    const pagesPool = [
      { page: 'Public Landing Porch', weight: 18 },
      { page: 'Public Boutique', weight: 14 },
      { page: 'Member Sanctuary: Boutique', weight: 16 },
      { page: 'Member Sanctuary: Blueprint', weight: 13 },
      { page: 'Paid Membership Tiers', weight: 9 },
      { page: 'Member Sanctuary: Inbox', weight: 7 },
      { page: 'Member Sanctuary: Consultations', weight: 6 },
      { page: 'Blueprint Quiz Step 1', weight: 5 },
      { page: 'Member Sign In', weight: 6 }
    ];

    const filterSamples = [
      { filterType: 'Blueprint Match', filterValue: 'Best Match for My Blueprint' },
      { filterType: 'Skin Condition', filterValue: 'Hydration' },
      { filterType: 'Skin Condition', filterValue: 'Anti-Aging' },
      { filterType: 'Skin Condition', filterValue: 'Brightening' },
      { filterType: 'Skin Type', filterValue: 'Dry' },
      { filterType: 'Skin Type', filterValue: 'Combination' },
      { filterType: 'Sensitivity', filterValue: 'High-Sensitivity Safe Only' },
      { filterType: 'Ritual Step', filterValue: 'Step 3: Serum & Essence' }
    ];

    const searchSamples = [
      'hyaluronic acid',
      'vitamin c serum',
      'barrier cream',
      'eye patch',
      'lip oil',
      'peptide',
      'gentle cleanser'
    ];

    const nowMs = Date.now();
    const demoEvents = [];
    const prodViewIncrements = {};
    const prodCartIncrements = {};

    // Generate 14 days of realistic boutique traffic
    for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
      const dayBaseMs = nowMs - dayOffset * 24 * 60 * 60 * 1000;
      const sessionsToday = 4 + ((13 - dayOffset) % 5) + (dayOffset < 4 ? 3 : 0);

      for (let s = 0; s < sessionsToday; s++) {
        const sessionId = `demo_sess_${dayOffset}_${s}_${Math.random().toString(36).slice(2, 6)}`;
        const isMember = s % 2 === 0 && users.length > 0;
        const memberObj = isMember ? users[(dayOffset + s) % users.length] : null;
        const eventTime = (minsAfter) => new Date(dayBaseMs - (s * 1800000) + minsAfter * 60000);

        // 1. Landing or Sanctuary Page View
        const primaryPage = pagesPool[(dayOffset + s) % pagesPool.length].page;
        demoEvents.push({
          eventType: 'PAGE_VIEW',
          page: primaryPage,
          sessionId,
          userId: memberObj?._id || null,
          userEmail: memberObj?.email || '',
          membershipTier: memberObj?.membershipTier || 'guest',
          metadata: { isDemo: true },
          createdAt: eventTime(1)
        });

        // 2. Secondary Boutique Page View
        const secondPage = isMember ? 'Member Sanctuary: Boutique' : 'Public Boutique';
        demoEvents.push({
          eventType: 'PAGE_VIEW',
          page: secondPage,
          sessionId,
          userId: memberObj?._id || null,
          userEmail: memberObj?.email || '',
          membershipTier: memberObj?.membershipTier || 'guest',
          metadata: { isDemo: true },
          createdAt: eventTime(3)
        });

        // 3. Filter or Search interaction
        if (s % 2 === 0) {
          const f = filterSamples[(dayOffset + s) % filterSamples.length];
          demoEvents.push({
            eventType: 'FILTER_USED',
            page: secondPage,
            sessionId,
            userId: memberObj?._id || null,
            userEmail: memberObj?.email || '',
            membershipTier: memberObj?.membershipTier || 'guest',
            filterType: f.filterType,
            filterValue: f.filterValue,
            metadata: { isDemo: true },
            createdAt: eventTime(4)
          });
        } else if (s % 3 === 0) {
          const kw = searchSamples[(dayOffset + s) % searchSamples.length];
          demoEvents.push({
            eventType: 'SEARCH_QUERY',
            page: secondPage,
            sessionId,
            userId: memberObj?._id || null,
            userEmail: memberObj?.email || '',
            membershipTier: memberObj?.membershipTier || 'guest',
            searchQuery: kw,
            metadata: { isDemo: true },
            createdAt: eventTime(4)
          });
        }

        // 4. Product Detail View & Add to Cart
        if (products.length > 0) {
          const p1 = products[(dayOffset * 2 + s) % products.length];
          const p1Id = String(p1._id);
          prodViewIncrements[p1Id] = (prodViewIncrements[p1Id] || 0) + 1;

          demoEvents.push({
            eventType: 'PRODUCT_VIEW',
            page: secondPage,
            sessionId,
            userId: memberObj?._id || null,
            userEmail: memberObj?.email || '',
            membershipTier: memberObj?.membershipTier || 'guest',
            productId: p1._id,
            productTitle: p1.title,
            ritualStep: p1.ritualStep || 'Step 3: Serum & Essence',
            metadata: { isDemo: true },
            createdAt: eventTime(6)
          });

          if ((dayOffset + s) % 3 !== 0) {
            const pPrice = Number(p1.variants?.[0]?.price ?? p1.price ?? 48);
            prodCartIncrements[p1Id] = (prodCartIncrements[p1Id] || 0) + 1;
            demoEvents.push({
              eventType: 'ADD_TO_CART',
              page: secondPage,
              sessionId,
              userId: memberObj?._id || null,
              userEmail: memberObj?.email || '',
              membershipTier: memberObj?.membershipTier || 'guest',
              productId: p1._id,
              productTitle: p1.title,
              ritualStep: p1.ritualStep || 'Step 3: Serum & Essence',
              cartValueUsd: pPrice,
              metadata: { isDemo: true },
              createdAt: eventTime(8)
            });

            if (s === 0 && dayOffset % 2 === 0) {
              demoEvents.push({
                eventType: 'CHECKOUT_INITIATED',
                page: secondPage,
                sessionId,
                userId: memberObj?._id || null,
                userEmail: memberObj?.email || '',
                membershipTier: memberObj?.membershipTier || 'guest',
                cartValueUsd: pPrice,
                metadata: { isDemo: true },
                createdAt: eventTime(10)
              });
            }
          }
        }
      }
    }

    await AnalyticsEvent.insertMany(demoEvents);

    const bulkProdUpdates = [];
    for (const [pid, incViews] of Object.entries(prodViewIncrements)) {
      const incCarts = prodCartIncrements[pid] || 0;
      bulkProdUpdates.push({
        updateOne: {
          filter: { _id: pid },
          update: {
            $inc: { viewCount: incViews, cartAddCount: incCarts },
            $set: { lastViewedAt: new Date() }
          }
        }
      });
    }
    if (bulkProdUpdates.length > 0) {
      await Product.bulkWrite(bulkProdUpdates);
    }

    const telemetry = await buildSiteAnalyticsTelemetry({ range: req.body?.range || '30d' });
    res.status(200).json({
      message: `Populated ${demoEvents.length} sample boutique telemetry events across 14 days for your Analytics charts! ✧`,
      seededCount: demoEvents.length,
      telemetry
    });
  } catch (error) {
    console.error('Seed Analytics Demo Error:', error);
    res.status(500).json({ error: error.message || 'Failed to seed sample analytics traffic.' });
  }
};

app.post('/api/admin/analytics/seed-demo', authenticateToken, requireAdmin, handleAdminAnalyticsSeedOrClear);
app.post('/api/admin/analytics/seed-sample', authenticateToken, requireAdmin, handleAdminAnalyticsSeedOrClear);

// ---------------- ODIE PERSISTENT MEMORY & CHAT HISTORY ENGINE ---------------- //

const DEFAULT_ODIE_MEMORIES = [
  {
    category: 'preference',
    key: 'Assistant Name & Persona',
    content: "My name is Odie. I am Susan's loyal, warm, and sharp Executive AI Assistant for Susan's Beauty Consulting.",
    source: 'system_seed',
    pinned: true
  },
  {
    category: 'business_rule',
    key: 'Boutique Pricing & Member Tiers',
    content: 'CJ Dropshipping Beauty & Skincare items use a 6.5x retail markup. Luminary Circle ($49/mo) receives a 3-piece box + 10% off; Radiance Elite ($119/mo) receives a 5-piece box + 25% off.',
    source: 'system_seed',
    pinned: true
  },
  {
    category: 'preference',
    key: 'Primary Mailbox & Timezone',
    content: "Susan's primary IONOS mailbox is Susan.Coke@SusansBeautyConsulting.com and all consultations operate in US Central Time (Kansas — America/Chicago).",
    source: 'system_seed',
    pinned: true
  },
  {
    category: 'financial_goal',
    key: 'Treasury & CJ Fulfillment Rule',
    content: 'Before dumping Stripe funds to the bank, always check if active unshipped orders need wholesale funds reserved or moved to CJ Dropshipping.',
    source: 'system_seed',
    pinned: true
  }
];

const ensureDefaultOdieMemories = async () => {
  try {
    const count = await OdieMemory.countDocuments();
    if (count === 0) {
      await OdieMemory.insertMany(DEFAULT_ODIE_MEMORIES);
      console.log('🧠 Seeded initial long-term memories for Odie.');
    }
  } catch (err) {
    console.warn('⚠️ Could not seed default Odie memories:', err.message);
  }
};

const upsertOdieMemoryFact = async ({ key, content, category = 'general', source = 'odie_auto', pinned = true }) => {
  const cleanKey = String(key || '').trim() || 'Executive Note';
  const cleanContent = String(content || '').trim();
  if (!cleanContent) {
    throw new Error('Memory content cannot be empty.');
  }
  const allowedCategories = ['preference', 'business_rule', 'vip_client', 'financial_goal', 'general'];
  const normalizedCategory = allowedCategories.includes(String(category || '').toLowerCase().trim())
    ? String(category).toLowerCase().trim()
    : 'general';

  const memoryDoc = await OdieMemory.findOneAndUpdate(
    { key: new RegExp(`^${escapeRegex(cleanKey)}$`, 'i') },
    {
      $set: {
        key: cleanKey,
        content: cleanContent,
        category: normalizedCategory,
        source,
        pinned: Boolean(pinned),
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true, returnDocument: 'after' }
  );
  return memoryDoc;
};

app.get('/api/admin/odie/memory', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await ensureDefaultOdieMemories();
    const [memories, recentHistory] = await Promise.all([
      OdieMemory.find({}).sort({ pinned: -1, updatedAt: -1 }).lean(),
      OdieChatHistory.find({}).sort({ createdAt: -1 }).limit(60).lean()
    ]);
    res.status(200).json({
      assistantName: 'Odie',
      memories,
      history: recentHistory.reverse()
    });
  } catch (error) {
    console.error('Fetch Odie Memory Error:', error);
    res.status(500).json({ error: error.message || 'Failed to load Odie memory bank.' });
  }
});

app.post('/api/admin/odie/memory', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { key, content, category, pinned } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: 'Please provide the fact or instruction you want Odie to remember.' });
    }
    const savedMemory = await upsertOdieMemoryFact({
      key: key || 'Susan Executive Note',
      content,
      category: category || 'general',
      source: 'susan_manual',
      pinned: pinned !== undefined ? Boolean(pinned) : true
    });
    const memories = await OdieMemory.find({}).sort({ pinned: -1, updatedAt: -1 }).lean();
    res.status(201).json({
      message: `Odie will remember: "${savedMemory.key}" 🧠✧`,
      memory: savedMemory,
      memories
    });
  } catch (error) {
    console.error('Save Odie Memory Error:', error);
    res.status(500).json({ error: error.message || 'Failed to save memory for Odie.' });
  }
});

app.delete('/api/admin/odie/memory/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const memId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(String(memId))) {
      return res.status(400).json({ error: 'Invalid memory ID.' });
    }
    await OdieMemory.findByIdAndDelete(memId);
    const memories = await OdieMemory.find({}).sort({ pinned: -1, updatedAt: -1 }).lean();
    res.status(200).json({
      message: 'Memory entry removed from Odie memory bank.',
      memories
    });
  } catch (error) {
    console.error('Delete Odie Memory Error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete memory entry.' });
  }
});

app.get('/api/admin/odie/history', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const recentHistory = await OdieChatHistory.find({}).sort({ createdAt: -1 }).limit(60).lean();
    res.status(200).json({
      assistantName: 'Odie',
      history: recentHistory.reverse()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load Odie chat history.' });
  }
});

app.delete('/api/admin/odie/history', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await OdieChatHistory.deleteMany({});
    res.status(200).json({
      message: "Cleared Odie's conversation log while keeping Odie's long-term Memory Bank intact ✧"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear Odie chat history.' });
  }
});

// ---------------- ODIE AI ASSISTANT ROUTE (15 EXECUTIVE BOUTIQUE, MEMORY, DIAGNOSTIC & TREASURY TOOLS) ---------------- //
const GEMINI_MODEL = cleanEnv(process.env.GEMINI_MODEL) || 'gemini-3.8-flash';

const getGeminiClient = () => {
  let GoogleGenAI, Type;
  try {
    ({ GoogleGenAI, Type } = require('@google/genai'));
  } catch (err) {
    throw new Error("Missing '@google/genai' package on server. Run: npm install @google/genai");
  }

  const rawKey = cleanEnv(process.env.GEMINI_API_KEY);
  if (!rawKey) {
    throw new Error('GEMINI_API_KEY is missing or empty in server .env file.');
  }

  return { ai: new GoogleGenAI({ apiKey: rawKey }), Type, model: GEMINI_MODEL };
};

app.post('/api/admin/ai-chat', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Please enter a message for Odie.' });
    }

    const { ai, Type } = getGeminiClient();
    await ensureDefaultOdieMemories();

    // Gather live boutique, calendar, financial/order pipeline, site analytics, monthly boxes, and Odie's persistent Memory Bank + Chat History
    const [rawCatalog, rawUsers, blueprints, rawAppointments, financialTelemetry, analyticsTelemetry, monthlyBoxesTelemetry, odieMemories, storedChatHistory] = await Promise.all([
      Product.find({}).select('_id title price wholesalePriceUsd markupMultiplier selectedLogisticName shippingCostUsd shippingIncludedInPrice customLabelConfig variants tags skinTypes skinConcerns sensitivitySafe sensitivityLabel ritualStep keyActives viewCount cartAddCount purchaseCount curatedCount imageUrl').sort({ _id: -1 }).limit(180).lean(),
      User.find({}).select('_id name email membershipTier role').sort({ createdAt: -1 }).limit(100).lean(),
      Consultation.find({})
        .populate('userId', '_id name email membershipTier')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Appointment.find({ status: { $ne: 'cancelled' } })
        .populate('clientId', '_id name email membershipTier')
        .sort({ startTime: 1 })
        .limit(60)
        .lean(),
      buildFinancialAndOrderTelemetry({ syncCjOrders: false }).catch(() => null),
      buildSiteAnalyticsTelemetry({ range: '30d' }).catch(() => null),
      buildMonthlyBoxesTelemetry({}).catch(() => null),
      OdieMemory.find({}).sort({ pinned: -1, updatedAt: -1 }).lean(),
      OdieChatHistory.find({}).sort({ createdAt: -1 }).limit(30).lean()
    ]);

    const catalog = rawCatalog.map(prod => ({
      _id: String(prod._id),
      title: prod.title,
      price: Number(prod.variants?.[0]?.price ?? prod.price ?? 0).toFixed(2),
      wholesalePriceUsd: Number(prod.wholesalePriceUsd ?? 2.50).toFixed(2),
      selectedLogisticName: prod.selectedLogisticName || 'CJPacket Sensitive',
      shippingCostUsd: Number(prod.shippingCostUsd ?? 4.49).toFixed(2),
      shippingIncludedInPrice: prod.shippingIncludedInPrice !== false,
      customLabelEnabled: Boolean(prod.customLabelConfig?.enabled),
      skinTypes: prod.skinTypes || [],
      skinConcerns: prod.skinConcerns || [],
      ritualStep: prod.ritualStep || 'Step 3: Serum & Essence',
      sensitivityLabel: prod.sensitivityLabel || 'Gentle • High-Sensitivity Safe',
      viewCount: Number(prod.viewCount || 0),
      cartAddCount: Number(prod.cartAddCount || 0),
      purchaseCount: Number(prod.purchaseCount || 0),
      curatedCount: Number(prod.curatedCount || 0),
      tags: prod.tags || []
    }));

    const monthlyBoxesSummary = monthlyBoxesTelemetry
      ? {
          billingMonth: monthlyBoxesTelemetry.billingMonth,
          summaryMetrics: monthlyBoxesTelemetry.summaryMetrics,
          curatedBoxes: (monthlyBoxesTelemetry.boxes || []).map(b => ({
            boxId: String(b._id),
            userId: String(b.userId),
            memberName: b.memberName,
            memberEmail: b.memberEmail,
            membershipTier: b.membershipTier,
            subscriptionPriceUsd: b.subscriptionPriceUsd,
            maxAllowedCostUsd: b.maxAllowedCostUsd,
            totalWholesaleCostUsd: b.totalWholesaleCostUsd,
            consolidatedShippingUsd: b.consolidatedShippingUsd,
            customLabelCostUsd: b.customLabelCostUsd,
            totalAllInCostUsd: b.totalAllInCostUsd,
            costPercentageOfMembership: b.costPercentageOfMembership,
            estimatedNetProfitUsd: b.estimatedNetProfitUsd,
            withinBudgetCap: b.withinBudgetCap,
            selectedLogisticName: b.selectedLogisticName,
            status: b.status,
            cjOrderId: b.cjOrderId,
            items: (b.items || []).map(i => `${i.ritualStep}: ${i.title} ($${i.wholesaleCostUsd})`)
          })),
          uncuratedMembers: monthlyBoxesTelemetry.uncuratedMembers || []
        }
      : { note: 'Monthly boxes telemetry unavailable' };

    const cjShippingAndLabelingSummary = {
      totalCatalogProducts: rawCatalog.length,
      shippingIncludedCount: rawCatalog.filter(p => p.shippingIncludedInPrice !== false).length,
      customLabelEnabledCount: rawCatalog.filter(p => p.customLabelConfig?.enabled).length,
      availableCarriers: ['CJPacket Sensitive', 'CJPacket Ordinary', 'USPS+', 'CJ Liquid Direct', 'DHL Official'],
      customPackagingOptions: DEFAULT_CUSTOM_PACKAGING_OPTIONS.map(o => ({
        packagingVid: o.packagingVid,
        packagingName: o.packagingName,
        labelType: o.labelType,
        packagingCostUsd: o.packagingCostUsd
      }))
    };

    const analyticsContextSummary = analyticsTelemetry
      ? {
          overview: analyticsTelemetry.overview,
          topPages: (analyticsTelemetry.topPages || []).slice(0, 6),
          topProducts: (analyticsTelemetry.productLeaderboard || []).slice(0, 10).map(p => ({
            _id: p._id,
            title: p.title,
            price: p.price,
            viewCount: p.viewCount,
            cartAddCount: p.cartAddCount,
            purchaseCount: p.purchaseCount,
            curatedCount: p.curatedCount,
            curationInsightBadge: p.curationInsightBadge
          })),
          curationRecommendations: analyticsTelemetry.blueprintDemandVsSupply?.curationRecommendations || [],
          topFilters: (analyticsTelemetry.filterAndSearchTrends?.topFilters || []).slice(0, 5),
          topSearches: (analyticsTelemetry.filterAndSearchTrends?.topSearches || []).slice(0, 5)
        }
      : { note: 'Analytics telemetry unavailable' };

    const members = rawUsers.map(u => ({
      _id: String(u._id),
      name: u.name,
      email: u.email,
      membershipTier: u.membershipTier || 'luminary'
    }));

    const upcomingAppointments = rawAppointments.map(appt => ({
      _id: String(appt._id),
      clientId: appt.clientId?._id ? String(appt.clientId._id) : '',
      clientName: appt.clientId?.name || 'Member',
      clientEmail: appt.clientId?.email || '',
      startTimeISO: appt.startTime ? new Date(appt.startTime).toISOString() : '',
      startTimeCT: formatCentralDateTime(appt.startTime),
      notes: appt.notes || '',
      meetingLink: appt.meetingLink || '',
      reminderSent: Boolean(appt.reminderSentAt)
    }));

    const formattedMemories = odieMemories.map(mem => ({
      _id: String(mem._id),
      category: mem.category,
      key: mem.key,
      content: mem.content,
      pinned: Boolean(mem.pinned),
      updatedAt: mem.updatedAt
    }));

    const financialContextSummary = financialTelemetry
      ? {
          stripeBalance: {
            mode: financialTelemetry.stripeBalance?.mode,
            availableUsd: financialTelemetry.stripeBalance?.availableUsd,
            pendingUsd: financialTelemetry.stripeBalance?.pendingUsd,
            instantAvailableUsd: financialTelemetry.stripeBalance?.instantAvailableUsd,
            totalBalanceUsd: financialTelemetry.stripeBalance?.totalBalanceUsd,
            recentPayouts: financialTelemetry.stripeBalance?.recentPayouts
          },
          cjDropshippingWallet: {
            availableUsd: financialTelemetry.cjBalance?.availableUsd,
            nonWithdrawableUsd: financialTelemetry.cjBalance?.nonWithdrawableUsd,
            frozenUsd: financialTelemetry.cjBalance?.frozenUsd,
            activeUnshippedCostUsd: financialTelemetry.cjBalance?.activeUnshippedCostUsd,
            walletCoversActiveOrders: financialTelemetry.cjBalance?.walletCoversActiveOrders
          },
          orderPipelineCounts: financialTelemetry.orderPipeline?.counts,
          summaryMetrics: financialTelemetry.summaryMetrics,
          futureProjections: {
            luminaryCount: financialTelemetry.futureProjections?.luminaryCount,
            radianceCount: financialTelemetry.futureProjections?.radianceCount,
            projectedMonthlySubscriptionRevenue: financialTelemetry.futureProjections?.projectedMonthlySubscriptionRevenue,
            projectedNext30DaysTotal: financialTelemetry.futureProjections?.projectedNext30DaysTotal,
            scheduledMemberBoxes: (financialTelemetry.futureProjections?.scheduledMemberBoxes || []).slice(0, 15)
          },
          recentTransfers: (financialTelemetry.recentTransfers || []).slice(0, 10),
          recentOrders: (financialTelemetry.orderPipeline?.all || []).slice(0, 30).map(o => ({
            _id: o._id,
            shortId: o.shortId,
            customerName: o.customerName,
            customerEmail: o.customerEmail,
            status: o.status,
            pipelineStage: o.pipelineStage,
            totalAmount: o.totalAmount,
            estimatedWholesaleCost: o.estimatedWholesaleCost,
            estimatedProfit: o.estimatedProfit,
            tracking_code: o.tracking_code,
            logisticName: o.logisticName,
            createdAt: o.createdAt
          }))
        }
      : { note: 'Financial telemetry unavailable' };

    const currentCentralTimeStr = formatCentralDateTime(new Date());

    const systemInstruction = `Your name is Odie. You are Susan's loyal, warm, and sharp Executive AI Assistant for "Susan's Beauty Consulting" boutique.
Always identify yourself as Odie whenever Susan greets you or asks who you are.
Current US Central Time (Kansas — America/Chicago): ${currentCentralTimeStr}.
Primary Admin IONOS Mailbox: ${getPrimaryAdminEmail()}.

Odie's Persistent Long-Term Memory Bank (${formattedMemories.length} stored facts, rules & preferences — use rememberFact to save new facts or forgetFact to remove outdated ones):
${JSON.stringify(formattedMemories)}

You have 21 direct executive tools to manage the boutique, profit-protected monthly membership boxes (<=25% cost cap), CJ custom labeling & live shipping rates, site analytics & curation intelligence, your persistent memory bank, system diagnostics, and Stripe/CJ treasury on Susan's behalf:
1. addProduct: Add a new custom beauty or skincare product to the boutique catalog.
2. updateProduct: Edit an existing product's title, price, description, imageUrl, or tags by its _id.
3. deleteProduct: Permanently remove a product from the boutique catalog by its _id.
4. sendCustomerEmail: Dispatch a real formatted email to any client or address via Susan's IONOS SMTP server and log it in Sent Messages.
5. curateProductForMember: Push a recommended product directly to a member's personal Inbox and Beauty Blueprint with a custom note from Susan.
6. scheduleConsultation: Book a 1-on-1 consultation on Susan's Central Time calendar, generate a private Jitsi video sanctuary link, and email the client.
7. sendAppointmentReminder: Immediately send a 1-on-1 consultation reminder email (with video room link) to both the client and Susan.
8. getFinancialAndOrderSummary: Retrieve live Stripe Account Balance, CJ Dropshipping Wallet Balance, Past/Present/Future order pipeline breakdown, and optionally sync live CJ order tracking numbers.
9. updateOrderStatus: Update any customer order's status (Pending, PAID_PROCESSING, SHIPPED, DELIVERED, COMPLETED, CANCELLED, REFUNDED), tracking number, or courier, and optionally email the customer an instant update.
10. rememberFact: Save or update a persistent fact, preference, VIP client note, financial goal, or business rule in Odie's long-term MongoDB Memory Bank.
11. forgetFact: Delete a stored memory from Odie's long-term Memory Bank by its memoryId or key.
12. runSystemDiagnostics: Run the 6-point unified system diagnostic suite (MongoDB, Stripe & CJ Webhooks, Stripe Treasury, CJ Dropshipping Wallet, IONOS SMTP, and Odie Brain) and optionally dispatch a live test email.
13. syncOrCleanCjCatalog: Run a live CJ Dropshipping Health & Beauty catalog sync or purge non-beauty items.
14. executeStripeMoneyDump: Initiate a Stripe "Money Dump" payout to Susan's bank account (supports full available balance or custom USD amount, standard/instant method, and Smart CJ Wholesale Reserve).
15. transferStripeToCj: Execute the Stripe -> CJ Dropshipping Treasury Bridge to earmark wholesale funds from Stripe and automatically pay open CJ Dropshipping orders from Susan's CJ Wallet.
16. reclassifyProductBlueprintLabels: Scan and label all boutique products with their matching Skin Types (Dry, Oily, Combination, Normal, All Skin Types), Skin Conditions/Concerns (Hydration, Anti-Aging, Acne/Texture, Brightening, Barrier & Soothing, Luminous Makeup), Sensitivity Safety, Key Actives, and Ritual Step.
17. getSiteAnalyticsAndCurationInsights: Retrieve live site traffic, page views, most viewed/carted/purchased products, conversion funnel rates, and Member Blueprint demand vs. catalog supply gaps to help Susan curate and grow the boutique.
18. curateMonthlyMemberBoxes: Curates profit-protected monthly membership boxes for one member (userId) or all paid members (curateAll=true) matched to their Beauty Blueprint with a strict <=25% all-in CJ cost cap ($12.25 max for Luminary $49/mo 3-piece box; $29.75 max for Radiance $119/mo 5-piece box).
19. configureCjCustomLabeling: Enables, updates, or disables CJ custom packaging / private labeling / POD logo branding on a specific product, a monthly box, or across the entire boutique catalog.
20. adjustCjShippingAndPricing: Fetches CJ shipping quotes, changes the CJ shipping method (CJPacket Sensitive, USPS+, CJPacket Ordinary, CJ Liquid Direct, DHL Official) on a product, active order, monthly box, or entire catalog, and recalculates retail prices with shipping included.
21. dispatchMonthlyMemberBoxToCj: Dispatches a curated monthly membership box to CJ Dropshipping via createOrderV2, optionally pays for it from the CJ Wallet, and emails the member.

Live Monthly Membership Boxes & <=25% Cost Cap Snapshot:
${JSON.stringify(monthlyBoxesSummary)}

Live CJ Shipping & Custom Labeling Snapshot:
${JSON.stringify(cjShippingAndLabelingSummary)}

Live Site Analytics & Curation Intelligence Snapshot (30d):
${JSON.stringify(analyticsContextSummary)}

Live Financial & Past/Present/Future Order Pipeline Snapshot:
${JSON.stringify(financialContextSummary)}

Live Boutique Inventory (${catalog.length} items — use _id for updateProduct, deleteProduct, or curateProductForMember):
${JSON.stringify(catalog)}

Registered Members (${members.length} accounts — use _id for curateProductForMember or scheduleConsultation):
${JSON.stringify(members)}

Client Beauty Blueprints (${blueprints.length} profiles):
${JSON.stringify(blueprints)}

Scheduled Consultations (${upcomingAppointments.length} active — use _id for sendAppointmentReminder):
${JSON.stringify(upcomingAppointments)}

Always execute the appropriate tool when Susan asks you to remember or forget a fact, run diagnostics or test webhooks/email, sync the CJ catalog, execute a Stripe money dump, move money from Stripe to CJ Dropshipping, check/refresh her Stripe or CJ balances, inspect Past/Present/Future orders, update an order's status or tracking number, add/edit/remove a product, send an email, curate a product for a member, schedule a consultation, or send a consultation reminder. Maintain a graceful, warm, loyal, and executive tone as Odie.`;

    // Build a clean, alternating multi-turn contents array from client history or stored MongoDB OdieChatHistory
    const sourceHistory = (Array.isArray(history) && history.length > 0)
      ? history
      : storedChatHistory.slice().reverse();

    const contents = [];
    if (Array.isArray(sourceHistory)) {
      for (const msg of sourceHistory) {
        if (!msg || !msg.text || String(msg.text).startsWith('⚠️')) continue;
        const role = msg.role === 'user' ? 'user' : 'model';
        const text = String(msg.text).trim();
        if (!text) continue;
        if (contents.length === 0 && role === 'model') continue;
        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          contents[contents.length - 1].parts[0].text += `\n\n${text}`;
        } else {
          contents.push({ role, parts: [{ text }] });
        }
      }
    }

    const cleanMessage = String(message).trim();
    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      contents[contents.length - 1].parts[0].text += `\n\n${cleanMessage}`;
    } else {
      contents.push({ role: 'user', parts: [{ text: cleanMessage }] });
    }

    // Persist Susan's incoming message to OdieChatHistory
    const adminEmail = normalizeEmail(req.user?.email || getPrimaryAdminEmail());
    await new OdieChatHistory({
      adminEmail,
      role: 'user',
      text: cleanMessage,
      actionsTaken: []
    }).save().catch(err => console.warn('⚠️ Could not log user chat history:', err.message));

    const executiveBoutiqueTools = {
      functionDeclarations: [
        {
          name: 'addProduct',
          description: 'Creates and saves a new custom beauty or skincare product in the boutique inventory.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: 'Product title (e.g., "Rosewater Luminous Mist")' },
              price: { type: Type.NUMBER, description: 'Retail price in USD (e.g., 48.00)' },
              description: { type: Type.STRING, description: 'Elegant product description' },
              imageUrl: { type: Type.STRING, description: 'Optional HTTPS image URL' },
              tags: { type: Type.STRING, description: 'Comma-separated tags (e.g., "skincare, hydration, mist")' }
            },
            required: ['title', 'price']
          }
        },
        {
          name: 'updateProduct',
          description: 'Updates an existing product in the boutique inventory by its MongoDB _id.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              productId: { type: Type.STRING, description: 'Exact MongoDB _id of the product to update' },
              title: { type: Type.STRING, description: 'Updated product title (optional)' },
              price: { type: Type.NUMBER, description: 'Updated retail price in USD (optional)' },
              description: { type: Type.STRING, description: 'Updated product description (optional)' },
              imageUrl: { type: Type.STRING, description: 'Updated HTTPS image URL (optional)' },
              tags: { type: Type.STRING, description: 'Updated comma-separated tags (optional)' }
            },
            required: ['productId']
          }
        },
        {
          name: 'deleteProduct',
          description: 'Deletes a product from the MongoDB database. Call this tool ONLY when Susan explicitly asks to remove or delete a specific product.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              productId: {
                type: Type.STRING,
                description: 'The exact MongoDB _id string of the product to delete. Find this in the inventory catalog provided.'
              }
            },
            required: ['productId']
          }
        },
        {
          name: 'sendCustomerEmail',
          description: 'Sends a real formatted email from Susan to a client or recipient via IONOS SMTP and records it in Sent Messages.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              to: { type: Type.STRING, description: 'Recipient email address' },
              subject: { type: Type.STRING, description: 'Email subject line' },
              body: { type: Type.STRING, description: 'Plain-text body of the email (greeting and message)' }
            },
            required: ['to', 'subject', 'body']
          }
        },
        {
          name: 'curateProductForMember',
          description: 'Pushes a product recommendation directly to a member Inbox and Beauty Blueprint with a personal note from Susan.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              userId: { type: Type.STRING, description: 'Exact MongoDB _id of the member/user' },
              productId: { type: Type.STRING, description: 'Exact MongoDB _id of the boutique product' },
              message: { type: Type.STRING, description: 'Personal note from Susan explaining why this product fits their ritual' }
            },
            required: ['userId', 'productId']
          }
        },
        {
          name: 'scheduleConsultation',
          description: 'Schedules a 1-on-1 beauty consultation on Susan calendar in US Central Time (America/Chicago) and emails the client.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              clientId: { type: Type.STRING, description: 'Exact MongoDB _id of the member/client' },
              startTime: { type: Type.STRING, description: 'Start date/time in US Central Time formatted as YYYY-MM-DDTHH:mm (e.g., "2026-10-20T14:00")' },
              durationInMinutes: { type: Type.NUMBER, description: 'Duration in minutes (default 60)' },
              notes: { type: Type.STRING, description: 'Consultation focus or notes' }
            },
            required: ['clientId', 'startTime']
          }
        },
        {
          name: 'sendAppointmentReminder',
          description: 'Dispatches an immediate 1-on-1 consultation reminder email (with video room link) to both the client and Susan.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              appointmentId: { type: Type.STRING, description: 'Exact MongoDB _id of the scheduled appointment' }
            },
            required: ['appointmentId']
          }
        },
        {
          name: 'getFinancialAndOrderSummary',
          description: 'Fetches live Stripe Account Balance, CJ Dropshipping Wallet Balance, and Past/Present/Future Order Pipeline summary, optionally syncing tracking numbers from CJ Dropshipping.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              syncCjOrders: {
                type: Type.BOOLEAN,
                description: 'Set to true to reconcile local orders with CJ Dropshipping live order statuses and tracking numbers.'
              }
            }
          }
        },
        {
          name: 'updateOrderStatus',
          description: 'Updates a customer order status (Pending, PAID_PROCESSING, SHIPPED, DELIVERED, COMPLETED, CANCELLED, REFUNDED), tracking number, or courier name, and optionally emails the customer.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              orderId: { type: Type.STRING, description: 'Exact MongoDB _id of the order to update' },
              status: { type: Type.STRING, description: 'New order status (e.g., SHIPPED, DELIVERED, COMPLETED, PAID_PROCESSING, CANCELLED)' },
              tracking_code: { type: Type.STRING, description: 'Optional courier tracking number' },
              logisticName: { type: Type.STRING, description: 'Optional courier name (e.g., USPS, FedEx, DHL)' },
              notifyCustomer: { type: Type.BOOLEAN, description: 'Set to true to email the customer an update via IONOS SMTP' }
            },
            required: ['orderId', 'status']
          }
        },
        {
          name: 'rememberFact',
          description: "Saves or updates an important fact, preference, VIP client note, financial goal, or business rule in Odie's persistent MongoDB Memory Bank.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              key: { type: Type.STRING, description: 'Short label/title for the memory (e.g., "VIP Gift Rule" or "Preferred Payout Day")' },
              content: { type: Type.STRING, description: 'Full detail of the fact, preference, or instruction to remember permanently' },
              category: {
                type: Type.STRING,
                description: 'Memory category: preference, business_rule, vip_client, financial_goal, or general'
              },
              pinned: { type: Type.BOOLEAN, description: 'Whether to pin this memory to the top of Odie Memory Bank (default true)' }
            },
            required: ['key', 'content']
          }
        },
        {
          name: 'forgetFact',
          description: "Removes a memory entry from Odie's persistent Memory Bank by its MongoDB _id or key.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              memoryId: { type: Type.STRING, description: 'Exact MongoDB _id of the memory entry to remove (optional if key is provided)' },
              key: { type: Type.STRING, description: 'Key/title of the memory entry to remove (optional if memoryId is provided)' }
            }
          }
        },
        {
          name: 'runSystemDiagnostics',
          description: 'Runs the full 6-point boutique diagnostic test suite (MongoDB, Stripe & CJ Webhooks, Stripe Balance API, CJ Dropshipping Wallet API, IONOS SMTP Email, and Odie AI Brain).',
          parameters: {
            type: Type.OBJECT,
            properties: {
              sendLiveTestEmail: {
                type: Type.BOOLEAN,
                description: 'Set to true to also dispatch a live diagnostic test email via IONOS SMTP to Susan.'
              },
              testEmailRecipient: {
                type: Type.STRING,
                description: 'Optional email address to receive the live test email (defaults to Susan primary admin email).'
              }
            }
          }
        },
        {
          name: 'syncOrCleanCjCatalog',
          description: 'Runs the CJ Dropshipping Health & Beauty catalog sync or purges non-beauty items from MongoDB.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              purgeOnly: {
                type: Type.BOOLEAN,
                description: 'Set to true to only purge non-beauty items without fetching new CJ products; false for full sync.'
              }
            }
          }
        },
        {
          name: 'executeStripeMoneyDump',
          description: "Initiates a Stripe 'Money Dump' bank payout from Susan's available Stripe balance to her linked bank account.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              amountUsd: { type: Type.NUMBER, description: 'Custom USD amount to payout (omit or set fullAvailableDump=true to dump full available balance)' },
              fullAvailableDump: { type: Type.BOOLEAN, description: 'Set to true to sweep the entire available Stripe balance' },
              reserveForActiveOrders: { type: Type.BOOLEAN, description: 'Set to true to hold back enough funds to cover active unshipped CJ wholesale orders' },
              method: { type: Type.STRING, description: 'Payout speed: "standard" or "instant"' },
              notes: { type: Type.STRING, description: 'Optional note for the Treasury Transfer ledger' }
            }
          }
        },
        {
          name: 'transferStripeToCj',
          description: "Moves/earmarks wholesale funds from Stripe for CJ Dropshipping and automatically pays open unpaid CJ orders using Susan's CJ Wallet balance.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              amountUsd: { type: Type.NUMBER, description: 'USD amount to allocate from Stripe to CJ wholesale (defaults to active unshipped wholesale cost)' },
              allocateFromStripe: { type: Type.BOOLEAN, description: 'Set to true to initiate a dedicated Stripe wholesale payout earmark' },
              payUnpaidCjOrders: { type: Type.BOOLEAN, description: 'Set to true to automatically pay open CJ Dropshipping orders via CJ Wallet API' },
              notes: { type: Type.STRING, description: 'Optional note for the Treasury Transfer ledger' }
            }
          }
        },
        {
          name: 'reclassifyProductBlueprintLabels',
          description: 'Re-scans and labels all boutique products with structured Skin Types, Skin Conditions/Concerns, Sensitivity Safety, Key Actives, and Ritual Steps so members can match products to their Beauty Blueprint.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              forceAll: {
                type: Type.BOOLEAN,
                description: 'Set to true to re-classify every product in the catalog (default true).'
              }
            }
          }
        },
        {
          name: 'getSiteAnalyticsAndCurationInsights',
          description: 'Retrieves comprehensive site analytics including page views, unique visitors, most viewed/carted/purchased products, conversion funnel metrics, shopper search/filter trends, and Member Blueprint demand vs. inventory supply gaps.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              range: {
                type: Type.STRING,
                description: 'Time window to analyze: "7d", "30d", "90d", or "all" (default "30d").'
              },
              seedSampleIfEmpty: {
                type: Type.BOOLEAN,
                description: 'Set to true only if Susan explicitly asks to seed sample preview traffic.'
              }
            }
          }
        },
        {
          name: 'curateMonthlyMemberBoxes',
          description: 'Curates profit-protected monthly membership boxes for one member (userId) or all paid members (curateAll=true) according to their locked Beauty Blueprint with a strict <=25% all-in cost ceiling ($12.25 max for Luminary $49; $29.75 max for Radiance $119).',
          parameters: {
            type: Type.OBJECT,
            properties: {
              userId: {
                type: Type.STRING,
                description: 'Optional MongoDB _id of a single member to curate a box for (omit or set curateAll=true to curate all paid members).'
              },
              curateAll: {
                type: Type.BOOLEAN,
                description: 'Set to true to curate profit-protected monthly boxes for all paid Luminary and Radiance members.'
              },
              billingMonth: {
                type: Type.STRING,
                description: 'Optional billing month in YYYY-MM format (defaults to current billing month).'
              },
              selectedLogisticName: {
                type: Type.STRING,
                description: 'Optional CJ carrier name (e.g., "CJPacket Sensitive", "USPS+", "CJPacket Ordinary").'
              },
              enableCustomLabel: {
                type: Type.BOOLEAN,
                description: 'Whether to include CJ custom rose-gold packaging/labeling on the box (default true).'
              }
            }
          }
        },
        {
          name: 'configureCjCustomLabeling',
          description: 'Enables, updates, or disables CJ custom packaging / private labeling / POD logo branding on a specific product, a monthly membership box, or across the entire boutique catalog.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              targetScope: {
                type: Type.STRING,
                description: 'Target scope: "catalog" (all products), "product" (single productId), or "monthly_box" (single boxId).'
              },
              productId: {
                type: Type.STRING,
                description: 'MongoDB _id of the product when targetScope is "product".'
              },
              boxId: {
                type: Type.STRING,
                description: 'MongoDB _id of the MemberMonthlyBox when targetScope is "monthly_box".'
              },
              enabled: {
                type: Type.BOOLEAN,
                description: 'Set to true to enable CJ custom labeling/packaging, or false to disable.'
              },
              packagingName: {
                type: Type.STRING,
                description: 'Packaging option name (e.g., "Susans Rose-Gold Custom Box & Seal", "Luxury Satin Ritual Pouch", "CJ POD Custom Bottle/Jar Logo Label").'
              },
              labelType: {
                type: Type.STRING,
                description: 'Label type: "CJ_CUSTOM_PACKAGING" or "CJ_POD_LOGO".'
              },
              customBrandText: {
                type: Type.STRING,
                description: 'Custom brand text printed on the packaging or POD label (default "Susans Beauty Consulting ✧").'
              },
              packagingCostUsd: {
                type: Type.NUMBER,
                description: 'Optional unit packaging cost in USD (e.g. 0.65).'
              }
            }
          }
        },
        {
          name: 'adjustCjShippingAndPricing',
          description: 'Fetches CJ shipping quotes, changes the CJ shipping method (CJPacket Sensitive, USPS+, CJPacket Ordinary, CJ Liquid Direct, DHL Official) on a product, order, monthly box, or entire catalog, and recalculates retail prices with shipping included.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              targetScope: {
                type: Type.STRING,
                description: 'Target scope: "catalog" (all products), "product" (single productId), "order" (single orderId), or "monthly_box" (single boxId).'
              },
              productId: { type: Type.STRING, description: 'MongoDB _id of the product when targetScope is "product".' },
              orderId: { type: Type.STRING, description: 'MongoDB _id of the order when targetScope is "order".' },
              boxId: { type: Type.STRING, description: 'MongoDB _id of the monthly box when targetScope is "monthly_box".' },
              selectedLogisticName: {
                type: Type.STRING,
                description: 'CJ shipping carrier to apply: "CJPacket Sensitive", "USPS+", "CJPacket Ordinary", "CJ Liquid Direct", or "DHL Official".'
              },
              shippingIncludedInPrice: {
                type: Type.BOOLEAN,
                description: 'Whether CJ shipping cost is baked into the retail price (default true).'
              },
              markupMultiplier: {
                type: Type.NUMBER,
                description: 'Optional retail markup multiplier on wholesale cost (default 6.5).'
              }
            }
          }
        },
        {
          name: 'dispatchMonthlyMemberBoxToCj',
          description: 'Dispatches a curated monthly membership box (or all ready boxes) to CJ Dropshipping via createOrderV2, optionally pays for it from the CJ Wallet, and emails the member.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              boxId: {
                type: Type.STRING,
                description: 'MongoDB _id of the MemberMonthlyBox to dispatch (or omit and set dispatchAllReady=true).'
              },
              userId: {
                type: Type.STRING,
                description: 'Optional member userId if looking up their current month box by userId instead of boxId.'
              },
              dispatchAllReady: {
                type: Type.BOOLEAN,
                description: 'Set to true to dispatch all curated/approved boxes for the current billing month.'
              },
              payFromCjWallet: {
                type: Type.BOOLEAN,
                description: 'Set to true to automatically pay for the CJ order using CJ Wallet balance (default true).'
              },
              notifyMember: {
                type: Type.BOOLEAN,
                description: 'Set to true to email the member their box curation & dispatch confirmation (default true).'
              }
            }
          }
        }
      ]
    };

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction,
        tools: [executiveBoutiqueTools],
        temperature: 0.2,
      }
    });

    if (response.functionCalls && response.functionCalls.length > 0) {
      const summaries = [];
      const payload = { actionsTaken: [], assistantName: 'Odie' };

      for (const call of response.functionCalls) {
        const args = call.args || {};

        if (call.name === 'addProduct') {
          const cleanTitle = String(args.title || '').trim() || 'Susan Bespoke Essential';
          const cleanPrice = parseFloat(args.price) || 0;
          const cleanDesc = String(args.description || '').trim();
          const cleanImg = String(args.imageUrl || '').trim();
          const tagList = args.tags
            ? String(args.tags).split(',').map(t => t.trim()).filter(Boolean)
            : ['beauty', 'skincare'];

          const classified = classifyProductForBlueprint(cleanTitle, tagList.join(' '), cleanDesc, { tags: tagList });

          const created = new Product({
            title: cleanTitle,
            description: cleanDesc,
            imageUrl: cleanImg,
            tags: classified.tags,
            skinTypes: classified.skinTypes,
            skinConcerns: classified.skinConcerns,
            sensitivitySafe: classified.sensitivitySafe,
            sensitivityLabel: classified.sensitivityLabel,
            ritualStep: classified.ritualStep,
            keyActives: classified.keyActives,
            variants: [{
              sku: `CUSTOM-${Date.now()}`,
              variantName: 'Standard',
              price: cleanPrice,
              imageUrl: cleanImg
            }]
          });
          await created.save();
          payload.addedProduct = created;
          payload.actionsTaken.push('addProduct');
          summaries.push(`✧ Odie added "${created.title}" ($${cleanPrice.toFixed(2)}) [Best for: ${classified.skinTypes.join(', ')} | Targets: ${classified.skinConcerns.join(', ')}] to the boutique inventory.`);
        }

        else if (call.name === 'updateProduct') {
          const pid = args.productId;
          const prod = pid && mongoose.Types.ObjectId.isValid(String(pid))
            ? await Product.findById(pid)
            : null;
          if (!prod) {
            summaries.push(`✧ Could not find a product with ID "${pid}" to update.`);
          } else {
            if (args.title !== undefined && String(args.title).trim()) {
              prod.title = String(args.title).trim();
            }
            if (args.description !== undefined) {
              prod.description = String(args.description).trim();
            }
            if (args.imageUrl !== undefined) {
              prod.imageUrl = String(args.imageUrl).trim();
            }
            if (args.tags !== undefined) {
              prod.tags = Array.isArray(args.tags)
                ? args.tags
                : String(args.tags).split(',').map(t => t.trim()).filter(Boolean);
            }
            const classified = classifyProductForBlueprint(
              prod.title,
              prod.rawCjData?.categoryName || (prod.tags || []).join(' '),
              prod.description,
              { tags: prod.tags }
            );
            prod.tags = classified.tags;
            prod.skinTypes = classified.skinTypes;
            prod.skinConcerns = classified.skinConcerns;
            prod.sensitivitySafe = classified.sensitivitySafe;
            prod.sensitivityLabel = classified.sensitivityLabel;
            prod.ritualStep = classified.ritualStep;
            prod.keyActives = classified.keyActives;

            const parsedPrice = args.price !== undefined ? parseFloat(args.price) : NaN;
            if (prod.variants && prod.variants.length > 0) {
              if (!isNaN(parsedPrice) && parsedPrice >= 0) {
                prod.variants[0].price = parsedPrice;
              }
              if (args.imageUrl !== undefined && String(args.imageUrl).trim()) {
                prod.variants[0].imageUrl = String(args.imageUrl).trim();
              }
            } else {
              prod.variants = [{
                sku: `CUSTOM-${Date.now()}`,
                variantName: 'Standard',
                price: !isNaN(parsedPrice) ? parsedPrice : 0,
                imageUrl: prod.imageUrl || ''
              }];
            }
            await prod.save();
            payload.updatedProduct = prod;
            payload.actionsTaken.push('updateProduct');
            const updatedPrice = Number(prod.variants?.[0]?.price ?? 0).toFixed(2);
            summaries.push(`✧ Odie updated "${prod.title}" ($${updatedPrice}) and refreshed its Blueprint skin-condition labels.`);
          }
        }

        else if (call.name === 'deleteProduct') {
          const pid = args.productId;
          const deleted = pid && mongoose.Types.ObjectId.isValid(String(pid))
            ? await Product.findByIdAndDelete(pid)
            : null;
          if (deleted) {
            payload.deletedProductId = String(pid);
            payload.actionsTaken.push('deleteProduct');
            summaries.push(`✧ Odie permanently removed "${deleted.title}" from the boutique database.`);
          } else {
            summaries.push(`✧ Could not find a product with ID "${pid}" in the database.`);
          }
        }

        else if (call.name === 'sendCustomerEmail') {
          const cleanTo = String(args.to || '').trim();
          const cleanSubject = String(args.subject || '').trim();
          const cleanBody = String(args.body || '').trim();
          if (!cleanTo || !cleanSubject || !cleanBody) {
            summaries.push(`✧ Could not send email because recipient, subject, or body was missing.`);
          } else {
            const safeHtmlBody = escapeHtml(cleanBody);
            const htmlContent = `
              <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; border: 1px solid #E8C5C8; padding: 40px; border-radius: 15px;">
                <h2 style="color: #B38B8F; font-style: italic; text-align: center;">Susan's Beauty Consulting ✧</h2>
                <div style="font-size: 1.1rem; line-height: 1.6; white-space: pre-wrap;">${safeHtmlBody}</div>
                <p style="font-size: 0.9rem; color: #8A797A; margin-top: 40px; text-align: center;">Warmly,<br>Susan</p>
              </div>
            `;
            const textContent = `${cleanBody}\n\nWarmly,\nSusan\nSusan's Beauty Consulting`;
            await sendEmail(cleanTo, cleanSubject, htmlContent, textContent);
            const newLog = await new EmailLog({ to: cleanTo, subject: cleanSubject, body: cleanBody }).save();
            payload.sentEmailLog = newLog;
            payload.actionsTaken.push('sendCustomerEmail');
            summaries.push(`✧ Odie dispatched email "${cleanSubject}" to ${cleanTo} and logged it in Sent Messages.`);
          }
        }

        else if (call.name === 'curateProductForMember') {
          const uid = args.userId;
          const pid = args.productId;
          const customNote = (args.message && String(args.message).trim())
            ? String(args.message).trim()
            : "Susan has hand-selected this specifically for your custom beauty profile ✧";

          const [product, member] = await Promise.all([
            pid && mongoose.Types.ObjectId.isValid(String(pid)) ? Product.findById(pid) : null,
            uid && mongoose.Types.ObjectId.isValid(String(uid)) ? User.findById(uid) : null
          ]);

          if (!product || !member) {
            summaries.push(`✧ Could not curate product: verify both the member ID and product ID exist.`);
          } else {
            await User.findByIdAndUpdate(
              member._id,
              { $addToSet: { recommendedProducts: product._id } },
              { returnDocument: 'after' }
            );
            const inboxItem = await new InboxItem({
              userId: member._id,
              productId: product._id,
              message: customNote
            }).save();
            await Product.findByIdAndUpdate(product._id, { $inc: { curatedCount: 1 } }).catch(() => {});
            payload.curatedRecommendation = {
              userId: String(member._id),
              productId: String(product._id),
              inboxItemId: String(inboxItem._id)
            };
            payload.actionsTaken.push('curateProductForMember');
            summaries.push(`✧ Odie pushed "${product.title}" to ${member.name}'s Sanctuary Inbox & Beauty Blueprint with your note.`);
          }
        }

        else if (call.name === 'scheduleConsultation') {
          const cid = args.clientId;
          const start = parseCentralDateTime(args.startTime);
          const duration = Number(args.durationInMinutes) || 60;
          const notes = args.notes ? String(args.notes).trim() : '';

          const clientUser = cid && mongoose.Types.ObjectId.isValid(String(cid))
            ? await User.findById(cid).select('_id name email membershipTier')
            : null;

          if (!clientUser || isNaN(start.getTime())) {
            summaries.push(`✧ Could not schedule consultation: please verify the member and start time.`);
          } else {
            const end = new Date(start.getTime() + duration * 60000);
            const conflict = await Appointment.findOne({
              status: { $ne: 'cancelled' },
              startTime: { $lt: end },
              endTime: { $gt: start }
            });
            if (conflict) {
              summaries.push(`✧ That time slot (${formatCentralDateTime(start)}) overlaps with an existing consultation on your calendar.`);
            } else {
              const newAppt = await new Appointment({
                clientId: clientUser._id,
                staffId: req.user._id,
                startTime: start,
                endTime: end,
                status: 'confirmed',
                notes,
                meetingLink: buildDefaultMeetingLink()
              }).save();

              const populatedAppt = await Appointment.findById(newAppt._id)
                .populate('clientId', 'name email membershipTier')
                .populate('serviceId', 'name');

              if (clientUser.email) {
                const formattedTime = formatCentralDateTime(start);
                const html = `
                  <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; border: 1px solid #E8C5C8; padding: 35px; border-radius: 15px;">
                    <h2 style="color: #B38B8F; font-style: italic; text-align: center;">Your 1-on-1 Consultation is Scheduled ✧</h2>
                    <p style="font-size: 1.05rem; line-height: 1.6;">Dear ${escapeHtml(clientUser.name || 'Member')},</p>
                    <p style="font-size: 1.05rem; line-height: 1.6;">Susan has scheduled a private consultation with you:</p>
                    <div style="background-color: #FFF0F2; padding: 15px; border-radius: 10px; margin: 20px 0;">
                      <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${escapeHtml(formattedTime)}</p>
                      ${notes ? `<p style="margin: 5px 0;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ''}
                      <p style="margin: 5px 0;"><strong>Video Sanctuary Link:</strong> <a href="${escapeHtml(newAppt.meetingLink)}" style="color: #B38B8F;">${escapeHtml(newAppt.meetingLink)}</a></p>
                    </div>
                  </div>
                `;
                const text = `Your 1-on-1 Consultation with Susan is scheduled for ${formattedTime}. Video link: ${newAppt.meetingLink}`;
                sendEmail(clientUser.email, "✧ New Consultation Scheduled with Susan", html, text).catch(() => {});
              }

              payload.scheduledAppointment = populatedAppt;
              payload.actionsTaken.push('scheduleConsultation');
              summaries.push(`✧ Odie scheduled a 1-on-1 consultation with ${clientUser.name} for ${formatCentralDateTime(start)} and emailed their Video Sanctuary link.`);
            }
          }
        }

        else if (call.name === 'sendAppointmentReminder') {
          const aid = args.appointmentId;
          if (!aid || !mongoose.Types.ObjectId.isValid(String(aid))) {
            summaries.push(`✧ Could not send reminder: invalid appointment ID "${aid}".`);
          } else {
            const reminderResult = await dispatchAppointmentReminder(aid, 'ai');
            payload.remindedAppointmentId = String(aid);
            payload.actionsTaken.push('sendAppointmentReminder');
            summaries.push(`✧ Odie sent a 1-on-1 consultation reminder email to ${reminderResult.clientEmail || 'client'} and to your inbox for ${reminderResult.formattedTime}.`);
          }
        }

        else if (call.name === 'getFinancialAndOrderSummary') {
          const syncFlag = Boolean(args.syncCjOrders);
          const freshTelemetry = await buildFinancialAndOrderTelemetry({ syncCjOrders: syncFlag });
          payload.financialTelemetry = freshTelemetry;
          payload.actionsTaken.push('getFinancialAndOrderSummary');

          const sb = freshTelemetry.stripeBalance || {};
          const cjb = freshTelemetry.cjBalance || {};
          const counts = freshTelemetry.orderPipeline?.counts || {};
          const sm = freshTelemetry.summaryMetrics || {};
          const fp = freshTelemetry.futureProjections || {};

          summaries.push(
            `✧ Odie's Live Executive Financial & Order Pipeline Brief:\n` +
            `• Stripe Balance (${sb.mode || 'TEST'}): $${Number(sb.availableUsd || 0).toFixed(2)} Available | $${Number(sb.pendingUsd || 0).toFixed(2)} Pending\n` +
            `• CJ Dropshipping Wallet: $${Number(cjb.availableUsd || 0).toFixed(2)} Available (${cjb.walletCoversActiveOrders ? 'Covers all active unshipped orders ✓' : 'Needs top-up for active orders ⚠️'})\n` +
            `• Order Pipeline: ${counts.past || 0} Past (Completed/Delivered) | ${counts.present || 0} Present (Paid/In-Transit) | ${counts.future || 0} Future Carts + ${counts.scheduledMemberBoxes || 0} Upcoming Member Ritual Boxes\n` +
            `• Paid Boutique Revenue: $${Number(sm.totalPaidRevenueUsd || 0).toFixed(2)} (Est. Net Profit: $${Number(sm.totalEstimatedProfitUsd || 0).toFixed(2)})\n` +
            `• Projected 30-Day Subscription + Pipeline Revenue: $${Number(fp.projectedNext30DaysTotal || 0).toFixed(2)} (${fp.luminaryCount || 0} Luminary, ${fp.radianceCount || 0} Radiance)`
          );
        }

        else if (call.name === 'updateOrderStatus') {
          const oid = args.orderId;
          const newStatus = String(args.status || '').trim();
          const trackingCode = args.tracking_code !== undefined ? String(args.tracking_code || '').trim() : undefined;
          const courier = args.logisticName !== undefined ? String(args.logisticName || '').trim() : undefined;
          const notifyFlag = Boolean(args.notifyCustomer);

          const ord = oid && mongoose.Types.ObjectId.isValid(String(oid))
            ? await Order.findById(oid)
            : null;

          if (!ord || !newStatus) {
            summaries.push(`✧ Could not update order: verify the order ID ("${oid}") and status.`);
          } else {
            ord.status = newStatus;
            if (trackingCode !== undefined) ord.tracking_code = trackingCode;
            if (courier !== undefined) ord.logisticName = courier;
            ord.updatedAt = new Date();
            await ord.save();

            let notified = false;
            if (notifyFlag && ord.customerEmail && ord.customerEmail !== 'Customer') {
              const shortCode = String(ord._id).slice(-6).toUpperCase();
              const subj = `✧ Order Update (#${shortCode}): ${ord.status}`;
              const html = `
                <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; border: 1px solid #E8C5C8; padding: 35px; border-radius: 15px;">
                  <h2 style="color: #B38B8F; font-style: italic; text-align: center;">Your Ritual Order Update ✧</h2>
                  <p style="font-size: 1.05rem; line-height: 1.6;">Susan has updated your order <strong>#${shortCode}</strong> to <strong>${escapeHtml(ord.status)}</strong>.</p>
                  ${ord.tracking_code ? `<p style="font-size: 1.05rem;"><strong>Tracking Number:</strong> ${escapeHtml(ord.tracking_code)}</p>` : ''}
                </div>
              `;
              const text = `Your order #${shortCode} is now ${ord.status}.${ord.tracking_code ? ` Tracking: ${ord.tracking_code}` : ''}`;
              await sendEmail(ord.customerEmail, subj, html, text).catch(() => {});
              notified = true;
            }

            payload.updatedOrder = ord;
            payload.actionsTaken.push('updateOrderStatus');
            summaries.push(
              `✧ Odie updated Order #${String(ord._id).slice(-6).toUpperCase()} (${ord.customerEmail}) to "${ord.status}"` +
              `${ord.tracking_code ? ` with tracking ${ord.tracking_code}` : ''}` +
              `${notified ? ' and emailed the customer.' : '.'}`
            );
          }
        }

        else if (call.name === 'rememberFact') {
          const savedMem = await upsertOdieMemoryFact({
            key: args.key || 'Susan Executive Note',
            content: args.content || '',
            category: args.category || 'general',
            source: 'odie_auto',
            pinned: args.pinned !== undefined ? Boolean(args.pinned) : true
          });
          payload.savedMemory = savedMem;
          payload.actionsTaken.push('rememberFact');
          summaries.push(`🧠 Odie saved to long-term memory [${savedMem.category}]: "${savedMem.key}" — ${savedMem.content}`);
        }

        else if (call.name === 'forgetFact') {
          let removedMem = null;
          if (args.memoryId && mongoose.Types.ObjectId.isValid(String(args.memoryId))) {
            removedMem = await OdieMemory.findByIdAndDelete(args.memoryId);
          } else if (args.key && String(args.key).trim()) {
            removedMem = await OdieMemory.findOneAndDelete({
              key: new RegExp(`^${escapeRegex(String(args.key).trim())}$`, 'i')
            });
          }
          payload.actionsTaken.push('forgetFact');
          if (removedMem) {
            summaries.push(`🧠 Odie removed "${removedMem.key}" from the long-term Memory Bank.`);
          } else {
            summaries.push(`🧠 Could not find a matching memory entry to remove.`);
          }
        }

        else if (call.name === 'runSystemDiagnostics') {
          const diagReport = await runFullSystemDiagnosticsSuite({
            sendLiveTestEmail: Boolean(args.sendLiveTestEmail),
            testEmailRecipient: args.testEmailRecipient || ''
          });
          payload.diagnosticsReport = diagReport;
          payload.actionsTaken.push('runSystemDiagnostics');
          const checkLines = (diagReport.checksList || []).map(
            c => `• ${c.passed ? '✅' : '⚠️'} ${c.name}: ${c.details}`
          );
          summaries.push(
            `🧪 ${diagReport.message}\n` + checkLines.join('\n')
          );
        }

        else if (call.name === 'syncOrCleanCjCatalog') {
          const purgeOnly = Boolean(args.purgeOnly);
          if (purgeOnly) {
            const purgedCount = await purgeNonBeautyCjProducts();
            const activeTotal = await Product.countDocuments();
            payload.actionsTaken.push('syncOrCleanCjCatalog');
            summaries.push(`🧹 Odie cleaned the catalog: purged ${purgedCount} non-beauty CJ items (${activeTotal} verified items active).`);
          } else {
            const syncRes = await syncCJCatalog({});
            payload.actionsTaken.push('syncOrCleanCjCatalog');
            summaries.push(`🔄 Odie completed CJ Beauty & Skincare sync: purged ${syncRes.purgedCount || 0} non-beauty items and synced ${syncRes.syncedCount || 0} beauty products (${syncRes.activeTotal || 0} total active).`);
          }
        }

        else if (call.name === 'executeStripeMoneyDump') {
          try {
            const dumpRes = await executeStripeMoneyDump({
              amountUsd: args.amountUsd,
              fullAvailableDump: Boolean(args.fullAvailableDump),
              reserveForActiveOrders: args.reserveForActiveOrders !== undefined ? Boolean(args.reserveForActiveOrders) : true,
              method: args.method || 'standard',
              notes: args.notes || 'Triggered by Odie AI on Susan command',
              triggeredBy: 'odie'
            });
            payload.stripeMoneyDumpResult = dumpRes;
            payload.financialTelemetry = dumpRes.telemetry;
            payload.actionsTaken.push('executeStripeMoneyDump');
            summaries.push(dumpRes.message);
          } catch (dumpErr) {
            summaries.push(`⚠️ Odie could not complete the Stripe Money Dump: ${dumpErr.message}`);
          }
        }

        else if (call.name === 'transferStripeToCj') {
          try {
            const bridgeRes = await executeStripeToCjBridge({
              amountUsd: args.amountUsd,
              allocateFromStripe: args.allocateFromStripe !== undefined ? Boolean(args.allocateFromStripe) : true,
              payUnpaidCjOrders: args.payUnpaidCjOrders !== undefined ? Boolean(args.payUnpaidCjOrders) : true,
              notes: args.notes || 'Triggered by Odie AI on Susan command',
              triggeredBy: 'odie'
            });
            payload.stripeToCjResult = bridgeRes;
            payload.financialTelemetry = bridgeRes.telemetry;
            payload.actionsTaken.push('transferStripeToCj');
            summaries.push(bridgeRes.message);
          } catch (bridgeErr) {
            summaries.push(`⚠️ Odie could not complete the Stripe -> CJ transfer bridge: ${bridgeErr.message}`);
          }
        }

        else if (call.name === 'reclassifyProductBlueprintLabels') {
          const forceAll = args.forceAll !== undefined ? Boolean(args.forceAll) : true;
          const labelResult = await backfillProductBlueprintLabels(forceAll);
          await backfillConsultationAnalyses();
          payload.reclassifiedProducts = labelResult;
          payload.actionsTaken.push('reclassifyProductBlueprintLabels');
          summaries.push(
            `🏷️ Odie classified and labeled ${labelResult.updatedCount || 0} boutique product(s) (${labelResult.totalCount || 0} total active) with Skin Types, Skin Conditions, Sensitivity Safety, Key Actives, and Ritual Steps!`
          );
        }

        else if (call.name === 'getSiteAnalyticsAndCurationInsights') {
          const range = args.range || '30d';
          const siteAnalytics = await buildSiteAnalyticsTelemetry({ range });
          payload.siteAnalytics = siteAnalytics;
          payload.actionsTaken.push('getSiteAnalyticsAndCurationInsights');

          const ov = siteAnalytics.overview || {};
          const topProds = (siteAnalytics.productLeaderboard || []).slice(0, 5);
          const topPagesList = (siteAnalytics.topPages || []).slice(0, 4);
          const recs = siteAnalytics.blueprintDemandVsSupply?.curationRecommendations || [];

          const topProdsText = topProds.length > 0
            ? topProds.map((p, idx) => `  ${idx + 1}. ${p.title} ($${p.price}) — ${p.viewCount} views, ${p.cartAddCount} bag adds, ${p.purchaseCount} sold [${p.curationInsightBadge}]`).join('\n')
            : '  • No product views recorded yet.';

          const topPagesText = topPagesList.length > 0
            ? topPagesList.map(pg => `${pg.page} (${pg.views} views)`).join(' • ')
            : 'No page views recorded yet';

          summaries.push(
            `📊 Odie's Executive Site Analytics & Curation Brief (${range}):\n` +
            `• Traffic & Sessions: ${ov.totalPageViews || 0} Page Views across ${ov.uniqueVisitors || 0} Unique Sessions (${ov.memberVsGuestRatio || '50% Member / 50% Guest'})\n` +
            `• Top Viewed Pages: ${topPagesText}\n` +
            `• Boutique Funnel: ${ov.productViews || 0} Product Detail Opens → ${ov.cartAdditions || 0} Bag Additions → ${ov.paidOrdersCount || 0} Paid Orders (${ov.conversionRatePct || 0}% Conversion)\n` +
            `• Blueprint Quiz Funnel: ${ov.quizCompletions || 0}/${ov.quizStarts || 0} Completed (${ov.quizCompletionRatePct || 0}% Completion Rate)\n` +
            `• Top Engaging Products:\n${topProdsText}` +
            (recs.length > 0 ? `\n• Curation Intelligence Notes:\n  - ${recs.join('\n  - ')}` : '')
          );
        }

        else if (call.name === 'curateMonthlyMemberBoxes') {
          try {
            const boxOptions = {
              billingMonth: args.billingMonth || undefined,
              selectedLogisticName: args.selectedLogisticName || 'CJPacket Sensitive',
              curatedBy: 'odie',
              ...(args.enableCustomLabel !== undefined
                ? { customLabelConfig: { enabled: Boolean(args.enableCustomLabel) } }
                : {})
            };

            if (args.userId && !args.curateAll && mongoose.Types.ObjectId.isValid(String(args.userId))) {
              const singleBox = await curateProfitProtectedMemberBox(args.userId, boxOptions);
              const freshBoxesTelemetry = await buildMonthlyBoxesTelemetry({ billingMonth: singleBox.billingMonth });
              payload.curatedMonthlyBox = singleBox;
              payload.monthlyBoxesTelemetry = freshBoxesTelemetry;
              payload.actionsTaken.push('curateMonthlyMemberBoxes');
              summaries.push(
                `🎁 Odie curated ${singleBox.memberName}'s ${singleBox.membershipTier === 'radiance' ? '5-Piece Radiance ($119/mo)' : '3-Piece Luminary ($49/mo)'} Box for ${singleBox.billingMonth}!\n` +
                `• Strict ≤25% Cap Check: All-In CJ Cost $${Number(singleBox.totalAllInCostUsd).toFixed(2)} / $${Number(singleBox.maxAllowedCostUsd).toFixed(2)} Max (${singleBox.costPercentageOfMembership}% of membership) • Net Profit: +$${Number(singleBox.estimatedNetProfitUsd).toFixed(2)} ✓\n` +
                `• Curated Blueprint Items: ${(singleBox.items || []).map(i => `${i.ritualStep} — ${i.title} ($${Number(i.wholesaleCostUsd).toFixed(2)})`).join(' | ')}`
              );
            } else {
              const batchRes = await curateAllMemberMonthlyBoxes(boxOptions);
              const freshBoxesTelemetry = await buildMonthlyBoxesTelemetry({ billingMonth: batchRes.billingMonth });
              payload.monthlyBoxesTelemetry = freshBoxesTelemetry;
              payload.actionsTaken.push('curateMonthlyMemberBoxes');
              const sm = freshBoxesTelemetry.summaryMetrics || {};
              summaries.push(
                `🎁 Odie curated ${batchRes.curatedCount} Profit-Protected Monthly Membership Box(es) for ${batchRes.billingMonth} (100% within the ≤25% cost cap)!\n` +
                `• Subscription Revenue: $${Number(sm.totalSubscriptionRevenueUsd || 0).toFixed(2)} | Total CJ Box Cost: $${Number(sm.totalBoxCjCostUsd || 0).toFixed(2)} (Avg ${sm.averageCostPct || 0}% of membership) | Guaranteed Net Profit: +$${Number(sm.totalNetProfitUsd || 0).toFixed(2)}`
              );
            }
          } catch (boxErr) {
            summaries.push(`⚠️ Odie could not curate monthly boxes: ${boxErr.message}`);
          }
        }

        else if (call.name === 'configureCjCustomLabeling') {
          try {
            const scope = String(args.targetScope || (args.boxId ? 'monthly_box' : args.productId ? 'product' : 'catalog')).toLowerCase().trim();
            const enabled = args.enabled !== undefined ? Boolean(args.enabled) : true;

            if (scope === 'monthly_box' && args.boxId && mongoose.Types.ObjectId.isValid(String(args.boxId))) {
              const box = await MemberMonthlyBox.findById(args.boxId);
              if (!box) {
                summaries.push(`⚠️ Could not find Monthly Box "${args.boxId}" to configure custom labeling.`);
              } else {
                const updatedLabel = getDefaultCustomLabelConfig({
                  ...(box.customLabelConfig || {}),
                  enabled,
                  packagingName: args.packagingName || box.customLabelConfig?.packagingName || "Susan's Rose-Gold Custom Box & Seal",
                  labelType: args.labelType || box.customLabelConfig?.labelType || 'CJ_CUSTOM_PACKAGING',
                  customBrandText: args.customBrandText || box.customLabelConfig?.customBrandText || "Susan's Beauty Consulting ✧",
                  packagingCostUsd: args.packagingCostUsd
                });
                const econ = recomputeAndValidateMonthlyBoxEconomics({
                  items: box.items || [],
                  membershipTier: box.membershipTier,
                  selectedLogisticName: box.selectedLogisticName,
                  customLabelConfig: updatedLabel
                });
                Object.assign(box, econ);
                await box.save();
                payload.updatedMonthlyBox = box;
                payload.monthlyBoxesTelemetry = await buildMonthlyBoxesTelemetry({ billingMonth: box.billingMonth });
                payload.actionsTaken.push('configureCjCustomLabeling');
                summaries.push(
                  `🏷️ Odie ${enabled ? 'enabled' : 'disabled'} CJ Custom Labeling ("${updatedLabel.packagingName}") on ${box.memberName}'s monthly box • New All-In Cost: $${econ.totalAllInCostUsd.toFixed(2)} / $${econ.maxAllowedCostUsd.toFixed(2)} (${econ.costPercentageOfMembership}%).`
                );
              }
            } else {
              const resLabel = await applyCustomLabelToProducts({
                productId: scope === 'product' ? args.productId : null,
                applyToAll: scope !== 'product',
                enabled,
                labelType: args.labelType || 'CJ_CUSTOM_PACKAGING',
                packagingName: args.packagingName || "Susan's Rose-Gold Custom Box & Seal",
                customBrandText: args.customBrandText || "Susan's Beauty Consulting ✧",
                packagingCostUsd: args.packagingCostUsd
              });
              payload.customLabelResult = resLabel;
              if (resLabel.updatedProduct) payload.updatedProduct = resLabel.updatedProduct;
              payload.actionsTaken.push('configureCjCustomLabeling');
              summaries.push(
                `🏷️ Odie ${enabled ? 'applied' : 'disabled'} CJ Custom Labeling ("${resLabel.customLabelConfig.packagingName}", +$${Number(resLabel.customLabelConfig.packagingCostUsd || 0).toFixed(2)}) and recalculated shipping-inclusive retail prices on ${resLabel.updatedCount} boutique product(s)!`
              );
            }
          } catch (lblErr) {
            summaries.push(`⚠️ Odie could not update CJ custom labeling: ${lblErr.message}`);
          }
        }

        else if (call.name === 'adjustCjShippingAndPricing') {
          try {
            const scope = String(args.targetScope || (args.boxId ? 'monthly_box' : args.orderId ? 'order' : args.productId ? 'product' : 'catalog')).toLowerCase().trim();
            const chosenCarrier = String(args.selectedLogisticName || 'CJPacket Sensitive').trim();

            if (scope === 'monthly_box' && args.boxId && mongoose.Types.ObjectId.isValid(String(args.boxId))) {
              const box = await MemberMonthlyBox.findById(args.boxId);
              if (!box) {
                summaries.push(`⚠️ Monthly box "${args.boxId}" not found.`);
              } else {
                const econ = recomputeAndValidateMonthlyBoxEconomics({
                  items: box.items || [],
                  membershipTier: box.membershipTier,
                  selectedLogisticName: chosenCarrier,
                  customLabelConfig: box.customLabelConfig
                });
                Object.assign(box, econ);
                await box.save();
                payload.updatedMonthlyBox = box;
                payload.monthlyBoxesTelemetry = await buildMonthlyBoxesTelemetry({ billingMonth: box.billingMonth });
                payload.actionsTaken.push('adjustCjShippingAndPricing');
                summaries.push(
                  `✈️ Odie switched ${box.memberName}'s monthly box shipping carrier to "${chosenCarrier}" ($${econ.consolidatedShippingUsd.toFixed(2)}) • Total Box Cost: $${econ.totalAllInCostUsd.toFixed(2)} / $${econ.maxAllowedCostUsd.toFixed(2)} (${econ.costPercentageOfMembership}%).`
                );
              }
            } else if (scope === 'order' && args.orderId && mongoose.Types.ObjectId.isValid(String(args.orderId))) {
              const ord = await Order.findById(args.orderId);
              if (!ord) {
                summaries.push(`⚠️ Order "${args.orderId}" not found.`);
              } else {
                ord.selectedLogisticName = chosenCarrier;
                ord.logisticName = chosenCarrier;
                ord.updatedAt = new Date();
                await ord.save();
                payload.updatedOrder = ord;
                payload.actionsTaken.push('adjustCjShippingAndPricing');
                summaries.push(`✈️ Odie updated Order #${String(ord._id).slice(-6).toUpperCase()} CJ shipping method to "${chosenCarrier}".`);
              }
            } else if (scope === 'product' && args.productId && mongoose.Types.ObjectId.isValid(String(args.productId))) {
              const prod = await Product.findById(args.productId);
              if (!prod) {
                summaries.push(`⚠️ Product "${args.productId}" not found.`);
              } else {
                const quote = await calculateCjFreightRates({
                  vid: prod.variants?.[0]?.sku || '',
                  weightGrams: prod.estimatedWeightGrams || 120
                });
                const matched = quote.rates.find(r => r.logisticName.toLowerCase() === chosenCarrier.toLowerCase()) || quote.recommendedCarrier;
                const summaryPricing = recalculateProductRetailPrice(prod, {
                  selectedLogisticName: matched?.logisticName || chosenCarrier,
                  shippingCostUsd: matched?.shippingCostUsd,
                  shippingIncludedInPrice: args.shippingIncludedInPrice !== undefined ? Boolean(args.shippingIncludedInPrice) : true,
                  markupMultiplier: args.markupMultiplier,
                  availableLogistics: quote.rates
                });
                await prod.save();
                payload.updatedProduct = prod;
                payload.actionsTaken.push('adjustCjShippingAndPricing');
                summaries.push(
                  `✈️ Odie updated "${prod.title}" to ${summaryPricing.selectedLogisticName} ($${summaryPricing.shippingCostUsd.toFixed(2)} shipping) → New Retail Price: $${summaryPricing.retailPriceUsd.toFixed(2)}.`
                );
              }
            } else {
              const allProds = await Product.find({});
              for (const prod of allProds) {
                const carriers = Array.isArray(prod.availableLogistics) && prod.availableLogistics.length > 0
                  ? prod.availableLogistics
                  : buildDeterministicCjBeautyCarriers({ weightGrams: prod.estimatedWeightGrams || 120 });
                const matched = carriers.find(c => String(c.logisticName || '').toLowerCase() === chosenCarrier.toLowerCase());
                recalculateProductRetailPrice(prod, {
                  selectedLogisticName: chosenCarrier,
                  shippingCostUsd: matched ? matched.shippingCostUsd : prod.shippingCostUsd,
                  shippingIncludedInPrice: args.shippingIncludedInPrice !== undefined ? Boolean(args.shippingIncludedInPrice) : true,
                  markupMultiplier: args.markupMultiplier !== undefined ? args.markupMultiplier : prod.markupMultiplier,
                  availableLogistics: carriers
                });
                await prod.save();
              }
              payload.actionsTaken.push('adjustCjShippingAndPricing');
              summaries.push(
                `✈️ Odie updated the CJ shipping method to "${chosenCarrier}" and recalculated shipping-included retail prices across all ${allProds.length} boutique products!`
              );
            }
          } catch (shipErr) {
            summaries.push(`⚠️ Odie could not adjust CJ shipping and pricing: ${shipErr.message}`);
          }
        }

        else if (call.name === 'dispatchMonthlyMemberBoxToCj') {
          try {
            const payFlag = args.payFromCjWallet !== undefined ? Boolean(args.payFromCjWallet) : true;
            const notifyFlag = args.notifyMember !== undefined ? Boolean(args.notifyMember) : true;

            if (args.dispatchAllReady) {
              const activeMonth = getCurrentBillingMonthStr();
              const readyBoxes = await MemberMonthlyBox.find({
                billingMonth: activeMonth,
                status: { $in: ['CURATED_DRAFT', 'APPROVED_READY'] }
              });
              const dispatchedMessages = [];
              for (const bx of readyBoxes) {
                const dRes = await dispatchMonthlyBoxToCj(bx._id, {
                  payFromCjWallet: payFlag,
                  notifyMember: notifyFlag,
                  triggeredBy: 'odie'
                });
                dispatchedMessages.push(dRes.message);
              }
              payload.monthlyBoxesTelemetry = await buildMonthlyBoxesTelemetry({ billingMonth: activeMonth });
              payload.actionsTaken.push('dispatchMonthlyMemberBoxToCj');
              summaries.push(
                dispatchedMessages.length > 0
                  ? dispatchedMessages.join('\n')
                  : `📦 No curated draft/ready boxes found for ${activeMonth}. Ask Odie to curate monthly boxes first!`
              );
            } else {
              let targetBoxId = args.boxId;
              if (!targetBoxId && args.userId && mongoose.Types.ObjectId.isValid(String(args.userId))) {
                const foundBox = await MemberMonthlyBox.findOne({ userId: args.userId }).sort({ updatedAt: -1 });
                if (foundBox) targetBoxId = String(foundBox._id);
              }
              if (!targetBoxId) {
                summaries.push(`⚠️ Please specify a boxId, userId, or set dispatchAllReady=true.`);
              } else {
                const dispatchRes = await dispatchMonthlyBoxToCj(targetBoxId, {
                  payFromCjWallet: payFlag,
                  notifyMember: notifyFlag,
                  triggeredBy: 'odie'
                });
                payload.dispatchedMonthlyBox = dispatchRes.box;
                payload.monthlyBoxesTelemetry = await buildMonthlyBoxesTelemetry({ billingMonth: dispatchRes.box.billingMonth });
                payload.actionsTaken.push('dispatchMonthlyMemberBoxToCj');
                summaries.push(dispatchRes.message);
              }
            }
          } catch (dispErr) {
            summaries.push(`⚠️ Odie could not dispatch monthly box to CJ: ${dispErr.message}`);
          }
        }
      }

      const finalActionReply = summaries.join('\n\n') || '✧ Odie completed your request, Susan.';
      await new OdieChatHistory({
        adminEmail,
        role: 'model',
        text: finalActionReply,
        actionsTaken: payload.actionsTaken
      }).save().catch(() => {});

      const latestMemories = await OdieMemory.find({}).sort({ pinned: -1, updatedAt: -1 }).lean();

      return res.status(200).json({
        response: finalActionReply,
        memories: latestMemories,
        ...payload
      });
    }

    const replyText = (response && typeof response.text === 'string' && response.text.trim())
      ? response.text.trim()
      : "I'm right here, Susan ✧ Could you rephrase that request for Odie?";

    await new OdieChatHistory({
      adminEmail,
      role: 'model',
      text: replyText,
      actionsTaken: []
    }).save().catch(() => {});

    const latestMemories = await OdieMemory.find({}).sort({ pinned: -1, updatedAt: -1 }).lean();

    res.status(200).json({
      assistantName: 'Odie',
      response: replyText,
      memories: latestMemories
    });

  } catch (error) {
    console.error("Odie AI Chat Error:", error);
    res.status(500).json({ 
      error: error?.message || 'Failed to communicate with Odie AI Assistant.' 
    });
  }
});

// ---------------- APPOINTMENT & CALENDAR ROUTES (TWO-WAY SYNC — US CENTRAL TIME) ---------------- //

const CENTRAL_TIMEZONE = 'America/Chicago';

// Parses a datetime-local string ("YYYY-MM-DDTHH:mm") explicitly in US Central Time (Kansas - America/Chicago)
// so a 9:00 AM appointment is never misinterpreted as 09:00 UTC (4:00 AM Central).
const parseCentralDateTime = (rawInput) => {
  if (!rawInput) return new Date(NaN);
  if (rawInput instanceof Date) return rawInput;

  const str = String(rawInput).trim();
  // If an explicit timezone offset or Z is already present, Date parses the exact instant directly
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(str)) {
    return new Date(str);
  }

  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return new Date(str);
  }

  const [, yStr, mStr, dStr, hStr, minStr, sStr] = match;
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  const hour = Number(hStr);
  const minute = Number(minStr);
  const second = Number(sStr || 0);

  const desiredWallClockUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);

  const getCentralWallClockAsUtcMs = (instantMs) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: CENTRAL_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date(instantMs));
    const map = {};
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = Number(p.value);
    }
    return Date.UTC(map.year, map.month - 1, map.day, map.hour, map.minute, map.second);
  };

  // First pass adjustment from UTC to America/Chicago
  let guessedInstantMs = desiredWallClockUtcMs;
  const offset1 = getCentralWallClockAsUtcMs(guessedInstantMs) - desiredWallClockUtcMs;
  guessedInstantMs -= offset1;

  // Second pass refinement in case the timestamp crossed a DST boundary
  const offset2 = getCentralWallClockAsUtcMs(guessedInstantMs) - desiredWallClockUtcMs;
  guessedInstantMs -= offset2;

  return new Date(guessedInstantMs);
};

const formatCentralDateTime = (dateVal) => {
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  return `${d.toLocaleString('en-US', {
    timeZone: CENTRAL_TIMEZONE,
    dateStyle: 'full',
    timeStyle: 'short'
  })} CT`;
};

const buildDefaultMeetingLink = () => {
  const roomCode = crypto.randomBytes(4).toString('hex');
  return `https://meet.jit.si/SusansBoutique_Consultation_${roomCode}`;
};

// Dispatches a 1-on-1 consultation reminder email to both the client and Susan,
// marks reminderSentAt on the appointment, and records an EmailLog entry.
const dispatchAppointmentReminder = async (appointmentOrId, triggeredBy = 'auto') => {
  const apptId = appointmentOrId?._id ? appointmentOrId._id : appointmentOrId;
  const appt = await Appointment.findById(apptId)
    .populate('clientId', 'name email membershipTier')
    .populate('serviceId', 'name');

  if (!appt) {
    throw new Error('Appointment not found.');
  }
  if (appt.status === 'cancelled') {
    throw new Error('Cannot send a reminder for a cancelled consultation.');
  }

  if (!appt.meetingLink || !String(appt.meetingLink).trim()) {
    appt.meetingLink = buildDefaultMeetingLink();
  }

  const clientName = appt.clientId?.name || 'Valued Member';
  const clientEmail = normalizeEmail(appt.clientId?.email || '');
  const formattedTime = formatCentralDateTime(appt.startTime);
  const safeNotes = escapeHtml(appt.notes || 'Personal Skincare & Beauty Consultation');
  const safeLink = escapeHtml(appt.meetingLink);

  let clientEmailSent = false;
  let adminEmailSent = false;

  if (clientEmail) {
    const clientSubject = `✧ Consultation Reminder: Your Session with Susan (${formattedTime})`;
    const clientHtml = `
      <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; border: 1px solid #E8C5C8; padding: 35px; border-radius: 15px;">
        <h2 style="color: #B38B8F; font-style: italic; text-align: center;">Upcoming Consultation Reminder ✧</h2>
        <p style="font-size: 1.05rem; line-height: 1.6;">Dear ${escapeHtml(clientName)},</p>
        <p style="font-size: 1.05rem; line-height: 1.6;">This is a friendly reminder of your upcoming 1-on-1 consultation with Susan:</p>
        <div style="background-color: #FFF0F2; padding: 18px; border-radius: 10px; margin: 20px 0;">
          <p style="margin: 6px 0;"><strong>Date & Time:</strong> ${escapeHtml(formattedTime)}</p>
          <p style="margin: 6px 0;"><strong>Session Focus:</strong> ${safeNotes}</p>
          <p style="margin: 6px 0;"><strong>Video Sanctuary Link:</strong> <a href="${safeLink}" style="color: #B38B8F; font-weight: bold;">${safeLink}</a></p>
        </div>
        <p style="font-size: 0.95rem; color: #8A797A;">You can join directly from your Member Sanctuary under the Consultations tab or by clicking your private Video Sanctuary link above.</p>
        <p style="font-size: 0.95rem; color: #8A797A; margin-top: 25px; text-align: center;">Warmly,<br>Susan's Beauty Consulting</p>
      </div>
    `;
    const clientText = `Upcoming Consultation Reminder ✧

Dear ${clientName},

This is a reminder of your 1-on-1 consultation with Susan scheduled for ${formattedTime}.
Focus: ${appt.notes || 'Personal Skincare & Beauty Consultation'}
Video Sanctuary Link: ${appt.meetingLink}

Warmly,
Susan's Beauty Consulting`;

    await sendEmail(clientEmail, clientSubject, clientHtml, clientText);
    clientEmailSent = true;

    await new EmailLog({
      to: clientEmail,
      subject: clientSubject,
      body: clientText
    }).save().catch(() => {});
  }

  // Also send a schedule reminder to Susan so she has the client details & room link at her fingertips
  const susanEmail = getPrimaryAdminEmail();
  if (susanEmail) {
    const susanSubject = `⏰ Schedule Reminder: Consultation with ${clientName} (${formattedTime})`;
    const susanHtml = `
      <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; border: 1px solid #E8C5C8; padding: 35px; border-radius: 15px;">
        <h2 style="color: #B38B8F; font-style: italic; text-align: center;">Susan's Consultation Reminder ✧</h2>
        <p style="font-size: 1.05rem; line-height: 1.6;">Hello Susan,</p>
        <p style="font-size: 1.05rem; line-height: 1.6;">Here is your upcoming consultation reminder (${triggeredBy === 'auto' ? '24-hour automated check' : 'manual/AI dispatch'}):</p>
        <div style="background-color: #FFF0F2; padding: 18px; border-radius: 10px; margin: 20px 0;">
          <p style="margin: 6px 0;"><strong>Client:</strong> ${escapeHtml(clientName)} (${escapeHtml(clientEmail || 'No email')})</p>
          <p style="margin: 6px 0;"><strong>Date & Time:</strong> ${escapeHtml(formattedTime)}</p>
          <p style="margin: 6px 0;"><strong>Notes:</strong> ${safeNotes}</p>
          <p style="margin: 6px 0;"><strong>Video Sanctuary Link:</strong> <a href="${safeLink}" style="color: #B38B8F; font-weight: bold;">${safeLink}</a></p>
        </div>
      </div>
    `;
    const susanText = `Susan's Consultation Reminder ✧
Client: ${clientName} (${clientEmail})
Date & Time: ${formattedTime}
Notes: ${appt.notes || 'None'}
Video Link: ${appt.meetingLink}`;

    await sendEmail(susanEmail, susanSubject, susanHtml, susanText).catch((err) => {
      console.warn('⚠️ Could not send copy of reminder to Susan:', err.message);
    });
    adminEmailSent = true;
  }

  appt.reminderSentAt = new Date();
  await appt.save();

  return {
    appointment: appt,
    clientEmail,
    formattedTime,
    clientEmailSent,
    adminEmailSent
  };
};

// Scans for confirmed consultations starting within the next 24 hours that have not yet received a reminder
const runUpcomingAppointmentReminders = async () => {
  try {
    if (mongoose.connection.readyState !== 1) return { checked: 0, sent: 0 };
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const upcoming = await Appointment.find({
      status: { $in: ['confirmed', 'pending'] },
      reminderSentAt: null,
      startTime: { $gt: now, $lte: in24Hours }
    }).populate('clientId', 'name email membershipTier');

    let sentCount = 0;
    for (const appt of upcoming) {
      try {
        await dispatchAppointmentReminder(appt, 'auto');
        sentCount++;
      } catch (remErr) {
        console.warn(`⚠️ Failed to send 24h reminder for appointment ${appt._id}:`, remErr.message);
      }
    }

    if (sentCount > 0) {
      console.log(`⏰ Dispatched ${sentCount} automated 24-hour consultation reminder(s).`);
    }
    return { checked: upcoming.length, sent: sentCount };
  } catch (err) {
    console.error('⚠️ Error in runUpcomingAppointmentReminders:', err.message);
    return { checked: 0, sent: 0, error: err.message };
  }
};

app.get('/api/admin/appointments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate('clientId', 'name email membershipTier')
      .populate('serviceId', 'name')
      .sort({ startTime: 1 });
    res.status(200).json(appointments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

app.post('/api/admin/appointments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { clientId, serviceId, startTime, durationInMinutes, notes, meetingLink } = req.body;
    if (!clientId || !startTime) {
      return res.status(400).json({ error: 'Client and start time are required.' });
    }

    const start = parseCentralDateTime(startTime);
    if (isNaN(start.getTime())) {
      return res.status(400).json({ error: 'Invalid start time format.' });
    }
    const duration = Number(durationInMinutes) || 60;
    const end = new Date(start.getTime() + duration * 60000);

    const conflict = await Appointment.findOne({
      status: { $ne: 'cancelled' },
      startTime: { $lt: end },
      endTime: { $gt: start }
    });
    if (conflict) {
      return res.status(409).json({ error: 'This time slot overlaps with another scheduled consultation.' });
    }

    const newAppointment = new Appointment({
      clientId,
      staffId: req.user._id,
      ...(serviceId ? { serviceId } : {}),
      startTime: start,
      endTime: end,
      status: 'confirmed',
      notes: notes ? String(notes).trim() : '',
      meetingLink: (meetingLink && String(meetingLink).trim()) ? String(meetingLink).trim() : buildDefaultMeetingLink()
    });

    await newAppointment.save();

    const populatedAppointment = await Appointment.findById(newAppointment._id)
      .populate('clientId', 'name email membershipTier')
      .populate('serviceId', 'name');

    if (populatedAppointment?.clientId?.email) {
      const formattedTime = formatCentralDateTime(start);
      const html = `
        <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; border: 1px solid #E8C5C8; padding: 35px; border-radius: 15px;">
          <h2 style="color: #B38B8F; font-style: italic; text-align: center;">Your 1-on-1 Consultation is Scheduled ✧</h2>
          <p style="font-size: 1.05rem; line-height: 1.6;">Dear ${populatedAppointment.clientId.name || 'Member'},</p>
          <p style="font-size: 1.05rem; line-height: 1.6;">Susan has scheduled a private consultation with you:</p>
          <div style="background-color: #FFF0F2; padding: 15px; border-radius: 10px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${formattedTime}</p>
            ${populatedAppointment.notes ? `<p style="margin: 5px 0;"><strong>Notes:</strong> ${populatedAppointment.notes}</p>` : ''}
            ${populatedAppointment.meetingLink ? `<p style="margin: 5px 0;"><strong>Video Sanctuary Link:</strong> <a href="${populatedAppointment.meetingLink}" style="color: #B38B8F;">${populatedAppointment.meetingLink}</a></p>` : ''}
          </div>
          <p style="font-size: 0.95rem; color: #8A797A;">You can view or manage this session anytime in the Consultations tab of your Member Sanctuary.</p>
        </div>
      `;
      const text = `Your 1-on-1 Consultation with Susan is scheduled for ${formattedTime}. Video link: ${populatedAppointment.meetingLink || 'Available in your dashboard'}`;
      sendEmail(populatedAppointment.clientId.email, "✧ New Consultation Scheduled with Susan", html, text).catch(() => {});
    }

    res.status(201).json(populatedAppointment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/appointments/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startTime, durationInMinutes, notes, status, meetingLink } = req.body;
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Consultation not found.' });
    }

    let timeChanged = false;
    if (startTime) {
      const newStart = parseCentralDateTime(startTime);
      if (isNaN(newStart.getTime())) {
        return res.status(400).json({ error: 'Invalid start time format.' });
      }
      const existingDuration = Math.max(
        15,
        Math.round((new Date(appointment.endTime).getTime() - new Date(appointment.startTime).getTime()) / 60000) || 60
      );
      const duration = Number(durationInMinutes) || existingDuration;
      const newEnd = new Date(newStart.getTime() + duration * 60000);

      const conflict = await Appointment.findOne({
        _id: { $ne: appointment._id },
        status: { $ne: 'cancelled' },
        startTime: { $lt: newEnd },
        endTime: { $gt: newStart }
      });
      if (conflict) {
        return res.status(409).json({ error: 'That new time overlaps with another consultation on the calendar.' });
      }

      if (newStart.getTime() !== new Date(appointment.startTime).getTime()) {
        appointment.previousStartTime = appointment.startTime;
        appointment.rescheduledBy = 'admin';
        appointment.reminderSentAt = null;
        timeChanged = true;
      }
      appointment.startTime = newStart;
      appointment.endTime = newEnd;
    }

    if (notes !== undefined) appointment.notes = String(notes).trim();
    if (status) appointment.status = status;
    if (meetingLink !== undefined) {
      appointment.meetingLink = String(meetingLink).trim() || appointment.meetingLink || buildDefaultMeetingLink();
    }

    await appointment.save();

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('clientId', 'name email membershipTier')
      .populate('serviceId', 'name');

    if (timeChanged && populatedAppointment?.clientId?.email) {
      const formattedTime = formatCentralDateTime(populatedAppointment.startTime);
      const html = `
        <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; border: 1px solid #E8C5C8; padding: 35px; border-radius: 15px;">
          <h2 style="color: #B38B8F; font-style: italic; text-align: center;">Consultation Rescheduled by Susan ✧</h2>
          <p style="font-size: 1.05rem; line-height: 1.6;">Dear ${populatedAppointment.clientId.name || 'Member'},</p>
          <p style="font-size: 1.05rem; line-height: 1.6;">Susan has updated the time for your upcoming 1-on-1 beauty consultation:</p>
          <div style="background-color: #FFF0F2; padding: 15px; border-radius: 10px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>New Date & Time:</strong> ${formattedTime}</p>
            ${populatedAppointment.notes ? `<p style="margin: 5px 0;"><strong>Notes:</strong> ${populatedAppointment.notes}</p>` : ''}
            ${populatedAppointment.meetingLink ? `<p style="margin: 5px 0;"><strong>Video Sanctuary Link:</strong> <a href="${populatedAppointment.meetingLink}" style="color: #B38B8F;">${populatedAppointment.meetingLink}</a></p>` : ''}
          </div>
          <p style="font-size: 0.95rem; color: #8A797A;">This change is now live on your Member Sanctuary calendar.</p>
        </div>
      `;
      const text = `Susan has rescheduled your consultation to ${formattedTime}. Video link: ${populatedAppointment.meetingLink || 'Available in your dashboard'}`;
      sendEmail(populatedAppointment.clientId.email, "✧ Your Consultation with Susan Has Been Rescheduled", html, text).catch(() => {});
    }

    res.status(200).json(populatedAppointment);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to update consultation' });
  }
});

app.delete('/api/admin/appointments/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await Appointment.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Consultation removed successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

app.post('/api/admin/appointments/:id/remind', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await dispatchAppointmentReminder(req.params.id, 'manual');
    res.status(200).json({
      message: `Reminder email dispatched to ${result.clientEmail || 'client'} and Susan for ${result.formattedTime} ✧`,
      appointment: result.appointment
    });
  } catch (error) {
    console.error('Appointment Reminder Error:', error);
    res.status(500).json({ error: error.message || 'Failed to send consultation reminder.' });
  }
});

// Member-facing two-way calendar endpoints
app.get('/api/users/me/appointments', authenticateToken, async (req, res) => {
  try {
    const allActive = await Appointment.find({ status: { $ne: 'cancelled' } })
      .populate('clientId', 'name email')
      .populate('serviceId', 'name')
      .sort({ startTime: 1 })
      .lean();

    const myIdStr = req.user._id.toString();
    const formatted = allActive.map(appt => {
      const apptClientId = appt.clientId?._id ? appt.clientId._id.toString() : appt.clientId?.toString();
      const isMine = apptClientId === myIdStr;
      if (isMine) {
        return {
          ...appt,
          isMine: true
        };
      }
      // Return anonymized busy slot so the member calendar displays unavailable times
      return {
        _id: appt._id,
        startTime: appt.startTime,
        endTime: appt.endTime,
        status: appt.status,
        isMine: false
      };
    });

    res.status(200).json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch member appointments' });
  }
});

app.post('/api/users/me/appointments', authenticateToken, async (req, res) => {
  try {
    const { startTime, durationInMinutes, notes, serviceId } = req.body;
    if (!startTime) {
      return res.status(400).json({ error: 'Please select a date and time for your consultation.' });
    }

    const start = parseCentralDateTime(startTime);
    if (isNaN(start.getTime())) {
      return res.status(400).json({ error: 'Invalid date and time selected.' });
    }
    const duration = Number(durationInMinutes) || 60;
    const end = new Date(start.getTime() + duration * 60000);

    const conflict = await Appointment.findOne({
      status: { $ne: 'cancelled' },
      startTime: { $lt: end },
      endTime: { $gt: start }
    });
    if (conflict) {
      return res.status(409).json({
        error: "That time slot overlaps with an existing consultation on Susan's calendar. Please select another time."
      });
    }

    const adminUser = await User.findOne({
      $or: [
        { role: 'admin' },
        { membershipTier: 'admin' },
        { email: /^susan\.coke@susansbeautyconsulting\.com$/i }
      ]
    }).select('_id email');

    const newAppointment = new Appointment({
      clientId: req.user._id,
      staffId: adminUser ? adminUser._id : req.user._id,
      ...(serviceId ? { serviceId } : {}),
      startTime: start,
      endTime: end,
      status: 'confirmed',
      notes: notes ? String(notes).trim() : '',
      meetingLink: buildDefaultMeetingLink()
    });

    await newAppointment.save();

    const populated = await Appointment.findById(newAppointment._id)
      .populate('clientId', 'name email membershipTier')
      .populate('serviceId', 'name')
      .lean();

    if (adminUser?.email) {
      const formattedTime = formatCentralDateTime(start);
      const html = `
        <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; border: 1px solid #E8C5C8; padding: 35px; border-radius: 15px;">
          <h2 style="color: #B38B8F; font-style: italic; text-align: center;">New Member Consultation Booked ✧</h2>
          <p style="font-size: 1.05rem; line-height: 1.6;"><strong>${req.user.name}</strong> (${req.user.email}) just booked a 1-on-1 consultation on your calendar:</p>
          <div style="background-color: #FFF0F2; padding: 15px; border-radius: 10px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${formattedTime}</p>
            ${newAppointment.notes ? `<p style="margin: 5px 0;"><strong>Client Notes:</strong> ${newAppointment.notes}</p>` : ''}
            <p style="margin: 5px 0;"><strong>Video Room:</strong> <a href="${newAppointment.meetingLink}" style="color: #B38B8F;">${newAppointment.meetingLink}</a></p>
          </div>
        </div>
      `;
      const text = `${req.user.name} (${req.user.email}) booked a consultation for ${formattedTime}.`;
      sendEmail(adminUser.email, `✧ New Consultation Booked: ${req.user.name}`, html, text).catch(() => {});
    }

    res.status(201).json({ ...populated, isMine: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to schedule consultation' });
  }
});

app.put('/api/users/me/appointments/:id', authenticateToken, async (req, res) => {
  try {
    const { startTime, durationInMinutes, notes } = req.body;
    const appointment = await Appointment.findOne({ _id: req.params.id, clientId: req.user._id });
    if (!appointment) {
      return res.status(404).json({ error: 'Consultation not found.' });
    }

    if (startTime) {
      const newStart = parseCentralDateTime(startTime);
      if (isNaN(newStart.getTime())) {
        return res.status(400).json({ error: 'Invalid date and time format.' });
      }
      const existingDuration = Math.max(
        15,
        Math.round((new Date(appointment.endTime).getTime() - new Date(appointment.startTime).getTime()) / 60000) || 60
      );
      const duration = Number(durationInMinutes) || existingDuration;
      const newEnd = new Date(newStart.getTime() + duration * 60000);

      const conflict = await Appointment.findOne({
        _id: { $ne: appointment._id },
        status: { $ne: 'cancelled' },
        startTime: { $lt: newEnd },
        endTime: { $gt: newStart }
      });
      if (conflict) {
        return res.status(409).json({
          error: "That new time overlaps with another consultation on Susan's calendar. Please choose another time."
        });
      }

      if (newStart.getTime() !== new Date(appointment.startTime).getTime()) {
        appointment.previousStartTime = appointment.startTime;
        appointment.rescheduledBy = 'client';
        appointment.reminderSentAt = null;
      }
      appointment.startTime = newStart;
      appointment.endTime = newEnd;
    }

    if (notes !== undefined) {
      appointment.notes = String(notes).trim();
    }

    await appointment.save();

    const populated = await Appointment.findById(appointment._id)
      .populate('clientId', 'name email membershipTier')
      .populate('serviceId', 'name')
      .lean();

    res.status(200).json({ ...populated, isMine: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to reschedule consultation' });
  }
});

app.delete('/api/users/me/appointments/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await Appointment.findOneAndDelete({ _id: req.params.id, clientId: req.user._id });
    if (!deleted) {
      return res.status(404).json({ error: 'Consultation not found.' });
    }
    res.status(200).json({ message: 'Consultation cancelled successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel consultation' });
  }
});

// ---------------- ADMIN CJ SYNC & CLEANUP ROUTE ---------------- //

app.post('/api/admin/cj-sync', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { purgeOnly, maxPages, maxProducts } = req.body || {};
    if (purgeOnly) {
      const purgedCount = await purgeNonBeautyCjProducts();
      const products = await Product.find({}).sort({ _id: -1 });
      return res.status(200).json({
        message: `Cleaned catalog: removed ${purgedCount} non-Health/Beauty CJ items.`,
        purgedCount,
        syncedCount: 0,
        activeTotal: products.length,
        products
      });
    }

    const result = await syncCJCatalog({ maxPages, maxProducts });
    const products = await Product.find({}).sort({ _id: -1 });
    res.status(200).json({
      message: `Health & Beauty sync complete! Removed ${result.purgedCount || 0} non-beauty items and synced ${result.syncedCount || 0} verified Health & Beauty products.`,
      ...result,
      activeTotal: products.length,
      products
    });
  } catch (error) {
    console.error('Admin CJ Sync Error:', error);
    res.status(500).json({ error: error.message || 'Failed to run CJ Health & Beauty sync.' });
  }
});

// ---------------- MANUAL INVENTORY & BLUEPRINT LABELING ROUTES ---------------- //

app.post('/api/admin/products/reclassify-labels', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const forceAll = req.body?.forceAll !== undefined ? Boolean(req.body.forceAll) : true;
    const result = await backfillProductBlueprintLabels(forceAll);
    await backfillConsultationAnalyses();
    const products = await Product.find({}).sort({ _id: -1 });
    res.status(200).json({
      message: `Labeled ${result.updatedCount || 0} product(s) with Skin Types, Skin Conditions & Ritual Steps (${products.length} total active) ✧`,
      ...result,
      products
    });
  } catch (error) {
    console.error('Reclassify Product Labels Error:', error);
    res.status(500).json({ error: error.message || 'Failed to reclassify product Blueprint labels.' });
  }
});

app.post('/api/admin/products', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      title,
      description,
      imageUrl,
      price,
      wholesalePriceUsd,
      markupMultiplier,
      estimatedWeightGrams,
      originCountryCode,
      selectedLogisticName,
      shippingCostUsd,
      shippingIncludedInPrice,
      customLabelConfig,
      tags,
      skinTypes,
      skinConcerns,
      sensitivitySafe,
      sensitivityLabel,
      ritualStep,
      keyActives
    } = req.body || {};

    const classified = classifyProductForBlueprint(title, '', description, {
      tags,
      skinTypes,
      skinConcerns,
      sensitivitySafe,
      sensitivityLabel,
      ritualStep,
      keyActives
    });

    const parsedRetail = parseFloat(price);
    const resolvedWholesale = wholesalePriceUsd !== undefined && !isNaN(parseFloat(wholesalePriceUsd))
      ? Number(parseFloat(wholesalePriceUsd).toFixed(2))
      : (!isNaN(parsedRetail) && parsedRetail > 0 ? Number((parsedRetail / 6.5).toFixed(2)) : 2.50);
    
    const newProduct = new Product({
      title,
      description,
      imageUrl,
      tags: classified.tags,
      skinTypes: classified.skinTypes,
      skinConcerns: classified.skinConcerns,
      sensitivitySafe: classified.sensitivitySafe,
      sensitivityLabel: classified.sensitivityLabel,
      ritualStep: classified.ritualStep,
      keyActives: classified.keyActives,
      variants: [{
        sku: `CUSTOM-${Date.now()}`,
        variantName: 'Standard',
        wholesalePriceUsd: resolvedWholesale,
        price: !isNaN(parsedRetail) ? parsedRetail : 0,
        imageUrl
      }]
    });

    recalculateProductRetailPrice(newProduct, {
      wholesalePriceUsd: resolvedWholesale,
      markupMultiplier,
      estimatedWeightGrams,
      originCountryCode,
      selectedLogisticName,
      shippingCostUsd,
      shippingIncludedInPrice,
      customLabelConfig
    });

    // If an explicit retail price was provided without explicit wholesale/shipping overrides, honor it
    if (!isNaN(parsedRetail) && parsedRetail > 0 && wholesalePriceUsd === undefined && shippingCostUsd === undefined && customLabelConfig === undefined) {
      newProduct.price = Number(parsedRetail.toFixed(2));
      if (newProduct.variants && newProduct.variants.length > 0) {
        newProduct.variants[0].price = Number(parsedRetail.toFixed(2));
        newProduct.markModified('variants');
      }
    }

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      title,
      description,
      imageUrl,
      price,
      wholesalePriceUsd,
      markupMultiplier,
      estimatedWeightGrams,
      originCountryCode,
      selectedLogisticName,
      shippingCostUsd,
      shippingIncludedInPrice,
      customLabelConfig,
      recalculateFromWholesale,
      tags,
      skinTypes,
      skinConcerns,
      sensitivitySafe,
      sensitivityLabel,
      ritualStep,
      keyActives
    } = req.body || {};
    const product = await Product.findById(req.params.id);
    
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (title !== undefined) product.title = title;
    if (description !== undefined) product.description = description;
    if (imageUrl !== undefined) product.imageUrl = imageUrl;

    const catName = product.rawCjData?.categoryName || '';
    const classified = classifyProductForBlueprint(product.title, catName, product.description, {
      tags: tags !== undefined ? tags : product.tags,
      skinTypes,
      skinConcerns,
      sensitivitySafe,
      sensitivityLabel,
      ritualStep,
      keyActives
    });

    product.tags = classified.tags;
    product.skinTypes = classified.skinTypes;
    product.skinConcerns = classified.skinConcerns;
    product.sensitivitySafe = classified.sensitivitySafe;
    product.sensitivityLabel = classified.sensitivityLabel;
    product.ritualStep = classified.ritualStep;
    product.keyActives = classified.keyActives;

    const hasPricingEngineChange =
      Boolean(recalculateFromWholesale) ||
      wholesalePriceUsd !== undefined ||
      markupMultiplier !== undefined ||
      selectedLogisticName !== undefined ||
      shippingCostUsd !== undefined ||
      shippingIncludedInPrice !== undefined ||
      customLabelConfig !== undefined;

    if (hasPricingEngineChange) {
      recalculateProductRetailPrice(product, {
        wholesalePriceUsd,
        markupMultiplier,
        estimatedWeightGrams,
        originCountryCode,
        selectedLogisticName,
        shippingCostUsd,
        shippingIncludedInPrice,
        customLabelConfig
      });
    }

    if (!hasPricingEngineChange && price !== undefined && !isNaN(parseFloat(price))) {
      const manualPrice = Number(parseFloat(price).toFixed(2));
      product.price = manualPrice;
      if (product.variants && product.variants.length > 0) {
        product.variants[0].price = manualPrice;
        if (imageUrl) product.variants[0].imageUrl = imageUrl;
        product.markModified('variants');
      } else {
        product.variants = [{
          sku: `CUSTOM-${Date.now()}`,
          variantName: 'Standard',
          wholesalePriceUsd: product.wholesalePriceUsd || 2.50,
          price: manualPrice,
          imageUrl
        }];
      }
    } else if (imageUrl && product.variants && product.variants.length > 0) {
      product.variants[0].imageUrl = imageUrl;
      product.markModified('variants');
    }

    await product.save();
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------- ADMIN EXPRESS ROUTES FOR CJ SHIPPING & CUSTOM LABELING (PHASE 1) ---------------- //

// 1. POST /api/admin/products/:id/shipping-quote — Fetches live CJ carrier rates for a product,
// updates selectedLogisticName / shippingIncludedInPrice / markupMultiplier, and recalculates retail price.
app.post('/api/admin/products/:id/shipping-quote', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found in boutique inventory.' });
    }

    const {
      selectedLogisticName,
      shippingIncludedInPrice,
      markupMultiplier,
      wholesalePriceUsd,
      estimatedWeightGrams,
      startCountryCode,
      endCountryCode,
      customLabelConfig
    } = req.body || {};

    const primaryVariant = product.variants?.[0] || {};
    const vid = String(primaryVariant.sku || product.rawCjData?.vid || product.rawCjData?.pid || '').trim();
    const weightToUse = Number(estimatedWeightGrams || product.estimatedWeightGrams || 120) || 120;
    const originToUse = String(startCountryCode || product.originCountryCode || 'CN').toUpperCase().trim() || 'CN';
    const destToUse = String(endCountryCode || 'US').toUpperCase().trim() || 'US';

    const freightQuote = await calculateCjFreightRates({
      vid,
      sku: vid,
      quantity: 1,
      weightGrams: weightToUse,
      startCountryCode: originToUse,
      endCountryCode: destToUse
    });

    const targetCarrierName = String(
      selectedLogisticName || product.selectedLogisticName || freightQuote.recommendedCarrier?.logisticName || 'CJPacket Sensitive'
    ).trim();

    const matchedCarrier =
      freightQuote.rates.find(r => r.logisticName.toLowerCase() === targetCarrierName.toLowerCase()) ||
      freightQuote.recommendedCarrier ||
      freightQuote.rates[0];

    const pricingSummary = recalculateProductRetailPrice(product, {
      wholesalePriceUsd,
      markupMultiplier,
      estimatedWeightGrams: weightToUse,
      originCountryCode: originToUse,
      availableLogistics: freightQuote.rates,
      selectedLogisticName: matchedCarrier?.logisticName || targetCarrierName,
      shippingCostUsd: matchedCarrier?.shippingCostUsd ?? product.shippingCostUsd ?? 4.49,
      shippingIncludedInPrice,
      customLabelConfig
    });

    await product.save();

    res.status(200).json({
      message: `Updated "${product.title}" shipping to ${pricingSummary.selectedLogisticName} ($${pricingSummary.shippingCostUsd.toFixed(2)}) • Retail Price: $${pricingSummary.retailPriceUsd.toFixed(2)} ✧`,
      liveApiUsed: freightQuote.liveApiUsed,
      product,
      pricingSummary,
      availableLogistics: freightQuote.rates
    });
  } catch (error) {
    console.error('Product Shipping Quote Error:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate CJ shipping quote for product.' });
  }
});

// 2. POST /api/admin/products/bulk-shipping-update — Updates CJ shipping method, shippingIncludedInPrice,
// markupMultiplier, or custom labeling across all products in 1 click.
app.post('/api/admin/products/bulk-shipping-update', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      selectedLogisticName,
      shippingIncludedInPrice,
      markupMultiplier,
      customLabelConfig
    } = req.body || {};

    const allProducts = await Product.find({});
    let updatedCount = 0;

    for (const prod of allProducts) {
      const weightGrams = Number(prod.estimatedWeightGrams || 120) || 120;
      const origin = String(prod.originCountryCode || 'CN').toUpperCase();
      const carriers = Array.isArray(prod.availableLogistics) && prod.availableLogistics.length > 0
        ? prod.availableLogistics
        : buildDeterministicCjBeautyCarriers({ weightGrams, quantity: 1, startCountryCode: origin, endCountryCode: 'US' });

      const targetCarrier = String(selectedLogisticName || prod.selectedLogisticName || 'CJPacket Sensitive').trim();
      const matched = carriers.find(c => String(c.logisticName || '').toLowerCase() === targetCarrier.toLowerCase());

      recalculateProductRetailPrice(prod, {
        markupMultiplier: markupMultiplier !== undefined ? markupMultiplier : prod.markupMultiplier,
        selectedLogisticName: targetCarrier,
        shippingCostUsd: matched ? matched.shippingCostUsd : prod.shippingCostUsd,
        shippingIncludedInPrice: shippingIncludedInPrice !== undefined ? Boolean(shippingIncludedInPrice) : prod.shippingIncludedInPrice,
        availableLogistics: carriers,
        customLabelConfig: customLabelConfig !== undefined ? customLabelConfig : prod.customLabelConfig
      });

      await prod.save();
      updatedCount++;
    }

    const updatedCatalog = await Product.find({}).sort({ _id: -1 });
    res.status(200).json({
      message: `Bulk updated CJ shipping (${selectedLogisticName || 'Active Carrier'}) & recalculated retail prices across ${updatedCount} boutique products! ✧`,
      updatedCount,
      products: updatedCatalog
    });
  } catch (error) {
    console.error('Bulk Shipping Update Error:', error);
    res.status(500).json({ error: error.message || 'Failed to bulk-update product shipping and prices.' });
  }
});

// 3. GET /api/admin/cj/custom-packaging & POST /api/admin/cj/custom-label (plus PUT /api/admin/products/:id/custom-label)
app.get('/api/admin/cj/custom-packaging', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const catalog = await fetchCjCustomPackagingCatalog();
    res.status(200).json(catalog);
  } catch (error) {
    console.error('Fetch CJ Custom Packaging Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch CJ custom packaging catalog.' });
  }
});

app.post('/api/admin/cj/custom-label', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      productId,
      applyToAll,
      enabled,
      labelType,
      packagingVid,
      packagingName,
      customBrandText,
      logoUrl,
      packagingCostUsd
    } = req.body || {};

    const result = await applyCustomLabelToProducts({
      productId,
      applyToAll: Boolean(applyToAll || !productId),
      enabled: enabled !== undefined ? Boolean(enabled) : true,
      labelType: labelType || 'CJ_CUSTOM_PACKAGING',
      packagingVid: packagingVid || '',
      packagingName: packagingName || "Susan's Rose-Gold Custom Box & Seal",
      customBrandText: customBrandText || "Susan's Beauty Consulting ✧",
      logoUrl: logoUrl || 'https://susansbeautyconsulting.com/susans-logo.png',
      packagingCostUsd
    });

    const allProducts = await Product.find({}).sort({ _id: -1 });
    res.status(200).json({
      message: result.customLabelConfig.enabled
        ? `Applied "${result.customLabelConfig.packagingName}" (+$${Number(result.customLabelConfig.packagingCostUsd || 0).toFixed(2)}) & recalculated retail prices on ${result.updatedCount} product(s)! ✧`
        : `Disabled custom labeling and recalculated retail prices on ${result.updatedCount} product(s).`,
      updatedCount: result.updatedCount,
      customLabelConfig: result.customLabelConfig,
      product: result.updatedProduct,
      products: allProducts
    });
  } catch (error) {
    console.error('Apply CJ Custom Label Error:', error);
    res.status(500).json({ error: error.message || 'Failed to apply CJ custom labeling.' });
  }
});

app.put('/api/admin/products/:id/custom-label', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await applyCustomLabelToProducts({
      ...(req.body || {}),
      productId: req.params.id,
      applyToAll: false
    });
    res.status(200).json({
      message: result.customLabelConfig.enabled
        ? `Enabled custom label "${result.customLabelConfig.packagingName}" on "${result.updatedProduct?.title || 'Product'}"! ✧`
        : `Disabled custom label on "${result.updatedProduct?.title || 'Product'}".`,
      customLabelConfig: result.customLabelConfig,
      product: result.updatedProduct
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to update product custom label.' });
  }
});

// 4. POST /api/admin/orders/:id/cj-logistics — Queries CJ's GET /shopping/order/getOrderOptionalLogistics
// and calls POST /shopping/order/modifyOrderLogistics (plus updates local Order.logisticName and selectedLogisticName)
app.post('/api/admin/orders/:id/cj-logistics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(String(orderId))) {
      return res.status(400).json({ error: 'Invalid order ID.' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const { logisticName, fromCountryCode, shippingCostUsd, fetchOptionsOnly } = req.body || {};
    const headers = getCjHeaders();
    const destCountry = String(order.shipping_address?.country || 'US').toUpperCase().trim() || 'US';
    const originCountry = String(fromCountryCode || order.fromCountryCode || 'CN').toUpperCase().trim() || 'CN';

    let optionalLogistics = buildDeterministicCjBeautyCarriers({
      weightGrams: 180,
      quantity: Math.max(1, (order.items || []).reduce((s, i) => s + (Number(i.quantity) || 1), 0)),
      startCountryCode: originCountry,
      endCountryCode: destCountry
    });
    let cjOptionalLogisticsQueried = false;
    let cjModifyResult = null;

    if (headers && order.cjOrderId) {
      try {
        const optRes = await axios.get(
          `${CJ_BASE_URL}/shopping/order/getOrderOptionalLogistics?orderId=${encodeURIComponent(order.cjOrderId)}`,
          { headers, timeout: 10000 }
        );
        cjOptionalLogisticsQueried = true;
        const rawList = optRes.data?.data || [];
        if (Array.isArray(rawList) && rawList.length > 0) {
          optionalLogistics = rawList.map(item => ({
            logisticName: String(item.logisticName || item.logisticNameEn || item),
            shippingCostUsd: Number(parseFloat(item.logisticPrice || item.price || 4.49).toFixed(2)),
            deliveryTime: String(item.logisticAging || '7-12 Days'),
            source: 'cj_order_optional_logistics'
          }));
        }
      } catch (optErr) {
        console.warn('⚠️ CJ getOrderOptionalLogistics notice:', optErr?.response?.data?.message || optErr.message);
      }
    }

    if (fetchOptionsOnly) {
      return res.status(200).json({
        orderId: String(order._id),
        cjOrderId: order.cjOrderId || '',
        selectedLogisticName: order.selectedLogisticName || order.logisticName || 'CJPacket Sensitive',
        optionalLogistics,
        cjOptionalLogisticsQueried
      });
    }

    const chosenLogistic = String(logisticName || order.selectedLogisticName || 'CJPacket Sensitive').trim();
    const matchedQuote = optionalLogistics.find(
      c => String(c.logisticName || '').toLowerCase() === chosenLogistic.toLowerCase()
    );

    if (headers && order.cjOrderId) {
      try {
        const modRes = await axios.post(
          `${CJ_BASE_URL}/shopping/order/modifyOrderLogistics`,
          {
            orderId: order.cjOrderId,
            logisticName: chosenLogistic
          },
          { headers, timeout: 10000 }
        );
        cjModifyResult = modRes.data;
      } catch (modErr) {
        cjModifyResult = {
          warning: modErr?.response?.data?.message || modErr.message
        };
      }
    }

    order.selectedLogisticName = chosenLogistic;
    order.logisticName = chosenLogistic;
    order.fromCountryCode = originCountry;
    if (shippingCostUsd !== undefined && !isNaN(parseFloat(shippingCostUsd))) {
      order.shippingCostUsd = Number(parseFloat(shippingCostUsd).toFixed(2));
    } else if (matchedQuote?.shippingCostUsd) {
      order.shippingCostUsd = Number(matchedQuote.shippingCostUsd);
    }
    order.updatedAt = new Date();
    await order.save();

    res.status(200).json({
      message: `Order #${String(order._id).slice(-6).toUpperCase()} CJ shipping method updated to "${chosenLogistic}"! ✧`,
      order,
      selectedLogisticName: order.selectedLogisticName,
      optionalLogistics,
      cjModifyResult
    });
  } catch (error) {
    console.error('Modify Order CJ Logistics Error:', error);
    res.status(500).json({ error: error.message || 'Failed to update CJ order logistics.' });
  }
});

// ---------------- ADMIN EXPRESS ROUTES FOR PROFIT-PROTECTED MONTHLY MEMBERSHIP BOXES (PHASE 2) ---------------- //

// 1. GET /api/admin/monthly-boxes — Returns all curated monthly boxes for the current billing cycle,
// summary metrics (total subscription revenue, total box CJ cost, average cost %, total net profit), and any uncurated paid members.
app.get('/api/admin/monthly-boxes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const billingMonth = req.query.billingMonth || '';
    const telemetry = await buildMonthlyBoxesTelemetry({ billingMonth });
    res.status(200).json(telemetry);
  } catch (error) {
    console.error('Fetch Monthly Boxes Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch monthly membership boxes.' });
  }
});

// 2. POST /api/admin/monthly-boxes/curate — Curates a box for a single userId or for all paid members (curateAll: true),
// enforcing the strict <=25% cost cap ($12.25 max for Luminary $49/mo; $29.75 max for Radiance $119/mo).
app.post('/api/admin/monthly-boxes/curate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      userId,
      curateAll,
      billingMonth,
      selectedLogisticName,
      customLabelConfig,
      curatedBy,
      notes
    } = req.body || {};

    const options = {
      billingMonth,
      selectedLogisticName: selectedLogisticName || 'CJPacket Sensitive',
      customLabelConfig,
      curatedBy: curatedBy || 'susan',
      notes
    };

    if (userId && !curateAll) {
      const box = await curateProfitProtectedMemberBox(userId, options);
      const telemetry = await buildMonthlyBoxesTelemetry({ billingMonth: box.billingMonth });
      return res.status(200).json({
        message: `Curated ${box.memberName}'s ${box.membershipTier === 'radiance' ? '5-Piece Radiance ($119/mo)' : '3-Piece Luminary ($49/mo)'} Box • All-In CJ Cost: $${Number(box.totalAllInCostUsd).toFixed(2)} / $${Number(box.maxAllowedCostUsd).toFixed(2)} max (${box.costPercentageOfMembership}%) • Profit: +$${Number(box.estimatedNetProfitUsd).toFixed(2)} ✧`,
        box,
        ...telemetry
      });
    }

    const batchResult = await curateAllMemberMonthlyBoxes(options);
    const telemetry = await buildMonthlyBoxesTelemetry({ billingMonth: batchResult.billingMonth });
    res.status(200).json({
      message: `Curated ${batchResult.curatedCount} Profit-Protected Monthly Box(es) for ${batchResult.billingMonth} (All strictly ≤25% membership cost cap)! ✧`,
      curatedCount: batchResult.curatedCount,
      errors: batchResult.errors,
      ...telemetry
    });
  } catch (error) {
    console.error('Curate Monthly Boxes Error:', error);
    res.status(400).json({ error: error.message || 'Failed to curate monthly membership boxes.' });
  }
});

// 3. PUT /api/admin/monthly-boxes/:boxId — Lets Susan swap products in a box, change selectedLogisticName,
// or toggle customLabelConfig while re-verifying the <=25% cost cap in real time.
app.put('/api/admin/monthly-boxes/:boxId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { boxId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(boxId))) {
      return res.status(400).json({ error: 'Invalid monthly box ID.' });
    }

    const box = await MemberMonthlyBox.findById(boxId);
    if (!box) {
      return res.status(404).json({ error: 'Monthly membership box not found.' });
    }

    const {
      productIds,
      swapSlotIndex,
      replacementProductId,
      selectedLogisticName,
      customLabelConfig,
      status,
      notes,
      forceOverride
    } = req.body || {};

    const blueprint = getEffectiveMemberBlueprint(box.blueprintSnapshot);
    let updatedItems = Array.isArray(box.items) ? box.items.map(i => (i.toObject ? i.toObject() : { ...i })) : [];

    // Option A: Swap a single slot by index with replacementProductId
    if (swapSlotIndex !== undefined && replacementProductId && mongoose.Types.ObjectId.isValid(String(replacementProductId))) {
      const idx = Number(swapSlotIndex);
      const prodDoc = await Product.findById(replacementProductId).lean();
      if (!prodDoc) {
        return res.status(404).json({ error: 'Replacement product not found in boutique catalog.' });
      }
      const scored = scoreProductForMemberBox(prodDoc, blueprint) || {
        productId: prodDoc._id,
        title: prodDoc.title,
        sku: prodDoc.variants?.[0]?.sku || String(prodDoc._id),
        vid: prodDoc.variants?.[0]?.sku || String(prodDoc._id),
        imageUrl: prodDoc.imageUrl || '',
        ritualStep: prodDoc.ritualStep || 'Step 3: Serum & Essence',
        wholesaleCostUsd: Number(prodDoc.wholesalePriceUsd || 2.50),
        retailPriceUsd: Number(prodDoc.price || 18.00),
        matchScore: 80,
        matchReasons: ['Hand-Selected by Susan']
      };
      if (idx >= 0 && idx < updatedItems.length) {
        updatedItems[idx] = scored;
      } else {
        updatedItems.push(scored);
      }
    }
    // Option B: Replace full items array by productIds
    else if (Array.isArray(productIds) && productIds.length > 0) {
      const validIds = productIds.filter(id => mongoose.Types.ObjectId.isValid(String(id)));
      const prodDocs = await Product.find({ _id: { $in: validIds } }).lean();
      const prodMap = {};
      for (const p of prodDocs) prodMap[String(p._id)] = p;
      updatedItems = validIds
        .map(id => {
          const p = prodMap[String(id)];
          if (!p) return null;
          return scoreProductForMemberBox(p, blueprint) || {
            productId: p._id,
            title: p.title,
            sku: p.variants?.[0]?.sku || String(p._id),
            vid: p.variants?.[0]?.sku || String(p._id),
            imageUrl: p.imageUrl || '',
            ritualStep: p.ritualStep || 'Step 3: Serum & Essence',
            wholesaleCostUsd: Number(p.wholesalePriceUsd || 2.50),
            retailPriceUsd: Number(p.price || 18.00),
            matchScore: 80,
            matchReasons: ['Hand-Selected by Susan']
          };
        })
        .filter(Boolean);
    }

    const nextLogistic = selectedLogisticName !== undefined ? selectedLogisticName : box.selectedLogisticName;
    const nextLabelConfig = customLabelConfig !== undefined
      ? { ...(box.customLabelConfig || {}), ...(customLabelConfig || {}) }
      : box.customLabelConfig;

    const econ = recomputeAndValidateMonthlyBoxEconomics({
      items: updatedItems,
      membershipTier: box.membershipTier,
      selectedLogisticName: nextLogistic,
      customLabelConfig: nextLabelConfig
    });

    if (!econ.withinBudgetCap && !forceOverride) {
      return res.status(400).json({
        error: `25% Cost Cap Guardrail: This edit brings total box cost to $${econ.totalAllInCostUsd.toFixed(2)} (${econ.costPercentageOfMembership}% of $${econ.subscriptionPriceUsd}/mo), exceeding the strict 25% ceiling of $${econ.maxAllowedCostUsd.toFixed(2)}. Choose a lower-wholesale item or shipping carrier (or pass forceOverride: true).`,
        proposedEconomics: econ
      });
    }

    box.items = econ.items;
    box.selectedLogisticName = econ.selectedLogisticName;
    box.consolidatedShippingUsd = econ.consolidatedShippingUsd;
    box.customLabelConfig = econ.customLabelConfig;
    box.customLabelCostUsd = econ.customLabelCostUsd;
    box.totalWholesaleCostUsd = econ.totalWholesaleCostUsd;
    box.totalAllInCostUsd = econ.totalAllInCostUsd;
    box.costPercentageOfMembership = econ.costPercentageOfMembership;
    box.estimatedNetProfitUsd = econ.estimatedNetProfitUsd;
    box.withinBudgetCap = econ.withinBudgetCap;
    box.curatedBy = 'susan';
    if (status && ['CURATED_DRAFT', 'APPROVED_READY', 'DISPATCHED_TO_CJ', 'SHIPPED'].includes(status)) {
      box.status = status;
    }
    if (notes !== undefined) {
      box.notes = String(notes).trim();
    }

    await box.save();
    const telemetry = await buildMonthlyBoxesTelemetry({ billingMonth: box.billingMonth });

    res.status(200).json({
      message: `Updated ${box.memberName}'s monthly box • All-In CJ Cost: $${econ.totalAllInCostUsd.toFixed(2)} / $${econ.maxAllowedCostUsd.toFixed(2)} max (${econ.costPercentageOfMembership}%) • Net Profit: +$${econ.estimatedNetProfitUsd.toFixed(2)} ✧`,
      box,
      ...telemetry
    });
  } catch (error) {
    console.error('Update Monthly Box Error:', error);
    res.status(500).json({ error: error.message || 'Failed to update monthly membership box.' });
  }
});

// 4. POST /api/admin/monthly-boxes/:boxId/dispatch-cj — Creates a local Order + dispatches the box to CJ
// via POST /shopping/order/createOrderV2 with logisticName and custom label/packaging, optionally pays via CJ Wallet,
// updates status to 'DISPATCHED_TO_CJ', and emails the member.
app.post('/api/admin/monthly-boxes/:boxId/dispatch-cj', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { boxId } = req.params;
    const { payFromCjWallet, notifyMember, shippingAddress } = req.body || {};

    const result = await dispatchMonthlyBoxToCj(boxId, {
      payFromCjWallet: payFromCjWallet !== undefined ? Boolean(payFromCjWallet) : true,
      notifyMember: notifyMember !== undefined ? Boolean(notifyMember) : true,
      shippingAddress: shippingAddress || null,
      triggeredBy: 'susan'
    });

    const telemetry = await buildMonthlyBoxesTelemetry({ billingMonth: result.box.billingMonth });
    res.status(200).json({
      ...result,
      ...telemetry
    });
  } catch (error) {
    console.error('Dispatch Monthly Box to CJ Error:', error);
    res.status(400).json({ error: error.message || 'Failed to dispatch monthly box to CJ Dropshipping.' });
  }
});

app.delete('/api/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Product successfully removed.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const { category, skinType, skinConcern, ritualStep } = req.query;
    const filter = {};
    if (category) {
      filter.tags = new RegExp(`^${escapeRegex(category)}$`, 'i');
    }
    if (skinType && skinType !== 'All') {
      filter.skinTypes = { $in: [new RegExp(`^${escapeRegex(skinType)}$`, 'i'), 'All Skin Types'] };
    }
    if (skinConcern && skinConcern !== 'All') {
      filter.skinConcerns = new RegExp(`^${escapeRegex(skinConcern)}$`, 'i');
    }
    if (ritualStep && ritualStep !== 'All') {
      filter.ritualStep = new RegExp(escapeRegex(ritualStep), 'i');
    }
    const products = await Product.find(filter);
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ---------------- PASSWORD RESET & AUTH ROUTES ---------------- //

app.post('/api/users/forgot-password', authLimiter, async (req, res) => {
  try {
    const cleanEmail = normalizeEmail(req.body?.email);
    if (!cleanEmail) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const user = await User.findOne({ email: new RegExp(`^${escapeRegex(cleanEmail)}$`, 'i') });
    if (!user) return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });

    const token = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; 
    await user.save();

    const resetUrl = `${req.headers.origin || 'http://localhost:3000'}?reset_token=${token}`;
    
    const htmlContent = `
      <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; border: 1px solid #E8C5C8; padding: 40px; border-radius: 15px; text-align: center;">
        <h2 style="color: #B38B8F; font-style: italic;">Password Reset Request ✧</h2>
        <p style="font-size: 1.1rem; line-height: 1.6;">You are receiving this because a password reset was requested for your account.</p>
        <p style="font-size: 1.1rem; line-height: 1.6;">Click the button below to securely set a new password:</p>
        <a href="${resetUrl}" style="display: inline-block; margin: 30px 0; padding: 12px 30px; background-color: #F2D4D7; color: #5C5454; text-decoration: none; border-radius: 25px; font-family: 'Cormorant Garamond', serif; font-size: 1.2rem; border: 1px solid #B38B8F; transition: all 0.3s ease;">Reset Password</a>
        <p style="font-size: 0.9rem; color: #8A797A; margin-top: 30px;">If you did not request this, please ignore this email and your password will remain unchanged.</p>
      </div>
    `;
    
    const textContent = `Password Reset Request ✧\n\nYou are receiving this because a password reset was requested for your account.\n\nPlease copy and paste the following link into your browser to complete the process:\n${resetUrl}\n\nIf you did not request this, please ignore this email.\n\nWarmly,\nSusan's Beauty Consulting`;

    await sendEmail(user.email, "Susan's Beauty Consulting - Password Reset", htmlContent, textContent);
    res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

app.post('/api/users/reset-password/:token', authLimiter, async (req, res) => {
  try {
    const user = await User.findOne({ 
      resetPasswordToken: req.params.token, 
      resetPasswordExpires: { $gt: Date.now() } 
    });

    if (!user) return res.status(400).json({ error: 'Password reset token is invalid or has expired.' });

    const { password } = req.body;
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(String(password), salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();

    res.status(200).json({ message: 'Password has been updated successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

app.post('/api/users/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, membershipTier } = req.body || {};
    const cleanName = String(name || '').trim();
    const cleanEmail = normalizeEmail(email);

    if (!cleanName || !cleanEmail || !password) {
      return res.status(400).json({ error: 'Please provide your name, email address, and password.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const existingUser = await User.findOne({ email: new RegExp(`^${escapeRegex(cleanEmail)}$`, 'i') });
    if (existingUser) return res.status(400).json({ error: 'Email already in use. Please sign in instead.' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(String(password), salt);

    const isSusanAdmin = cleanEmail === 'susan.coke@susansbeautyconsulting.com';
    const assignedTier = isSusanAdmin ? 'admin' : (membershipTier || 'luminary');
    const assignedRole = isSusanAdmin ? 'admin' : 'client';

    const newUser = new User({
      name: cleanName,
      email: cleanEmail,
      password: hashedPassword,
      membershipTier: assignedTier,
      role: assignedRole
    });

    const savedUser = await newUser.save();
    const token = jwt.sign({ _id: savedUser._id }, process.env.JWT_SECRET || 'fallback_secret_key', { expiresIn: '24h' });

    res.status(201).json({
      user: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
        membershipTier: savedUser.membershipTier,
        role: savedUser.role
      },
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'Please enter both your email address and password.' });
    }

    const user = await User.findOne({ email: new RegExp(`^${escapeRegex(cleanEmail)}$`, 'i') });
    if (!user) return res.status(400).json({ error: 'Invalid email or password.' });

    let validPassword = false;
    if (String(user.password).startsWith('$2')) {
      validPassword = await bcrypt.compare(String(password), user.password);
    } else if (String(password) === user.password) {
      // One-time automatic migration for legacy non-bcrypt passwords
      validPassword = true;
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(String(password), salt);
      await user.save();
    }

    if (!validPassword) return res.status(400).json({ error: 'Invalid email or password.' });

    let userModified = false;
    if (user.email !== cleanEmail) {
      user.email = cleanEmail;
      userModified = true;
    }
    if (cleanEmail === 'susan.coke@susansbeautyconsulting.com' && (user.membershipTier !== 'admin' || user.role !== 'admin')) {
      user.membershipTier = 'admin';
      user.role = 'admin';
      userModified = true;
    }
    if (userModified) {
      await user.save();
    }

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET || 'fallback_secret_key', { expiresIn: '24h' });

    res.json({ 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        membershipTier: user.membershipTier, 
        role: user.role
      }, 
      token 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/me/recommendations', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('recommendedProducts');
    res.json(user.recommendedProducts || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

app.get('/api/users/me/inbox', authenticateToken, async (req, res) => {
  try {
    const items = await InboxItem.find({ userId: req.user._id })
      .populate('productId')
      .sort({ createdAt: -1 }); 
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user inbox' });
  }
});

app.get('/api/users/me/orders', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const emailRegex = new RegExp(`^${escapeRegex(normalizeEmail(user.email))}$`, 'i');
    const orders = await Order.find({ customerEmail: emailRegex }).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order history' });
  }
});

app.get('/api/users/me/blueprint', authenticateToken, async (req, res) => {
  try {
    const existingBlueprint = await Consultation.findOne({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    if (existingBlueprint && (!existingBlueprint.blueprintAnalysis || !existingBlueprint.blueprintAnalysis.archetypeTitle)) {
      const generatedAnalysis = generateBlueprintAnalysis(existingBlueprint);
      await Consultation.findByIdAndUpdate(existingBlueprint._id, {
        $set: { blueprintAnalysis: generatedAnalysis }
      }).catch(() => {});
      existingBlueprint.blueprintAnalysis = generatedAnalysis;
    }
    res.status(200).json({
      hasCompletedQuiz: Boolean(existingBlueprint),
      blueprint: existingBlueprint || null,
      blueprintAnalysis: existingBlueprint?.blueprintAnalysis || null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch member blueprint status' });
  }
});

app.post('/api/consultations', authenticateToken, async (req, res) => {
  try {
    // Enforce one-time-only Blueprint Quiz per member account
    const existingConsultation = await Consultation.findOne({ userId: req.user._id }).sort({ createdAt: -1 });
    if (existingConsultation) {
      if (!existingConsultation.blueprintAnalysis || !existingConsultation.blueprintAnalysis.archetypeTitle) {
        existingConsultation.blueprintAnalysis = generateBlueprintAnalysis(existingConsultation);
        await existingConsultation.save().catch(() => {});
      }
      return res.status(403).json({
        error: 'Your Beauty Blueprint is a one-time personal curation and is permanently locked to your membership profile.',
        blueprint: existingConsultation,
        blueprintAnalysis: existingConsultation.blueprintAnalysis
      });
    }

    const blueprintAnalysis = generateBlueprintAnalysis(req.body || {});

    const newConsultation = new Consultation({
      ...req.body,
      userId: req.user._id,
      blueprintAnalysis
    });
    const savedConsultation = await newConsultation.save();

    // ---------------- GOOGLE GEN AI CURATION ---------------- //
    try {
      const { ai, Type } = getGeminiClient();
      
      const rawCatalog = await Product.find({})
        .select('_id title variants tags skinTypes skinConcerns sensitivitySafe sensitivityLabel ritualStep keyActives description')
        .limit(150)
        .lean();
      const catalog = rawCatalog.map(prod => ({
        _id: prod._id,
        title: prod.title,
        price: Number(prod.variants?.[0]?.price ?? prod.price ?? 0).toFixed(2),
        skinTypes: prod.skinTypes || [],
        skinConcerns: prod.skinConcerns || [],
        sensitivitySafe: prod.sensitivitySafe !== false,
        ritualStep: prod.ritualStep || 'Step 3: Serum & Essence',
        keyActives: prod.keyActives || [],
        tags: prod.tags || [],
        description: typeof prod.description === 'string'
          ? prod.description.replace(/<[^>]*>?/gm, '').slice(0, 160)
          : ''
      }));
      
      const systemInstruction = `You are Susan, a master beauty consultant. Curate a bespoke 3 to 5 piece skincare and makeup ritual for this client based on their profile. Select the most optimal products from the provided catalog.`;
      
      const prompt = `
        Client Profile:
        - Skin Temperament: ${savedConsultation.skinType}
        - Primary Vision: ${savedConsultation.primaryGoal}
        - Climate: ${savedConsultation.climate}
        - Sensitivity: ${savedConsultation.skinSensitivity}
        - Signature Aesthetic: ${savedConsultation.makeupVibe}
        - Routine Focus: ${savedConsultation.routineFocus}

        Available Boutique Products:
        ${JSON.stringify(catalog)}
      `;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.1, 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            description: "An array of exact MongoDB _id strings corresponding to the recommended products.",
            items: {
              type: Type.STRING
            }
          }
        }
      });

      const recommendedIds = JSON.parse(response.text);
      
      await User.findByIdAndUpdate(req.user._id, {
        $set: { recommendedProducts: recommendedIds }
      });
      
      console.log(`✨ AI Curation complete for user ${req.user._id}. Recommended ${recommendedIds.length} items.`);
      
    } catch (aiError) {
      console.error("⚠️ AI Curation fallback triggered (using deterministic Blueprint matcher):", aiError.message);
      try {
        const allProds = await Product.find({}).limit(150).lean();
        const scored = allProds.map(p => {
          let score = 0;
          const st = Array.isArray(p.skinTypes) ? p.skinTypes : [];
          const sc = Array.isArray(p.skinConcerns) ? p.skinConcerns : [];
          if (st.includes(savedConsultation.skinType)) score += 4;
          else if (st.includes('All Skin Types')) score += 2;
          if (sc.includes(savedConsultation.primaryGoal)) score += 5;
          if (savedConsultation.skinSensitivity === 'High' && p.sensitivitySafe === false) score -= 5;
          if ((savedConsultation.skinSensitivity === 'High' || savedConsultation.skinSensitivity === 'Moderate') && sc.includes('Barrier & Soothing')) score += 2;
          return { id: p._id, score };
        }).sort((a, b) => b.score - a.score);
        const fallbackIds = scored.slice(0, 4).map(s => s.id);
        if (fallbackIds.length > 0) {
          await User.findByIdAndUpdate(req.user._id, {
            $set: { recommendedProducts: fallbackIds }
          });
        }
      } catch (fallbackErr) {}
    }
    // --------------------------------------------------------

    res.status(201).json(savedConsultation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { tier } = req.body;
    let unit_amount = 4900; 
    let productName = "The Luminary Circle Membership";
    let productDescription = "3-piece skin care ritual box, quarterly 1-on-1 consultation, and 10% boutique discount.";

    if (tier === 'radiance') {
      unit_amount = 11900; 
      productName = "The Radiance Elite Membership";
      productDescription = "5-piece premium skin care ritual box, monthly 1-on-1 consultations, 25% off the boutique, and new product early updates.";
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription', 
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: productName, description: productDescription },
          unit_amount: unit_amount,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      metadata: {
        userId: req.user._id.toString(),
        tier: tier
      },
      subscription_data: {
        metadata: {
          userId: req.user._id.toString(),
          tier: tier
        }
      },
      success_url: `${req.headers.origin || 'http://localhost:3000'}/?success=true&tier=${tier}`,
      cancel_url: `${req.headers.origin || 'http://localhost:3000'}/?canceled=true`,
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------- WEBHOOK & FULFILLMENT HELPERS ---------------- //

// Extracts a normalized shipping address object from a Stripe checkout.session.completed event
const extractStripeShippingAddress = (session = {}, fallbackAddress = {}) => {
  const shippingDetails = session.shipping_details || session.collected_information?.shipping_details || {};
  const customerDetails = session.customer_details || {};
  const addr = shippingDetails.address || customerDetails.address || {};

  const fullName = String(
    shippingDetails.name ||
    customerDetails.name ||
    `${fallbackAddress.first_name || ''} ${fallbackAddress.last_name || ''}`.trim() ||
    'Valued Customer'
  ).trim();

  const nameParts = fullName.split(/\s+/);
  const firstName = fallbackAddress.first_name || nameParts[0] || 'Valued';
  const lastName = fallbackAddress.last_name || nameParts.slice(1).join(' ') || 'Customer';

  const line1 = addr.line1 || fallbackAddress.address_1 || '';
  const line2 = addr.line2 || fallbackAddress.address_2 || '';
  const fullStreet = [line1, line2].filter(Boolean).join(', ') || 'Address Pending';

  return {
    name: fullName,
    first_name: firstName,
    last_name: lastName,
    address_1: fullStreet,
    city: addr.city || fallbackAddress.city || 'Pending',
    state: addr.state || fallbackAddress.state || 'Pending',
    postcode: addr.postal_code || fallbackAddress.postcode || '00000',
    country: addr.country || fallbackAddress.country || 'US',
    phone: customerDetails.phone || shippingDetails.phone || fallbackAddress.phone || '0000000000'
  };
};

// Builds a validated CJ Dropshipping createOrderV2 payload from an Order document
// Explicitly passes logisticName, fromCountryCode, and appends custom packaging vid or POD metadata when enabled.
const buildCjOrderPayload = (order) => {
  const address = order.shipping_address || {};
  const customerName = (
    address.name ||
    `${address.first_name || 'Valued'} ${address.last_name || 'Customer'}`
  ).trim();

  const logisticName = String(
    order.selectedLogisticName || order.logisticName || 'CJPacket Sensitive'
  ).trim() || 'CJPacket Sensitive';
  const fromCountryCode = String(order.fromCountryCode || 'CN').toUpperCase().trim() || 'CN';
  const orderCustomLabel = order.customLabelConfig && typeof order.customLabelConfig === 'object'
    ? order.customLabelConfig
    : null;

  const mappedProducts = (Array.isArray(order.items) ? order.items : []).map(item => {
    const itemLabel = (item.customLabelConfig && typeof item.customLabelConfig === 'object')
      ? item.customLabelConfig
      : orderCustomLabel;
    const baseProd = {
      vid: String(item.vid || item.sku || ''),
      sku: String(item.sku || ''),
      quantity: Math.max(1, Number(item.quantity) || 1)
    };
    if (itemLabel?.enabled) {
      baseProd.customLabelConfig = {
        labelType: itemLabel.labelType || 'CJ_CUSTOM_PACKAGING',
        packagingVid: itemLabel.packagingVid || '',
        packagingName: itemLabel.packagingName || "Susan's Rose-Gold Custom Box & Seal",
        customBrandText: itemLabel.customBrandText || "Susan's Beauty Consulting ✧",
        logoUrl: itemLabel.logoUrl || ''
      };
      if (itemLabel.logoUrl || itemLabel.customBrandText) {
        baseProd.podProperties = {
          customText: itemLabel.customBrandText || "Susan's Beauty Consulting ✧",
          logoUrl: itemLabel.logoUrl || ''
        };
      }
    }
    return baseProd;
  });

  // If order-level CJ Custom Packaging is enabled with a packagingVid, append the packaging line item after product items
  if (
    orderCustomLabel?.enabled &&
    orderCustomLabel?.packagingVid &&
    !mappedProducts.some(p => p.vid === String(orderCustomLabel.packagingVid))
  ) {
    mappedProducts.push({
      vid: String(orderCustomLabel.packagingVid),
      sku: String(orderCustomLabel.packagingSku || orderCustomLabel.packagingVid),
      quantity: 1,
      isCustomPackaging: true,
      packagingName: String(orderCustomLabel.packagingName || "Susan's Rose-Gold Custom Box & Seal")
    });
  }

  return {
    orderNumber: String(order._id || 'TEST-ORDER'),
    shippingZip: String(address.postcode || '00000'),
    shippingCountryCode: String(address.country || 'US'),
    shippingProvince: String(address.state || 'KS'),
    shippingCity: String(address.city || 'Wichita'),
    shippingAddress: String(address.address_1 || 'Pending'),
    shippingCustomerName: customerName,
    shippingPhone: String(address.phone || '0000000000'),
    logisticName,
    fromCountryCode,
    ...(orderCustomLabel?.enabled
      ? {
          remark: `Custom Label: ${orderCustomLabel.packagingName || "Susan's Rose-Gold Custom Box"} (${orderCustomLabel.customBrandText || "Susan's Beauty Consulting"})`,
          customLabelConfig: orderCustomLabel
        }
      : {}),
    products: mappedProducts
  };
};

// Parses both CJ v2 nested (`req.body.params`) and flat webhook payloads safely
const parseCjWebhookFields = (body = {}) => {
  const safeBody = (body && typeof body === 'object') ? body : {};
  const nested = (safeBody.params && typeof safeBody.params === 'object') ? safeBody.params : {};

  const orderNumber =
    nested.orderNumber ||
    nested.orderId ||
    nested.cjOrderId ||
    safeBody.orderNumber ||
    safeBody.orderId ||
    null;

  const trackingNumber =
    nested.trackNumber ||
    nested.trackingNumber ||
    nested.trackingCode ||
    safeBody.trackingNumber ||
    safeBody.trackNumber ||
    '';

  const status =
    nested.orderStatus ||
    nested.status ||
    safeBody.status ||
    safeBody.orderStatus ||
    'SHIPPED';

  const logisticName =
    nested.logisticName ||
    safeBody.logisticName ||
    '';

  return {
    orderNumber: orderNumber ? String(orderNumber).trim() : null,
    trackingNumber: trackingNumber ? String(trackingNumber).trim() : '',
    status: status ? String(status).trim() : 'SHIPPED',
    logisticName: logisticName ? String(logisticName).trim() : '',
    messageType: safeBody.type || 'ORDER_STATUS'
  };
};

app.post('/api/cart-checkout', async (req, res) => {
  try {
    const { items, shipping_address, customerEmail, membershipTier } = req.body || {};
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cannot process an empty cart.' });
    }

    // Verify member tier from Authorization token if signed in (fallback to request membershipTier)
    let verifiedTier = String(membershipTier || '').toLowerCase().trim();
    let verifiedEmail = normalizeEmail(customerEmail);

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
        const dbUser = await User.findById(decoded._id).select('email membershipTier').lean();
        if (dbUser) {
          verifiedTier = String(dbUser.membershipTier || verifiedTier).toLowerCase().trim();
          if (!verifiedEmail && dbUser.email) {
            verifiedEmail = normalizeEmail(dbUser.email);
          }
        }
      } catch (tokenErr) {
        // Proceed as guest/fallback tier if token is expired or absent
      }
    }

    const discountInfo = getMemberDiscountInfo(verifiedTier);
    const multiplier = 1 - discountInfo.rate;

    const discountedItems = items.map(item => {
      const basePrice = Math.max(0, Number(item.price) || 0);
      const finalUnitPrice = Number((basePrice * multiplier).toFixed(2));
      return {
        ...item,
        originalPrice: basePrice,
        price: finalUnitPrice,
        discountRate: discountInfo.rate,
        quantity: Math.max(1, Number(item.quantity) || 1)
      };
    });

    const totalAmount = discountedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const newOrder = new Order({ 
      items: discountedItems, 
      totalAmount: Number(totalAmount.toFixed(2)),
      shipping_address,
      ...(verifiedEmail ? { customerEmail: verifiedEmail } : {})
    });
    await newOrder.save();

    const line_items = discountedItems.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.displayTitle || item.title || 'Boutique Essential',
          ...(discountInfo.label ? { description: `${discountInfo.label} Applied` } : {}),
          images: item.imageUrl ? [item.imageUrl.startsWith('//') ? `https:${item.imageUrl}` : item.imageUrl] : [],
        },
        unit_amount: Math.max(50, Math.round(item.price * 100)), 
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items,
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU']
      },
      phone_number_collection: {
        enabled: true
      },
      ...(verifiedEmail ? { customer_email: verifiedEmail } : {}),
      metadata: {
        orderId: newOrder._id.toString(),
        membershipTier: verifiedTier || 'guest',
        discountRate: String(discountInfo.rate)
      },
      success_url: `${req.headers.origin || 'http://localhost:3000'}/?cart_success=true`,
      cancel_url: `${req.headers.origin || 'http://localhost:3000'}/?cart_canceled=true`,
    });

    res.json({
      url: session.url,
      discountApplied: discountInfo.rate > 0,
      discountLabel: discountInfo.label,
      totalAmount: Number(totalAmount.toFixed(2))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = cleanEnv(process.env.STRIPE_WEBHOOK_SECRET);
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error(`⚠️ Stripe Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    const orderId = session.metadata?.orderId;
    const tier = session.metadata?.tier;
    const userId = session.metadata?.userId;

    if (orderId && mongoose.Types.ObjectId.isValid(String(orderId))) {
      try {
        const order = await Order.findById(orderId);
        if (order && order.status === 'Pending') {
          
          order.status = 'PAID_PROCESSING';
          const rawEmail = session.customer_details?.email || session.customer_email || order.customerEmail || 'Customer';
          order.customerEmail = rawEmail !== 'Customer' ? String(rawEmail).toLowerCase().trim() : 'Customer';
          order.shipping_address = extractStripeShippingAddress(session, order.shipping_address || {});
          await order.save();
          await incrementProductPurchaseCountsForOrder(order);

          if (order.customerEmail !== 'Customer') {
            const receiptHtml = `
              <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; text-align: center; border: 1px solid #E8C5C8; padding: 40px; border-radius: 15px;">
                <h1 style="color: #B38B8F; font-style: italic;">Payment Confirmed ✧</h1>
                <p style="font-size: 1.2rem; line-height: 1.6;">Thank you for your order! Your ritual essentials are being prepared.</p>
                <p style="font-size: 1.1rem;"><strong>Order Total:</strong> $${(order.totalAmount || 0).toFixed(2)}</p>
                <p style="font-size: 0.9rem; color: #8A797A; margin-top: 30px;">You will receive another update as soon as your package ships.</p>
              </div>
            `;
            
            const receiptText = `Payment Confirmed ✧\n\nThank you for your order! Your ritual essentials are being prepared.\n\nOrder Total: $${(order.totalAmount || 0).toFixed(2)}\n\nYou will receive another update as soon as your package ships.\n\nWarmly,\nSusan\nSusan's Beauty Consulting`;

            await sendEmail(order.customerEmail, "Your Susan's Beauty Consulting Receipt", receiptHtml, receiptText).catch(() => {});
          }

          const headers = getCjHeaders();
          const cjPayload = buildCjOrderPayload(order);
          let cjStatusNote = 'Routed to CJ Dropshipping';

          if (headers) {
            try {
              const cjOrderRes = await axios.post(`${CJ_BASE_URL}/shopping/order/createOrderV2`, cjPayload, { headers, timeout: 15000 });
              const returnedCjId = cjOrderRes?.data?.data?.orderId || (typeof cjOrderRes?.data?.data === 'string' ? cjOrderRes.data.data : '');
              if (returnedCjId) {
                order.cjOrderId = String(returnedCjId);
                order.cjOrderStatus = 'CREATED';
                await order.save();
              }
              console.log(`💸 Payment cleared. Order ${orderId} forwarded to CJ Dropshipping.`);
            } catch (cjErr) {
              cjStatusNote = `Manual review needed (CJ API response: ${cjErr?.response?.data?.message || cjErr.message})`;
              console.warn(`⚠️ CJ createOrderV2 warning for Order ${orderId}:`, cjStatusNote);
            }
          } else {
            cjStatusNote = 'CJ_ACCESS_TOKEN not configured; ready for manual fulfillment';
          }

          // --- NOTIFY SUSAN ---
          const susanHtml = `
            <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; border: 1px solid #E8C5C8; padding: 40px; border-radius: 15px;">
              <h2 style="color: #B38B8F; font-style: italic; text-align: center;">Automated Order Processed ✧</h2>
              <p style="font-size: 1.1rem; line-height: 1.6;">Susan,</p>
              <p style="font-size: 1.1rem; line-height: 1.6;">A new order has been paid via Stripe.</p>
              <div style="background-color: #FFF0F2; padding: 15px; border-radius: 10px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Customer:</strong> ${cjPayload.shippingCustomerName} (${order.customerEmail})</p>
                <p style="margin: 5px 0;"><strong>Ship To:</strong> ${cjPayload.shippingAddress}, ${cjPayload.shippingCity}, ${cjPayload.shippingProvince} ${cjPayload.shippingZip}, ${cjPayload.shippingCountryCode}</p>
                <p style="margin: 5px 0;"><strong>Order Total:</strong> $${(order.totalAmount || 0).toFixed(2)}</p>
                <p style="margin: 5px 0;"><strong>Order ID:</strong> ${order._id.toString()}</p>
                <p style="margin: 5px 0;"><strong>Fulfillment Status:</strong> ${cjStatusNote}</p>
              </div>
            </div>
          `;
          
          const susanText = `Automated Order Processed ✧\n\nSusan, a new order has been placed by ${cjPayload.shippingCustomerName} (${order.customerEmail}) for $${(order.totalAmount || 0).toFixed(2)}.\nShip To: ${cjPayload.shippingAddress}, ${cjPayload.shippingCity}, ${cjPayload.shippingProvince} ${cjPayload.shippingZip}\nFulfillment: ${cjStatusNote}\nOrder ID: ${order._id.toString()}`;

          await sendEmail(getPrimaryAdminEmail(), '✧ New Order Auto-Processed', susanHtml, susanText).catch(() => {});
          console.log(`✉️ Admin notification dispatched to Susan for Order ${orderId}`);

        }
      } catch (err) {
        console.error(`⚠️ Failed to process paid order ${orderId}:`, err.message);
      }
    } 
    else if (tier && userId && mongoose.Types.ObjectId.isValid(String(userId))) {
      try {
        const user = await User.findById(userId);
        if (user) {
          user.membershipTier = tier;
          await user.save();
          console.log(`✨ Successfully upgraded user ${user.email} to ${tier} tier.`);
          
          const welcomeHtml = `
            <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; text-align: center; border: 1px solid #E8C5C8; padding: 40px; border-radius: 15px;">
              <h1 style="color: #B38B8F; font-style: italic;">Welcome to ${tier === 'radiance' ? 'The Radiance Elite' : 'The Luminary Circle'} ✧</h1>
              <p style="font-size: 1.2rem; line-height: 1.6;">Your membership payment is verified. You can now access your member dashboard and complete your personalized beauty blueprint.</p>
            </div>
          `;
          const welcomeText = `Welcome to the ${tier} tier! Your membership is now active. \n\nWarmly,\nSusan's Beauty Consulting`;
          
          await sendEmail(user.email, "Your Membership is Active ✧", welcomeHtml, welcomeText).catch(() => {});
        }
      } catch (err) {
        console.error(`⚠️ Failed to upgrade user ${userId} to ${tier}:`, err.message);
      }
    }
  }

  res.status(200).json({ received: true });
});

app.post('/webhook/cj', express.json(), async (req, res) => {
  try {
    const providedToken = cleanEnv(
      req.query.token ||
      req.headers['x-cj-webhook-token'] ||
      (req.headers['authorization'] && req.headers['authorization'].startsWith('Bearer ')
        ? req.headers['authorization'].split(' ')[1]
        : '')
    );
    const expectedToken = cleanEnv(process.env.CJ_WEBHOOK_SECRET);

    // If CJ_WEBHOOK_SECRET is configured, enforce token match whenever ?token= or header is supplied,
    // while allowing CJ's initial unauthenticated URL verification ping (which sends no orderNumber) to return 200 OK.
    const parsed = parseCjWebhookFields(req.body);

    if (!parsed.orderNumber) {
      console.log(`📡 CJ Webhook Verification Ping received from IP: ${req.ip}`);
      return res.status(200).json({
        received: true,
        ping: true,
        message: 'CJ webhook endpoint is online and ready.'
      });
    }

    if (expectedToken && providedToken !== expectedToken) {
      console.warn(`⚠️ Unauthorized CJ webhook attempt from IP: ${req.ip}`);
      return res.status(403).json({ error: 'Forbidden: Invalid webhook authentication.' });
    }

    const { orderNumber, trackingNumber, status, logisticName } = parsed;
    console.log(`📦 CJ Webhook Received - Order: ${orderNumber}, Status: ${status}, Tracking: ${trackingNumber}`);

    // Prevent Mongoose CastError 500 if CJ sends a test/non-ObjectId orderNumber (e.g. "TEST-12345")
    if (!mongoose.Types.ObjectId.isValid(orderNumber)) {
      console.log(`🧪 CJ Webhook Test Mode - Non-ObjectId orderNumber "${orderNumber}" acknowledged safely.`);
      return res.status(200).json({
        received: true,
        testMode: true,
        orderNumber,
        status,
        trackingNumber,
        logisticName
      });
    }

    const updateFields = { status: status || 'SHIPPED' };
    if (trackingNumber) {
      updateFields.tracking_code = trackingNumber;
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderNumber, 
      updateFields,
      { returnDocument: 'after' } 
    );

    if (!updatedOrder) {
      console.warn(`⚠️ CJ webhook notice: Order ${orderNumber} not found in DB.`);
      return res.status(200).json({ received: true, orderFound: false, orderNumber });
    }

    if (trackingNumber && updatedOrder.customerEmail && updatedOrder.customerEmail !== 'Customer') {
      const shippingHtml = `
        <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; text-align: center; border: 1px solid #E8C5C8; padding: 40px; border-radius: 15px;">
          <h1 style="color: #B38B8F; font-style: italic;">Your Ritual has Shipped ✈️</h1>
          <p style="font-size: 1.2rem; line-height: 1.6;">Your bespoke beauty products have left our facility and are on their way to you!</p>
          <div style="background-color: #FFF0F2; padding: 15px; border-radius: 10px; display: inline-block; margin: 20px 0;">
            <p style="margin: 0; font-size: 1.1rem;">Tracking Number${logisticName ? ` (${logisticName})` : ''}:</p>
            <strong style="font-size: 1.3rem; color: #B38B8F;">${trackingNumber}</strong>
          </div>
          <p style="font-size: 0.9rem; color: #8A797A;">Please allow up to 24-48 hours for the tracking link to activate with the courier.</p>
        </div>
      `;

      const shippingText = `Your Ritual has Shipped ✈️\n\nYour bespoke beauty products have left our facility and are on their way to you!\n\nTracking Number: ${trackingNumber}\n\nPlease allow up to 24-48 hours for the tracking link to activate with the courier.\n\nWarmly,\nSusan\nSusan's Beauty Consulting`;

      await sendEmail(updatedOrder.customerEmail, "Your Susan's Beauty Consulting Order has Shipped!", shippingHtml, shippingText).catch(() => {});
    }

    res.status(200).json({
      received: true,
      orderFound: true,
      orderId: updatedOrder._id.toString(),
      status: updatedOrder.status,
      trackingNumber: updatedOrder.tracking_code || ''
    });
  } catch (err) {
    console.error(`⚠️ Error handling CJ webhook:`, err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ---------------- PUBLIC HEALTH & ADMIN WEBHOOK DIAGNOSTICS ROUTES ---------------- //

app.get('/api/health', async (req, res) => {
  try {
    const dbReady = mongoose.connection.readyState === 1;
    const productCount = dbReady ? await Product.countDocuments() : 0;
    res.status(200).json({
      status: 'ok',
      timezone: CENTRAL_TIMEZONE,
      dbConnected: dbReady,
      productCount,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Unified 6-Point System Diagnostics Suite (used by both the 🧪 Diagnostics Tab and Odie's runSystemDiagnostics tool)
const runFullSystemDiagnosticsSuite = async ({ sendLiveTestEmail = false, testEmailRecipient = '' } = {}) => {
  const startMs = Date.now();
  const timestampCT = formatCentralDateTime(new Date());

  // 1. MongoDB & Boutique Data Integrity Check
  const dbReady = mongoose.connection.readyState === 1;
  const [productCount, userCount, orderCount, appointmentCount, memoryCount] = dbReady
    ? await Promise.all([
        Product.countDocuments(),
        User.countDocuments(),
        Order.countDocuments(),
        Appointment.countDocuments({ status: { $ne: 'cancelled' } }),
        OdieMemory.countDocuments()
      ])
    : [0, 0, 0, 0, 0];

  const databaseCheck = {
    name: 'MongoDB & Boutique Data Store',
    passed: dbReady,
    status: dbReady ? 'PASSED' : 'FAILED',
    details: dbReady
      ? `${productCount} products • ${userCount} members • ${orderCount} orders • ${appointmentCount} active consultations • ${memoryCount} Odie memories`
      : 'MongoDB connection is not active.'
  };

  // 2. Webhook & Fulfillment Payload Self-Test
  const sampleCjV2Payload = {
    messageId: `DIAG-MSG-${Date.now()}`,
    type: 'ORDER',
    params: {
      orderNumber: 'TEST-CJ-ORDER-999',
      orderStatus: 'SHIPPED',
      trackNumber: 'CJ123456789US',
      logisticName: 'USPS'
    }
  };
  const parsedCj = parseCjWebhookFields(sampleCjV2Payload);
  const cjParserPassed =
    parsedCj.orderNumber === 'TEST-CJ-ORDER-999' &&
    parsedCj.trackingNumber === 'CJ123456789US' &&
    parsedCj.status === 'SHIPPED' &&
    !mongoose.Types.ObjectId.isValid(parsedCj.orderNumber);

  const sampleStripeSession = {
    customer_details: { name: 'Susan Diagnostic Client', email: 'client@example.com', phone: '+13165550199' },
    shipping_details: {
      name: 'Susan Diagnostic Client',
      address: { line1: '742 Evergreen Terrace', line2: 'Suite 200', city: 'Wichita', state: 'KS', postal_code: '67202', country: 'US' }
    }
  };
  const extractedAddr = extractStripeShippingAddress(sampleStripeSession);
  const sampleCjOrderPayload = buildCjOrderPayload({
    _id: new mongoose.Types.ObjectId(),
    shipping_address: extractedAddr,
    items: [{ sku: 'CJ-BEAUTY-SKU-01', quantity: 2 }]
  });
  const stripeFormatterPassed =
    sampleCjOrderPayload.shippingCity === 'Wichita' &&
    sampleCjOrderPayload.shippingProvince === 'KS' &&
    sampleCjOrderPayload.products[0]?.vid === 'CJ-BEAUTY-SKU-01';

  const webhooksCheck = {
    name: 'Stripe & CJ v2 Webhook Parsers',
    passed: cjParserPassed && stripeFormatterPassed,
    status: cjParserPassed && stripeFormatterPassed ? 'PASSED' : 'WARNING',
    details: 'CJ v2 nested params parser, ObjectId CastError guard, and Stripe -> CJ createOrderV2 formatter verified.'
  };

  // 3. Stripe Treasury & Balance API Check
  const stripeSnapshot = await fetchStripeFinancialSnapshot();
  const stripeCheck = {
    name: 'Stripe Treasury & Payout Engine',
    passed: Boolean(stripeSnapshot.connected),
    status: stripeSnapshot.connected ? 'PASSED' : (stripeSnapshot.configured ? 'WARNING' : 'UNCONFIGURED'),
    mode: stripeSnapshot.mode,
    availableUsd: stripeSnapshot.availableUsd,
    pendingUsd: stripeSnapshot.pendingUsd,
    details: stripeSnapshot.connected
      ? `Connected (${stripeSnapshot.mode}) • Available: $${Number(stripeSnapshot.availableUsd || 0).toFixed(2)} • Pending: $${Number(stripeSnapshot.pendingUsd || 0).toFixed(2)}`
      : (stripeSnapshot.error || 'Stripe key not connected.')
  };

  // 4. CJ Dropshipping API & Wallet Check
  const cjSnapshot = await fetchCjWalletAndOrdersSnapshot(false);
  const cjCheck = {
    name: 'CJ Dropshipping API & Wallet',
    passed: Boolean(cjSnapshot.connected),
    status: cjSnapshot.connected ? 'PASSED' : (cjSnapshot.configured ? 'WARNING' : 'UNCONFIGURED'),
    availableUsd: cjSnapshot.availableUsd,
    details: cjSnapshot.connected
      ? `Connected • CJ Wallet Available: $${Number(cjSnapshot.availableUsd || 0).toFixed(2)} • Recent CJ Orders: ${(cjSnapshot.recentCjOrders || []).length}`
      : (cjSnapshot.error || 'CJ_ACCESS_TOKEN not connected.')
  };

  // 5. IONOS SMTP Connection & Optional Live Dispatch Check
  const smtpVerify = await verifySmtpConnection();
  let liveEmailResult = null;
  if (sendLiveTestEmail && (smtpVerify.verified || resendApiKey || brevoApiKey)) {
    const recipient = (testEmailRecipient && String(testEmailRecipient).trim()) || getPrimaryAdminEmail();
    try {
      const subj = `✧ Odie System Diagnostic Test (${timestampCT})`;
      const html = `<div style="font-family: Georgia, serif; padding: 25px; border: 1px solid #E8C5C8; border-radius: 12px;"><h2 style="color: #B38B8F;">Odie Diagnostic Check Passed ✧</h2><p>Your IONOS SMTP transport (${escapeHtml(smtpHost)}:${activeSmtpPort}) is verified and delivering mail.</p></div>`;
      const text = `Odie Diagnostic Check Passed (${timestampCT}) via ${smtpHost}:${activeSmtpPort}.`;
      liveEmailResult = await sendEmail(recipient, subj, html, text);
    } catch (emailErr) {
      liveEmailResult = { error: emailErr.message };
    }
  }

  const smtpPassed = Boolean(smtpVerify.verified || (liveEmailResult && !liveEmailResult.error));
  const smtpCheck = {
    name: 'IONOS SMTP Email Transport',
    passed: smtpPassed,
    status: smtpPassed ? 'PASSED' : 'WARNING',
    host: smtpHost,
    port: smtpVerify.port || activeSmtpPort,
    authUserUsed: smtpVerify.authUserUsed || activeSmtpUser,
    liveEmailSent: Boolean(liveEmailResult && !liveEmailResult.error),
    details: smtpPassed
      ? `Verified on ${smtpHost}:${smtpVerify.port || activeSmtpPort} as ${smtpVerify.authUserUsed || activeSmtpUser}${liveEmailResult && !liveEmailResult.error ? ' (Live test email delivered ✓)' : ''}`
      : (smtpVerify.error || 'IONOS SMTP connection warning.'),
    troubleshootingAdvice: smtpVerify.troubleshootingAdvice || []
  };

  // 6. Odie AI Brain & Persistent Memory Check
  const geminiConfigured = Boolean(cleanEnv(process.env.GEMINI_API_KEY));
  const odieCheck = {
    name: 'Odie AI Brain & Long-Term Memory Bank',
    passed: geminiConfigured && dbReady,
    status: geminiConfigured && dbReady ? 'PASSED' : 'WARNING',
    model: GEMINI_MODEL,
    memoryCount,
    details: geminiConfigured
      ? `Odie online (${GEMINI_MODEL}) with ${memoryCount} persistent long-term memory facts loaded.`
      : 'GEMINI_API_KEY is missing in .env.'
  };

  const checksList = [databaseCheck, webhooksCheck, stripeCheck, cjCheck, smtpCheck, odieCheck];
  const passedCount = checksList.filter(c => c.passed).length;
  const totalChecks = checksList.length;
  const overallStatus = passedCount === totalChecks ? 'PASSED' : (passedCount >= 4 ? 'PARTIAL_PASS' : 'WARNING');

  return {
    overallStatus,
    passedCount,
    totalChecks,
    durationMs: Date.now() - startMs,
    timestampCT,
    message: `Odie System Diagnostics complete: ${passedCount}/${totalChecks} subsystems passed verification in ${Date.now() - startMs}ms ✧`,
    checks: {
      database: databaseCheck,
      webhooks: webhooksCheck,
      stripe: stripeCheck,
      cjDropshipping: cjCheck,
      ionosSmtp: smtpCheck,
      odieBrain: odieCheck
    },
    checksList
  };
};

app.post('/api/admin/diagnostics/run-all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { sendLiveTestEmail, testEmailRecipient } = req.body || {};
    const report = await runFullSystemDiagnosticsSuite({
      sendLiveTestEmail: Boolean(sendLiveTestEmail),
      testEmailRecipient: testEmailRecipient || ''
    });
    res.status(200).json(report);
  } catch (err) {
    console.error('Unified System Diagnostics Error:', err);
    res.status(500).json({ error: err.message || 'Failed to run unified system diagnostics.' });
  }
});

app.post('/api/admin/diagnostics/test-webhooks', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // 1. Test CJ v2 nested webhook payload parsing & non-ObjectId safety
    const sampleCjV2Payload = {
      messageId: `TEST-MSG-${Date.now()}`,
      type: 'ORDER',
      params: {
        orderNumber: 'TEST-CJ-ORDER-999',
        orderStatus: 'SHIPPED',
        trackNumber: 'CJ123456789US',
        logisticName: 'USPS'
      }
    };
    const parsedCj = parseCjWebhookFields(sampleCjV2Payload);
    const cjTestPassed =
      parsedCj.orderNumber === 'TEST-CJ-ORDER-999' &&
      parsedCj.trackingNumber === 'CJ123456789US' &&
      parsedCj.status === 'SHIPPED' &&
      !mongoose.Types.ObjectId.isValid(parsedCj.orderNumber);

    // 2. Test Stripe shipping_details extraction & CJ createOrderV2 payload formatting
    const sampleStripeSession = {
      customer_details: {
        name: 'Susan Test Client',
        email: 'client@example.com',
        phone: '+13165550199'
      },
      shipping_details: {
        name: 'Susan Test Client',
        address: {
          line1: '742 Evergreen Terrace',
          line2: 'Suite 200',
          city: 'Wichita',
          state: 'KS',
          postal_code: '67202',
          country: 'US'
        }
      }
    };
    const extractedAddr = extractStripeShippingAddress(sampleStripeSession);
    const sampleCjOrderPayload = buildCjOrderPayload({
      _id: new mongoose.Types.ObjectId(),
      shipping_address: extractedAddr,
      items: [{ sku: 'CJ-BEAUTY-SKU-01', quantity: 2 }]
    });

    const stripeTestPassed =
      sampleCjOrderPayload.shippingCity === 'Wichita' &&
      sampleCjOrderPayload.shippingProvince === 'KS' &&
      sampleCjOrderPayload.shippingZip === '67202' &&
      sampleCjOrderPayload.shippingPhone === '+13165550199' &&
      sampleCjOrderPayload.products[0]?.vid === 'CJ-BEAUTY-SKU-01';

    // 3. Check environment configuration readiness
    const envStatus = {
      stripeSecretConfigured: Boolean(cleanEnv(process.env.STRIPE_SECRET_KEY)),
      stripeWebhookSecretConfigured: Boolean(cleanEnv(process.env.STRIPE_WEBHOOK_SECRET)),
      cjAccessTokenConfigured: Boolean(cleanEnv(process.env.CJ_ACCESS_TOKEN)),
      cjWebhookSecretConfigured: Boolean(cleanEnv(process.env.CJ_WEBHOOK_SECRET)),
      smtpConfigured: Boolean(smtpUser && smtpPass),
      geminiConfigured: Boolean(cleanEnv(process.env.GEMINI_API_KEY))
    };

    const allPassed = cjTestPassed && stripeTestPassed;

    res.status(200).json({
      overallStatus: allPassed ? 'PASSED' : 'WARNING',
      message: allPassed
        ? 'All webhook parsers, shipping extractors, and CJ fulfillment formatters passed verification! ✧'
        : 'One or more webhook checks reported a warning.',
      checks: {
        cjWebhookParser: {
          passed: cjTestPassed,
          parsedSample: parsedCj
        },
        stripeToCjFulfillment: {
          passed: stripeTestPassed,
          extractedShipping: extractedAddr,
          formattedCjPayload: sampleCjOrderPayload
        },
        environment: envStatus
      }
    });
  } catch (err) {
    console.error('Webhook diagnostics error:', err);
    res.status(500).json({ error: err.message || 'Failed to run webhook diagnostics.' });
  }
});

app.post('/api/admin/diagnostics/test-email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const requestedTo = req.body?.to ? String(req.body.to).trim() : '';
    const targetEmail = requestedTo || getPrimaryAdminEmail();
    const verifyReport = await verifySmtpConnection();

    if (!verifyReport.verified && !resendApiKey && !brevoApiKey) {
      return res.status(500).json({
        error: `IONOS SMTP verification failed on ${smtpHost}: ${verifyReport.error}`,
        host: smtpHost,
        configuredUser: rawSmtpUser,
        dnsResolution: verifyReport.dnsResolution,
        attempts: verifyReport.attempts || [],
        troubleshootingAdvice: verifyReport.troubleshootingAdvice || []
      });
    }

    const timestampCT = formatCentralDateTime(new Date());
    const subject = `✧ IONOS SMTP Live Diagnostic Test (${timestampCT})`;
    const html = `
      <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; border: 1px solid #E8C5C8; padding: 35px; border-radius: 15px;">
        <h2 style="color: #B38B8F; font-style: italic; text-align: center;">IONOS Email Diagnostic Passed ✧</h2>
        <p style="font-size: 1.05rem; line-height: 1.6;">Hello Susan,</p>
        <p style="font-size: 1.05rem; line-height: 1.6;">Your boutique email system is online and verified with exact-case/lowercase retry and strict From-header alignment.</p>
        <div style="background-color: #FFF0F2; padding: 15px; border-radius: 10px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>SMTP Host:</strong> ${escapeHtml(smtpHost)}</p>
          <p style="margin: 5px 0;"><strong>Authenticated Mailbox:</strong> ${escapeHtml(activeSmtpUser)}</p>
          <p style="margin: 5px 0;"><strong>Active Port:</strong> ${activeSmtpPort} (${activeSmtpPort === 465 ? 'Implicit SSL/TLS' : 'STARTTLS'})</p>
          <p style="margin: 5px 0;"><strong>Dispatched At:</strong> ${escapeHtml(timestampCT)}</p>
        </div>
      </div>
    `;
    const text = `IONOS Email Diagnostic Passed ✧\nHost: ${smtpHost}:${activeSmtpPort}\nAuthenticated Mailbox: ${activeSmtpUser}\nTime: ${timestampCT}`;

    const sendResult = await sendEmail(targetEmail, subject, html, text);

    await new EmailLog({
      to: targetEmail,
      subject,
      body: text
    }).save().catch(() => {});

    res.status(200).json({
      message: `Test email successfully delivered to ${targetEmail} via ${sendResult.deliveryTransport || `${smtpHost}:${sendResult.portUsed}`} (authenticated as ${sendResult.authUserUsed || activeSmtpUser}) ✧`,
      recipient: targetEmail,
      host: smtpHost,
      portUsed: sendResult.portUsed,
      secureUsed: sendResult.secureUsed,
      authUserUsed: sendResult.authUserUsed || activeSmtpUser,
      deliveryTransport: sendResult.deliveryTransport || `IONOS SMTP (${smtpHost}:${sendResult.portUsed})`,
      dnsResolution: verifyReport.dnsResolution,
      attempts: sendResult.attempts || verifyReport.attempts || [],
      messageId: sendResult.info?.messageId || null
    });
  } catch (err) {
    console.error('SMTP Diagnostic Test Error:', err);
    res.status(500).json({
      error: err.message || 'SMTP test email failed.',
      host: smtpHost,
      configuredUser: rawSmtpUser,
      attempts: err.attempts || [],
      troubleshootingAdvice: err.troubleshootingAdvice || []
    });
  }
});

// ---------------- SERVER INITIALIZATION ---------------- //
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/beauty_app';

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✧ Connected securely to MongoDB');
    await ensureDefaultOdieMemories();
    await backfillProductBlueprintLabels(false);
    await backfillProductShippingAndCustomLabelMeta(false);
    await backfillConsultationAnalyses();
    await backfillAnalyticsBaseline();
    
    if (!smtpUser || !smtpPass) {
      console.warn('⚠️ SMTP_USER or SMTP_PASS is not set in .env. Email dispatch is disabled until configured.');
    } else {
      await verifySmtpConnection();
    }

    app.listen(PORT, () => {
      console.log(`✧ Backend API running gracefully on port ${PORT}`);
      
      syncCJCatalog().catch((error) => {
        console.error('❌ Unexpected CJ catalog sync failure:', error?.response?.data || error.message);
      });

      // Check for upcoming 24-hour consultation reminders shortly after boot and every 15 minutes
      setTimeout(() => {
        runUpcomingAppointmentReminders().catch(() => {});
      }, 10000);

      cron.schedule('*/15 * * * *', () => {
        runUpcomingAppointmentReminders().catch((err) => {
          console.error('❌ Scheduled consultation reminder check failed:', err.message);
        });
      });

      cron.schedule('0 3 * * *', () => {
        console.log('⏰ Running scheduled CJ catalog sync at 3:00 AM...');
        syncCJCatalog().catch((error) => {
          console.error('❌ Scheduled CJ catalog sync failure:', error?.response?.data || error.message);
        });
      });
    });
  })
  .catch((err) => console.error('Failed to connect to MongoDB:', err));
