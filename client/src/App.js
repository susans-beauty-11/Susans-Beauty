import React, { useState, useEffect } from 'react';
import './App.css';
import logo from "./susans-logo.png";

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ---------------- COMPONENTS ---------------- //

const FallingSparkles = () => {
  const sparkles = Array.from({ length: 40 }).map((_, i) => {
    const colors = ['#FFFFFF', '#E8C5C8', '#B38B8F'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    return {
      id: i,
      left: Math.random() * 100, 
      animationDuration: Math.random() * 2 + 2, 
      animationDelay: Math.random() * 1.5, 
      size: Math.random() * 15 + 10, 
      color: randomColor,
      char: Math.random() > 0.5 ? '✦' : '✧' 
    };
  });

  return (
    <div className="sparkle-container" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {sparkles.map(s => (
        <div 
          key={s.id} 
          style={{
            position: 'absolute',
            top: '-50px',
            left: `${s.left}vw`,
            color: s.color,
            fontSize: `${s.size}px`,
            animation: `fall ${s.animationDuration}s linear ${s.animationDelay}s infinite`,
          }}
        >
          {s.char}
        </div>
      ))}
      <style>{`
        @keyframes fall {
          0% { transform: translateY(-50px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
        @keyframes spinSlow { 100% { transform: rotate(360deg); } }
        @keyframes pulseSoft { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

const EmpowermentContainer = ({ children }) => (
  <div style={{ margin: '0 auto', maxWidth: '1000px', padding: '60px 40px', textAlign: 'center', position: 'relative', transition: 'all 0.5s ease' }}>
    {children}
  </div>
);

const EmpowermentButton = ({ text, onClick }) => (
  <button style={{
    backgroundColor: '#F2D4D7', color: '#5C5454', border: '1px solid #E8C5C8',
    padding: '12px 50px', fontSize: '32px', fontFamily: "'Alex Brush', cursive", fontWeight: '400',
    cursor: 'pointer', transition: 'all 0.5s ease', borderRadius: '30px', boxShadow: '0 4px 15px rgba(232, 197, 200, 0.3)',
  }}
  onClick={onClick}
  onMouseOver={(e) => { e.target.style.backgroundColor = '#FFFFFF'; e.target.style.color = '#B38B8F'; e.target.style.boxShadow = '0 6px 20px rgba(232, 197, 200, 0.5)'; }}
  onMouseOut={(e) => { e.target.style.backgroundColor = '#F2D4D7'; e.target.style.color = '#5C5454'; e.target.style.boxShadow = '0 4px 15px rgba(232, 197, 200, 0.3)'; }}
  >
    {text}
  </button>
);

const QuizOptionButton = ({ text, onClick }) => (
  <button style={{
    display: 'block', width: '100%', maxWidth: '450px', margin: '12px auto',
    backgroundColor: 'rgba(255, 255, 255, 0.7)', color: '#5C5454', border: '1px solid #E8C5C8',
    padding: '16px 25px', fontSize: '1.2rem', fontFamily: "'Cormorant Garamond', serif",
    cursor: 'pointer', transition: 'all 0.3s ease', borderRadius: '15px', letterSpacing: '1px'
  }}
  onClick={onClick}
  onMouseOver={(e) => { e.target.style.backgroundColor = '#F2D4D7'; e.target.style.borderColor = '#B38B8F'; e.target.style.transform = 'translateY(-2px)'; }}
  onMouseOut={(e) => { e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.7)'; e.target.style.borderColor = '#E8C5C8'; e.target.style.transform = 'translateY(0)'; }}
  >
    {text}
  </button>
);

const ProgressDots = ({ currentStep, totalSteps }) => (
  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '35px' }}>
    {Array.from({ length: totalSteps }).map((_, index) => (
      <div key={index} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: index < currentStep ? '#B38B8F' : '#F2D4D7', transition: 'background-color 0.5s ease' }} />
    ))}
  </div>
);

const EmpowermentLoader = ({ text }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '40px 0' }}>
    <div style={{ animation: 'spinSlow 4s linear infinite', width: '60px', height: '60px' }}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E8C5C8" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" strokeDasharray="4 4" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="#B38B8F" strokeWidth="1.5" />
        <circle cx="12" cy="2" r="2" fill="#FFFFFF" stroke="#B38B8F"/>
      </svg>
    </div>
    <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', color: '#8A797A', marginTop: '20px', fontStyle: 'italic', animation: 'pulseSoft 2s infinite' }}>
      {text || "Curating your personalized routine..."}
    </p>
  </div>
);

const BlueprintCard = ({ label, value }) => (
  <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', border: '1px solid #E8C5C8', borderRadius: '15px', padding: '20px', boxShadow: '0 4px 15px rgba(232, 197, 200, 0.15)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
    <p style={{ margin: '0 0 5px 0', fontSize: '1.1rem', color: '#A89999', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>{label}</p>
    <p style={{ margin: 0, fontSize: '1.4rem', color: '#5C5454', fontFamily: "'Cormorant Garamond', serif", fontWeight: 'bold' }}>{value}</p>
  </div>
);

const ProductDetailModal = ({ product, onClose, onAddToCart }) => {
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);

  if (!product) return null;

  const title = product.title || 'Untitled Product';
  const hasVariants = product.variants && product.variants.length > 0;
  const activeVariant = hasVariants ? product.variants[selectedVariantIdx] : product;

  const displayImage = activeVariant?.imageUrl || product.imageUrl;
  const formattedImageUrl = displayImage && displayImage.startsWith('//')
    ? `https:${displayImage}`
    : displayImage;

  const itemPrice = activeVariant?.price || product.price || 0;

  const rawInfo = product.rawCjData?.description || product.description || '';
  const unformattedInfo = typeof rawInfo === 'string' ? rawInfo.replace(/<[^>]*>?/gm, '') : '';
  const shippingTime = product.rawCjData?.deliveryTime ? `${product.rawCjData.deliveryTime} hours` : '7-12 Days';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(92, 84, 84, 0.5)', zIndex: 1200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.3s ease', padding: '20px', boxSizing: 'border-box'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8',
        borderRadius: '20px', padding: '30px', maxWidth: '500px', width: '100%',
        boxShadow: '0 10px 30px rgba(232, 197, 200, 0.4)', position: 'relative',
        maxHeight: '90vh', overflowY: 'auto'
      }} onClick={(e) => e.stopPropagation()}>
        
        <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '20px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#8A797A' }}>✕</button>

        <div style={{ width: '100%', height: '240px', backgroundColor: '#FFF0F2', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <img src={logo} alt="Susan's Logo" style={{ position: 'absolute', top: '10px', right: '10px', width: '35px', height: '35px', objectFit: 'contain', zIndex: 3, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
          {formattedImageUrl ? (
            <img src={formattedImageUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ color: '#B38B8F', fontStyle: 'italic' }}>Susan's Select SKU</span>
          )}
        </div>

        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', color: '#5C5454', margin: '0 0 10px 0' }}>{title}</h2>
        
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', color: '#B38B8F', fontWeight: 'bold', margin: '0 0 5px 0' }}>
          ${parseFloat(itemPrice).toFixed(2)}
        </p>
        <p style={{ fontFamily: 'sans-serif', fontSize: '0.9rem', color: '#A89999', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
          ✈️ Ships globally ({shippingTime})
        </p>

        {unformattedInfo && (
          <p style={{ fontFamily: "'sans-serif'", fontSize: '1rem', color: '#736A6A', lineHeight: '1.6', margin: '0 0 20px 0' }}>
            {unformattedInfo}
          </p>
        )}

        {hasVariants && product.variants.length > 1 && (
          <div style={{ marginBottom: '20px' }} onClick={(e) => e.stopPropagation()}>
            <label style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", color: '#8A797A', marginBottom: '5px' }}>Select Option:</label>
            <select 
              value={selectedVariantIdx} 
              onChange={(e) => setSelectedVariantIdx(Number(e.target.value))}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: "'Cormorant Garamond', serif", color: '#5C5454', backgroundColor: '#FFF9F9', outline: 'none' }}
            >
              {product.variants.map((v, idx) => (
                <option key={v.sku || idx} value={idx}>
                  {v.variantName && v.variantName !== v.sku ? v.variantName : `Option ${idx + 1}`} - ${parseFloat(v.price).toFixed(2)}
                </option>
              ))}
            </select>
          </div>
        )}

        <button 
          onClick={() => {
            onAddToCart({
              ...product,
              sku: activeVariant?.sku || product.sku || product._id,
              price: itemPrice,
              selectedVariantName: activeVariant?.variantName,
              imageUrl: activeVariant?.imageUrl || product.imageUrl,
              title: title
            });
            onClose();
          }}
          style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '12px 20px', borderRadius: '25px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', cursor: 'pointer', width: '100%', transition: 'all 0.3s ease' }}
        >
          Add to Ritual ✧
        </button>
      </div>
    </div>
  );
};

const ProductCard = ({ product, onAddToCart, onCardClick }) => {
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);

  const hasVariants = product.variants && product.variants.length > 0;
  const activeVariant = hasVariants ? product.variants[selectedVariantIdx] : product;

  const displayImage = activeVariant?.imageUrl || product.imageUrl;
  const formattedImageUrl = displayImage && displayImage.startsWith('//') ? `https:${displayImage}` : displayImage;
  const title = product.title || 'Untitled Product';
  
  const itemPrice = activeVariant?.price || product.price || 0;

  const rawInfo = product.rawCjData?.description || product.description || '';
  const unformattedInfo = typeof rawInfo === 'string' ? rawInfo.replace(/<[^>]*>?/gm, '') : '';
  const shippingTime = product.rawCjData?.deliveryTime ? `${product.rawCjData.deliveryTime} hours` : '7-12 Days';

  const enrichedProduct = { ...product, title, activeVariant };

  return (
    <div 
      onClick={() => onCardClick && onCardClick(enrichedProduct)}
      style={{ backgroundColor: 'rgba(255, 255, 255, 0.85)', border: '1px solid #E8C5C8', borderRadius: '15px', padding: '15px', textAlign: 'center', transition: 'transform 0.3s ease, box-shadow 0.3s ease', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 4px 15px rgba(232, 197, 200, 0.15)', height: '100%', cursor: 'pointer' }}
      onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(232, 197, 200, 0.3)'; }}
      onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(232, 197, 200, 0.15)'; }}
    >
      <div>
        <div style={{ width: '100%', height: '180px', backgroundColor: '#FFF0F2', borderRadius: '10px', marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
          <img src={logo} alt="Susan's Logo" style={{ position: 'absolute', top: '8px', right: '8px', width: '30px', height: '30px', objectFit: 'contain', zIndex: 3, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
          {product.essentialSlotLabel && (
            <span style={{ position: 'absolute', top: '8px', left: '8px', backgroundColor: 'rgba(92, 84, 84, 0.85)', color: '#FFFFFF', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontFamily: "'Cormorant Garamond', serif", letterSpacing: '0.5px', zIndex: 2 }}>
              {product.essentialSlotLabel}
            </span>
          )}
          {formattedImageUrl ? (
            <img src={formattedImageUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            <span style={{ color: '#B38B8F', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>Susan's Select SKU</span>
          )}
        </div>
        <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#5C5454', margin: '0 0 8px 0', minHeight: '45px', lineHeight: '1.3' }}>{title}</h4>
        
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', color: '#B38B8F', fontWeight: 'bold', margin: '0 0 5px 0' }}>
          ${parseFloat(itemPrice).toFixed(2)}
        </p>
        <p style={{ fontFamily: 'sans-serif', fontSize: '0.8rem', color: '#A89999', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
          ✈️ Ships globally ({shippingTime})
        </p>

        {unformattedInfo && (
          <div style={{ fontSize: '0.85rem', color: '#736A6A', marginBottom: '15px', textAlign: 'left', maxHeight: '60px', overflowY: 'auto', fontFamily: 'sans-serif' }}>
            {unformattedInfo}
          </div>
        )}

        {hasVariants && product.variants.length > 1 && (
          <div onClick={(e) => e.stopPropagation()}>
            <select 
              value={selectedVariantIdx} 
              onChange={(e) => setSelectedVariantIdx(Number(e.target.value))}
              style={{ width: '100%', padding: '8px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #E8C5C8', fontFamily: "'Cormorant Garamond', serif", color: '#5C5454', backgroundColor: '#FFF9F9', outline: 'none' }}
            >
              {product.variants.map((v, idx) => (
                <option key={v.sku || idx} value={idx}>
                  {v.variantName && v.variantName !== v.sku ? v.variantName : `Option ${idx + 1}`} - ${parseFloat(v.price).toFixed(2)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onAddToCart({
            ...product,
            sku: activeVariant?.sku || product.sku || product._id,
            price: itemPrice,
            selectedVariantName: activeVariant?.variantName,
            imageUrl: activeVariant?.imageUrl || product.imageUrl,
            title: title
          });
        }}
        style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px 15px', borderRadius: '20px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', cursor: 'pointer', width: '100%', marginTop: 'auto', transition: 'all 0.3s ease' }}
        onMouseOver={(e) => { e.target.style.backgroundColor = '#FFFFFF'; e.target.style.color = '#B38B8F'; }}
        onMouseOut={(e) => { e.target.style.backgroundColor = '#F2D4D7'; e.target.style.color = '#5C5454'; }}
      >
        Add to Ritual ✧
      </button>
    </div>
  );
};


const ElegantInput = ({ type, placeholder, name, value, onChange }) => (
  <input
    type={type} name={name} placeholder={placeholder} value={value} onChange={onChange}
    style={{ width: '100%', maxWidth: '380px', padding: '16px 25px', margin: '10px auto', display: 'block', backgroundColor: 'rgba(255, 255, 255, 0.8)', border: '1px solid #E8C5C8', borderRadius: '30px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', color: '#5C5454', outline: 'none', boxSizing: 'border-box', transition: 'all 0.3s ease' }}
    onFocus={(e) => { e.target.style.backgroundColor = '#FFFFFF'; e.target.style.boxShadow = '0 0 10px rgba(232, 197, 200, 0.4)'; }}
    onBlur={(e) => { e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.8)'; e.target.style.boxShadow = 'none'; }}
  />
);

const AdminDashboard = ({ adminData, onLogout, backendProducts }) => {
  const [activeTab, setActiveTab] = useState('Inbox');
  const tabs = ['Inbox', 'Curation', 'Calendar', 'Inventory', 'Video', 'AI'];

  const [emailForm, setEmailForm] = useState({ to: '', subject: '', body: '' });
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  
  // New State for Curation Tab
  const [selectedBlueprint, setSelectedBlueprint] = useState(null);
  const [pushingId, setPushingId] = useState(null);

  const handleSendEmail = async (e) => {
    e.preventDefault();
    setIsSendingEmail(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/admin/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(emailForm)
      });
      const data = await res.json();
      if (res.ok) {
        alert('Email successfully dispatched! ✧');
        setEmailForm({ to: '', subject: '', body: '' }); 
      } else {
        alert(data.error || 'Failed to send email.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while sending email.');
    }
    setIsSendingEmail(false);
  };

  // New Push Recommendation Function
  const handlePushRecommendation = async (productId, userId) => {
    if (!userId) {
      alert('Cannot push recommendation: User account not found for this blueprint.');
      return;
    }
    setPushingId(productId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ productId })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Product successfully pushed to user dashboard! ✧');
      } else {
        alert(data.error || 'Failed to push recommendation.');
      }
    } catch (err) {
      console.error('Error pushing recommendation:', err);
      alert('Network error while pushing recommendation.');
    }
    setPushingId(null);
  };

  return (
    <div style={{ display: 'flex', width: '100vw', minHeight: '100vh', backgroundColor: '#FFF9F9', position: 'absolute', top: 0, left: 0, zIndex: 500 }}>
      
      {/* Sidebar Navigation */}
      <div style={{ width: '260px', backgroundColor: '#FFFFFF', borderRight: '1px solid #E8C5C8', display: 'flex', flexDirection: 'column', padding: '30px 0', boxShadow: '2px 0 15px rgba(232, 197, 200, 0.2)' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontFamily: "'Alex Brush', cursive", color: '#B38B8F', fontSize: '3rem', margin: 0, fontWeight: '400' }}>Admin Portal</h2>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", color: '#A89999', margin: '5px 0 0 0', fontStyle: 'italic' }}>Susan's Beauty Consulting</p>
        </div>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 20px' }}>
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 20px', textAlign: 'left', border: 'none', borderRadius: '12px',
                backgroundColor: activeTab === tab ? '#F2D4D7' : 'transparent',
                color: activeTab === tab ? '#5C5454' : '#8A797A',
                fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', cursor: 'pointer',
                transition: 'all 0.3s ease', fontWeight: activeTab === tab ? 'bold' : 'normal',
                boxShadow: activeTab === tab ? '0 4px 10px rgba(232, 197, 200, 0.3)' : 'none'
              }}
            >
              {tab === 'Inbox' && '✉️ '}
              {tab === 'Curation' && '✨ '}
              {tab === 'Calendar' && '📅 '}
              {tab === 'Inventory' && '🛍️ '}
              {tab === 'Video' && '🎥 '}
              {tab === 'AI' && '🤖 '}
              {tab}
            </button>
          ))}
        </div>

        <div style={{ padding: '0 20px' }}>
          <button onClick={onLogout} style={{ width: '100%', padding: '12px', border: '1px solid #E8C5C8', backgroundColor: 'transparent', color: '#736A6A', borderRadius: '12px', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', transition: 'all 0.3s ease' }} onMouseOver={(e) => { e.target.style.backgroundColor = '#FFF0F2'; }} onMouseOut={(e) => { e.target.style.backgroundColor = 'transparent'; }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: '50px', overflowY: 'auto' }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#5C5454', fontSize: '2.8rem', marginTop: 0, borderBottom: '1px solid rgba(232, 197, 200, 0.5)', paddingBottom: '15px', marginBottom: '30px' }}>
          {activeTab}
        </h1>
        
        {activeTab === 'Inbox' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px', animation: 'fadeIn 0.5s ease' }}>
            
            {/* Left Column: Email Composer */}
            <div style={{ backgroundColor: '#FFFFFF', padding: '30px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.15)' }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#B38B8F', marginTop: 0, fontSize: '2.2rem' }}>Compose Message</h2>
              <form onSubmit={handleSendEmail} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input 
                  type="email" 
                  placeholder="Recipient Email" 
                  required
                  value={emailForm.to}
                  onChange={(e) => setEmailForm({...emailForm, to: e.target.value})}
                  style={{ padding: '15px', borderRadius: '12px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '1rem', outline: 'none', backgroundColor: '#FFF9F9' }}
                />
                <input 
                  type="text" 
                  placeholder="Subject Line" 
                  required
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({...emailForm, subject: e.target.value})}
                  style={{ padding: '15px', borderRadius: '12px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '1rem', outline: 'none', backgroundColor: '#FFF9F9' }}
                />
                <textarea 
                  placeholder="Draft your message here..." 
                  required
                  rows="10"
                  value={emailForm.body}
                  onChange={(e) => setEmailForm({...emailForm, body: e.target.value})}
                  style={{ padding: '15px', borderRadius: '12px', border: '1px solid #E8C5C8', fontFamily: 'sans-serif', fontSize: '1rem', outline: 'none', resize: 'vertical', backgroundColor: '#FFF9F9' }}
                />
                <button 
                  type="submit" 
                  disabled={isSendingEmail}
                  style={{ backgroundColor: '#F2D4D7', color: '#5C5454', padding: '15px', borderRadius: '30px', border: '1px solid #B38B8F', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', cursor: isSendingEmail ? 'not-allowed' : 'pointer', transition: 'all 0.3s ease', marginTop: '10px' }}
                >
                  {isSendingEmail ? 'Dispatching...' : 'Send Message ✧'}
                </button>
              </form>
            </div>

            {/* Right Column: Global Order Feed */}
            <div style={{ backgroundColor: '#FFFFFF', padding: '30px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.15)', maxHeight: '700px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#B38B8F', margin: 0, fontSize: '2.2rem' }}>Global Orders</h2>
                <span style={{ backgroundColor: '#FFF0F2', color: '#B38B8F', padding: '5px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', border: '1px solid #E8C5C8' }}>
                  Total: {adminData.orders?.length || 0}
                </span>
              </div>

              {(!adminData.orders || adminData.orders.length === 0) ? (
                <p style={{ color: '#8A797A', fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem' }}>No orders have been placed yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {adminData.orders.map(order => (
                    <div key={order._id} style={{ padding: '20px', backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '15px', transition: 'transform 0.2s ease' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <strong style={{ color: '#5C5454', fontSize: '1.1rem' }}>{order.customerEmail || 'Anonymous Checkout'}</strong>
                        <span style={{ color: '#B38B8F', fontWeight: 'bold', fontSize: '1.2rem' }}>${(order.totalAmount || 0).toFixed(2)}</span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                         <p style={{ margin: 0, fontSize: '0.9rem', color: '#736A6A' }}>Status: <span style={{ fontWeight: 'bold', color: order.status === 'SHIPPED' ? '#B38B8F' : '#8A797A' }}>{order.status}</span></p>
                         <p style={{ margin: 0, fontSize: '0.8rem', color: '#A89999' }}>{new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>

                      <button 
                        onClick={() => setEmailForm({ ...emailForm, to: order.customerEmail || '', subject: `Update regarding order ${order._id.slice(-6)}` })}
                        style={{ background: 'transparent', border: '1px solid #B38B8F', borderRadius: '20px', padding: '8px 15px', fontSize: '0.95rem', color: '#5C5454', cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif", transition: 'all 0.3s ease', width: '100%' }}
                        onMouseOver={(e) => { e.target.style.backgroundColor = '#F2D4D7'; }} 
                        onMouseOut={(e) => { e.target.style.backgroundColor = 'transparent'; }}
                      >
                        ✉️ Email Customer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
          </div>
        )}

        {/* --- NEW CURATION VIEW --- */}
        {activeTab === 'Curation' && (
          <div style={{ display: 'flex', gap: '30px', animation: 'fadeIn 0.5s ease' }}>
            
            {/* Left Column: Blueprint List */}
            <div style={{ width: '350px', backgroundColor: '#FFFFFF', padding: '25px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.15)', overflowY: 'auto', maxHeight: '75vh' }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#B38B8F', marginTop: 0, fontSize: '1.8rem' }}>Client Blueprints</h2>
              {(!adminData.blueprints || adminData.blueprints.length === 0) ? (
                <p style={{ color: '#8A797A', fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif" }}>No blueprints submitted yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {adminData.blueprints.map(bp => (
                    <div 
                      key={bp._id} 
                      onClick={() => setSelectedBlueprint(bp)}
                      style={{ padding: '15px', borderRadius: '12px', border: selectedBlueprint?._id === bp._id ? '2px solid #B38B8F' : '1px solid #E8C5C8', backgroundColor: selectedBlueprint?._id === bp._id ? '#FFF0F2' : '#FFF9F9', cursor: 'pointer', transition: 'all 0.2s ease' }}
                    >
                      <strong style={{ display: 'block', color: '#5C5454', fontSize: '1.1rem' }}>{bp.userId?.name || 'Anonymous'}</strong>
                      <span style={{ color: '#8A797A', fontSize: '0.9rem' }}>{bp.userId?.email || 'No email'}</span>
                      <span style={{ display: 'block', color: '#A89999', fontSize: '0.8rem', marginTop: '5px' }}>{new Date(bp.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Blueprint Details & Curation */}
            <div style={{ flex: 1, backgroundColor: '#FFFFFF', padding: '30px', borderRadius: '20px', border: '1px solid #E8C5C8', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.15)', overflowY: 'auto', maxHeight: '75vh' }}>
              {!selectedBlueprint ? (
                <div style={{ height: '100%', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ color: '#8A797A', fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem' }}>Select a client blueprint to begin curation ✧</p>
                </div>
              ) : (
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E8C5C8', paddingBottom: '15px', marginBottom: '20px' }}>
                    <div>
                      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#5C5454', margin: '0 0 5px 0', fontSize: '2.2rem' }}>{selectedBlueprint.userId?.name || 'Anonymous'}</h2>
                      <p style={{ color: '#8A797A', margin: 0 }}>{selectedBlueprint.userId?.email || 'No email'}</p>
                    </div>
                    <button onClick={() => setSelectedBlueprint(null)} style={{ background: 'none', border: '1px solid #E8C5C8', borderRadius: '15px', padding: '8px 15px', color: '#8A797A', cursor: 'pointer' }}>Close View</button>
                  </div>

                  <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', color: '#B38B8F', marginBottom: '15px' }}>Quiz Analysis</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
                    <BlueprintCard label="Skin Temperament" value={selectedBlueprint.skinType}/>
                    <BlueprintCard label="Primary Vision" value={selectedBlueprint.primaryGoal}/>
                    <BlueprintCard label="Climate Context" value={selectedBlueprint.climate}/>
                    <BlueprintCard label="Skin Sensitivity" value={selectedBlueprint.skinSensitivity}/>
                    <BlueprintCard label="Complexion Canvas" value={selectedBlueprint.complexion}/>
                    <BlueprintCard label="Undertone" value={selectedBlueprint.undertone}/>
                    <BlueprintCard label="Eye Color" value={selectedBlueprint.eyeColor}/>
                    <BlueprintCard label="Facial Silhouette" value={selectedBlueprint.faceShape}/>
                    <BlueprintCard label="Signature Aesthetic" value={selectedBlueprint.makeupVibe}/>
                    <BlueprintCard label="Regimen Focus" value={selectedBlueprint.routineFocus}/>
                  </div>

                  <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', color: '#B38B8F', marginBottom: '15px', borderTop: '1px solid #E8C5C8', paddingTop: '20px' }}>Curate Products</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                    {backendProducts.map(product => {
                      const title = product.title || 'Untitled Product';
                      const price = product.variants?.[0]?.retailPrice || product.variants?.[0]?.price || product.retailPrice || product.price || 0;
                      return (
                        <div key={product._id} style={{ backgroundColor: '#FFF9F9', border: '1px solid #E8C5C8', borderRadius: '12px', padding: '15px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'transform 0.2s ease' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                          <div style={{ marginBottom: '15px' }}>
                            <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', color: '#5C5454', margin: '0 0 5px 0' }}>{title}</h4>
                            <p style={{ fontFamily: 'sans-serif', fontSize: '1rem', color: '#B38B8F', fontWeight: 'bold', margin: 0 }}>${parseFloat(price).toFixed(2)}</p>
                          </div>
                          <button
                            onClick={() => handlePushRecommendation(product._id, selectedBlueprint.userId?._id)}
                            disabled={pushingId === product._id}
                            style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', color: '#5C5454', padding: '10px', borderRadius: '15px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', cursor: pushingId === product._id ? 'not-allowed' : 'pointer', width: '100%', transition: 'all 0.3s ease' }}
                          >
                            {pushingId === product._id ? 'Pushing...' : 'Push to Member ✧'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Calendar' && <p style={{fontFamily: 'sans-serif', color: '#8A797A'}}>Consultation Calendar coming in Phase 4...</p>}
        {activeTab === 'Inventory' && <p style={{fontFamily: 'sans-serif', color: '#8A797A'}}>Manual Inventory management coming in Phase 5...</p>}
        {activeTab === 'Video' && <p style={{fontFamily: 'sans-serif', color: '#8A797A'}}>Video Portal coming in Phase 6...</p>}
        {activeTab === 'AI' && <p style={{fontFamily: 'sans-serif', color: '#8A797A'}}>Gemini AI Assistant coming in Phase 7...</p>}
      </div>
    </div>
  );
};

// ---------------- MAIN APP ---------------- //

function App() {
  const [step, setStep] = useState(0); 
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false); 
  const [backendProducts, setBackendProducts] = useState([]);
  
  const [selectedTier, setSelectedTier] = useState('luminary');
  const [hasCompletedQuiz, setHasCompletedQuiz] = useState(false);
  
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  const [adminData, setAdminData] = useState({ users: [], blueprints: [], orders: [] });
  
  const [userRecommendations, setUserRecommendations] = useState([]);
  const [userOrders, setUserOrders] = useState([]);

  const [quizAnswers, setQuizAnswers] = useState({ skinType: '', primaryGoal: '', climate: '', skinSensitivity: '', complexion: '', undertone: '', eyeColor: '', faceShape: '', makeupVibe: '', routineFocus: '' });
  const [userDetails, setUserDetails] = useState({ name: '', email: '', password: '', membershipTier: '', role: 'client' });
  const [loginCredentials, setLoginCredentials] = useState({ email: '', password: '' });

  useEffect(() => {
    const fetchBackendData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/products`);
        if (response.ok) {
          const data = await response.json();
          setBackendProducts(data);
        }
      } catch (error) {
        console.error('Failed to connect to backend data:', error);
      }
    };
    fetchBackendData();
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const resRecs = await fetch(`${API_BASE_URL}/api/users/me/recommendations`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resRecs.ok) setUserRecommendations(await resRecs.json());

        const resOrders = await fetch(`${API_BASE_URL}/api/users/me/orders`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resOrders.ok) setUserOrders(await resOrders.json());

      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      }
    };
    if (step === 5) {
      fetchDashboardData();
    }
  }, [step]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    
    if (query.get('success')) {
      const tierStr = query.get('tier') || 'luminary';
      window.history.replaceState(null, '', window.location.pathname);
      setSelectedTier(tierStr);
      setUserDetails(prev => ({ ...prev, name: 'Valued Member' }));
      setIsSubscribing(true);
      setStep(5);
    }

    if (query.get('canceled')) {
      window.history.replaceState(null, '', window.location.pathname);
      setStep(0);
    }
    
    if (query.get('cart_success')) {
       window.history.replaceState(null, '', window.location.pathname);
       setCart([]);
       alert("Thank you! Your ritual essentials are being prepared for you.");
    }
  }, []);

  const fetchAdminData = async (token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminData(data);
      }
    } catch (error) {
      console.error('Failed to fetch admin data', error);
    }
  };

  const handleAddToCart = (product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.sku === product.sku);
      if (existingItem) {
        return prevCart.map(item => item.sku === product.sku ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (sku, delta) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.sku === sku) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const handleRemoveFromCart = (sku) => setCart(prevCart => prevCart.filter(item => item.sku !== sku));
  const calculateCartTotal = () => cart.reduce((total, item) => total + (item.price * item.quantity), 0).toFixed(2);

  const handleCartCheckout = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cart-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Checkout initialization failed.');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Network error during checkout.');
    }
    setIsLoading(false);
  };

  const handleAnswer = (field, value) => {
    const updatedAnswers = { ...quizAnswers, [field]: value };
    setQuizAnswers(updatedAnswers);
    if (step < 20) setStep(step + 1); 
    else submitQuiz(updatedAnswers); 
  };

  const submitQuiz = async (finalData) => {
    setStep(21); 
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/api/consultations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(finalData), 
      });
    } catch (error) {
      console.error('Failed to save consultation to backend:', error);
    }
    setTimeout(() => { 
      setIsLoading(false); 
      setHasCompletedQuiz(true);
      setStep(5);
    }, 2500);
  };

  const handleInputChange = (e) => setUserDetails({ ...userDetails, [e.target.name]: e.target.value });
  const handleLoginInputChange = (e) => setLoginCredentials({ ...loginCredentials, [e.target.name]: e.target.value });

  const handleCreateAccount = async () => {
    setIsLoading(true);
    try {
      const regRes = await fetch(`${API_BASE_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userDetails, membershipTier: selectedTier })
      });
      const regData = await regRes.json();
      
      if (!regRes.ok) {
        alert(regData.error || 'Failed to create account');
        setIsLoading(false);
        return;
      }

      localStorage.setItem('token', regData.token);

      if (isSubscribing) {
        const stripeRes = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${regData.token}` },
          body: JSON.stringify({ tier: selectedTier }),
        });
        
        const stripeData = await stripeRes.json();
        if (stripeData.url) window.location.href = stripeData.url;
      }
    } catch (err) {
      console.error('Failed to save user account:', err);
      setIsLoading(false);
    }
  };

  const handleFreeMembershipSubmit = async () => {
    setIsLoading(true);
    try {
      const regRes = await fetch(`${API_BASE_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userDetails, membershipTier: 'basic' })
      });
      const regData = await regRes.json();
      
      if (!regRes.ok) {
        alert(regData.error || 'Failed to create account');
        setIsLoading(false);
        return;
      }

      localStorage.setItem('token', regData.token);
      setIsLoading(false);
      setStep(1); 
    } catch (err) {
      console.error('Failed to save user account:', err);
      setIsLoading(false);
      alert('Network error during registration.');
    }
  };

  const handleLoginSubmit = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginCredentials)
      });
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('token', data.token);
        // Save the role to state
        setUserDetails(prev => ({ 
          ...prev, 
          name: data.user.name, 
          membershipTier: data.user.membershipTier,
          role: data.user.role || 'client'
        }));
        setSelectedTier(data.user.membershipTier);
        setIsSubscribing(data.user.membershipTier !== 'basic' && data.user.membershipTier !== 'admin');
        
        // Strict Role Routing
        const userRole = data.user.role;
        const isLegacyAdmin = data.user.membershipTier === 'admin';
        
        if (userRole === 'admin' || isLegacyAdmin) {
          setStep(6); // Step 6 is now the exclusive Admin Portal
          fetchAdminData(data.token);
        } else {
          setStep(5); // Step 5 is the Client Dashboard
        }
      } else {
        alert(data.error || 'Login failed');
      }
    } catch (err) {
      alert('An error occurred while logging in');
    }
    setIsLoading(false);
  };

  const handleLogOut = () => {
    localStorage.removeItem('token');
    setUserDetails({ name: '', email: '', password: '', membershipTier: '', role: 'client' });
    setLoginCredentials({ email: '', password: '' });
    setSelectedTier('luminary');
    setHasCompletedQuiz(false);
    setCart([]);
    setAdminData({ users: [], blueprints: [], orders: [] });
    setUserRecommendations([]);
    setUserOrders([]);
    setStep(0);
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center', position: 'relative' }}>
      
      {isLoading && <FallingSparkles/>}

      <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onAddToCart={handleAddToCart} />

      {(step === 1 || step === 5 || step === 6) && (
        <div style={{ position: 'fixed', top: '30px', right: '30px', zIndex: 1000 }}>
          <button
            onClick={() => setIsCartOpen(!isCartOpen)}
            style={{ backgroundColor: '#F2D4D7', border: '1px solid #B38B8F', borderRadius: '30px', padding: '10px 22px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', color: '#5C5454', cursor: 'pointer', boxShadow: '0 4px 15px rgba(232, 197, 200, 0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span>🛍️ Ritual Bag</span>
            <span style={{ backgroundColor: '#B38B8F', color: '#FFFFFF', borderRadius: '50%', padding: '2px 8px', fontSize: '0.9rem', fontWeight: 'bold' }}>
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          </button>
        </div>
      )}

      {isCartOpen && (
        <div style={{ position: 'fixed', top: 0, right: 0, width: '380px', height: '100vh', backgroundColor: '#FFF9F9', borderLeft: '1px solid #E8C5C8', boxShadow: '-5px 0 25px rgba(232, 197, 200, 0.3)', zIndex: 1100, display: 'flex', flexDirection: 'column', padding: '25px', boxSizing: 'border-box', animation: 'fadeIn 0.3s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E8C5C8', paddingBottom: '15px' }}>
            <h3 style={{ fontFamily: "'Alex Brush', cursive", fontSize: '2.5rem', color: '#B38B8F', margin: 0 }}>Your Ritual Bag</h3>
            <button onClick={() => setIsCartOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#8A797A' }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', margin: '20px 0' }}>
            {cart.length === 0 ? (
              <p style={{ fontFamily: "'Cormorant Garamond', serif", color: '#8A797A', fontStyle: 'italic', textAlign: 'center', marginTop: '50px' }}>Your ritual bag is currently empty.</p>
            ) : (
              cart.map((item) => (
                <div key={item.sku} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid rgba(232, 197, 200, 0.3)', paddingBottom: '15px' }}>
                  <div style={{ flex: 1, paddingRight: '10px' }}>
                    <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', color: '#5C5454', margin: '0 0 5px 0' }}>
                      {item.title || 'Product'} {item.selectedVariantName && item.selectedVariantName !== item.sku ? `(${item.selectedVariantName})` : ''}
                    </h4>
                    <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', color: '#B38B8F', margin: 0, fontWeight: 'bold' }}>
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => handleUpdateQuantity(item.sku, -1)} style={{ background: '#F2D4D7', border: '1px solid #E8C5C8', borderRadius: '5px', cursor: 'pointer', width: '25px', height: '25px' }}>-</button>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', color: '#5C5454' }}>{item.quantity}</span>
                    <button onClick={() => handleUpdateQuantity(item.sku, 1)} style={{ background: '#F2D4D7', border: '1px solid #E8C5C8', borderRadius: '5px', cursor: 'pointer', width: '25px', height: '25px' }}>+</button>
                    <button onClick={() => handleRemoveFromCart(item.sku)} style={{ background: 'none', border: 'none', color: '#A89999', cursor: 'pointer', fontSize: '1rem', marginLeft: '5px' }}>🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ borderTop: '1px solid #E8C5C8', paddingTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', color: '#5C5454' }}>Total:</span>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 'bold', color: '#B38B8F' }}>${calculateCartTotal()}</span>
            </div>
            <button 
              onClick={handleCartCheckout}
              disabled={cart.length === 0}
              style={{ width: '100%', backgroundColor: cart.length === 0 ? '#E8C5C8' : '#F2D4D7', border: '1px solid #B38B8F', borderRadius: '25px', padding: '12px', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', color: '#5C5454', cursor: cart.length === 0 ? 'not-allowed' : 'pointer' }}
            >
              Secure Checkout ✧
            </button>
          </div>
        </div>
      )}

      <EmpowermentContainer>
        
        {step === 0 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '25px' }}>
              <img src={logo} alt="Susan's Beauty Consulting Logo" style={{ width: '160px', height: '160px', objectFit: 'contain' }} />
            </div>
            <h1 style={{ fontSize: '4.8rem', margin: '0 0 20px 0', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", fontWeight: '400', lineHeight: '1.1' }}>Susan's Beauty Consulting</h1>
            <p style={{ fontSize: '1.5rem', lineHeight: '1.9', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: '#736A6A', margin: '15px auto', maxWidth: '680px' }}>Gracefully unveil the most luminous version of yourself. Through bespoke skincare rituals and refined makeup artistry, we illuminate your natural essence.</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '40px auto' }}>
              <div style={{ width: '80px', height: '1px', backgroundColor: '#E8C5C8' }}></div>
              <span style={{ color: '#E8C5C8', margin: '0 15px', fontSize: '1.2rem' }}>✧</span>
              <div style={{ width: '80px', height: '1px', backgroundColor: '#E8C5C8' }}></div>
            </div>
            
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <EmpowermentButton text="Free Membership" onClick={() => { setSelectedTier('basic'); setStep(7); }} />
                <EmpowermentButton text="Join Paid Membership" onClick={() => setStep(2)} />
              </div>
              <p style={{ cursor: 'pointer', color: '#A89999', textDecoration: 'underline', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', transition: 'color 0.3s ease', marginTop: '10px' }} onClick={() => setStep(4)} onMouseOver={(e) => e.target.style.color = '#736A6A'} onMouseOut={(e) => e.target.style.color = '#A89999'}>
                Already a member? Sign in to your dashboard
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={{ animation: 'fadeIn 1s ease', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <img src={logo} alt="Logo" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
                <h1 style={{ fontSize: '3.8rem', margin: 0, color: '#B38B8F', fontFamily: "'Alex Brush', cursive", fontWeight: '400' }}>The Boutique</h1>
              </div>
              <button onClick={() => setStep(0)} style={{ background: 'none', border: '1px solid #E8C5C8', borderRadius: '20px', padding: '8px 20px', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", cursor: 'pointer', fontSize: '1.1rem', transition: 'all 0.3s ease' }} onMouseOver={(e) => { e.target.style.backgroundColor = '#F2D4D7'; }} onMouseOut={(e) => { e.target.style.backgroundColor = 'transparent'; }}>← Home</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              {backendProducts.length > 0 ? (
                backendProducts.map((product) => (
                  <ProductCard key={product._id || product.title} product={product} onAddToCart={handleAddToCart} onCardClick={setSelectedProduct} />
                ))
              ) : (
                <p style={{ fontFamily: "'Cormorant Garamond', serif", color: '#736A6A', fontSize: '1.2rem', fontStyle: 'italic' }}>Fetching live boutique inventory...</p>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ animation: 'fadeIn 1.5s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
              <img src={logo} alt="Logo" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
            </div>
            <h1 style={{ fontSize: '4.2rem', margin: '0 0 10px 0', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", fontWeight: '400', lineHeight: '1.1' }}>Elevate Your Ritual</h1>
            <p style={{ fontSize: '1.4rem', lineHeight: '1.8', fontFamily: "'Cormorant Garamond', serif", color: '#736A6A', margin: '15px auto 35px', maxWidth: '600px' }}>Join our exclusive membership to unlock Susan's famous Personalized Beauty Consultation Quiz and bespoke product curation.</p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap', marginBottom: '35px' }}>
              <div style={{ border: '1px solid rgba(232, 197, 200, 0.6)', borderRadius: '20px', padding: '40px 30px', backgroundColor: 'rgba(255, 255, 255, 0.7)', flex: '1', minWidth: '300px', maxWidth: '400px', boxShadow: '0 10px 30px rgba(232, 197, 200, 0.15)' }}>
                <h3 style={{ fontSize: '2.2rem', color: '#8A797A', fontFamily: "'Cormorant Garamond', serif", margin: '0 0 10px 0' }}>The Luminary Circle</h3>
                <p style={{ fontSize: '1.8rem', color: '#5C5454', margin: '0 0 25px 0', fontFamily: "'Alex Brush', cursive" }}>$49 <span style={{fontSize: '1rem', fontFamily: 'sans-serif', fontStyle: 'italic', color: '#A89999'}}>/ month</span></p>
                <ul style={{ textAlign: 'left', listStyle: 'none', padding: 0, margin: '0 0 35px 0', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', lineHeight: '2' }}>
                  <li><span style={{color: '#E8C5C8', marginRight: '10px'}}>✧</span> Full access to the Curation Quiz</li>
                  <li><span style={{color: '#E8C5C8', marginRight: '10px'}}>✧</span> 3-piece skin care ritual box</li>
                  <li><span style={{color: '#E8C5C8', marginRight: '10px'}}>✧</span> Quarterly 1-on-1 consultation</li>
                  <li><span style={{color: '#E8C5C8', marginRight: '10px'}}>✧</span> 10% boutique discount</li>
                </ul>
                <EmpowermentButton text="Select Luminary" onClick={() => { setSelectedTier('luminary'); setIsSubscribing(true); setStep(3); }} />
              </div>

              <div style={{ border: '1px solid rgba(179, 139, 143, 0.8)', borderRadius: '20px', padding: '40px 30px', backgroundColor: 'rgba(255, 255, 255, 0.9)', flex: '1', minWidth: '300px', maxWidth: '400px', boxShadow: '0 10px 30px rgba(179, 139, 143, 0.25)' }}>
                <h3 style={{ fontSize: '2.2rem', color: '#B38B8F', fontFamily: "'Cormorant Garamond', serif", margin: '0 0 10px 0', fontWeight: 'bold' }}>The Radiance Elite</h3>
                <p style={{ fontSize: '1.8rem', color: '#5C5454', margin: '0 0 25px 0', fontFamily: "'Alex Brush', cursive" }}>$119 <span style={{fontSize: '1rem', fontFamily: 'sans-serif', fontStyle: 'italic', color: '#A89999'}}>/ month</span></p>
                <ul style={{ textAlign: 'left', listStyle: 'none', padding: 0, margin: '0 0 35px 0', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', lineHeight: '2' }}>
                  <li><span style={{color: '#B38B8F', marginRight: '10px'}}>✧</span> Full access to the Curation Quiz</li>
                  <li><span style={{color: '#B38B8F', marginRight: '10px'}}>✧</span> 5-piece premium skin care ritual box</li>
                  <li><span style={{color: '#B38B8F', marginRight: '10px'}}>✧</span> Monthly 1-on-1 consultations</li>
                  <li><span style={{color: '#B38B8F', marginRight: '10px'}}>✧</span> 25% off the boutique</li>
                </ul>
                <EmpowermentButton text="Select Radiance" onClick={() => { setSelectedTier('radiance'); setIsSubscribing(true); setStep(3); }} />
              </div>
            </div>
            
            <p style={{ cursor: 'pointer', color: '#A89999', textDecoration: 'underline', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', transition: 'color 0.3s ease' }} onClick={() => setStep(0)} onMouseOver={(e) => e.target.style.color = '#736A6A'} onMouseOut={(e) => e.target.style.color = '#A89999'}>← Back to Home</p>
          </div>
        )}

        {step === 3 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
              <img src={logo} alt="Logo" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
            </div>
            <h1 style={{ fontSize: '4.2rem', margin: '0 0 10px 0', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", fontWeight: '400', lineHeight: '1.1' }}>
              Join {selectedTier === 'radiance' ? 'The Radiance Elite' : 'The Luminary Circle'}
            </h1>
            <p style={{ fontSize: '1.4rem', lineHeight: '1.8', fontFamily: "'Cormorant Garamond', serif", color: '#736A6A', margin: '15px auto 35px', maxWidth: '600px' }}>Enter your details below to create your account before proceeding to Stripe secure checkout.</p>

            {isLoading ? (
              <EmpowermentLoader text="Connecting to payment gateway..."/>
            ) : (
              <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                <ElegantInput name="name" onChange={handleInputChange} placeholder="Your First Name" type="text" value={userDetails.name}/>
                <ElegantInput name="email" onChange={handleInputChange} placeholder="Email Address" type="email" value={userDetails.email}/>
                <ElegantInput name="password" onChange={handleInputChange} placeholder="Create a Password" type="password" value={userDetails.password}/>
                
                <div style={{ marginTop: '35px' }}>
                  <EmpowermentButton text="Proceed to Checkout" onClick={handleCreateAccount}/>
                </div>
                <p style={{ cursor: 'pointer', color: '#A89999', textDecoration: 'underline', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', marginTop: '20px', transition: 'color 0.3s ease' }} onClick={() => setStep(2)} onMouseOver={(e) => e.target.style.color = '#736A6A'} onMouseOut={(e) => e.target.style.color = '#A89999'}>← Back to Tiers</p>
              </div>
            )}
          </div>
        )}

        {step === 7 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
              <img src={logo} alt="Logo" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
            </div>
            <h1 style={{ fontSize: '4.2rem', margin: '0 0 10px 0', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", fontWeight: '400', lineHeight: '1.1' }}>Free Membership</h1>
            <p style={{ fontSize: '1.4rem', lineHeight: '1.8', fontFamily: "'Cormorant Garamond', serif", color: '#736A6A', margin: '15px auto 35px', maxWidth: '600px' }}>Enter your details below to join our community and start shopping our curated boutique.</p>

            {isLoading ? (
              <EmpowermentLoader text="Creating your free membership..."/>
            ) : (
              <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                <ElegantInput name="name" onChange={handleInputChange} placeholder="Your First Name" type="text" value={userDetails.name}/>
                <ElegantInput name="email" onChange={handleInputChange} placeholder="Email Address" type="email" value={userDetails.email}/>
                <ElegantInput name="password" onChange={handleInputChange} placeholder="Create a Password" type="password" value={userDetails.password}/>
                
                <div style={{ marginTop: '35px' }}>
                  <EmpowermentButton text="Start Shopping ✧" onClick={handleFreeMembershipSubmit}/>
                </div>
                <p style={{ cursor: 'pointer', color: '#A89999', textDecoration: 'underline', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', marginTop: '20px', transition: 'color 0.3s ease' }} onClick={() => setStep(0)} onMouseOver={(e) => e.target.style.color = '#736A6A'} onMouseOut={(e) => e.target.style.color = '#A89999'}>← Back to Home</p>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
              <img src={logo} alt="Logo" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
            </div>
            <h1 style={{ fontSize: '4.2rem', margin: '0 0 10px 0', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", fontWeight: '400', lineHeight: '1.1' }}>Welcome Back</h1>
            <p style={{ fontSize: '1.4rem', lineHeight: '1.8', fontFamily: "'Cormorant Garamond', serif", color: '#736A6A', margin: '15px auto 35px', maxWidth: '600px' }}>Sign in to access your dashboard and personalized blueprint.</p>

            {isLoading ? (
              <EmpowermentLoader text="Verifying credentials securely..."/>
            ) : (
              <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                <ElegantInput name="email" onChange={handleLoginInputChange} placeholder="Email Address" type="email" value={loginCredentials.email}/>
                <ElegantInput name="password" onChange={handleLoginInputChange} placeholder="Password" type="password" value={loginCredentials.password}/>
                
                <div style={{ marginTop: '35px' }}>
                  <EmpowermentButton text="Sign In" onClick={handleLoginSubmit}/>
                </div>

                <p style={{ cursor: 'pointer', color: '#A89999', textDecoration: 'underline', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', marginTop: '20px', transition: 'color 0.3s ease' }} onClick={() => setStep(0)} onMouseOver={(e) => e.target.style.color = '#736A6A'} onMouseOut={(e) => e.target.style.color = '#A89999'}>← Back to Home</p>
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div style={{ animation: 'fadeIn 1.5s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(232, 197, 200, 0.4)', paddingBottom: '15px' }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: '#A89999', fontSize: '1.2rem' }}>Welcome, {userDetails.name || 'Valued Member'}</span>
              <button onClick={handleLogOut} style={{ background: 'none', border: '1px solid #E8C5C8', borderRadius: '20px', padding: '5px 15px', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", cursor: 'pointer', fontSize: '1rem', transition: 'all 0.3s ease' }} onMouseOver={(e) => { e.target.style.backgroundColor = '#F2D4D7'; }} onMouseOut={(e) => { e.target.style.backgroundColor = 'transparent'; }}>Sign Out</button>
            </div>

            <h1 style={{ fontSize: '3.8rem', margin: '0 0 10px 0', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", fontWeight: '400' }}>Your Member Dashboard</h1>
            <p style={{ fontSize: '1.3rem', lineHeight: '1.6', fontFamily: "'Cormorant Garamond', serif", color: '#736A6A', margin: '0 auto 30px', maxWidth: '600px' }}>
              {selectedTier === 'radiance' ? "🌟 Radiance Elite Member — Premium Access Verified." : selectedTier === 'luminary' ? "✨ Luminary Circle Member — Subscription Verified." : "✨ Access verified."}
            </p>

            {userRecommendations.length > 0 && (
              <div style={{ textAlign: 'left', marginBottom: '40px', backgroundColor: 'rgba(255, 240, 242, 0.6)', border: '1px solid #E8C5C8', borderRadius: '20px', padding: '25px' }}>
                <h2 style={{ fontSize: '2.5rem', margin: '0 0 5px 0', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", fontWeight: '400' }}>Susan's Direct Recommendations For You ✧</h2>
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', color: '#8A797A', fontStyle: 'italic', marginBottom: '20px' }}>Hand-selected specifically for your custom beauty profile by Susan.</p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                  {userRecommendations.map((product) => (
                    <ProductCard key={product._id || product.title} product={product} onAddToCart={handleAddToCart} onCardClick={setSelectedProduct} />
                  ))}
                </div>
              </div>
            )}

            {!hasCompletedQuiz ? (
              <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', border: '1px solid #E8C5C8', borderRadius: '15px', padding: '40px', boxShadow: '0 4px 15px rgba(232, 197, 200, 0.15)', margin: '40px 0' }}>
                <h3 style={{ fontSize: '2.2rem', color: '#5C5454', fontFamily: "'Cormorant Garamond', serif", margin: '0 0 15px 0' }}>Unlock Your Bespoke Routine</h3>
                <p style={{ fontSize: '1.2rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>As a member, you have exclusive access to Susan's Beauty Blueprint curation process. Take the quiz to generate your custom products.</p>
                <EmpowermentButton text="Start the Consultation" onClick={() => setStep(11)} />
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', textAlign: 'left', marginBottom: '45px' }}>
                  <BlueprintCard label="Skin Temperament" value={quizAnswers.skinType}/>
                  <BlueprintCard label="Primary Vision" value={quizAnswers.primaryGoal}/>
                  <BlueprintCard label="Climate Context" value={quizAnswers.climate}/>
                  <BlueprintCard label="Skin Sensitivity" value={quizAnswers.skinSensitivity}/>
                  <BlueprintCard label="Complexion Canvas" value={quizAnswers.complexion}/>
                  <BlueprintCard label="Undertone" value={quizAnswers.undertone}/>
                  <BlueprintCard label="Eye Color" value={quizAnswers.eyeColor}/>
                  <BlueprintCard label="Facial Silhouette" value={quizAnswers.faceShape}/>
                  <BlueprintCard label="Signature Aesthetic" value={quizAnswers.makeupVibe}/>
                  <BlueprintCard label="Regimen Focus" value={quizAnswers.routineFocus}/>
                </div>
              </>
            )}

            {userOrders.length > 0 && (
              <div style={{ marginTop: '40px', textAlign: 'left', backgroundColor: 'rgba(255, 255, 255, 0.8)', border: '1px solid #E8C5C8', borderRadius: '15px', padding: '30px', boxShadow: '0 4px 15px rgba(232, 197, 200, 0.15)' }}>
                <h3 style={{ fontSize: '2.2rem', color: '#5C5454', fontFamily: "'Cormorant Garamond', serif", margin: '0 0 20px 0' }}>Order History</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {userOrders.map((order, idx) => (
                    <div key={order._id || idx} style={{ padding: '15px', border: '1px solid #E8C5C8', borderRadius: '10px', backgroundColor: '#FFF9F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <p style={{ margin: '0 0 5px 0', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', color: '#5C5454', fontWeight: 'bold' }}>Order Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                        <p style={{ margin: '0 0 5px 0', fontFamily: 'sans-serif', fontSize: '0.9rem', color: '#8A797A' }}>Total: ${(order.totalAmount || 0).toFixed(2)}</p>
                        <p style={{ margin: 0, fontFamily: 'sans-serif', fontSize: '0.9rem', color: '#8A797A' }}>Status: <span style={{ color: order.status === 'SHIPPED' ? '#B38B8F' : '#A89999', fontWeight: 'bold' }}>{order.status || 'Pending'}</span></p>
                      </div>
                      {order.tracking_code && (
                        <div style={{ backgroundColor: '#FFF0F2', padding: '10px 15px', borderRadius: '8px', border: '1px solid #E8C5C8' }}>
                          <p style={{ margin: '0 0 3px 0', fontSize: '0.85rem', color: '#A89999' }}>Tracking Number</p>
                          <p style={{ margin: 0, fontSize: '1.1rem', color: '#B38B8F', fontWeight: 'bold' }}>{order.tracking_code}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 6 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
             <AdminDashboard adminData={adminData} onLogout={handleLogOut} backendProducts={backendProducts} />
          </div>
        )}

        {/* ---------------- CONSULTATION QUIZ STEPS 11-21 ---------------- */}
        
        {step === 11 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <ProgressDots currentStep={1} totalSteps={10} />
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 20px 0' }}>Discover Your Temperament</h2>
            <p style={{ fontSize: '1.4rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>How does your skin naturally behave throughout the day?</p>
            <QuizOptionButton text="Balanced & Harmonious (Normal)" onClick={() => handleAnswer('skinType', 'Normal')} />
            <QuizOptionButton text="Dewy to Oily (Produces excess shine)" onClick={() => handleAnswer('skinType', 'Oily')} />
            <QuizOptionButton text="Thirsty & Tight (Dry)" onClick={() => handleAnswer('skinType', 'Dry')} />
            <QuizOptionButton text="Combination (Oily T-zone, dry cheeks)" onClick={() => handleAnswer('skinType', 'Combination')} />
          </div>
        )}

        {step === 12 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <ProgressDots currentStep={2} totalSteps={10} />
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 20px 0' }}>Your Primary Vision</h2>
            <p style={{ fontSize: '1.4rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>What is the main focus of your bespoke routine?</p>
            <QuizOptionButton text="Age-Defying Radiance" onClick={() => handleAnswer('primaryGoal', 'Anti-Aging')} />
            <QuizOptionButton text="Clearing Blemishes & Texture" onClick={() => handleAnswer('primaryGoal', 'Acne/Texture')} />
            <QuizOptionButton text="Deep Hydration & Plumping" onClick={() => handleAnswer('primaryGoal', 'Hydration')} />
            <QuizOptionButton text="Brightening & Even Tone" onClick={() => handleAnswer('primaryGoal', 'Brightening')} />
          </div>
        )}

        {step === 13 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <ProgressDots currentStep={3} totalSteps={10} />
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 20px 0' }}>Your Climate Context</h2>
            <p style={{ fontSize: '1.4rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>What environment surrounds you daily?</p>
            <QuizOptionButton text="Arid & Dry" onClick={() => handleAnswer('climate', 'Dry')} />
            <QuizOptionButton text="Humid & Tropical" onClick={() => handleAnswer('climate', 'Humid')} />
            <QuizOptionButton text="Temperate & Mild" onClick={() => handleAnswer('climate', 'Temperate')} />
            <QuizOptionButton text="Cold & Harsh" onClick={() => handleAnswer('climate', 'Cold')} />
          </div>
        )}

        {step === 14 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <ProgressDots currentStep={4} totalSteps={10} />
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 20px 0' }}>Skin Sensitivity</h2>
            <p style={{ fontSize: '1.4rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>Does your skin react easily to new ingredients?</p>
            <QuizOptionButton text="Highly Sensitive (Often reacts)" onClick={() => handleAnswer('skinSensitivity', 'High')} />
            <QuizOptionButton text="Moderately Sensitive (Occasional redness)" onClick={() => handleAnswer('skinSensitivity', 'Moderate')} />
            <QuizOptionButton text="Resilient (Rarely reacts)" onClick={() => handleAnswer('skinSensitivity', 'Low')} />
          </div>
        )}

        {step === 15 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <ProgressDots currentStep={5} totalSteps={10} />
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 20px 0' }}>Your Complexion Canvas</h2>
            <p style={{ fontSize: '1.4rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>How would you describe your overall skin tone?</p>
            <QuizOptionButton text="Porcelain to Fair" onClick={() => handleAnswer('complexion', 'Fair')} />
            <QuizOptionButton text="Light to Medium" onClick={() => handleAnswer('complexion', 'Medium')} />
            <QuizOptionButton text="Tan to Olive" onClick={() => handleAnswer('complexion', 'Olive')} />
            <QuizOptionButton text="Deep to Rich" onClick={() => handleAnswer('complexion', 'Deep')} />
          </div>
        )}

        {step === 16 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <ProgressDots currentStep={6} totalSteps={10} />
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 20px 0' }}>Unveiling Your Undertone</h2>
            <p style={{ fontSize: '1.4rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>Do your veins appear more blue, green, or a mix?</p>
            <QuizOptionButton text="Cool (Blue/Purple veins, hints of pink)" onClick={() => handleAnswer('undertone', 'Cool')} />
            <QuizOptionButton text="Warm (Green veins, hints of peach/gold)" onClick={() => handleAnswer('undertone', 'Warm')} />
            <QuizOptionButton text="Neutral (Mix of both)" onClick={() => handleAnswer('undertone', 'Neutral')} />
          </div>
        )}

        {step === 17 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <ProgressDots currentStep={7} totalSteps={10} />
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 20px 0' }}>Eye Color</h2>
            <p style={{ fontSize: '1.4rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>What color are your eyes?</p>
            <QuizOptionButton text="Deep Brown to Black" onClick={() => handleAnswer('eyeColor', 'Brown')} />
            <QuizOptionButton text="Blue to Grey" onClick={() => handleAnswer('eyeColor', 'Blue')} />
            <QuizOptionButton text="Green to Hazel" onClick={() => handleAnswer('eyeColor', 'Green')} />
          </div>
        )}

        {step === 18 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <ProgressDots currentStep={8} totalSteps={10} />
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 20px 0' }}>Facial Silhouette</h2>
            <p style={{ fontSize: '1.4rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>How would you describe your natural face shape?</p>
            <QuizOptionButton text="Oval (Softly rounded, balanced)" onClick={() => handleAnswer('faceShape', 'Oval')} />
            <QuizOptionButton text="Round (Fuller cheeks, soft angles)" onClick={() => handleAnswer('faceShape', 'Round')} />
            <QuizOptionButton text="Square/Heart (Strong jawline or wider forehead)" onClick={() => handleAnswer('faceShape', 'Square/Heart')} />
          </div>
        )}

        {step === 19 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <ProgressDots currentStep={9} totalSteps={10} />
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 20px 0' }}>Signature Aesthetic</h2>
            <p style={{ fontSize: '1.4rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>What is your preferred makeup style?</p>
            <QuizOptionButton text="Barely There (No-makeup makeup)" onClick={() => handleAnswer('makeupVibe', 'Natural')} />
            <QuizOptionButton text="Soft Glam (Elevated everyday elegance)" onClick={() => handleAnswer('makeupVibe', 'Soft Glam')} />
            <QuizOptionButton text="Full Glam (Bold, sculpted, dramatic)" onClick={() => handleAnswer('makeupVibe', 'Full Glam')} />
          </div>
        )}

        {step === 20 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
            <ProgressDots currentStep={10} totalSteps={10} />
            <h2 style={{ fontSize: '3rem', color: '#B38B8F', fontFamily: "'Alex Brush', cursive", margin: '0 0 20px 0' }}>Regimen Focus</h2>
            <p style={{ fontSize: '1.4rem', color: '#736A6A', fontFamily: "'Cormorant Garamond', serif", marginBottom: '30px' }}>Do you prefer a minimalist routine or a luxurious multi-step ritual?</p>
            <QuizOptionButton text="Minimalist (3 steps max, fast & effective)" onClick={() => handleAnswer('routineFocus', 'Minimalist')} />
            <QuizOptionButton text="Balanced (Moderate steps, focused results)" onClick={() => handleAnswer('routineFocus', 'Balanced')} />
            <QuizOptionButton text="Luxurious (Multi-step indulgence)" onClick={() => handleAnswer('routineFocus', 'Luxurious')} />
          </div>
        )}

        {step === 21 && (
          <div style={{ animation: 'fadeIn 1s ease' }}>
             <EmpowermentLoader text="Susan's AI is analyzing your profile..."/>
          </div>
        )}

      </EmpowermentContainer>
    </div>
  );
}

export default App;