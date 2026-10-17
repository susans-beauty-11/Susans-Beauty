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

// ---------------- EMAIL TRANSPORTER (IONOS SMTP) ---------------- //
const cleanEnv = (val) => (val || '').toString().trim().replace(/^["']|["']$/g, '');

const smtpHost = cleanEnv(process.env.SMTP_HOST) || 'smtp.ionos.com';
const smtpPort = Number(cleanEnv(process.env.SMTP_PORT)) || 465;
const smtpSecure = process.env.SMTP_SECURE
  ? cleanEnv(process.env.SMTP_SECURE).toLowerCase() === 'true'
  : smtpPort === 465;
const smtpUser = cleanEnv(process.env.SMTP_USER);
const smtpPass = cleanEnv(process.env.SMTP_PASS);
const smtpFrom = cleanEnv(process.env.SMTP_FROM) || `"Susan's Beauty Consulting" <${smtpUser || 'susan.coke@susansbeautyconsulting.com'}>`;

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure, // true for 465 (Implicit SSL/TLS), false for 587 (STARTTLS)
  requireTLS: !smtpSecure, // Enforce STARTTLS upgrade when using port 587
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  tls: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  }
});

const sendEmail = async (to, subject, htmlContent, textContent) => {
  if (!smtpUser || !smtpPass) {
    const configErr = new Error('SMTP_USER or SMTP_PASS is missing in environment variables.');
    console.error(`⚠️ Cannot send email to ${to}:`, configErr.message);
    throw configErr;
  }
  try {
    await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      text: textContent,
      html: htmlContent,
    });
    console.log(`✉️ Email dispatched to ${to}: "${subject}"`);
  } catch (err) {
    console.error(`⚠️ Failed to send email to ${to}:`, err.message);
    throw err;
  }
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
  previousStartTime: { type: Date, default: null }
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


// ---------------- CJ DROPSHIPPING API INTEGRATION ---------------- //
const CJ_BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';

const getCjHeaders = () => {
  const token = process.env.CJ_ACCESS_TOKEN;
  if (!token) {
    console.warn("⚠ CJ_ACCESS_TOKEN is missing in environment.");
    return null;
  }
  return {
    'CJ-Access-Token': token.trim(),
    'Content-Type': 'application/json'
  };
};

const syncCJCatalog = async () => {
  const headers = getCjHeaders();
  if (!headers) return;

  console.log("🔄 Starting CJ Dropshipping catalog sync (Filtered for Beauty & Cosmetics)...");

  let pageNum = 1;
  const pageSize = 50;
  let hasMoreProducts = true;
  let totalProcessed = 0;

  const beautyKeywords = ['beauty', 'skin', 'cosmetic', 'makeup', 'health', 'hair', 'face', 'care', 'lotion', 'serum', 'cream', 'cleanser'];

  try {
    while (hasMoreProducts) {
      console.log(`🔍 Fetching CJ products -> Page ${pageNum}`);
      
      const response = await axios.get(`${CJ_BASE_URL}/product/list?pageNum=${pageNum}&pageSize=${pageSize}`, { headers });
      const cjProducts = response.data?.data?.list || response.data?.data?.content || [];

      if (cjProducts.length === 0) {
        hasMoreProducts = false;
        break;
      }

      for (const item of cjProducts) {
        const title = item.nameEn || item.productNameEn || item.productName;
        const baseSku = item.productSku || item.sku;
        const category = (item.categoryName || '').toLowerCase();
        
        if (!title || !baseSku) continue;

        const isBeautyProduct = beautyKeywords.some(kw => category.includes(kw) || title.toLowerCase().includes(kw));
        if (!isBeautyProduct) {
          continue; 
        }

        const desc = item.description || item.productDescription || '';
        const img = item.productImage || item.image;
        
        const retailMarkup = 6.5;

        let rawBasePrice = parseFloat(item.sellPrice || item.price || 0);
        
        if (rawBasePrice === 0 && item.variants && item.variants.length > 0) {
          const validVariant = item.variants.find(v => parseFloat(v.sellPrice || v.price || 0) > 0);
          if (validVariant) {
            rawBasePrice = parseFloat(validVariant.sellPrice || validVariant.price);
          }
        }

        if (rawBasePrice === 0) {
          console.warn(`⚠️ Skipping ${title} (SKU: ${baseSku}) - No valid price found.`);
          continue;
        }

        const mappedVariants = item.variants && item.variants.length > 0 ? item.variants.map(v => {
          const variantRawPrice = parseFloat(v.sellPrice || v.price || rawBasePrice);
          return {
            sku: v.vid || v.variantSku || baseSku, 
            variantName: v.variantEn || v.variantName || v.variantKey || 'Standard Option',
            price: variantRawPrice * retailMarkup, 
            imageUrl: v.variantImage || img
          };
        }) : [{
          sku: baseSku,
          variantName: title,
          price: rawBasePrice * retailMarkup,
          imageUrl: img
        }];

        await Product.findOneAndUpdate(
          { title: title },
          {
            title: title,
            description: desc,
            imageUrl: img,
            tags: category.split(' '),
            variants: mappedVariants,
            rawCjData: item 
          },
          { upsert: true, returnDocument: 'after' } 
        );
        
        totalProcessed++;
      }
      
      pageNum++;
      await delay(1500); 
    }
    
    console.log(`🚀 CJ catalog sync complete! Processed ${totalProcessed} Beauty/Skincare items.`);
  } catch (error) {
    console.error("❌ Error during CJ sync:", error?.response?.data || error.message);
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
    
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'Missing required email fields (to, subject, body).' });
    }

    const htmlContent = `
      <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; border: 1px solid #E8C5C8; padding: 40px; border-radius: 15px;">
        <h2 style="color: #B38B8F; font-style: italic; text-align: center;">Susan's Beauty Consulting ✧</h2>
        <div style="font-size: 1.1rem; line-height: 1.6; white-space: pre-wrap;">
          ${body}
        </div>
        <p style="font-size: 0.9rem; color: #8A797A; margin-top: 40px; text-align: center;">Warmly,<br>Susan</p>
      </div>
    `;

    const textContent = `${body}\n\nWarmly,\nSusan\nSusan's Beauty Consulting`;

    await sendEmail(to, subject, htmlContent, textContent);
    
    const newLog = new EmailLog({ to, subject, body });
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

// ---------------- AI ASSISTANT ROUTE ---------------- //
const getGeminiClient = () => {
  let GoogleGenAI, Type;
  try {
    ({ GoogleGenAI, Type } = require('@google/genai'));
  } catch (err) {
    throw new Error("Missing '@google/genai' package on server. Run: npm install @google/genai");
  }

  const rawKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
  if (!rawKey) {
    throw new Error('GEMINI_API_KEY is missing or empty in server .env file.');
  }

  return { ai: new GoogleGenAI({ apiKey: rawKey }), Type };
};

app.post('/api/admin/ai-chat', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Please enter a message for the AI Assistant.' });
    }

    const { ai, Type } = getGeminiClient();

    const rawCatalog = await Product.find({}).select('_id title variants tags').limit(150).lean();
    const catalog = rawCatalog.map(prod => ({
      _id: prod._id,
      title: prod.title,
      price: Number(prod.variants?.[0]?.price ?? prod.price ?? 0).toFixed(2),
      tags: prod.tags || []
    }));
    const blueprints = await Consultation.find({})
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const systemInstruction = `You are Susan's elite AI Assistant for her boutique.
Your job is to help Susan draft elegant emails to clients, evaluate skin profiles, and manage the boutique inventory.
Here is the current boutique inventory (use the _id field if you need to delete a product): ${JSON.stringify(catalog)}.
Here are the recent client blueprints: ${JSON.stringify(blueprints)}.
Maintain a graceful, sophisticated, and helpful tone.`;

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

    const deleteProductTool = {
      functionDeclarations: [{
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
      }]
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
        tools: [deleteProductTool],
        temperature: 0.2,
      }
    });

    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      
      if (call.name === 'deleteProduct') {
        const pid = call.args?.productId;
        const deleted = pid ? await Product.findByIdAndDelete(pid) : null;
        console.log(`🤖 AI triggered deletion of product ID: ${pid}`);
        return res.status(200).json({ 
          response: deleted
            ? `✧ Done. I have permanently removed "${deleted.title}" from the boutique's database, Susan.`
            : `✧ I couldn't find a product with ID ${pid} in the database, Susan.`,
          deletedProductId: deleted ? pid : null
        });
      }
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

// ---------------- APPOINTMENT & CALENDAR ROUTES (TWO-WAY SYNC) ---------------- //

const buildDefaultMeetingLink = () => {
  const roomCode = crypto.randomBytes(4).toString('hex');
  return `https://meet.jit.si/SusansBoutique_Consultation_${roomCode}`;
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

    const start = new Date(startTime);
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
      const formattedTime = start.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
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
      const newStart = new Date(startTime);
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
      const formattedTime = new Date(populatedAppointment.startTime).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
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

    const start = new Date(startTime);
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
      const formattedTime = start.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
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
      const newStart = new Date(startTime);
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

// ---------------- PASSWORD RESET ROUTES ---------------- //

app.post('/api/users/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
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
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
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
    const { name, email, password, membershipTier } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already in use.' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      membershipTier: membershipTier || 'luminary'
    });

    const savedUser = await newUser.save();
    const token = jwt.sign({ _id: savedUser._id }, process.env.JWT_SECRET || 'fallback_secret_key', { expiresIn: '24h' });

    res.status(201).json({ user: { id: savedUser._id, name: savedUser.name, email: savedUser.email, membershipTier: savedUser.membershipTier }, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid email or password.' });

    let validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword && password === user.password) {
      validPassword = true;
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
      await user.save();
    }

    if (!validPassword) return res.status(400).json({ error: 'Invalid email or password.' });

    if (user.email.toLowerCase() === 'susan.coke@susansbeautyconsulting.com' && user.membershipTier !== 'admin') {
      user.membershipTier = 'admin';
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

    const orders = await Order.find({ customerEmail: user.email }).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order history' });
  }
});

app.post('/api/consultations', authenticateToken, async (req, res) => {
  try {
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
        model: 'gemini-2.5-flash',
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

app.post('/api/cart-checkout', async (req, res) => {
  try {
    const { items, shipping_address } = req.body;
    
    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Cannot process an empty cart.' });
    }

    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const newOrder = new Order({ 
      items, 
      totalAmount,
      shipping_address 
    });
    await newOrder.save();

    const line_items = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.displayTitle || item.title,
          images: item.imageUrl ? [item.imageUrl.startsWith('//') ? `https:${item.imageUrl}` : item.imageUrl] : [],
        },
        unit_amount: Math.round(item.price * 100), 
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items,
      metadata: {
        orderId: newOrder._id.toString() 
      },
      success_url: `${req.headers.origin || 'http://localhost:3000'}/?cart_success=true`,
      cancel_url: `${req.headers.origin || 'http://localhost:3000'}/?cart_canceled=true`,
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`⚠️ Stripe Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    const orderId = session.metadata?.orderId;
    const tier = session.metadata?.tier;
    const userId = session.metadata?.userId;

    if (orderId) {
      try {
        const order = await Order.findById(orderId);
        if (order && order.status === 'Pending') {
          
          order.status = 'PAID_PROCESSING';
          order.customerEmail = session.customer_details?.email || session.customer_email || 'Customer';
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

            await sendEmail(order.customerEmail, "Your Susan's Beauty Consulting Receipt", receiptHtml, receiptText);
          }

          const headers = getCjHeaders();
          const address = order.shipping_address || {};
          
          const cjPayload = {
            orderNumber: order._id.toString(),
            shippingZip: address.postcode || "00000",
            shippingCountryCode: address.country || "US",
            shippingProvince: address.state || "Pending",
            shippingCity: address.city || "Pending",
            shippingAddress: address.address_1 || "Pending",
            shippingCustomerName: `${address.first_name || 'Customer'} ${address.last_name || ''}`.trim(),
            shippingPhone: address.phone || "0000000000",
            products: order.items.map(item => ({
              vid: item.sku, 
              quantity: item.quantity
            }))
          };

          const response = await axios.post(`${CJ_BASE_URL}/shopping/order/createOrderV2`, cjPayload, { headers });
          console.log(`💸 Payment cleared. Order ${orderId} forwarded to CJ Dropshipping.`);

          // --- NEW STEP 4: NOTIFY SUSAN ---
          const susanHtml = `
            <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; border: 1px solid #E8C5C8; padding: 40px; border-radius: 15px;">
              <h2 style="color: #B38B8F; font-style: italic; text-align: center;">Automated Order Processed ✧</h2>
              <p style="font-size: 1.1rem; line-height: 1.6;">Susan,</p>
              <p style="font-size: 1.1rem; line-height: 1.6;">A new order has been placed and automatically routed to CJ Dropshipping for fulfillment.</p>
              <div style="background-color: #FFF0F2; padding: 15px; border-radius: 10px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Customer:</strong> ${cjPayload.shippingCustomerName}</p>
                <p style="margin: 5px 0;"><strong>Order Total:</strong> $${(order.totalAmount || 0).toFixed(2)}</p>
                <p style="margin: 5px 0;"><strong>Order ID:</strong> ${order._id.toString()}</p>
              </div>
              <p style="font-size: 1.1rem; line-height: 1.6;">No action is required on your part. The funds are processing via Stripe.</p>
            </div>
          `;
          
          const susanText = `Automated Order Processed ✧\n\nSusan, a new order has been placed by ${cjPayload.shippingCustomerName} for $${(order.totalAmount || 0).toFixed(2)} and forwarded to CJ Dropshipping.\n\nOrder ID: ${order._id.toString()}`;

          await sendEmail('susan.coke@susansbeautyconsulting.com', '✧ New Order Auto-Processed', susanHtml, susanText);
          console.log(`✉️ Admin notification dispatched to Susan for Order ${orderId}`);
          // --------------------------------

        }
      } catch (err) {
        console.error(`⚠️ Failed to process paid order ${orderId}:`, err.message);
      }
    } 
    else if (tier && userId) {
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
          
          await sendEmail(user.email, "Your Membership is Active ✧", welcomeHtml, welcomeText);
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
    const providedToken = req.query.token;
    const expectedToken = process.env.CJ_WEBHOOK_SECRET;

    if (!expectedToken || providedToken !== expectedToken) {
      console.warn(`⚠️ Unauthorized CJ webhook attempt from IP: ${req.ip}`);
      return res.status(403).json({ error: 'Forbidden: Invalid webhook authentication.' });
    }

    const { orderNumber, trackingNumber, status } = req.body;
    console.log(`📦 CJ Webhook Received - Order: ${orderNumber}, Status: ${status}, Tracking: ${trackingNumber}`);

    if (!orderNumber) {
      return res.status(400).json({ error: "Missing orderNumber" });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderNumber, 
      { 
        status: status || 'SHIPPED', 
        tracking_code: trackingNumber 
      },
      { returnDocument: 'after' } 
    );

    if (!updatedOrder) {
      console.warn(`⚠️ CJ webhook failed: Order ${orderNumber} not found in DB.`);
      return res.status(200).json({ received: true });
    }

    if (trackingNumber && updatedOrder.customerEmail && updatedOrder.customerEmail !== 'Customer') {
      const shippingHtml = `
        <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; text-align: center; border: 1px solid #E8C5C8; padding: 40px; border-radius: 15px;">
          <h1 style="color: #B38B8F; font-style: italic;">Your Ritual has Shipped ✈️</h1>
          <p style="font-size: 1.2rem; line-height: 1.6;">Your bespoke beauty products have left our facility and are on their way to you!</p>
          <div style="background-color: #FFF0F2; padding: 15px; border-radius: 10px; display: inline-block; margin: 20px 0;">
            <p style="margin: 0; font-size: 1.1rem;">Tracking Number:</p>
            <strong style="font-size: 1.3rem; color: #B38B8F;">${trackingNumber}</strong>
          </div>
          <p style="font-size: 0.9rem; color: #8A797A;">Please allow up to 24-48 hours for the tracking link to activate with the courier.</p>
        </div>
      `;

      const shippingText = `Your Ritual has Shipped ✈️\n\nYour bespoke beauty products have left our facility and are on their way to you!\n\nTracking Number: ${trackingNumber}\n\nPlease allow up to 24-48 hours for the tracking link to activate with the courier.\n\nWarmly,\nSusan\nSusan's Beauty Consulting`;

      await sendEmail(updatedOrder.customerEmail, "Your Susan's Beauty Consulting Order has Shipped!", shippingHtml, shippingText);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error(`⚠️ Error handling CJ webhook:`, err.message);
    res.status(500).json({ error: 'Internal Server Error' });
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
      try {
        await transporter.verify();
        console.log(`✧ IONOS SMTP Server (${smtpHost}:${smtpPort}, secure=${smtpSecure}) verified for ${smtpUser}`);
      } catch (smtpError) {
        console.error(
          `⚠️ SMTP Verification failed on startup (${smtpHost}:${smtpPort}, secure=${smtpSecure}):`,
          smtpError.message
        );
      }
    }

    app.listen(PORT, () => {
      console.log(`✧ Backend API running gracefully on port ${PORT}`);
      
      syncCJCatalog().catch((error) => {
        console.error('❌ Unexpected CJ catalog sync failure:', error?.response?.data || error.message);
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