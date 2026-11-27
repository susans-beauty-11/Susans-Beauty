#!/usr/bin/env node
/**
 * apply_email_signup_and_newsletter_popup.js
 *
 * Safely and idempotently patches `server.js` and `App.js` to:
 *
 *  Part A — server.js:
 *    1. Adds `NewsletterSubscriber` MongoDB schema & model to store mailing list signups.
 *    2. Adds `POST /api/newsletter/subscribe` (public) and `GET /api/admin/newsletter/subscribers`
 *       (admin-only) routes, with non-blocking welcome email dispatch via IONOS SMTP.
 *    3. Updates `POST /api/users/register` so new email sign-ups save `phone` and automatically
 *       enroll opted-in members into `NewsletterSubscriber`.
 *
 *  Part B — App.js:
 *    1. Adds `NewsletterDealsModal` — a rose-gold pop-up inviting visitors and new signups to
 *       join Susan's VIP deals, seasonal offers, and events mailing list.
 *    2. Upgrades the top Landing Page auth card (`#sanctuary-signin-top`) with a
 *       **Sign In | Create Account** toggle so visitors can register directly with their
 *       Full Name, Email Address, Phone Number, Password, and Mailing List opt-in—without
 *       needing Google, Facebook, X, or any social login.
 *    3. Automatically displays the deals & events pop-up when a visitor enters the Boutique
 *       (public or member sanctuary) or right after signing up (respecting dismissal/subscription).
 *
 * Usage:
 *   node apply_email_signup_and_newsletter_popup.js
 *   node apply_email_signup_and_newsletter_popup.js path/to/server.js path/to/App.js
 */

const fs = require('fs');
const path = require('path');

// ---------------- FILE DISCOVERY & IO HELPERS ---------------- //

const findFirstExistingFile = (candidates = []) => {
  for (const relPath of candidates) {
    if (!relPath) continue;
    const resolved = path.resolve(process.cwd(), relPath);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return resolved;
    }
  }
  return null;
};

const readNormalized = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  return {
    text: raw.replace(/\r\n/g, '\n'),
    eol
  };
};

const writeWithOriginalEol = (filePath, normalizedText, eol) => {
  const backupPath = `${filePath}.email_signup_popup_${Date.now()}.bak`;
  fs.copyFileSync(filePath, backupPath);
  const output = eol === '\r\n' ? normalizedText.replace(/\n/g, '\r\n') : normalizedText;
  fs.writeFileSync(filePath, output, 'utf8');
  return backupPath;
};

// ---------------- PART A: SERVER.JS PATCHER ---------------- //

const patchServerFile = (serverPath) => {
  console.log(`\n🔧 Patching backend mailing list & registration in: ${serverPath}`);
  let { text, eol } = readNormalized(serverPath);
  let changesApplied = 0;

  // 1. Add NewsletterSubscriber schema right after EmailLog model
  const emailLogAnchor = "const EmailLog = mongoose.model('EmailLog', emailLogSchema);";
  const newsletterSchemaBlock = [
    emailLogAnchor,
    '',
    '// Mailing List / Deals & Events Subscribers Schema',
    'const newsletterSubscriberSchema = new mongoose.Schema({',
    '  email: { type: String, required: true, unique: true, index: true },',
    "  name: { type: String, default: '' },",
    "  source: { type: String, default: 'boutique_popup' },",
    '  subscribed: { type: Boolean, default: true, index: true },',
    '  subscribedAt: { type: Date, default: Date.now }',
    '});',
    "const NewsletterSubscriber = mongoose.models.NewsletterSubscriber || mongoose.model('NewsletterSubscriber', newsletterSubscriberSchema);"
  ].join('\n');

  if (text.includes('const NewsletterSubscriber =')) {
    console.log('  ✓ [A.1] NewsletterSubscriber schema already present (skipped)');
  } else if (text.includes(emailLogAnchor)) {
    text = text.replace(emailLogAnchor, newsletterSchemaBlock);
    changesApplied++;
    console.log('  ✅ [A.1] Added NewsletterSubscriber MongoDB schema & model');
  } else {
    throw new Error('[A.1] Could not find EmailLog model anchor in server.js.');
  }

  // 2. Add POST /api/newsletter/subscribe & GET /api/admin/newsletter/subscribers routes above /api/users/register
  const registerAnchor = "app.post('/api/users/register', authLimiter, async (req, res) => {";
  const newsletterRoutesBlock = [
    '// ---------------- MAILING LIST / DEALS & EVENTS SUBSCRIPTION ROUTES ---------------- //',
    '',
    "app.post('/api/newsletter/subscribe', async (req, res) => {",
    '  try {',
    '    const { email, name, source } = req.body || {};',
    '    const cleanEmail = normalizeEmail(email);',
    "    const cleanName = String(name || '').trim();",
    "    const cleanSource = String(source || 'boutique_popup').trim();",
    '',
    '    if (!cleanEmail || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(cleanEmail)) {',
    "      return res.status(400).json({ error: 'Please enter a valid email address.' });",
    '    }',
    '',
    '    const existing = await NewsletterSubscriber.findOne({ email: cleanEmail });',
    '    const alreadySubscribed = Boolean(existing && existing.subscribed);',
    '',
    '    const subscriber = await NewsletterSubscriber.findOneAndUpdate(',
    '      { email: cleanEmail },',
    '      {',
    '        $set: {',
    '          email: cleanEmail,',
    '          ...(cleanName ? { name: cleanName } : {}),',
    '          source: cleanSource,',
    '          subscribed: true,',
    '          subscribedAt: existing?.subscribedAt || new Date()',
    '        }',
    '      },',
    '      { upsert: true, new: true }',
    '    );',
    '',
    '    if (!alreadySubscribed && typeof sendEmail === \'function\') {',
    '      const greetingName = cleanName || \'Beauty Lover\';',
    "      const subject = \"Welcome to Susan's VIP Deals & Events List ✧\";",
    '      const htmlContent = `',
    '        <div style="font-family: \'Georgia\', serif; color: #5C5454; max-width: 600px; margin: 0 auto; border: 1px solid #E8C5C8; padding: 36px; border-radius: 16px; background: #FFF9F9;">',
    '          <h2 style="color: #B38B8F; font-style: italic; text-align: center; margin-top: 0;">You\'re on the VIP List ✧</h2>',
    '          <p style="font-size: 1.08rem; line-height: 1.65;">Dear ${escapeHtml(greetingName)},</p>',
    '          <p style="font-size: 1.05rem; line-height: 1.65;">Thank you for joining <strong>Susan\'s Beauty Consulting</strong> mailing list! You\'ll be the first to hear about exclusive boutique deals, seasonal skincare offers, new arrivals, and private Sanctuary events.</p>',
    '          <p style="font-size: 0.95rem; color: #8A797A; margin-top: 28px; text-align: center;">Warmly,<br/>Susan\'s Beauty Consulting</p>',
    '        </div>',
    '      `;',
    '      const textContent = `Welcome ${greetingName}! You are now subscribed to Susan\'s Beauty Consulting deals, seasonal offers, and VIP events.`;',
    '      sendEmail(cleanEmail, subject, htmlContent, textContent).catch(() => {});',
    '    }',
    '',
    '    return res.status(200).json({',
    '      success: true,',
    '      alreadySubscribed,',
    '      subscriber,',
    '      message: alreadySubscribed',
    "        ? \"You're already on Susan's VIP Deals & Events list! ✧\"",
    "        : \"Welcome! You're now on Susan's VIP Deals & Events list. ✧\"",
    '    });',
    '  } catch (error) {',
    "    console.error('Newsletter Subscribe Error:', error);",
    "    return res.status(500).json({ error: 'Unable to subscribe right now. Please try again.' });",
    '  }',
    '});',
    '',
    "app.get('/api/admin/newsletter/subscribers', authenticateToken, requireAdmin, async (req, res) => {",
    '  try {',
    '    const subscribers = await NewsletterSubscriber.find({ subscribed: true }).sort({ subscribedAt: -1 }).lean();',
    '    res.status(200).json({ total: subscribers.length, subscribers });',
    '  } catch (error) {',
    "    res.status(500).json({ error: 'Failed to load newsletter subscribers.' });",
    '  }',
    '});',
    ''
  ].join('\n');

  if (text.includes("app.post('/api/newsletter/subscribe'")) {
    console.log('  ✓ [A.2] Newsletter subscribe & admin list routes already present (skipped)');
  } else if (text.includes(registerAnchor)) {
    text = text.replace(registerAnchor, `${newsletterRoutesBlock}\n${registerAnchor}`);
    changesApplied++;
    console.log('  ✅ [A.2] Added POST /api/newsletter/subscribe and GET /api/admin/newsletter/subscribers');
  } else {
    throw new Error('[A.2] Could not find /api/users/register anchor in server.js.');
  }

  // 3. Auto-enroll opted-in new email signups into NewsletterSubscriber inside /api/users/register
  const regSaveOld = [
    '    const savedUser = await newUser.save();',
    "    const token = jwt.sign({ _id: savedUser._id }, process.env.JWT_SECRET || 'fallback_secret_key', { expiresIn: '24h' });"
  ].join('\n');

  const regSaveNew = [
    '    const savedUser = await newUser.save();',
    '    if (req.body?.marketingOptIn !== false && cleanEmail) {',
    '      NewsletterSubscriber.findOneAndUpdate(',
    '        { email: cleanEmail },',
    "        { $set: { email: cleanEmail, name: cleanName, source: 'landing_signup', subscribed: true, subscribedAt: new Date() } },",
    '        { upsert: true }',
    '      ).catch(() => {});',
    '    }',
    "    const token = jwt.sign({ _id: savedUser._id }, process.env.JWT_SECRET || 'fallback_secret_key', { expiresIn: '24h' });"
  ].join('\n');

  if (text.includes("source: 'landing_signup'")) {
    console.log('  ✓ [A.3] /api/users/register already syncs opted-in users to NewsletterSubscriber (skipped)');
  } else if (text.includes(regSaveOld)) {
    text = text.replace(regSaveOld, regSaveNew);
    changesApplied++;
    console.log('  ✅ [A.3] Hooked NewsletterSubscriber opt-in sync into POST /api/users/register');
  } else {
    throw new Error('[A.3] Could not find savedUser/token block inside /api/users/register.');
  }

  if (changesApplied > 0) {
    const backupPath = writeWithOriginalEol(serverPath, text, eol);
    console.log(`  💾 Saved ${serverPath} (${changesApplied} change(s) applied). Backup: ${path.basename(backupPath)}`);
  } else {
    console.log(`  ℹ️ No changes needed for ${serverPath}.`);
  }
};

// ---------------- PART B: APP.JS PATCHER ---------------- //

const patchAppFile = (appPath) => {
  console.log(`\n🔧 Patching landing page email sign-up & deals/events pop-up in: ${appPath}`);
  let { text, eol } = readNormalized(appPath);
  let changesApplied = 0;

  // 1. Add NewsletterDealsModal component right above `function App() {`
  const appFnAnchor = 'function App() {';
  const newsletterModalComponent = [
    '// Deals & Events Mailing List Pop-Up Modal (appears on Boutique entry or after signup)',
    'const NewsletterDealsModal = ({ isOpen, onClose, initialEmail = \'\', initialName = \'\', source = \'boutique_popup\' }) => {',
    '  const [email, setEmail] = useState(initialEmail || \'\');',
    '  const [name, setName] = useState(initialName || \'\');',
    '  const [isSubmitting, setIsSubmitting] = useState(false);',
    '  const [feedback, setFeedback] = useState({ type: \'\', text: \'\' });',
    '',
    '  useEffect(() => {',
    '    if (initialEmail && !email) setEmail(initialEmail);',
    '    if (initialName && !name) setName(initialName);',
    '    // eslint-disable-next-line',
    '  }, [initialEmail, initialName, isOpen]);',
    '',
    '  if (!isOpen) return null;',
    '',
    '  const handleDismiss = () => {',
    '    try {',
    "      sessionStorage.setItem('sbc_newsletter_dismissed', 'true');",
    '    } catch (e) {}',
    '    if (onClose) onClose();',
    '  };',
    '',
    '  const handleSubscribe = async (e) => {',
    '    e.preventDefault();',
    '    const trimmedEmail = String(email || \'\').trim();',
    '    if (!trimmedEmail || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(trimmedEmail)) {',
    "      setFeedback({ type: 'error', text: 'Please enter a valid email address.' });",
    '      return;',
    '    }',
    '    setIsSubmitting(true);',
    "    setFeedback({ type: '', text: '' });",
    '    try {',
    '      const res = await fetch(`${API_BASE_URL}/api/newsletter/subscribe`, {',
    "        method: 'POST',",
    "        headers: { 'Content-Type': 'application/json' },",
    '        body: JSON.stringify({ email: trimmedEmail, name: String(name || \'\').trim(), source })',
    '      });',
    '      const data = await res.json().catch(() => ({}));',
    '      if (res.ok && data.success) {',
    '        try {',
    "          localStorage.setItem('sbc_newsletter_subscribed', 'true');",
    '        } catch (err) {}',
    "        setFeedback({ type: 'success', text: data.message || \"Welcome! You're on our VIP Deals & Events list. ✧\" });",
    '        setTimeout(() => {',
    '          if (onClose) onClose();',
    '        }, 1600);',
    '      } else {',
    "        setFeedback({ type: 'error', text: data.error || 'Could not subscribe right now. Please try again.' });",
    '      }',
    '    } catch (err) {',
    "      setFeedback({ type: 'error', text: 'Network error. Please try again in a moment.' });",
    '    } finally {',
    '      setIsSubmitting(false);',
    '    }',
    '  };',
    '',
    '  return (',
    '    <div',
    '      onClick={handleDismiss}',
    '      style={{',
    "        position: 'fixed',",
    '        top: 0,',
    '        left: 0,',
    "        width: '100vw',",
    "        height: '100vh',",
    "        backgroundColor: 'rgba(92, 84, 84, 0.58)',",
    "        backdropFilter: 'blur(5px)',",
    '        zIndex: 2600,',
    "        display: 'flex',",
    "        alignItems: 'center',",
    "        justifyContent: 'center',",
    "        padding: '20px',",
    "        boxSizing: 'border-box',",
    "        animation: 'fadeIn 0.3s ease'",
    '      }}',
    '    >',
    '      <div',
    '        onClick={(e) => e.stopPropagation()}',
    '        style={{',
    "          backgroundColor: '#FFF9F9',",
    "          border: '2px solid #B38B8F',",
    "          borderRadius: '26px',",
    "          padding: '34px 30px',",
    "          maxWidth: '460px',",
    "          width: '100%',",
    "          boxShadow: '0 22px 55px rgba(92, 84, 84, 0.35)',",
    "          position: 'relative',",
    "          textAlign: 'center',",
    "          boxSizing: 'border-box'",
    '        }}',
    '      >',
    '        <button',
    '          type="button"',
    '          onClick={handleDismiss}',
    '          aria-label="Close mailing list popup"',
    '          style={{',
    "            position: 'absolute',",
    "            top: '14px',",
    "            right: '16px',",
    "            background: '#FFFFFF',",
    "            border: '1px solid #E8C5C8',",
    "            width: '34px',",
    "            height: '34px',",
    "            borderRadius: '50%',",
    "            fontSize: '1rem',",
    "            cursor: 'pointer',",
    "            color: '#8A797A'",
    '          }}',
    '        >',
    '          ✕',
    '        </button>',
    '',
    '        <span',
    '          style={{',
    "            display: 'inline-block',",
    "            backgroundColor: '#FFF0F2',",
    "            color: '#B38B8F',",
    "            border: '1px solid #B38B8F',",
    "            borderRadius: '20px',",
    "            padding: '5px 14px',",
    "            fontSize: '0.74rem',",
    "            fontWeight: 'bold',",
    "            fontFamily: 'sans-serif',",
    "            letterSpacing: '0.7px',",
    "            textTransform: 'uppercase',",
    "            marginBottom: '10px'",
    '          }}',
    '        >',
    "          ✧ Susan's VIP Mailing List",
    '        </span>',
    '',
    '        <h2',
    '          style={{',
    "            fontFamily: \"'Alex Brush', cursive\",",
    "            fontSize: '3.1rem',",
    "            color: '#B38B8F',",
    "            fontWeight: '400',",
    "            margin: '0 0 8px 0',",
    "            lineHeight: '1.1'",
    '          }}',
    '        >',
    '          Deals, Events &amp; Glow Notes',
    '        </h2>',
    '',
    '        <p',
    '          style={{',
    "            fontFamily: \"'Cormorant Garamond', serif\",",
    "            fontSize: '1.22rem',",
    "            color: '#5C5454',",
    "            margin: '0 0 20px 0',",
    "            lineHeight: '1.55'",
    '          }}',
    '        >',
    "          Give us your email and we'll send you exclusive boutique deals, seasonal skincare promos, new arrivals, and private Sanctuary events!",
    '        </p>',
    '',
    "        <form onSubmit={handleSubscribe} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>",
    '          <input',
    '            type="text"',
    '            placeholder="First Name (optional)"',
    '            value={name}',
    '            onChange={(e) => setName(e.target.value)}',
    '            style={{',
    "              width: '100%',",
    "              padding: '12px 16px',",
    "              borderRadius: '22px',",
    "              border: '1px solid #E8C5C8',",
    "              backgroundColor: '#FFFFFF',",
    "              fontFamily: 'sans-serif',",
    "              fontSize: '0.94rem',",
    "              color: '#5C5454',",
    "              outline: 'none',",
    "              boxSizing: 'border-box'",
    '            }}',
    '          />',
    '          <input',
    '            type="email"',
    '            required',
    '            placeholder="Enter your email address..."',
    '            value={email}',
    '            onChange={(e) => setEmail(e.target.value)}',
    '            style={{',
    "              width: '100%',",
    "              padding: '12px 16px',",
    "              borderRadius: '22px',",
    "              border: '1.5px solid #B38B8F',",
    "              backgroundColor: '#FFFFFF',",
    "              fontFamily: 'sans-serif',",
    "              fontSize: '0.95rem',",
    "              color: '#5C5454',",
    "              outline: 'none',",
    "              boxSizing: 'border-box'",
    '            }}',
    '          />',
    '',
    '          {feedback.text && (',
    '            <div',
    '              style={{',
    "                padding: '9px 12px',",
    "                borderRadius: '12px',",
    "                fontSize: '0.84rem',",
    "                fontFamily: 'sans-serif',",
    "                fontWeight: '600',",
    "                backgroundColor: feedback.type === 'success' ? '#F6FBF7' : '#FFF5F5',",
    "                color: feedback.type === 'success' ? '#2E7D32' : '#C62828',",
    "                border: `1px solid ${feedback.type === 'success' ? '#A5D6A7' : '#FFCDD2'}`",
    '              }}',
    '            >',
    '              {feedback.text}',
    '            </div>',
    '          )}',
    '',
    '          <button',
    '            type="submit"',
    '            disabled={isSubmitting}',
    '            style={{',
    "              marginTop: '6px',",
    "              width: '100%',",
    "              background: 'linear-gradient(135deg, #B38B8F 0%, #D4A5A9 100%)',",
    "              color: '#FFFFFF',",
    "              border: 'none',",
    "              padding: '13px 20px',",
    "              borderRadius: '26px',",
    "              fontFamily: \"'Cormorant Garamond', serif\",",
    "              fontSize: '1.22rem',",
    "              fontWeight: 'bold',",
    "              cursor: isSubmitting ? 'wait' : 'pointer',",
    "              boxShadow: '0 6px 18px rgba(179, 139, 143, 0.35)'",
    '            }}',
    '          >',
    "            {isSubmitting ? 'Adding you to the list...' : 'Join for Deals & Events ✧'}",
    '          </button>',
    '        </form>',
    '',
    '        <button',
    '          type="button"',
    '          onClick={handleDismiss}',
    '          style={{',
    "            marginTop: '14px',",
    "            background: 'none',",
    "            border: 'none',",
    "            color: '#8A797A',",
    "            fontFamily: 'sans-serif',",
    "            fontSize: '0.82rem',",
    "            textDecoration: 'underline',",
    "            cursor: 'pointer'",
    '          }}',
    '        >',
    '          No thanks, maybe later',
    '        </button>',
    '      </div>',
    '    </div>',
    '  );',
    '};',
    ''
  ].join('\n');

  if (text.includes('const NewsletterDealsModal = ({')) {
    console.log('  ✓ [B.1] NewsletterDealsModal component already present (skipped)');
  } else if (text.includes(appFnAnchor)) {
    text = text.replace(appFnAnchor, `${newsletterModalComponent}\n${appFnAnchor}`);
    changesApplied++;
    console.log('  ✅ [B.1] Added NewsletterDealsModal component');
  } else {
    throw new Error('[B.1] Could not find `function App() {` anchor in App.js.');
  }

  // 2. Add landing email signup state, newsletter popup state, handler & boutique trigger inside App()
  const loginCredsAnchor = "  const [loginCredentials, setLoginCredentials] = useState({ email: '', password: '' });";
  const newAppStateAndHandlers = [
    loginCredsAnchor,
    "  const [authCardMode, setAuthCardMode] = useState('login'); // 'login' | 'signup'",
    "  const [landingSignupForm, setLandingSignupForm] = useState({ name: '', email: '', phone: '', password: '', marketingOptIn: true });",
    "  const [authInlineError, setAuthInlineError] = useState('');",
    '  const [isNewsletterModalOpen, setIsNewsletterModalOpen] = useState(false);',
    "  const [newsletterModalSource, setNewsletterModalSource] = useState('boutique_popup');",
    '',
    '  // Automatically open the Deals & Events mailing-list pop-up when entering the Boutique',
    '  useEffect(() => {',
    "    const inBoutique = step === 1 || (step === 5 && activeMemberTab === 'Boutique');",
    '    if (!inBoutique || step === 6) return;',
    '    try {',
    "      if (localStorage.getItem('sbc_newsletter_subscribed') === 'true') return;",
    "      if (sessionStorage.getItem('sbc_newsletter_dismissed') === 'true') return;",
    '    } catch (e) {}',
    '    const timer = setTimeout(() => {',
    "      setNewsletterModalSource('boutique_popup');",
    '      setIsNewsletterModalOpen(true);',
    '    }, 900);',
    '    return () => clearTimeout(timer);',
    '  }, [step, activeMemberTab]);',
    '',
    '  const handleLandingEmailSignup = async (e) => {',
    '    if (e && e.preventDefault) e.preventDefault();',
    "    setAuthInlineError('');",
    '    const cleanName = String(landingSignupForm.name || \'\').trim();',
    '    const cleanEmail = String(landingSignupForm.email || \'\').trim();',
    '    const cleanPhone = String(landingSignupForm.phone || \'\').trim();',
    '    const cleanPassword = String(landingSignupForm.password || \'\');',
    '',
    '    if (!cleanName || !cleanEmail || !cleanPassword) {',
    "      setAuthInlineError('Please enter your full name, email address, and password.');",
    '      return;',
    '    }',
    '    if (cleanPassword.length < 6) {',
    "      setAuthInlineError('Password must be at least 6 characters long.');",
    '      return;',
    '    }',
    '',
    '    setIsLoading(true);',
    '    try {',
    '      const regRes = await fetch(`${API_BASE_URL}/api/users/register`, {',
    "        method: 'POST',",
    "        headers: { 'Content-Type': 'application/json' },",
    '        body: JSON.stringify({',
    '          name: cleanName,',
    '          email: cleanEmail,',
    '          phone: cleanPhone,',
    '          password: cleanPassword,',
    "          membershipTier: 'basic',",
    '          marketingOptIn: Boolean(landingSignupForm.marketingOptIn)',
    '        })',
    '      });',
    '      const regData = await regRes.json().catch(() => ({}));',
    '      if (!regRes.ok) {',
    "        setAuthInlineError(regData.error || 'Could not create account. Please try again.');",
    '        setIsLoading(false);',
    '        return;',
    '      }',
    '',
    "      localStorage.setItem('token', regData.token);",
    '      if (landingSignupForm.marketingOptIn) {',
    '        try {',
    "          localStorage.setItem('sbc_newsletter_subscribed', 'true');",
    '        } catch (err) {}',
    '      }',
    '      setHasCompletedQuiz(false);',
    "      setSelectedTier(regData.user?.membershipTier || 'basic');",
    '      setIsSubscribing(false);',
    '      setUserDetails(prev => ({',
    '        ...prev,',
    '        ...(regData.user || {}),',
    '        name: regData.user?.name || cleanName,',
    '        email: regData.user?.email || cleanEmail,',
    '        phone: regData.user?.phone || cleanPhone,',
    "        membershipTier: regData.user?.membershipTier || 'basic',",
    "        role: regData.user?.role || 'client',",
    "        password: ''",
    '      }));',
    "      setLandingSignupForm({ name: '', email: '', phone: '', password: '', marketingOptIn: true });",
    '      setIsLoading(false);',
    "      setActiveMemberTab('Boutique');",
    '      setStep(5);',
    '      // If they did not check the opt-in box during signup, invite them via the Deals & Events pop-up',
    '      if (!landingSignupForm.marketingOptIn) {',
    '        setTimeout(() => {',
    "          setNewsletterModalSource('post_signup_popup');",
    '          setIsNewsletterModalOpen(true);',
    '        }, 700);',
    '      }',
    '    } catch (err) {',
    "      console.error('Landing email signup error:', err);",
    "      setAuthInlineError('Network error while creating your account. Please try again.');",
    '      setIsLoading(false);',
    '    }',
    '  };'
  ].join('\n');

  if (text.includes('const handleLandingEmailSignup = async')) {
    console.log('  ✓ [B.2] Landing email signup state/handler & boutique popup trigger already present (skipped)');
  } else if (text.includes(loginCredsAnchor)) {
    text = text.replace(loginCredsAnchor, newAppStateAndHandlers);
    changesApplied++;
    console.log('  ✅ [B.2] Added landing email signup handler & automatic Boutique deals/events popup trigger');
  } else {
    throw new Error('[B.2] Could not find `loginCredentials` state anchor in App().');
  }

  // 3. Render <NewsletterDealsModal /> inside App() JSX
  const modalRenderAnchor = [
    '      <LiveOrderTrackingModal',
    '        trackingModal={liveTrackingModal}',
    '        onClose={() => setLiveTrackingModal((prev) => ({ ...prev, isOpen: false }))}',
    "        authToken={localStorage.getItem('token')}",
    '      />'
  ].join('\n');

  const modalRenderNew = [
    modalRenderAnchor,
    '',
    '      <NewsletterDealsModal',
    '        isOpen={isNewsletterModalOpen}',
    '        onClose={() => setIsNewsletterModalOpen(false)}',
    "        initialEmail={userDetails?.email || ''}",
    "        initialName={userDetails?.name || ''}",
    '        source={newsletterModalSource}',
    '      />'
  ].join('\n');

  if (text.includes('<NewsletterDealsModal')) {
    console.log('  ✓ [B.3] <NewsletterDealsModal /> already mounted in App() (skipped)');
  } else if (text.includes(modalRenderAnchor)) {
    text = text.replace(modalRenderAnchor, modalRenderNew);
    changesApplied++;
    console.log('  ✅ [B.3] Mounted <NewsletterDealsModal /> inside App()');
  } else {
    throw new Error('[B.3] Could not find <LiveOrderTrackingModal /> render anchor in App().');
  }

  // 4. Upgrade Landing Page Top Auth Section (#sanctuary-signin-top) with Sign In | Create Account with Email toggle
  const authSectionStart = "            {/* 1. TOP FOCAL POINT: 'WELCOME BACK' SIGN-IN CARD (PICTURE 2) */}";
  const authSectionEnd = '            {/* Decorative Sanctuary Divider */}';

  const aStartIdx = text.indexOf(authSectionStart);
  const aEndIdx = text.indexOf(authSectionEnd);

  const upgradedAuthSection = [
    "            {/* 1. TOP FOCAL POINT: SIGN IN OR CREATE ACCOUNT WITH EMAIL */}",
    '            <section',
    '              id="sanctuary-signin-top"',
    '              style={{',
    "                paddingTop: '6px',",
    "                paddingBottom: '28px'",
    '              }}',
    '            >',
    "              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>",
    "                <img src={logo} alt=\"Susan's Beauty Consulting Logo\" style={{ width: '300px', height: '300px', maxWidth: '82vw', maxHeight: '300px', objectFit: 'contain', display: 'block', margin: '0 auto' }} />",
    '              </div>',
    "              <h1 style={{ fontSize: '4.2rem', margin: '0 0 10px 0', color: '#B38B8F', fontFamily: \"'Alex Brush', cursive\", fontWeight: '400', lineHeight: '1.1' }}>",
    "                {authCardMode === 'signup' ? 'Create Your Account' : 'Welcome Back'}",
    '              </h1>',
    "              <p style={{ fontSize: '1.4rem', lineHeight: '1.8', fontFamily: \"'Cormorant Garamond', serif\", color: '#736A6A', margin: '12px auto 22px', maxWidth: '620px' }}>",
    "                {authCardMode === 'signup'",
    "                  ? 'Sign up directly with your email address — no Google or social account required.'",
    "                  : 'Sign in to access your dashboard and personalized blueprint.'}",
    '              </p>',
    '',
    '              {/* Sign In / Create Account with Email Mode Switcher */}',
    "              <div style={{ display: 'inline-flex', backgroundColor: '#FFF0F2', border: '1.5px solid #E8C5C8', borderRadius: '30px', padding: '5px', marginBottom: '24px', gap: '6px' }}>",
    '                <button',
    '                  type="button"',
    "                  onClick={() => { setAuthCardMode('login'); setAuthInlineError(''); }}",
    '                  style={{',
    "                    padding: '9px 22px',",
    "                    borderRadius: '24px',",
    "                    border: 'none',",
    "                    backgroundColor: authCardMode === 'login' ? '#B38B8F' : 'transparent',",
    "                    color: authCardMode === 'login' ? '#FFFFFF' : '#5C5454',",
    "                    fontFamily: \"'Cormorant Garamond', serif\",",
    "                    fontSize: '1.15rem',",
    "                    fontWeight: 'bold',",
    "                    cursor: 'pointer',",
    "                    transition: 'all 0.2s ease'",
    '                  }}',
    '                >',
    '                  Sign In',
    '                </button>',
    '                <button',
    '                  type="button"',
    "                  onClick={() => { setAuthCardMode('signup'); setAuthInlineError(''); }}",
    '                  style={{',
    "                    padding: '9px 22px',",
    "                    borderRadius: '24px',",
    "                    border: 'none',",
    "                    backgroundColor: authCardMode === 'signup' ? '#B38B8F' : 'transparent',",
    "                    color: authCardMode === 'signup' ? '#FFFFFF' : '#5C5454',",
    "                    fontFamily: \"'Cormorant Garamond', serif\",",
    "                    fontSize: '1.15rem',",
    "                    fontWeight: 'bold',",
    "                    cursor: 'pointer',",
    "                    transition: 'all 0.2s ease'",
    '                  }}',
    '                >',
    '                  ✨ Create Account with Email',
    '                </button>',
    '              </div>',
    '',
    "              {localStorage.getItem('token') && (",
    "                <div style={{ marginBottom: '22px' }}>",
    '                  <button',
    '                    type="button"',
    '                    onClick={() => setStep(5)}',
    '                    style={{',
    "                      backgroundColor: '#FFF0F2',",
    "                      border: '1.5px solid #B38B8F',",
    "                      borderRadius: '26px',",
    "                      padding: '10px 24px',",
    "                      color: '#5C5454',",
    "                      fontFamily: \"'Cormorant Garamond', serif\",",
    "                      fontSize: '1.2rem',",
    "                      fontWeight: 'bold',",
    "                      cursor: 'pointer',",
    "                      boxShadow: '0 6px 18px rgba(179, 139, 143, 0.22)'",
    '                    }}',
    '                  >',
    '                    📝 Return to My Sanctuary Dashboard →',
    '                  </button>',
    '                </div>',
    '              )}',
    '',
    '              {isLoading ? (',
    "                <EmpowermentLoader text={authCardMode === 'signup' ? 'Creating your Sanctuary account...' : 'Verifying credentials securely...'} />",
    "              ) : authCardMode === 'signup' ? (",
    "                <form onSubmit={handleLandingEmailSignup} style={{ maxWidth: '460px', margin: '0 auto' }}>",
    '                  <ElegantInput',
    '                    name="signupName"',
    '                    type="text"',
    '                    placeholder="Full Name (e.g. Sarah Jenkins)"',
    '                    value={landingSignupForm.name}',
    '                    onChange={(e) => setLandingSignupForm(prev => ({ ...prev, name: e.target.value }))}',
    '                  />',
    '                  <ElegantInput',
    '                    name="signupEmail"',
    '                    type="email"',
    '                    placeholder="Email Address"',
    '                    value={landingSignupForm.email}',
    '                    onChange={(e) => setLandingSignupForm(prev => ({ ...prev, email: e.target.value }))}',
    '                  />',
    '                  <ElegantInput',
    '                    name="signupPhone"',
    '                    type="tel"',
    '                    placeholder="Phone Number (for order & VIP event alerts)"',
    '                    value={landingSignupForm.phone}',
    '                    onChange={(e) => setLandingSignupForm(prev => ({ ...prev, phone: e.target.value }))}',
    '                  />',
    '                  <ElegantInput',
    '                    name="signupPassword"',
    '                    type="password"',
    '                    placeholder="Create a Password (min 6 characters)"',
    '                    value={landingSignupForm.password}',
    '                    onChange={(e) => setLandingSignupForm(prev => ({ ...prev, password: e.target.value }))}',
    '                  />',
    '',
    '                  <label',
    '                    style={{',
    "                      display: 'flex',",
    "                      alignItems: 'flex-start',",
    "                      gap: '10px',",
    "                      maxWidth: '380px',",
    "                      margin: '14px auto 6px auto',",
    "                      textAlign: 'left',",
    "                      fontFamily: 'sans-serif',",
    "                      fontSize: '0.84rem',",
    "                      color: '#5C5454',",
    "                      backgroundColor: '#FFF9F9',",
    "                      border: '1px solid #E8C5C8',",
    "                      borderRadius: '14px',",
    "                      padding: '10px 14px',",
    "                      cursor: 'pointer'",
    '                    }}',
    '                  >',
    '                    <input',
    '                      type="checkbox"',
    '                      checked={Boolean(landingSignupForm.marketingOptIn)}',
    '                      onChange={(e) => setLandingSignupForm(prev => ({ ...prev, marketingOptIn: e.target.checked }))}',
    "                      style={{ marginTop: '3px', accentColor: '#B38B8F' }}",
    '                    />',
    '                    <span>',
    "                      <strong>Yes!</strong> Send me exclusive boutique deals, seasonal offers, and VIP Sanctuary events.",
    '                    </span>',
    '                  </label>',
    '',
    '                  {authInlineError && (',
    "                    <div style={{ maxWidth: '380px', margin: '12px auto 0 auto', padding: '10px 14px', borderRadius: '12px', backgroundColor: '#FFF5F5', border: '1px solid #FFCDD2', color: '#C62828', fontFamily: 'sans-serif', fontSize: '0.86rem' }}>",
    '                      {authInlineError}',
    '                    </div>',
    '                  )}',
    '',
    "                  <div style={{ marginTop: '24px' }}>",
    '                    <EmpowermentButton text="Create Account ✧" onClick={handleLandingEmailSignup} />',
    '                  </div>',
    '',
    "                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', maxWidth: '380px', margin: '22px auto 12px auto' }}>",
    "                    <div style={{ flex: 1, height: '1px', backgroundColor: '#E6E8EC' }} />",
    "                    <span style={{ fontFamily: 'sans-serif', fontSize: '0.82rem', color: '#8A797A' }}>or continue with social</span>",
    "                    <div style={{ flex: 1, height: '1px', backgroundColor: '#E6E8EC' }} />",
    '                  </div>',
    '',
    '                  <SocialAuthButtonGrid',
    '                    mode="signup"',
    '                    showBottomDivider={false}',
    '                    initialSandboxProvider={oauthSandboxProvider}',
    '                    selectedTier="basic"',
    '                    isSubscribing={false}',
    "                    onSwitchAuthMode={(nextMode) => { setAuthCardMode(nextMode); setAuthInlineError(''); }}",
    '                    onSocialAuthSuccess={(data) =>',
    '                      handleSocialAuthSuccess(data, {',
    "                        tierOverride: 'basic',",
    '                        subscribingOverride: false',
    '                      })',
    '                    }',
    '                  />',
    '                </form>',
    '              ) : (',
    "                <div style={{ maxWidth: '460px', margin: '0 auto' }}>",
    '                  <SocialAuthButtonGrid',
    '                    mode="login"',
    '                    showBottomDivider={true}',
    '                    initialSandboxProvider={oauthSandboxProvider}',
    '                    selectedTier={selectedTier}',
    '                    isSubscribing={false}',
    "                    onSwitchAuthMode={(nextMode) => { setAuthCardMode(nextMode); setAuthInlineError(''); }}",
    '                    onSocialAuthSuccess={(data) =>',
    '                      handleSocialAuthSuccess(data, {',
    '                        subscribingOverride: false',
    '                      })',
    '                    }',
    '                  />',
    '',
    '                  <ElegantInput name="email" onChange={handleLoginInputChange} placeholder="Email Address" type="email" value={loginCredentials.email} />',
    '                  <ElegantInput name="password" onChange={handleLoginInputChange} placeholder="Password" type="password" value={loginCredentials.password} />',
    '',
    "                  <div style={{ marginTop: '30px' }}>",
    '                    <EmpowermentButton text="Sign In" onClick={handleLoginSubmit} />',
    '                  </div>',
    '',
    "                  <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>",
    '                    <button',
    '                      type="button"',
    "                      onClick={() => { setAuthCardMode('signup'); setAuthInlineError(''); }}",
    "                      style={{ background: 'none', border: 'none', color: '#B38B8F', fontFamily: \"'Cormorant Garamond', serif\", fontSize: '1.15rem', fontWeight: 'bold', textDecoration: 'underline', cursor: 'pointer' }}",
    '                    >',
    "                      New here? Create an account with your email address →",
    '                    </button>',
    '                    <p',
    "                      style={{ cursor: 'pointer', color: '#A89999', fontFamily: \"'Cormorant Garamond', serif\", fontSize: '1.05rem', margin: 0, transition: 'color 0.3s ease' }}",
    '                      onClick={() => setStep(8)}',
    "                      onMouseOver={(e) => { e.target.style.color = '#736A6A'; }}",
    "                      onMouseOut={(e) => { e.target.style.color = '#A89999'; }}",
    '                    >',
    '                      Forgot your password?',
    '                    </p>',
    '                  </div>',
    '                </div>',
    '              )}',
    '            </section>',
    ''
  ].join('\n');

  if (text.includes('✨ Create Account with Email')) {
    console.log('  ✓ [B.4] Landing page email Sign-Up toggle already present (skipped)');
  } else if (aStartIdx !== -1 && aEndIdx > aStartIdx) {
    text = text.slice(0, aStartIdx) + upgradedAuthSection + '\n' + text.slice(aEndIdx);
    changesApplied++;
    console.log('  ✅ [B.4] Added Sign In | Create Account with Email toggle & full signup form to landing page');
  } else {
    throw new Error('[B.4] Could not locate #sanctuary-signin-top section in App.js.');
  }

  // 5. Also add Phone Number input to the standalone Free Membership page (step === 7)
  const step7Old = [
    '                <ElegantInput name="name" onChange={handleInputChange} placeholder="Your First Name" type="text" value={userDetails.name}/>',
    '                <ElegantInput name="email" onChange={handleInputChange} placeholder="Email Address" type="email" value={userDetails.email}/>',
    '                <ElegantInput name="password" onChange={handleInputChange} placeholder="Create a Password" type="password" value={userDetails.password}/>'
  ].join('\n');

  const step7New = [
    '                <ElegantInput name="name" onChange={handleInputChange} placeholder="Your Full Name" type="text" value={userDetails.name}/>',
    '                <ElegantInput name="email" onChange={handleInputChange} placeholder="Email Address" type="email" value={userDetails.email}/>',
    '                <ElegantInput name="phone" onChange={handleInputChange} placeholder="Phone Number (for order & VIP event alerts)" type="tel" value={userDetails.phone || \'\'}/>',
    '                <ElegantInput name="password" onChange={handleInputChange} placeholder="Create a Password" type="password" value={userDetails.password}/>'
  ].join('\n');

  if (text.includes('placeholder="Phone Number (for order & VIP event alerts)" type="tel" value={userDetails.phone')) {
    console.log('  ✓ [B.5] Step 7 & Step 3 forms already collect phone number (skipped)');
  } else if (text.includes(step7Old)) {
    text = text.split(step7Old).join(step7New);
    changesApplied++;
    console.log('  ✅ [B.5] Added Phone Number collection to standalone Sign-Up forms');
  }

  if (changesApplied > 0) {
    const backupPath = writeWithOriginalEol(appPath, text, eol);
    console.log(`  💾 Saved ${appPath} (${changesApplied} change(s) applied). Backup: ${path.basename(backupPath)}`);
  } else {
    console.log(`  ℹ️ No changes needed for ${appPath}.`);
  }
};

// ---------------- MAIN EXECUTION ---------------- //

try {
  const cliServerArg = process.argv[2];
  const cliAppArg = process.argv[3];

  const serverPath = findFirstExistingFile([
    cliServerArg,
    'server.js',
    'server_2.js'
  ]);

  const appPath = findFirstExistingFile([
    cliAppArg,
    'client/src/App.js',
    'src/App.js',
    'App.js',
    'App_2.js'
  ]);

  if (!serverPath) {
    throw new Error('Could not locate server.js. Pass it explicitly: node apply_email_signup_and_newsletter_popup.js path/to/server.js path/to/App.js');
  }
  if (!appPath) {
    throw new Error('Could not locate App.js. Pass it explicitly: node apply_email_signup_and_newsletter_popup.js path/to/server.js path/to/App.js');
  }

  patchServerFile(serverPath);
  patchAppFile(appPath);

  console.log('\n✨ Email Account Sign-Up & Deals/Events Mailing List Pop-Up applied successfully!');
  console.log('Next steps:');
  console.log(`  1. Syntax-check backend:  node --check "${serverPath}"`);
  console.log('  2. Build React frontend:  cd client && npm run build');
  console.log('  3. Deploy & verify:');
  console.log('     - Landing page shows "Sign In | ✨ Create Account with Email" collecting Full Name, Email, Phone, Password & Deals opt-in.');
  console.log('     - Entering the Boutique (or signing up without checking opt-in) opens the Deals & Events mailing list pop-up and saves to MongoDB.');
} catch (err) {
  console.error('\n❌ Patch failed:', err.message);
  process.exit(1);
}