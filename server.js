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

const app = express();

// ---------------- MIDDLEWARE & RATE LIMITING ---------------- //
app.use(cors());

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

// ---------------- EMAIL TRANSPORTER ---------------- //
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_PORT == 465, 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async (to, subject, htmlContent) => {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Susan\'s Beauty Consulting" <susan.coke@susansbeautyconsulting.com>',
      to,
      subject,
      html: htmlContent,
    });
    console.log(`✉️ Email dispatched to ${to}: "${subject}"`);
  } catch (err) {
    console.error(`⚠️ Failed to send email to ${to}:`, err.message);
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
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
  startTime: { type: Date, required: true, index: true },
  endTime: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'completed', 'cancelled'], 
    default: 'pending',
    index: true
  },
  depositPaid: { type: Boolean, default: false },
  notes: { type: String }
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

// ---------------- AUTHENTICATION & RBAC MIDDLEWARE ---------------- //

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
    
    // Fetch user to guarantee they still exist and retrieve their current role
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

// RBAC Factory Function
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'Access denied. Role information missing.' });
    }

    // Support legacy admin accounts that might still rely on membershipTier
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

// Pre-configured Role Checks for Routes
const requireAdmin = requireRole(['admin']);
const requireStaffOrAdmin = requireRole(['admin', 'staff']);
const requireClient = requireRole(['client', 'admin']); // Admins can test client routes


// ---------------- CJ DROPSHIPPING API INTEGRATION ---------------- //
const CJ_BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';

const getCjHeaders = () => {
  const token = process.env.CJ_ACCESS_TOKEN;
  if (!token) {
    console.warn("⚠️ CJ_ACCESS_TOKEN is missing in environment.");
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

  // 1. STRICT CATEGORY FILTER: Only allow beauty and skincare-related terms
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
        // 2. ENFORCE ENGLISH: Prioritize 'nameEn' over standard name
        const title = item.nameEn || item.productNameEn || item.productName;
        const baseSku = item.productSku || item.sku;
        const category = (item.categoryName || '').toLowerCase();
        
        if (!title || !baseSku) continue;

        // Apply the strict beauty filter
        const isBeautyProduct = beautyKeywords.some(kw => category.includes(kw) || title.toLowerCase().includes(kw));
        if (!isBeautyProduct) {
          continue; // Skip electronics, home goods, and non-beauty items
        }

        const desc = item.description || item.productDescription || '';
        const img = item.productImage || item.image;
        
        // 3. 350% RETAIL MARKUP
        const retailMarkup = 3.5;

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
            // Force English variant names
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
            tags: categorizeProduct(title, item.categoryName || ''),
            variants: mappedVariants,
            rawCjData: item 
          },
          { upsert: true, returnDocument: 'after' } 
        );
        
        totalProcessed++;
      }
      
      pageNum++;
      await delay(500); 
    }
    
    console.log(`🚀 CJ catalog sync complete! Processed ${totalProcessed} Beauty/Skincare items.`);
  } catch (error) {
    console.error("❌ Error during CJ sync:", error?.response?.data || error.message);
  }
};

// ---------------- EXPRESS ROUTES ---------------- //

app.get('/api/admin/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}, 'name email membershipTier createdAt').sort({ createdAt: -1 });
    const blueprints = await Consultation.find({}).populate('userId', 'name email').sort({ createdAt: -1 });
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

    // Wrap the body in a branded HTML template
    const htmlContent = `
      <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; border: 1px solid #E8C5C8; padding: 40px; border-radius: 15px;">
        <h2 style="color: #B38B8F; font-style: italic; text-align: center;">Susan's Beauty Consulting ✧</h2>
        <div style="font-size: 1.1rem; line-height: 1.6; white-space: pre-wrap;">
          ${body}
        </div>
        <p style="font-size: 0.9rem; color: #8A797A; margin-top: 40px; text-align: center;">Warmly,<br>Susan</p>
      </div>
    `;

    await sendEmail(to, subject, htmlContent);
    res.status(200).json({ message: 'Email dispatched successfully.' });
    
  } catch (error) {
    console.error('Email Dispatch Error:', error);
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

app.post('/api/admin/users/:userId/recommend', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { productId } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (!user.recommendedProducts.includes(productId)) {
      user.recommendedProducts.push(productId);
      await user.save();
    }
    res.status(200).json({ message: 'Product successfully pushed to user dashboard.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to push recommendation' });
  }
});

// ---------------- APPOINTMENT & CALENDAR ROUTES ---------------- //

// GET: Fetch all appointments for the calendar
app.get('/api/admin/appointments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate('clientId', 'name email')
      .populate('serviceId', 'name')
      .sort({ startTime: 1 });
    res.status(200).json(appointments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// POST: Schedule a new consultation
app.post('/api/admin/appointments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { clientId, serviceId, startTime, durationInMinutes, notes } = req.body;
    
    // Calculate end time based on duration
    const start = new Date(startTime);
    const end = new Date(start.getTime() + (durationInMinutes || 60) * 60000);

    const newAppointment = new Appointment({
      clientId,
      staffId: req.user._id, // Assigns Susan (the admin) as the staff member
      serviceId, // Optional: Can reference a specific "Consultation" service ID
      startTime: start,
      endTime: end,
      status: 'confirmed',
      notes
    });

    await newAppointment.save();
    
    // Populate client details before sending response to instantly update the UI
    const populatedAppointment = await Appointment.findById(newAppointment._id)
      .populate('clientId', 'name email');
      
    res.status(201).json(populatedAppointment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Cancel/Remove an appointment
app.delete('/api/admin/appointments/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await Appointment.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Consultation removed successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

// ---------------- END APPOINTMENT ROUTES ---------------- //

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

// NEW ENDPOINT: Fetch Order History for Authenticated User
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
      const { GoogleGenAI } = require('@google/genai');
      const ai = new GoogleGenAI({});
      
      const catalog = await Product.find({}).select('_id title tags description').lean();
      
      const prompt = `
        You are Susan, a master beauty consultant.
        Curate a bespoke 3 to 5 piece skincare and makeup ritual for this client.
        
        Client Profile:
        - Skin Temperament: ${savedConsultation.skinType}
        - Primary Vision: ${savedConsultation.primaryGoal}
        - Climate: ${savedConsultation.climate}
        - Sensitivity: ${savedConsultation.skinSensitivity}
        - Signature Aesthetic: ${savedConsultation.makeupVibe}
        - Routine Focus: ${savedConsultation.routineFocus}

        Available Boutique Products:
        ${JSON.stringify(catalog)}

        Based on the profile, select the 3 to 5 most optimal products from the catalog.
        Return ONLY a valid JSON array of the _id strings. 
        Example: ["65a123...", "65b456..."]
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json"
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

    // ---------------- STRIPE CHECKOUT ROUTING ---------------- //
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

// ---------------- STRIPE WEBHOOK (PAYMENT CONFIRMED) ---------------- //
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

    if (orderId) {
      try {
        const order = await Order.findById(orderId);
        if (order && order.status === 'Pending') {
          
          // 1. Mark as paid, extract Stripe email, and save
          order.status = 'PAID_PROCESSING';
          order.customerEmail = session.customer_details?.email || session.customer_email || 'Customer';
          await order.save();

          // 2. Dispatch Customer Receipt
          if (order.customerEmail !== 'Customer') {
            const receiptHtml = `
              <div style="font-family: 'Georgia', serif; color: #5C5454; max-width: 600px; margin: 0 auto; text-align: center; border: 1px solid #E8C5C8; padding: 40px; border-radius: 15px;">
                <h1 style="color: #B38B8F; font-style: italic;">Payment Confirmed ✧</h1>
                <p style="font-size: 1.2rem; line-height: 1.6;">Thank you for your order! Your ritual essentials are being prepared.</p>
                <p style="font-size: 1.1rem;"><strong>Order Total:</strong> $${(order.totalAmount || 0).toFixed(2)}</p>
                <p style="font-size: 0.9rem; color: #8A797A; margin-top: 30px;">You will receive another update as soon as your package ships.</p>
              </div>
            `;
            await sendEmail(order.customerEmail, "Your Susan's Beauty Consulting Receipt", receiptHtml);
          }

          // 3. Forward to CJ Dropshipping
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
        }
      } catch (err) {
        console.error(`⚠️ Failed to process paid order ${orderId}:`, err.message);
      }
    }
  }

  res.status(200).json({ received: true });
});

// ---------------- CJ DROPSHIPPING WEBHOOK ---------------- //
app.post('/webhook/cj', express.json(), async (req, res) => {
  try {
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

    // Dispatch Shipping Update
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
      await sendEmail(updatedOrder.customerEmail, "Your Susan's Beauty Consulting Order has Shipped!", shippingHtml);
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
  .then(() => {
    console.log('✧ Connected securely to MongoDB');
    app.listen(PORT, () => {
      console.log(`✧ Backend API running gracefully on port ${PORT}`);
      
      // Initial Sync on Boot
      syncCJCatalog().catch((error) => {
        console.error('❌ Unexpected CJ catalog sync failure:', error?.response?.data || error.message);
      });

      // Scheduled Daily Sync at 3:00 AM
      cron.schedule('0 3 * * *', () => {
        console.log('⏰ Running scheduled CJ catalog sync at 3:00 AM...');
        syncCJCatalog().catch((error) => {
          console.error('❌ Scheduled CJ catalog sync failure:', error?.response?.data || error.message);
        });
      });
    });
  })
  .catch((err) => console.error('Failed to connect to MongoDB:', err));