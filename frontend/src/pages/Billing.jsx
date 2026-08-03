import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Smartphone, Scale, Package, X, Printer } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, socket } from '../api';

/* ── helpers ─────────────────────────────────────────────── */

/* ── Category gradient colors for card backgrounds ── */
const CAT_COLORS = {
  'Hot Drinks':        ['#92400e','#b45309'],
  'Milk Shake':        ['#6d28d9','#8b5cf6'],
  'Mojito':            ['#065f46','#059669'],
  'Chat Items':        ['#9a3412','#ea580c'],
  'Scopes':            ['#be185d','#ec4899'],
  'Juice':             ['#92400e','#f59e0b'],
  'Cooling':           ['#1e40af','#3b82f6'],
  'Starter (Veg)':     ['#166534','#22c55e'],
  'Rice & Noodle':     ['#854d0e','#ca8a04'],
  'Starter (Non-Veg)': ['#7f1d1d','#ef4444'],
  'Desserts':          ['#86198f','#d946ef'],
  'Savories':          ['#78350f','#d97706'],
};

const getItemImage = (name, category) => {
  const specialImages = {
    'Coffee': 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=300&q=70',
    'French Fries': 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=300&q=70',
    'Pani Puri': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=300&q=70',
    'Chicken Nuggets': 'https://images.unsplash.com/photo-1562967914-608f82629710?w=300&q=70',
  };
  
  if (specialImages[name]) return specialImages[name];
  const searchQuery = encodeURIComponent(`${name} ${category !== 'Chat Items' && category !== 'Savories' ? category : ''} food`);
  return `https://tse1.mm.bing.net/th?q=${searchQuery}`;
};

const getCatEmoji = (cat) => {
  const m = { 'hot drinks':'☕','milk shake':'🥤','mojito':'🍹','chat items':'🍡',
    'scopes':'🍦','juice':'🍊','cooling':'🧊','starter (veg)':'🥗',
    'rice & noodle':'🍜','starter (non-veg)':'🍗','desserts':'🍰','savories':'⚖️' };
  return m[cat?.toLowerCase()] ?? '🍽️';
};


/* ── component ───────────────────────────────────────────── */
const Billing = () => {
  const [items, setItems]                     = useState([]);
  const [categoriesData, setCategoriesData]   = useState([]);
  const [cart, setCart]                       = useState([]);
  const [search, setSearch]                   = useState('');
  const [categoryFilter, setCategoryFilter]   = useState('Recent');
  const [isCheckoutOpen, setIsCheckoutOpen]   = useState(false);
  const [paymentMethod, setPaymentMethod]     = useState('Cash');
  const [mobileView, setMobileView]           = useState('menu'); // 'menu' or 'cart'
  const [isCheckingOut, setIsCheckingOut]     = useState(false);

  const location = useLocation();
  const navigate  = useNavigate();
  const editBill  = location.state?.editBill || null;
  const [editingBillId,     setEditingBillId]     = useState(null);
  const [editingBillNumber, setEditingBillNumber] = useState(null);

  const [weightModal, setWeightModal] = useState(null); // { item, catMeta }
  const [weightGrams, setWeightGrams] = useState('');
  const [receipt, setReceipt]         = useState(null);

  useEffect(() => {
    loadMenu();
    if (editBill) {
      setEditingBillId(editBill.id);
      setEditingBillNumber(editBill.bill_number);
      setPaymentMethod(editBill.payment_method);
      setCart(editBill.items.map(i => ({
        id: i.item_id, name: i.item_name,
        price: i.price, quantity: i.quantity, stock_count: 9999,
      })));
      navigate('/billing', { replace: true, state: {} });
    }
    const onUpdate = (d) => { if (d.table === 'menu') loadMenu(); };
    socket.on('database_update', onUpdate);
    return () => socket.off('database_update', onUpdate);
  }, [editBill, navigate]);

  const loadMenu = async () => {
    try { 
      setItems(await api.getMenu());
      setCategoriesData(await api.getCategories());
    }
    catch (e) { console.error('Failed to load menu/categories', e); }
  };

  const categories  = ['Recent', 'All', ...new Set(items.map(i => i.category))].filter((v,i,a)=>a.indexOf(v)===i);
  
  let filtered = items.filter(i => {
    if (categoryFilter === 'Recent') {
      const recentOrder = [
        'tea', 'coffee', 'black tea', 'black coffee', 'ginger tea', 
        'yalaka tea', 'nt tea', 'nt coffee', 'nt ginger tea', 'boost', 'horlicks'
      ];
      return recentOrder.includes(i.name.toLowerCase()) && i.name.toLowerCase().includes(search.toLowerCase());
    }
    return i.name.toLowerCase().includes(search.toLowerCase()) && (categoryFilter === 'All' || i.category === categoryFilter);
  });

  if (categoryFilter === 'Recent') {
    const recentOrder = [
      'tea', 'coffee', 'black tea', 'black coffee', 'ginger tea', 
      'yalaka tea', 'nt tea', 'nt coffee', 'nt ginger tea', 'boost', 'horlicks'
    ];
    filtered.sort((a, b) => {
      const indexA = recentOrder.indexOf(a.name.toLowerCase());
      const indexB = recentOrder.indexOf(b.name.toLowerCase());
      return indexA - indexB;
    });
  }

  const addToCart = (item) => {
    const catMeta = categoriesData.find(c => c.name === item.category);
    if (catMeta?.pricing_type === 'weight') {
      setWeightModal({ item, catMeta }); 
      setWeightGrams(''); 
      return;
    }
    if (item.stock_count <= 0) { alert('Out of stock!'); return; }
    setCart(prev => {
      const ex = prev.find(i => i.id === item.id);
      if (ex) {
        if (ex.quantity >= item.stock_count) return prev;
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQty = (id, delta) => setCart(prev =>
    prev.map(i => {
      if (i.id !== id) return i;
      const q = i.quantity + delta;
      if (q <= 0) return { ...i, quantity: 0 };
      if (q <= i.stock_count) return { ...i, quantity: q };
      return i;
    }).filter(i => i.quantity > 0)
  );

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));

  const handleWeightSubmit = (e) => {
    e.preventDefault();
    if (!weightGrams || isNaN(weightGrams) || Number(weightGrams) <= 0) return;
    
    const { item, catMeta } = weightModal;
    const grams = Number(weightGrams);
    const kgs = grams / 1000;
    
    const pricePerKg = catMeta.weight_unit === '1kg' ? item.price : item.price * 10;
    
    setCart(prev => [...prev, {
      id: Date.now() + Math.random(),
      item_id: item.id,
      name: item.name,
      price: pricePerKg,
      quantity: kgs,
      isWeightBased: true,
      stock_count: 9999,
    }]);
    setWeightModal(null);
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const total    = subtotal;

  const handleCheckout = async () => {
    if (!cart.length || isCheckingOut) return;
    setIsCheckingOut(true);
    const billData = {
      id: editingBillId,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      subtotal, tax: 0, total, payment_method: paymentMethod,
      items: cart.map(i => ({ id: i.item_id || i.id, name: i.name, price: i.price, quantity: i.quantity })),
    };
    try {
      if (editingBillId) {
        const r = await api.updateBill(billData);
        if (r.success) {
          setCart([]); setIsCheckoutOpen(false);
          setReceipt({ billNumber: editingBillNumber, items: cart, total, paymentMethod, date: billData.date, time: billData.time });
          setEditingBillId(null); setEditingBillNumber(null);
        }
      } else {
        const r = await api.createBill(billData);
        if (r.success) {
          setCart([]); setIsCheckoutOpen(false);
          setReceipt({ billNumber: r.billNumber, items: cart, total, paymentMethod, date: billData.date, time: billData.time });
        }
      }
    } catch (e) { 
      console.error(e); 
      alert('Checkout failed: ' + (e.message || 'Check your internet or database connection')); 
    } finally {
      setIsCheckingOut(false);
    }
  };

  /* ── styles ─ */
  const S = {
    overlay: { position:'fixed', inset:0, background:'rgba(15,23,42,0.85)', backdropFilter:'blur(12px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' },
    modal:   { background:'var(--bg-surface-solid)', borderRadius:'var(--r-xl)', padding:'2rem', width:'420px', maxWidth: '95%', boxShadow:'var(--shadow-lg)', animation:'slideUp 0.3s var(--ease)', border:'1px solid var(--border-strong)' },
  };

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '1rem' }}>
      
      {/* ── TOP BAR ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', marginBottom: '2px' }}>Billing</h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dashboard &bull; Billing</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {/* Action buttons removed */}
        </div>
      </div>

      <div className="animate-fade-in billing-layout" style={{ position: 'relative', flex: 1, minHeight: 0 }}>

        {/* ── MOBILE TOGGLE (Sticky Top) ────────────────── */}
        <div className="mobile-flex" style={{
          display: 'none',
          position: 'sticky',
          top: '-1px',
          background: 'var(--bg)',
          padding: '0.75rem 0',
          zIndex: 100,
          justifyContent: 'center',
          borderBottom: '1px solid var(--border)',
          marginBottom: '0.5rem'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            padding: '0.3rem',
            borderRadius: '99px',
            display: 'flex',
            gap: '0.2rem',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <button
              onClick={() => setMobileView('menu')}
              style={{
                padding: '0.5rem 1.5rem',
                borderRadius: '99px',
                border: 'none',
                background: mobileView === 'menu' ? 'var(--primary)' : 'transparent',
                color: mobileView === 'menu' ? '#fff' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Menu
            </button>
            <button
              onClick={() => setMobileView('cart')}
              style={{
                padding: '0.5rem 1.5rem',
                borderRadius: '99px',
                border: 'none',
                background: mobileView === 'cart' ? 'var(--primary)' : 'transparent',
                color: mobileView === 'cart' ? '#fff' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              Cart {cart.length > 0 && <span style={{ background: mobileView === 'cart' ? '#fff' : 'var(--primary)', color: mobileView === 'cart' ? 'var(--primary)' : '#fff', padding: '0 5px', borderRadius: '4px', fontSize: '0.7rem' }}>{cart.length}</span>}
            </button>
          </div>
        </div>

        {/* ── LEFT: Menu ───────────────────────────────── */}
        <div className={`billing-main ${mobileView === 'menu' ? 'mobile-show' : 'mobile-hide'} glass-panel`} style={{ borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>

          {/* Search + Filters bar */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ flex: 2, position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search in products"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '12px', border: '1px solid var(--border-strong)', background: 'rgba(255,255,255,0.03)', color: 'var(--text)', outline: 'none', fontSize: '0.9rem' }}
              />
            </div>
            <select style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-strong)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', outline: 'none', fontSize: '0.9rem' }}>
              <option>All Category</option>
              {categories.filter(c => c !== 'Recent' && c !== 'All').map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="scroll-x" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                style={{
                  background: categoryFilter === cat ? 'var(--primary)' : 'transparent',
                  color: categoryFilter === cat ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '0.4rem 1rem',
                  borderRadius: '9999px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {cat === 'All' ? 'Show All' : cat}
              </button>
            ))}
          </div>

          {/* Menu grid */}
          <div style={{
            flex:1, overflowY:'auto',
            display:'grid',
            gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))',
            gridAutoRows:'max-content',
            gap:'1rem',
            paddingBottom:'0.5rem',
            alignContent:'start',
          }}>
            {filtered.map(item => {
              const available = item.stock_count > 0 || isSaver(item.category);
              const img = item.image_url || getItemImage(item.name, item.category);
              return (
                <div
                  className="premium-hover"
                  key={item.id}
                  onClick={() => available && addToCart(item)}
                  style={{
                    background:'var(--bg-surface2)',
                    border:'1px solid var(--border)',
                    borderRadius:'16px',
                    cursor: available ? 'pointer' : 'not-allowed',
                    opacity: available ? 1 : 0.5,
                    display:'flex', flexDirection:'column',
                    overflow:'hidden',
                    position: 'relative'
                  }}
                >
                  <div style={{ height:'120px', width: '100%', background: 'rgba(0,0,0,0.03)', display:'flex', alignItems:'center', justifyContent:'center', padding: img ? '0' : '15px' }}>
                    {img ? (
                      <img src={img} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No Image</div>
                    )}
                  </div>
                  
                  <div style={{ padding:'0.75rem', display:'flex', flexDirection:'column' }}>
                    <div style={{ fontWeight:600, fontSize:'0.8rem', color:'var(--text)', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                    <div style={{ color:'var(--primary)', fontWeight:700, fontSize:'0.9rem' }}>₹{item.price.toFixed(2)}</div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ gridColumn:'1/-1', textAlign:'center', color:'var(--text-muted)', padding:'4rem', fontSize:'0.95rem' }}>
                No items found. Try a different search.
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Cart ──────────────────────────────── */}
        <div className={`billing-cart ${mobileView === 'cart' ? 'mobile-show' : 'mobile-hide'} glass-panel`} style={{ padding:'1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>


          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={16} /> {editingBillNumber ? `Edit Order #${editingBillNumber}` : 'New Order'}
          </div>

          {/* Items list */}
          <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', marginBottom: '1rem', background:'var(--bg-surface-solid)', borderRadius:'8px', border:'1px solid var(--border)' }}>
            {cart.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cart is empty</div>}
            {cart.map((item, index) => (
              <div key={item.id} style={{ display:'flex', flexDirection: 'column', padding:'1rem', borderBottom: index < cart.length - 1 ? '1px solid var(--border)' : 'none', position: 'relative' }}>
                
                <button style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => removeFromCart(item.id)}>
                  <Trash2 size={12} />
                </button>

                <div style={{ fontWeight:600, fontSize:'0.85rem', color:'var(--text)', paddingRight: '20px' }}>{item.name}</div>
                <div style={{ color:'var(--primary)', fontSize:'0.8rem', fontWeight: 600, marginTop:'4px', marginBottom: '8px' }}>
                  ₹{item.price.toFixed(2)} × {item.isWeightBased || !Number.isInteger(item.quantity) ? `${item.quantity}kg` : item.quantity} = ₹{(item.price * item.quantity).toFixed(2)}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display:'flex', alignItems:'center', background:'var(--bg-surface2)', border:'1px solid var(--border)', borderRadius:'12px', overflow:'hidden', width: 'fit-content' }}>
                    <button style={{ padding:'0.1rem 0.5rem', border:'none', background:'transparent', color:'var(--text)', cursor: 'pointer' }} onClick={() => updateQty(item.id, -1)}><Minus size={12} /></button>
                    <span style={{ minWidth:'30px', padding:'0 4px', textAlign:'center', fontSize:'0.85rem', fontWeight:700, color:'var(--text)' }}>
                      {item.isWeightBased || !Number.isInteger(item.quantity) ? `${item.quantity}kg` : item.quantity}
                    </span>
                    <button style={{ padding:'0.1rem 0.5rem', border:'none', background:'transparent', color:'var(--text)', cursor: 'pointer' }} onClick={() => updateQty(item.id, 1)}><Plus size={12} /></button>
                  </div>
                  <button style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'none', border: '1px dashed var(--border-strong)', padding: '0.2rem 0.4rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Add Notes
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Summary section */}
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px', marginBottom: '1rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'var(--text-muted)', marginBottom: '0.4rem' }}>
              <span>Sub total :</span> <span>₹{subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'var(--text-muted)', marginBottom: '0.4rem' }}>
              <span>Product Discount :</span> <span>₹0.00</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'var(--text-muted)', marginBottom: '0.4rem' }}>
              <span>Extra Discount :</span> <span>₹0.00</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'var(--text-muted)', marginBottom: '0.4rem' }}>
              <span>Coupon discount :</span> <span>₹0.00</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.9rem', fontWeight: 700, color:'var(--text)', borderTop: '1px solid var(--border-strong)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
              <span>Total :</span> <span>₹{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Buttons */}
          <div>
            <button onClick={() => setIsCheckoutOpen(true)} className="premium-btn-gradient" style={{ width: '100%', color: '#fff', border: 'none', padding: '1rem', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer' }}>
              Complete Order
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* ── CHECKOUT MODAL ─────────────────────────────── */}
      {isCheckoutOpen && (
        <div style={S.overlay} onClick={() => setIsCheckoutOpen(false)}>
          <div className="modal-container" style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign:'center', marginBottom:'2rem' }}>
              <div style={{ width:'60px', height:'60px', background:'var(--bg-surface2)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem', border:'1px solid var(--border-strong)' }}>
                <CreditCard size={28} color="var(--primary)" />
              </div>
              <h3 style={{ fontFamily:"'Inter',sans-serif", fontWeight:800, fontSize:'1.5rem', color:'var(--text)' }}>Payment Method</h3>
              <p style={{ color:'var(--text-muted)', fontSize:'0.9rem', marginTop:'0.35rem' }}>Select how the customer is paying</p>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem', marginBottom:'2rem' }}>
              {[
                { key:'Cash', icon:<Banknote size={24} />, label:'Cash', color:'#10b981' },
                { key:'UPI',  icon:<Smartphone size={24} />, label:'UPI',  color:'#8b5cf6' },
                { key:'Card', icon:<CreditCard size={24} />, label:'Card', color:'#3b82f6' },
              ].map(({ key, icon, label, color }) => (
                <div
                  key={key}
                  onClick={() => setPaymentMethod(key)}
                  style={{
                    border:`1px solid ${paymentMethod === key ? color : 'var(--border-strong)'}`,
                    borderRadius:'var(--r-lg)', padding:'1.25rem 0.5rem',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:'0.75rem',
                    cursor:'pointer', transition:'all 0.2s var(--ease)',
                    background: paymentMethod === key ? `${color}15` : 'var(--bg-surface2)',
                    boxShadow: paymentMethod === key ? `0 0 15px ${color}30` : 'none',
                    transform: paymentMethod === key ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  <span style={{ color: paymentMethod === key ? color : 'var(--text-muted)' }}>{icon}</span>
                  <span style={{ fontWeight:700, fontSize:'0.9rem', color: paymentMethod === key ? color : 'var(--text-muted)', fontFamily:"'Inter',sans-serif" }}>{label}</span>
                </div>
              ))}
            </div>

            <div style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              background:'var(--bg-surface2)', borderRadius:'var(--r-md)', padding:'1.25rem 1.5rem',
              marginBottom:'2rem', border:'1px solid var(--border)',
            }}>
              <span style={{ color:'var(--text-muted)', fontWeight:600 }}>Amount Due</span>
              <span style={{ fontFamily:"'Inter',sans-serif", fontWeight:800, fontSize:'1.6rem', color:'var(--text)' }}>₹{total.toFixed(2)}</span>
            </div>

            <div style={{ display:'flex', gap:'1rem' }}>
              <button className="btn btn-outline" style={{ flex:1 }} onClick={() => setIsCheckoutOpen(false)} disabled={isCheckingOut}>Cancel</button>
              <button 
                className="btn btn-primary" 
                style={{ flex:2, opacity: isCheckingOut ? 0.7 : 1, cursor: isCheckingOut ? 'not-allowed' : 'pointer' }} 
                onClick={handleCheckout}
                disabled={isCheckingOut}
              >
                {isCheckingOut ? 'Processing...' : (editingBillId ? 'Update Bill' : 'Confirm Payment')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SAVORIES WEIGHT MODAL ──────────────────────── */}
      {weightModal && (
        <div style={{ ...S.overlay, zIndex:1100 }} onClick={() => setWeightModal(null)}>
          <div className="modal-container" style={{ ...S.modal, width:'420px' }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{
              textAlign:'center', marginBottom:'2rem',
              padding:'1.5rem',
              background:'var(--bg-surface2)',
              borderRadius:'var(--r-lg)',
              border:'1px solid var(--border-strong)',
            }}>
              <div style={{ fontSize:'2.5rem', marginBottom:'0.5rem' }}>⚖️</div>
              <div style={{ fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--success)', marginBottom:'0.5rem' }}>By Weight</div>
              <h3 style={{ fontFamily:"'Inter',sans-serif", fontWeight:800, fontSize:'1.4rem', color:'var(--text)' }}>{weightModal.item.name}</h3>
            </div>

            <form onSubmit={handleWeightSubmit}>
              {/* Weight */}
              <div style={{ marginBottom:'1.25rem' }}>
                <label style={{ display:'block', marginBottom:'0.5rem', fontSize:'0.9rem', fontWeight:600, color:'var(--text-muted)' }}>
                  Weight (Grams)
                </label>
                <input
                  className="input"
                  type="number" required min="1"
                  value={weightGrams}
                  onChange={e => setWeightGrams(e.target.value)}
                  placeholder="e.g. 250"
                  autoFocus
                  style={{ fontSize:'1.1rem', fontWeight:600 }}
                />
              </div>

              {/* Price Calculation Display */}
              <div style={{ marginBottom:'1.5rem', padding: '1rem', background: 'var(--bg-surface2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <span>Unit Price:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>₹{weightModal.item.price} / {weightModal.catMeta.weight_unit}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 700 }}>
                  <span>Total Amount:</span>
                  <span style={{ color: 'var(--primary)' }}>
                    ₹{ weightGrams && !isNaN(weightGrams) 
                       ? (weightModal.catMeta.weight_unit === '1kg' 
                           ? ((Number(weightGrams) / 1000) * weightModal.item.price)
                           : ((Number(weightGrams) / 100) * weightModal.item.price)
                         ).toFixed(2)
                       : '0.00' }
                  </span>
                </div>
              </div>

              <div style={{ display:'flex', gap:'1rem' }}>
                <button type="button" className="btn btn-outline" style={{ flex:1 }} onClick={() => setWeightModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex:2, background:'var(--success)' }}>
                  Add to Cart
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── RECEIPT MODAL ──────────────────────────────── */}
      {receipt && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(12px)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem' }}>
          <div style={{
            background:'#ffffff',
            borderRadius:'12px',
            width:'380px',
            maxHeight:'92vh',
            overflowY:'auto',
            boxShadow:'0 32px 80px rgba(0,0,0,0.55)',
            position:'relative',
            color:'#111111',          /* explicit dark — no CSS var leakage */
            fontFamily:"'Inter','Segoe UI',Arial,sans-serif",
          }}>
            {/* Close */}
            <button onClick={()=>setReceipt(null)} style={{ position:'absolute',top:'16px',right:'16px',background:'none',border:'none',cursor:'pointer',color:'#555',lineHeight:1 }}>
              <X size={20}/>
            </button>

            {/* Receipt body */}
            <div id="receipt-content" style={{ padding:'2rem', color:'#111111' }}>

              {/* ── Shop Header ── */}
              <div style={{ textAlign:'center', paddingBottom:'1.5rem', borderBottom:'2px dashed #d0d0d0', marginBottom:'1.5rem' }}>
                <div style={{
                  fontFamily:"'Inter','Segoe UI',Arial,sans-serif",
                  fontWeight:800,
                  fontSize:'1.5rem',
                  letterSpacing:'0.12em',
                  textTransform:'uppercase',
                  color:'#111111',          /* hard-coded black — always visible */
                }}>TGM PANDI CAFE</div>
                <div style={{ fontFamily:"'Inter',Arial,sans-serif", fontWeight:500, fontSize:'0.85rem', color:'#555555', marginTop:'0.5rem', letterSpacing:'0.02em' }}>
                  Your Taste, Our Pride
                </div>
                <div style={{ fontFamily:"'Inter',Arial,sans-serif", fontSize:'0.75rem', color:'#888888', marginTop:'0.4rem' }}>
                  📍 Thank you for visiting us!
                </div>
              </div>

              {/* ── Bill Meta ── */}
              <div style={{ fontFamily:"'Inter Mono','Courier New',monospace", fontSize:'0.85rem', color:'#333333', marginBottom:'1.5rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.4rem' }}>
                  <span>Bill No</span>
                  <strong style={{ color:'#111111', fontWeight:700 }}>#{receipt.billNumber}</strong>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.4rem' }}>
                  <span>Date</span>
                  <span style={{ color:'#333333' }}>{receipt.date}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.4rem' }}>
                  <span>Time</span>
                  <span style={{ color:'#333333' }}>{receipt.time}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span>Payment</span>
                  <span style={{ color:'#111111', fontWeight:600 }}>{receipt.paymentMethod}</span>
                </div>
              </div>

              {/* ── Items ── */}
              <div style={{ borderTop:'1px dashed #ccc', borderBottom:'1px dashed #ccc', padding:'1rem 0', marginBottom:'1rem' }}>
                {/* Column headers */}
                <div style={{
                  display:'grid', gridTemplateColumns:'1fr 45px 75px',
                  fontFamily:"'Inter',Arial,sans-serif",
                  fontSize:'0.75rem', fontWeight:700,
                  textTransform:'uppercase', letterSpacing:'0.07em',
                  color:'#777777', marginBottom:'0.75rem',
                  borderBottom:'1px solid #eeeeee', paddingBottom:'0.5rem',
                }}>
                  <span>Item</span>
                  <span style={{ textAlign:'center' }}>Qty</span>
                  <span style={{ textAlign:'right' }}>Amount</span>
                </div>
                {/* Rows */}
                {receipt.items.map((it, i) => (
                  <div key={i} style={{
                    display:'grid', gridTemplateColumns:'1fr 45px 75px',
                    fontFamily:"'Inter Mono','Courier New',monospace",
                    fontSize:'0.85rem', color:'#222222',
                    marginBottom:'0.6rem', alignItems:'start',
                  }}>
                    <span style={{ lineHeight:1.4, paddingRight:'0.5rem' }}>{it.name}</span>
                    <span style={{ textAlign:'center', color:'#555555' }}>×{it.isWeightBased || !Number.isInteger(it.quantity) ? `${it.quantity}kg` : it.quantity}</span>
                    <span style={{ textAlign:'right', fontWeight:600, color:'#111111' }}>₹{(it.price * it.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* ── Total ── */}
              <div style={{
                display:'flex', justifyContent:'space-between', alignItems:'center',
                fontFamily:"'Inter',Arial,sans-serif",
                fontWeight:800, fontSize:'1.2rem', color:'#111111',
                borderBottom:'3px double #111111',
                padding:'0.8rem 0', marginBottom:'1.5rem',
              }}>
                <span style={{ letterSpacing:'0.04em' }}>TOTAL</span>
                <span style={{ fontSize:'1.4rem' }}>₹{receipt.total.toFixed(2)}</span>
              </div>

              {/* ── Footer ── */}
              <div style={{ textAlign:'center', fontFamily:"'Inter',Arial,sans-serif", lineHeight:1.8 }}>
                <div style={{ fontWeight:700, fontSize:'0.9rem', color:'#333333', letterSpacing:'0.06em' }}>
                  ✦ THANK YOU ✦
                </div>
                <div style={{ fontSize:'0.8rem', color:'#666666' }}>Please visit again soon!</div>
                <div style={{ marginTop:'1rem', paddingTop:'0.8rem', borderTop:'1px dashed #ddd', fontSize:'0.7rem', color:'#aaaaaa', letterSpacing:'0.04em' }}>
                  Powered by TGM POS System
                </div>
              </div>
            </div>

            {/* ── Action buttons ── */}
            <div style={{ padding:'1.25rem 2rem', borderTop:'1px solid #eeeeee', display:'flex', gap:'1rem', background:'#fafafa', borderRadius:'0 0 12px 12px' }}>
              <button onClick={()=>setReceipt(null)} style={{
                flex:1, padding:'0.75rem', border:'1px solid #d0d0d0', borderRadius:'8px',
                background:'#ffffff', color:'#333333', fontFamily:"'Inter',sans-serif",
                fontWeight:600, fontSize:'0.9rem', cursor:'pointer',
              }}>Close</button>
              <button onClick={() => {
                const content = document.getElementById('receipt-content').innerHTML;
                const w = window.open('','_blank','width=400,height=700');
                w.document.write(`<!DOCTYPE html><html><head><title>Bill #${receipt.billNumber}</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Inter',Arial,sans-serif;color:#111;background:#fff;padding:1rem;}</style></head><body>${content}</body></html>`);
                w.document.close();
                w.focus();
                setTimeout(()=>{ w.print(); w.close(); }, 400);
              }} style={{
                flex:1, padding:'0.75rem', border:'none', borderRadius:'8px',
                background:'#000', color:'#ffffff',
                fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:'0.9rem',
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem',
              }}>
                <Printer size={18}/> Print Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Billing;



