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

// ---------------- EMAIL TRANSPORTER & SECURITY HELPERS (IONOS SMTP) ---------------- //
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
const configuredPort = Number(cleanEnv(process.env.SMTP_PORT)) || 587;
const configuredSecure = process.env.SMTP_SECURE
  ? cleanEnv(process.env.SMTP_SECURE).toLowerCase() === 'true'
  : configuredPort === 465;
const fallbackPort = configuredPort === 465 ? 587 : 465;
const fallbackSecure = fallbackPort === 465;

const smtpUser = cleanEnv(process.env.SMTP_USER);
const smtpPass = cleanEnv(process.env.SMTP_PASS);
const smtpFrom = cleanEnv(process.env.SMTP_FROM) || `"Susan's Beauty Consulting" <${smtpUser || 'susan.coke@susansbeautyconsulting.com'}>`;

// Creates a Nodemailer transporter for IONOS with IPv4 enforcement (family: 4) and strict timeouts
// so cloud IPv6 DNS blackholes or blocked ports fail over in <10s instead of hanging for 2 minutes.
const createIonosTransporter = (port, secure) =>
  nodemailer.createTransport({
    host: smtpHost,
    port,
    secure, // true for 465 (Implicit SSL/TLS), false for 587 (STARTTLS)
    requireTLS: !secure, // Enforce STARTTLS upgrade when using port 587
    family: 4, // Force IPv4 resolution to prevent IPv6 ETIMEDOUT stalls on cloud hosts
    connectionTimeout: 10000, // 10 seconds max to establish TCP connection
    greetingTimeout: 10000, // 10 seconds max for SMTP greeting
    socketTimeout: 15000, // 15 seconds max for socket inactivity
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    tls: {
      minVersion: 'TLSv1.2',
      servername: smtpHost,
      rejectUnauthorized: true
    }
  });

const primaryTransporter = createIonosTransporter(configuredPort, configuredSecure);
const fallbackTransporter = createIonosTransporter(fallbackPort, fallbackSecure);
let activeSmtpPort = configuredPort;

const getOrderedTransporters = () => {
  if (activeSmtpPort === fallbackPort) {
    return [
      { client: fallbackTransporter, port: fallbackPort, secure: fallbackSecure },
      { client: primaryTransporter, port: configuredPort, secure: configuredSecure }
    ];
  }
  return [
    { client: primaryTransporter, port: configuredPort, secure: configuredSecure },
    { client: fallbackTransporter, port: fallbackPort, secure: fallbackSecure }
  ];
};

const verifySmtpConnection = async () => {
  if (!smtpUser || !smtpPass) {
    return { verified: false, error: 'SMTP_USER or SMTP_PASS is missing in environment variables.' };
  }
  const candidates = getOrderedTransporters();
  let lastError = null;

  for (const candidate of candidates) {
    try {
      await candidate.client.verify();
      activeSmtpPort = candidate.port;
      console.log(`✧ IONOS SMTP Server (${smtpHost}:${candidate.port}, secure=${candidate.secure}, IPv4) verified for ${smtpUser}`);
      return { verified: true, host: smtpHost, port: candidate.port, secure: candidate.secure };
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ SMTP verify on ${smtpHost}:${candidate.port} (secure=${candidate.secure}) failed: ${err.message}. Trying alternate port...`);
    }
  }

  return {
    verified: false,
    host: smtpHost,
    triedPorts: candidates.map(c => c.port),
    error: lastError ? lastError.message : 'Unknown SMTP verification error'
  };
};

const sendEmail = async (to, subject, htmlContent, textContent) => {
  if (!smtpUser || !smtpPass) {
    const configErr = new Error('SMTP_USER or SMTP_PASS is missing in environment variables.');
    console.error(`⚠️ Cannot send email to ${to}:`, configErr.message);
    throw configErr;
  }

  const mailOptions = {
    from: smtpFrom,
    to,
    subject,
    text: textContent,
    html: htmlContent,
  };

  const candidates = getOrderedTransporters();
  let lastError = null;

  for (const candidate of candidates) {
    try {
      const info = await candidate.client.sendMail(mailOptions);
      activeSmtpPort = candidate.port;
      console.log(`✉️ Email dispatched via ${smtpHost}:${candidate.port} to ${to}: "${subject}"`);
      return { info, portUsed: candidate.port, secureUsed: candidate.secure };
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ SMTP send failed on ${smtpHost}:${candidate.port} to ${to} (${err.code || err.message}). Retrying on alternate port...`);
    }
  }

  console.error(`❌ Failed to send email to ${to} on both ports (${configuredPort} & ${fallbackPort}):`, lastError?.message);
  throw new Error(`SMTP delivery failed across ports ${configuredPort} and ${fallbackPort}: ${lastError?.message || 'Connection timed out'}`);
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
  createdAt: { type: Date, default: Date.now }
});
const Consultation = mongoose.model('Consultation', consultationSchema);

const productSchema = new mongoose.Schema({
  title: { type: String, required: true, index: true },
  description: String,
  imageUrl: String,
  tags: { type: [String], index: true },
  variants: [{
    sku: { type: String, required: true },
    variantName: String, 
    price: Number,
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
  tracking_code: String,
  createdAt: { type: Date, default: Date.now }
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

        const mappedVariants = Array.isArray(item.variants) && item.variants.length > 0
          ? item.variants.map(v => {
              const variantRawPrice = parseFloat(v.sellPrice || v.price || rawBasePrice) || rawBasePrice;
              return {
                sku: v.vid || v.variantSku || baseSku,
                variantName: v.variantEn || v.variantName || v.variantKey || 'Standard Option',
                price: Number((variantRawPrice * retailMarkup).toFixed(2)),
                imageUrl: v.variantImage || img
              };
            })
          : [{
              sku: item.vid || baseSku,
              variantName: 'Standard',
              price: Number((rawBasePrice * retailMarkup).toFixed(2)),
              imageUrl: img
            }];

        await Product.findOneAndUpdate(
          { title },
          {
            title,
            description: desc,
            imageUrl: img,
            tags: extractCleanTags(category, title),
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

// ---------------- EXPRESS ROUTES ---------------- //

app.get('/api/admin/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}, 'name email membershipTier recommendedProducts createdAt').sort({ createdAt: -1 });
    const blueprints = await Consultation.find({}).populate('userId', 'name email recommendedProducts').sort({ createdAt: -1 });
    const orders = await Order.find({}).sort({ createdAt: -1 });
    
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

// ---------------- AI ASSISTANT ROUTE (7 EXECUTIVE BOUTIQUE TOOLS) ---------------- //
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
      return res.status(400).json({ error: 'Please enter a message for the AI Assistant.' });
    }

    const { ai, Type } = getGeminiClient();

    // Gather live boutique context for Susan's Executive Assistant
    const [rawCatalog, rawUsers, blueprints, rawAppointments] = await Promise.all([
      Product.find({}).select('_id title variants tags imageUrl').sort({ _id: -1 }).limit(180).lean(),
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
        .lean()
    ]);

    const catalog = rawCatalog.map(prod => ({
      _id: String(prod._id),
      title: prod.title,
      price: Number(prod.variants?.[0]?.price ?? prod.price ?? 0).toFixed(2),
      tags: prod.tags || []
    }));

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

    const currentCentralTimeStr = formatCentralDateTime(new Date());

    const systemInstruction = `You are Susan's elite Executive AI Assistant for "Susan's Beauty Consulting" boutique.
Current US Central Time (Kansas — America/Chicago): ${currentCentralTimeStr}.

You have direct executive tools to manage the boutique on Susan's behalf:
1. addProduct: Add a new custom beauty or skincare product to the boutique catalog.
2. updateProduct: Edit an existing product's title, price, description, imageUrl, or tags by its _id.
3. deleteProduct: Permanently remove a product from the boutique catalog by its _id.
4. sendCustomerEmail: Dispatch a real formatted email to any client or address via Susan's IONOS SMTP server and log it in Sent Messages.
5. curateProductForMember: Push a recommended product directly to a member's personal Inbox and Beauty Blueprint with a custom note from Susan.
6. scheduleConsultation: Book a 1-on-1 consultation on Susan's Central Time calendar, generate a private Jitsi video sanctuary link, and email the client.
7. sendAppointmentReminder: Immediately send a 1-on-1 consultation reminder email (with video room link) to both the client and Susan.

Live Boutique Inventory (${catalog.length} items — use _id for updateProduct, deleteProduct, or curateProductForMember):
${JSON.stringify(catalog)}

Registered Members (${members.length} accounts — use _id for curateProductForMember or scheduleConsultation):
${JSON.stringify(members)}

Client Beauty Blueprints (${blueprints.length} profiles):
${JSON.stringify(blueprints)}

Scheduled Consultations (${upcomingAppointments.length} active — use _id for sendAppointmentReminder):
${JSON.stringify(upcomingAppointments)}

Always execute the appropriate tool when Susan asks you to add/edit/remove a product, send an email, curate a product for a member, schedule a consultation, or send a consultation reminder. Maintain a graceful, warm, and executive tone.`;

    // Build a clean, alternating multi-turn contents array that ignores error bubbles
    const contents = [];
    if (Array.isArray(history)) {
      for (const msg of history) {
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
      const payload = { actionsTaken: [] };

      for (const call of response.functionCalls) {
        const args = call.args || {};

        if (call.name === 'addProduct') {
          const cleanTitle = String(args.title || '').trim();
          const cleanPrice = parseFloat(args.price) || 0;
          const cleanDesc = String(args.description || '').trim();
          const cleanImg = String(args.imageUrl || '').trim();
          const tagList = args.tags
            ? String(args.tags).split(',').map(t => t.trim()).filter(Boolean)
            : ['beauty', 'skincare'];

          const created = new Product({
            title: cleanTitle || 'Susan Bespoke Essential',
            description: cleanDesc,
            imageUrl: cleanImg,
            tags: tagList,
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
          summaries.push(`✧ Added "${created.title}" ($${cleanPrice.toFixed(2)}) to the boutique inventory.`);
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
            summaries.push(`✧ Updated "${prod.title}" ($${updatedPrice}) in the boutique catalog.`);
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
            summaries.push(`✧ Permanently removed "${deleted.title}" from the boutique database.`);
          } else {
            summaries.push(`✧ Could not find a product with ID "${pid}" in the database.`);
          }
        }

        else if (call.name === 'sendCustomerEmail') {
          const cleanTo = normalizeEmail(args.to);
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
            summaries.push(`✧ Dispatched email "${cleanSubject}" to ${cleanTo} and logged it in Sent Messages.`);
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
            payload.curatedRecommendation = {
              userId: String(member._id),
              productId: String(product._id),
              inboxItemId: String(inboxItem._id)
            };
            payload.actionsTaken.push('curateProductForMember');
            summaries.push(`✧ Pushed "${product.title}" to ${member.name}'s Sanctuary Inbox & Beauty Blueprint with your note.`);
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
              summaries.push(`✧ Scheduled a 1-on-1 consultation with ${clientUser.name} for ${formatCentralDateTime(start)} and emailed their Video Sanctuary link.`);
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
            summaries.push(`✧ Sent 1-on-1 consultation reminder email to ${reminderResult.clientEmail || 'client'} and to your inbox for ${reminderResult.formattedTime}.`);
          }
        }
      }

      return res.status(200).json({
        response: summaries.join('\n\n') || '✧ Completed your request, Susan.',
        ...payload
      });
    }

    const replyText = (response && typeof response.text === 'string' && response.text.trim())
      ? response.text.trim()
      : "I'm here, Susan ✧ Could you rephrase that request for me?";

    res.status(200).json({ response: replyText });

  } catch (error) {
    console.error("AI Chat Error:", error);
    res.status(500).json({ 
      error: error?.message || 'Failed to communicate with AI Assistant.' 
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
  const susanEmail = normalizeEmail(smtpUser || 'susan.coke@susansbeautyconsulting.com');
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

// ---------------- MANUAL INVENTORY ROUTES ---------------- //

app.post('/api/admin/products', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, description, imageUrl, price, tags } = req.body;
    
    const newProduct = new Product({
      title,
      description,
      imageUrl,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      variants: [{
        sku: `CUSTOM-${Date.now()}`,
        variantName: 'Standard',
        price: parseFloat(price) || 0,
        imageUrl
      }]
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, description, imageUrl, price, tags } = req.body;
    const product = await Product.findById(req.params.id);
    
    if (!product) return res.status(404).json({ error: 'Product not found' });

    product.title = title;
    product.description = description;
    product.imageUrl = imageUrl;
    
    if (tags) {
      product.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
    }

    if (product.variants && product.variants.length > 0) {
      product.variants[0].price = parseFloat(price) || product.variants[0].price;
      if (imageUrl) product.variants[0].imageUrl = imageUrl;
    } else {
      product.variants = [{ 
        sku: `CUSTOM-${Date.now()}`, 
        variantName: 'Standard', 
        price: parseFloat(price) || 0, 
        imageUrl 
      }];
    }

    await product.save();
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    const { category } = req.query;
    const filter = category ? { tags: new RegExp(`^${category}$`, 'i') } : {};
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
    res.status(200).json({
      hasCompletedQuiz: Boolean(existingBlueprint),
      blueprint: existingBlueprint || null
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
      return res.status(403).json({
        error: 'Your Beauty Blueprint is a one-time personal curation and is permanently locked to your membership profile.',
        blueprint: existingConsultation
      });
    }

    const newConsultation = new Consultation({
      ...req.body,
      userId: req.user._id
    });
    const savedConsultation = await newConsultation.save();

    // ---------------- GOOGLE GEN AI CURATION ---------------- //
    try {
      const { ai, Type } = getGeminiClient();
      
      const rawCatalog = await Product.find({}).select('_id title variants tags description').limit(150).lean();
      const catalog = rawCatalog.map(prod => ({
        _id: prod._id,
        title: prod.title,
        price: Number(prod.variants?.[0]?.price ?? prod.price ?? 0).toFixed(2),
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
      console.error("⚠️ AI Curation failed. Consultation saved, but recommendations skipped:", aiError.message);
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
const buildCjOrderPayload = (order) => {
  const address = order.shipping_address || {};
  const customerName = (
    address.name ||
    `${address.first_name || 'Valued'} ${address.last_name || 'Customer'}`
  ).trim();

  return {
    orderNumber: String(order._id || 'TEST-ORDER'),
    shippingZip: String(address.postcode || '00000'),
    shippingCountryCode: String(address.country || 'US'),
    shippingProvince: String(address.state || 'KS'),
    shippingCity: String(address.city || 'Wichita'),
    shippingAddress: String(address.address_1 || 'Pending'),
    shippingCustomerName: customerName,
    shippingPhone: String(address.phone || '0000000000'),
    products: (Array.isArray(order.items) ? order.items : []).map(item => ({
      vid: String(item.vid || item.sku || ''),
      sku: String(item.sku || ''),
      quantity: Math.max(1, Number(item.quantity) || 1)
    }))
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
              await axios.post(`${CJ_BASE_URL}/shopping/order/createOrderV2`, cjPayload, { headers, timeout: 15000 });
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

          await sendEmail('susan.coke@susansbeautyconsulting.com', '✧ New Order Auto-Processed', susanHtml, susanText).catch(() => {});
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
    const targetEmail = normalizeEmail(req.body?.to || req.user?.email || smtpUser || 'susan.coke@susansbeautyconsulting.com');
    const verifyReport = await verifySmtpConnection();

    if (!verifyReport.verified) {
      return res.status(500).json({
        error: `SMTP verification failed on ${smtpHost} (ports ${configuredPort} & ${fallbackPort}): ${verifyReport.error}`,
        verifyReport
      });
    }

    const timestampCT = formatCentralDateTime(new Date());
    const subject = `✧ IONOS SMTP Live Diagnostic Test (${timestampCT})`;
    const html = `
      <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; border: 1px solid #E8C5C8; padding: 35px; border-radius: 15px;">
        <h2 style="color: #B38B8F; font-style: italic; text-align: center;">IONOS Email Diagnostic Passed ✧</h2>
        <p style="font-size: 1.05rem; line-height: 1.6;">Hello Susan,</p>
        <p style="font-size: 1.05rem; line-height: 1.6;">Your boutique email system is online and verified with dual-port IPv4 auto-fallback.</p>
        <div style="background-color: #FFF0F2; padding: 15px; border-radius: 10px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>SMTP Host:</strong> ${escapeHtml(smtpHost)}</p>
          <p style="margin: 5px 0;"><strong>Active Port:</strong> ${activeSmtpPort} (${activeSmtpPort === 465 ? 'Implicit SSL/TLS' : 'STARTTLS'})</p>
          <p style="margin: 5px 0;"><strong>Dispatched At:</strong> ${escapeHtml(timestampCT)}</p>
        </div>
      </div>
    `;
    const text = `IONOS Email Diagnostic Passed ✧
Host: ${smtpHost}:${activeSmtpPort}
Time: ${timestampCT}`;

    const sendResult = await sendEmail(targetEmail, subject, html, text);

    await new EmailLog({
      to: targetEmail,
      subject,
      body: text
    }).save().catch(() => {});

    res.status(200).json({
      message: `Test email successfully delivered to ${targetEmail} via ${smtpHost}:${sendResult.portUsed} ✧`,
      recipient: targetEmail,
      host: smtpHost,
      portUsed: sendResult.portUsed,
      secureUsed: sendResult.secureUsed,
      messageId: sendResult.info?.messageId || null
    });
  } catch (err) {
    console.error('SMTP Diagnostic Test Error:', err);
    res.status(500).json({
      error: err.message || 'SMTP test email failed.'
    });
  }
});

// ---------------- SERVER INITIALIZATION ---------------- //
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/beauty_app';

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✧ Connected securely to MongoDB');
    
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