import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit, Trash2, Search, X, Calendar, ShoppingCart, IndianRupee, Tag } from 'lucide-react';
import { api, socket } from '../api';

const Purchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('Day'); // 'Day', 'Month', 'All'
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    quantity: '',
    price: '',
    category: ''
  });

  const categoriesList = ['Ingredients', 'Dairy', 'Vegetables/Fruits', 'Packaging', 'Rent & Utilities', 'Salaries & Wages', 'Other'];

  useEffect(() => {
    loadPurchases();
    
    const handleUpdate = () => {
      loadPurchases();
    };
    socket.on('database_update', handleUpdate);
    return () => socket.off('database_update', handleUpdate);
  }, []);

  const loadPurchases = async () => {
    try {
      const data = await api.getPurchases();
      setPurchases(data || []);
    } catch (err) {
      console.error("Failed to load purchases", err);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const openNewItemModal = () => {
    setEditingItem(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      quantity: '',
      price: '',
      category: ''
    });
    setSelectedCategory('');
    setIsModalOpen(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      date: item.date,
      description: item.description,
      quantity: item.quantity.toString(),
      price: item.price.toString(),
      category: item.category
    });
    const isStandardCat = categoriesList.includes(item.category);
    setSelectedCategory(isStandardCat ? item.category : 'Other');
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this purchase record?')) {
      try {
        await api.deletePurchaseItem(id);
        await loadPurchases();
      } catch (err) {
        console.error("Failed to delete purchase", err);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    const purchaseData = {
      ...formData,
      quantity: parseFloat(formData.quantity),
      price: parseFloat(formData.price),
      category: selectedCategory === 'Other' ? formData.category : selectedCategory
    };

    try {
      if (editingItem) {
        await api.updatePurchaseItem({ ...purchaseData, id: editingItem.id });
      } else {
        await api.addPurchaseItem(purchaseData);
      }
      await loadPurchases();
      closeModal();
    } catch (err) {
      console.error("Failed to save purchase", err);
    } finally {
      setIsSaving(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  // Filter logic
  const filteredPurchases = purchases.filter(item => {
    // 1. Search Filter
    const matchesSearch = 
      item.description.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Date Filter
    if (filterType === 'Day') {
      return item.date === filterDate;
    } else if (filterType === 'Month') {
      return item.date.startsWith(filterMonth);
    }
    return true; // 'All'
  });

  // Calculations
  const totalAmount = filteredPurchases.reduce((sum, item) => sum + item.total, 0);
  const purchaseCount = filteredPurchases.length;

  return (
    <div className="page-scroll">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Header Area */}
        <div>
          <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: '2rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.5rem' }}>Purchase Details</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Track and manage your expenses and restocks.</p>
        </div>

        {/* Top Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.05))',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--danger)',
              width: '56px', height: '56px', borderRadius: 'var(--r-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <IndianRupee size={26} />
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                Total Purchases ({filterType})
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: "'Inter', sans-serif", lineHeight: 1 }}>
                ₹{totalAmount.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.05))',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: 'var(--primary)',
              width: '56px', height: '56px', borderRadius: 'var(--r-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <ShoppingCart size={26} />
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                Entries Count
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: "'Inter', sans-serif", lineHeight: 1 }}>
                {purchaseCount}
              </div>
            </div>
          </div>
        </div>

        {/* Filters Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
            
            {/* Search Bar */}
            <div style={{ position: 'relative', minWidth: '220px', flex: 1, maxWidth: '350px' }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                className="input" 
                type="text" 
                placeholder="Search description or category..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '40px' }}
              />
            </div>

            {/* Filter Type Dropdown */}
            <select 
              className="input"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ width: '130px', appearance: 'auto', background: 'var(--bg-surface)' }}
            >
              <option value="Day">Daily</option>
              <option value="Month">Monthly</option>
              <option value="All">All Time</option>
            </select>

            {/* Date / Month Picker */}
            {filterType === 'Day' && (
              <input 
                className="input"
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                style={{ width: '160px' }}
              />
            )}

            {filterType === 'Month' && (
              <input 
                className="input"
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                style={{ width: '160px' }}
              />
            )}
          </div>

          <button className="btn btn-primary" onClick={openNewItemModal} style={{ whiteSpace: 'nowrap' }}>
            <Plus size={18} /> <span className="desktop-only">Add Purchase Record</span><span className="mobile-only">Add Purchase</span>
          </button>
        </div>

        {/* Purchases Table Card */}
        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, border: 'none' }}>
            <table>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th style={{ paddingLeft: '1.5rem' }}>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th className="desktop-only">Quantity</th>
                  <th className="desktop-only">Price/Unit</th>
                  <th>Total</th>
                  <th style={{ textAlign: 'right', paddingRight: '1.5rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map(item => (
                  <tr key={item.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem', paddingLeft: '1.5rem' }}>{item.date}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>{item.description}</td>
                    <td>
                      <span style={{ 
                        padding: '0.35rem 0.75rem', 
                        borderRadius: 'var(--r-full)', 
                        backgroundColor: 'var(--bg-surface2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}>
                        <Tag size={12} color="var(--primary)" />
                        {item.category}
                      </span>
                      <div className="mobile-only" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                        Qty: {item.quantity} | Price: ₹{item.price}
                      </div>
                    </td>
                    <td className="desktop-only" style={{ fontWeight: 600 }}>{item.quantity}</td>
                    <td className="desktop-only" style={{ color: 'var(--text-muted)' }}>₹{item.price.toFixed(2)}</td>
                    <td style={{ fontWeight: 800, fontFamily: "'Inter', sans-serif", fontSize: '1.05rem', color: 'var(--danger)' }}>₹{item.total.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', paddingRight: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button className="icon-btn" onClick={() => handleEdit(item)} title="Edit Purchase"><Edit size={18} /></button>
                        <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(item.id)} title="Delete Purchase"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredPurchases.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <ShoppingCart size={48} opacity={0.3} />
                        <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>No purchase entries logged for the selected period.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Form */}
        {isModalOpen && createPortal(
          <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem'
          }}>
            <div className="card modal-container" style={{ width: '500px', maxWidth: '100%', animation: 'slideUp 0.3s var(--ease)', border: '1px solid var(--border-strong)', background: 'var(--bg-surface-solid)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: '1.3rem', fontWeight: 800 }}>{editingItem ? 'Edit Purchase Details' : 'Add Daily Purchase'}</h3>
                <button className="icon-btn" onClick={closeModal}><X size={20} /></button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Date</label>
                  <input className="input" type="date" name="date" required value={formData.date} onChange={handleInputChange} />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Description</label>
                  <input className="input" type="text" name="description" placeholder="e.g. Milk 10 Litres, Sugar 5kg" required value={formData.description} onChange={handleInputChange} autoFocus />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Category</label>
                  <select 
                    className="input" 
                    name="category" 
                    required 
                    value={selectedCategory} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedCategory(val);
                      if (val === 'Other') {
                        setFormData({ ...formData, category: '' });
                      } else {
                        setFormData({ ...formData, category: val });
                      }
                    }}
                    style={{ appearance: 'auto', background: 'var(--bg-surface)' }}
                  >
                    <option value="" disabled>Select category</option>
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="Other">Other (Custom)</option>
                  </select>
                  {selectedCategory === 'Other' && (
                    <input 
                      className="input" 
                      style={{ marginTop: '0.75rem' }} 
                      placeholder="Type custom category..."
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    />
                  )}
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Quantity</label>
                    <input className="input" name="quantity" type="number" step="any" min="0.001" placeholder="e.g. 10" required value={formData.quantity} onChange={handleInputChange} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Price/Unit (₹)</label>
                    <input className="input" name="price" type="number" step="0.01" min="0" placeholder="e.g. 45" required value={formData.price} onChange={handleInputChange} />
                  </div>
                </div>

                {formData.quantity && formData.price && (
                  <div style={{ 
                    padding: '1rem', 
                    background: 'var(--bg-surface2)', 
                    borderRadius: 'var(--r-md)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontWeight: 600,
                    fontSize: '0.95rem'
                  }}>
                    <span style={{ color: 'var(--text-muted)' }}>Estimated Total:</span>
                    <span style={{ color: 'var(--danger)', fontSize: '1.3rem', fontFamily: "'Inter', sans-serif", fontWeight: 800 }}>
                      ₹{(parseFloat(formData.quantity) * parseFloat(formData.price)).toFixed(2)}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <button type="button" className="btn btn-outline" onClick={closeModal} style={{ flex: 1 }} disabled={isSaving}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, opacity: isSaving ? 0.7 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }} disabled={isSaving}>
                    {isSaving ? 'Saving...' : (editingItem ? 'Update Record' : 'Save Record')}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

export default Purchases;



