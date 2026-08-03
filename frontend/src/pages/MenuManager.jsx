import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit, Trash2, Search, X, Image as ImageIcon, Upload, RefreshCw } from 'lucide-react';
import { api, socket } from '../api';

const MenuManager = () => {
  const role = localStorage.getItem('role') || 'sales';
  const isAdmin = role === 'admin';

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  
  const [newCatData, setNewCatData] = useState({
    name: '',
    pricing_type: 'fixed',
    weight_unit: ''
  });
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    stock_count: '',
    min_stock: 10,
    image_url: ''
  });

  // Image Modal States
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageSearchQuery, setImageSearchQuery] = useState('');
  const [imageSearchResults, setImageSearchResults] = useState([]);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [imageSearchError, setImageSearchError] = useState('');

  // Batch Image Regeneration States
  const [isRegenModalOpen, setIsRegenModalOpen] = useState(false);
  const [regenState, setRegenState] = useState({
    status: 'idle', // idle, running, finished
    total: 0,
    current: 0,
    currentItemName: '',
    successCount: 0,
    failCount: 0,
    startTime: 0,
    logs: []
  });

  useEffect(() => {
    loadMenu();
    
    // Auto-refresh when other devices modify menu
    const handleUpdate = (data) => {
      if (data.table === 'menu' || data.table === 'categories') {
        loadMenu();
      }
    };
    socket.on('database_update', handleUpdate);
    return () => socket.off('database_update', handleUpdate);
  }, []);

  const loadMenu = async () => {
    try {
      const data = await api.getMenu();
      setItems(data);
      const cats = await api.getCategories();
      setCategories(cats);
    } catch (err) {
      console.error("Failed to load menu", err);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const itemData = {
      ...formData,
      price: parseFloat(formData.price),
      stock_count: parseFloat(formData.stock_count) || 0,
      min_stock: parseFloat(formData.min_stock) || 10,
      image_url: formData.image_url || null
    };

    try {
      if (editingItem) {
        await api.updateMenuItem({ ...itemData, id: editingItem.id });
      } else {
        await api.addMenuItem(itemData);
      }
      // loadMenu() is triggered by socket event, but we can call it here for instant feedback
      await loadMenu();
      closeModal();
    } catch (err) {
      console.error("Error saving item", err);
      alert("Failed to save item: " + (err.message || "Unknown error"));
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      price: item.price,
      stock_count: item.stock_count,
      min_stock: item.min_stock ?? 10,
      image_url: item.image_url || ''
    });
    
    const exists = categories.some(c => c.name === item.category);
    setSelectedCategory(exists ? item.category : 'Other');
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        await api.deleteMenuItem(id);
        await loadMenu();
      } catch (err) {
        console.error("Error deleting item", err);
      }
    }
  };

  const openNewItemModal = () => {
    setEditingItem(null);
    setFormData({ name: '', category: '', price: '', stock_count: '', min_stock: 10, image_url: '' });
    setSelectedCategory('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleImageSearch = async (queryToSearch) => {
    const q = queryToSearch || formData.name;
    if (!q) return;
    
    setIsImageModalOpen(true);
    setIsSearchingImages(true);
    setImageSearchError('');
    setImageSearchQuery(q);
    
    try {
      const results = await api.searchImages(q);
      setImageSearchResults(results || []);
    } catch (err) {
      setImageSearchError('Failed to fetch images. Please try again.');
      console.error(err);
    } finally {
      setIsSearchingImages(false);
    }
  };

  const handleImageSelect = (url) => {
    setFormData({ ...formData, image_url: url });
    setIsImageModalOpen(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large. Max 5MB allowed.");
      return;
    }
    try {
      const res = await api.uploadImage(file);
      if (res.success && res.url) {
        setFormData({ ...formData, image_url: `http://localhost:5000${res.url}` });
        setIsImageModalOpen(false);
      }
    } catch (err) {
      alert("Failed to upload image");
      console.error(err);
    }
  };
  
  const startBatchRegeneration = async () => {
    setIsRegenModalOpen(false); // Close confirmation modal
    
    setRegenState({
      status: 'running',
      total: items.length,
      current: 0,
      currentItemName: '',
      successCount: 0,
      failCount: 0,
      startTime: Date.now(),
      logs: []
    });
    
    let successes = 0;
    let fails = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setRegenState(prev => ({ ...prev, current: i + 1, currentItemName: item.name }));
      
      try {
        const results = await api.searchImages(item.name);
        if (results && results.length > 0) {
          const bestImage = results[0].src.medium; // Use the top match
          await api.updateMenuItem({ ...item, image_url: bestImage });
          successes++;
        } else {
          fails++;
        }
      } catch (err) {
        fails++;
        console.error(`Failed to update ${item.name}`, err);
      }
      
      // Artificial delay to allow UI paint and respect rate limits slightly
      await new Promise(r => setTimeout(r, 400)); 
    }
    
    await loadMenu(); // Refresh all items in the UI

    setRegenState(prev => ({
      ...prev,
      status: 'finished',
      successCount: successes,
      failCount: fails,
    }));
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    try {
      await api.addCategory({
        name: newCatData.name,
        pricing_type: newCatData.pricing_type,
        weight_unit: newCatData.pricing_type === 'weight' ? newCatData.weight_unit : null
      });
      setNewCatData({ name: '', pricing_type: 'fixed', weight_unit: '' });
      await loadMenu();
    } catch (err) {
      console.error("Failed to add category", err);
      alert("Failed to add category");
    }
  };
  
  const handleDeleteCategory = async (id) => {
    if (window.confirm("Are you sure you want to delete this category? Note: This won't delete the menu items in it.")) {
      try {
        await api.deleteCategory(id);
        await loadMenu();
      } catch (err) {
        console.error("Failed to delete category", err);
      }
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-scroll">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Header Area */}
        <div>
          <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: '2rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.5rem' }}>Menu Management</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Add, edit, or remove items from your cafe menu.</p>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '1 1 250px' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                className="input" 
                type="text" 
                placeholder="Search items or categories..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '40px' }}
              />
            </div>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setIsCategoryModalOpen(true)} style={{ whiteSpace: 'nowrap' }}>
                <span className="desktop-only">Manage Categories</span><span className="mobile-only">Categories</span>
              </button>
              <button className="btn btn-outline" onClick={() => setIsRegenModalOpen(true)} style={{ whiteSpace: 'nowrap', color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                <RefreshCw size={18} /> <span className="desktop-only">Regenerate All Images</span>
              </button>
              <button className="btn btn-primary" onClick={openNewItemModal} style={{ whiteSpace: 'nowrap' }}>
                <Plus size={18} /> <span className="desktop-only">Add New Item</span><span className="mobile-only">Add Item</span>
              </button>
            </div>
          )}
        </div>

        {/* Table Card */}
        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, border: 'none' }}>
            <table>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th style={{ paddingLeft: '1.5rem' }}>Item Name</th>
                  <th>Category</th>
                  <th className="desktop-only">Price</th>
                  <th className="desktop-only">Stock</th>
                  {isAdmin && <th style={{ textAlign: 'right', paddingRight: '1.5rem' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text)', paddingLeft: '1.5rem' }}>{item.name}</td>
                    <td>
                      <span style={{ 
                        padding: '0.35rem 0.75rem', 
                        borderRadius: 'var(--r-full)', 
                        backgroundColor: 'var(--bg-surface2)',
                        color: 'var(--primary)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        border: '1px solid rgba(249, 115, 22, 0.2)'
                      }}>
                        {item.category}
                      </span>
                      <div className="mobile-only" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                        ₹{item.price.toFixed(2)} | Stock: {item.stock_count}
                      </div>
                    </td>
                    <td className="desktop-only" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700 }}>
                      ₹{item.price.toFixed(2)}
                    </td>
                    <td className="desktop-only">
                      <span style={{ 
                        color: item.stock_count < 10 ? 'var(--danger)' : 'var(--text)', 
                        fontWeight: item.stock_count < 10 ? 700 : 500,
                        background: item.stock_count < 10 ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                        padding: item.stock_count < 10 ? '0.2rem 0.5rem' : '0',
                        borderRadius: 'var(--r-sm)'
                      }}>
                        {item.stock_count}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: 'right', paddingRight: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button className="icon-btn" onClick={() => handleEdit(item)} title="Edit Item"><Edit size={18} /></button>
                          <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(item.id)} title="Delete Item"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 5 : 4} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <Search size={32} opacity={0.3} />
                        <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>No items found</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && createPortal(
          <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem'
          }}>
            <div className="card modal-container" style={{ width: '450px', maxWidth: '100%', animation: 'slideUp 0.3s var(--ease)', border: '1px solid var(--border-strong)', background: 'var(--bg-surface-solid)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: '1.3rem', fontWeight: 800 }}>{editingItem ? 'Edit Menu Item' : 'Add New Item'}</h3>
                <button className="icon-btn" onClick={closeModal}><X size={20} /></button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Item Name</label>
                  <input 
                    className="input" 
                    name="name" 
                    required 
                    value={formData.name} 
                    onChange={handleInputChange}
                    onBlur={() => {
                      if (!editingItem && formData.name && !formData.image_url) {
                        handleImageSearch(formData.name);
                      }
                    }}
                    autoFocus 
                  />
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
                        handleInputChange(e);
                      }
                    }}
                    style={{ appearance: 'auto', background: 'var(--bg-surface)' }}
                  >
                    <option value="" disabled>Select a category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                    <option value="Other">Other (Custom)</option>
                  </select>
                  {selectedCategory === 'Other' && (
                    <input 
                      className="input" 
                      style={{ marginTop: '0.75rem' }} 
                      placeholder="Type new category name..."
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      autoFocus
                    />
                  )}
                </div>
                
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Price (₹){categories.find(c => c.name === formData.category)?.pricing_type === 'weight' ? ` per ${categories.find(c => c.name === formData.category)?.weight_unit}` : ''}
                    </label>
                    <input className="input" name="price" type="number" step="0.01" min="0" required value={formData.price} onChange={handleInputChange} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Stock Count {categories.find(c => c.name === formData.category)?.pricing_type === 'weight' ? `(in kg)` : ''} {categories.find(c => c.name === formData.category)?.pricing_type === 'weight' ? '(Optional)' : ''}
                    </label>
                    <input 
                      className="input" 
                      name="stock_count" 
                      type="number" 
                      step="any"
                      min="0" 
                      required={categories.find(c => c.name === formData.category)?.pricing_type !== 'weight'} 
                      value={formData.stock_count} 
                      onChange={handleInputChange} 
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Minimum Stock Alert Level
                    </label>
                    <input 
                      className="input" 
                      name="min_stock" 
                      type="number" 
                      step="any"
                      min="0" 
                      required 
                      value={formData.min_stock} 
                      onChange={handleInputChange} 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Product Image
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div 
                        style={{ 
                          width: '60px', height: '60px', borderRadius: 'var(--r-md)', 
                          background: 'var(--bg-surface2)', border: '1px dashed var(--border-strong)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden', flexShrink: 0
                        }}
                      >
                        {formData.image_url ? (
                          <img src={formData.image_url} alt="Product" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <ImageIcon size={24} color="var(--text-muted)" />
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                        <button 
                          type="button" 
                          className="btn btn-outline" 
                          style={{ flex: 1, padding: '0.5rem' }}
                          onClick={() => handleImageSearch(formData.name)}
                        >
                          <Search size={16} /> {formData.image_url ? 'Change Image' : 'Find Image'}
                        </button>
                        {formData.image_url && (
                          <button 
                            type="button" 
                            className="btn btn-outline" 
                            style={{ padding: '0.5rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                            onClick={() => setFormData({ ...formData, image_url: '' })}
                            title="Remove Image"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <button type="button" className="btn btn-outline" onClick={closeModal} style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editingItem ? 'Update Item' : 'Save Item'}</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
        
        {/* Category Manager Modal */}
        {isCategoryModalOpen && createPortal(
          <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem'
          }}>
            <div className="card modal-container" style={{ width: '500px', maxWidth: '100%', animation: 'slideUp 0.3s var(--ease)', border: '1px solid var(--border-strong)', background: 'var(--bg-surface-solid)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: '1.3rem', fontWeight: 800 }}>Manage Categories</h3>
                <button className="icon-btn" onClick={() => setIsCategoryModalOpen(false)}><X size={20} /></button>
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                {categories.length > 0 ? (
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>Name</th>
                        <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>Type</th>
                        <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map(cat => (
                        <tr key={cat.id}>
                          <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{cat.name}</td>
                          <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', background: 'var(--bg-surface2)', borderRadius: 'var(--r-sm)' }}>
                              {cat.pricing_type === 'weight' ? `Weight (${cat.weight_unit})` : 'Fixed'}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                            <button className="icon-btn" style={{ color: 'var(--danger)', padding: '0' }} onClick={() => handleDeleteCategory(cat.id)}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No categories found.</p>
                )}
              </div>

              <form onSubmit={handleAddCategory} style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--r-md)', border: '1px dashed var(--border)' }}>
                <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Add New Category</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <input 
                    className="input" 
                    placeholder="Category Name" 
                    required 
                    value={newCatData.name} 
                    onChange={e => setNewCatData({...newCatData, name: e.target.value})} 
                  />
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <select 
                      className="input" 
                      style={{ flex: 1 }} 
                      value={newCatData.pricing_type}
                      onChange={e => setNewCatData({...newCatData, pricing_type: e.target.value})}
                    >
                      <option value="fixed">Fixed Price</option>
                      <option value="weight">Weight-Based</option>
                    </select>
                    
                    {newCatData.pricing_type === 'weight' && (
                      <select 
                        className="input" 
                        style={{ flex: 1 }} 
                        required
                        value={newCatData.weight_unit}
                        onChange={e => setNewCatData({...newCatData, weight_unit: e.target.value})}
                      >
                        <option value="" disabled>Select Unit</option>
                        <option value="100g">Per 100g</option>
                        <option value="1kg">Per 1kg</option>
                      </select>
                    )}
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>Add Category</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      </div>

      {/* Image Selection Modal */}
      {isImageModalOpen && createPortal(
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="card modal-container" style={{ width: '800px', maxWidth: '100%', animation: 'slideUp 0.3s var(--ease)', border: '1px solid var(--border-strong)', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ImageIcon size={24} color="var(--primary)" /> Select Product Image
              </h3>
              <button className="icon-btn" onClick={() => setIsImageModalOpen(false)}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <input 
                type="text" 
                className="input" 
                placeholder="Search images (e.g. Fried Chicken)..." 
                value={imageSearchQuery}
                onChange={(e) => setImageSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleImageSearch(imageSearchQuery)}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={() => handleImageSearch(imageSearchQuery)}>
                <Search size={18} /> Search
              </button>
              
              <button 
                className="btn btn-outline" 
                onClick={() => window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(imageSearchQuery || formData.name)}`, '_blank')}
                style={{ color: 'var(--text)', borderColor: 'var(--border)' }}
                title="Search Google Images to download manually"
              >
                Search Web
              </button>

              <div style={{ position: 'relative' }}>
                <input 
                  type="file" 
                  accept="image/jpeg, image/png, image/webp" 
                  onChange={handleImageUpload} 
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                />
                <button className="btn btn-outline" style={{ pointerEvents: 'none' }}>
                  <Upload size={18} /> Upload Custom
                </button>
              </div>
            </div>

            {imageSearchError && (
              <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: 'var(--r-md)', marginBottom: '1rem' }}>
                {imageSearchError}
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
              {isSearchingImages ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} style={{ height: '150px', background: 'var(--bg-surface2)', borderRadius: 'var(--r-md)', animation: 'pulse 1.5s infinite' }} />
                  ))}
                </div>
              ) : imageSearchResults.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                  {imageSearchResults.map(img => (
                    <div 
                      key={img.id} 
                      style={{ 
                        position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', cursor: 'pointer',
                        border: formData.image_url === img.src.medium ? '3px solid var(--primary)' : '3px solid transparent',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => handleImageSelect(img.src.medium)}
                    >
                      <img src={img.src.medium} alt={img.alt} style={{ width: '100%', height: '150px', objectFit: 'cover', display: 'block' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '0.5rem', fontSize: '0.75rem' }}>
                        By {img.photographer}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <ImageIcon size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <p>No images found. Try a different keyword or upload a custom image.</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Regeneration Confirmation Modal */}
      {isRegenModalOpen && createPortal(
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="card modal-container" style={{ width: '500px', maxWidth: '100%', animation: 'slideUp 0.3s var(--ease)', border: '1px solid var(--border-strong)', background: 'var(--bg-surface-solid)' }}>
            <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)' }}>Regenerate All Product Images</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
              This action will replace all existing product images with newly selected high-quality images from the Pexels API.
            </p>
            <div style={{ background: 'var(--bg-surface2)', padding: '1rem', borderRadius: 'var(--r-md)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>This will NOT modify:</div>
              <ul style={{ color: 'var(--text-muted)', margin: 0, paddingLeft: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <li>Product Name</li>
                <li>Price</li>
                <li>Category</li>
                <li>Stock</li>
                <li>Description</li>
                <li>Product ID</li>
              </ul>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setIsRegenModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={startBatchRegeneration}>Regenerate Images</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Regeneration Progress/Summary Modal */}
      {regenState.status !== 'idle' && createPortal(
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="card modal-container" style={{ width: '500px', maxWidth: '100%', animation: 'slideUp 0.3s var(--ease)', border: '1px solid var(--border-strong)', background: 'var(--bg-surface-solid)' }}>
            
            {regenState.status === 'running' && (
              <>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <RefreshCw size={48} className="spin" style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Regenerating Product Images...</h3>
                  <div style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    {regenState.current} / {regenState.total} Products Completed
                  </div>
                </div>

                <div style={{ height: '8px', background: 'var(--bg-surface2)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                  <div style={{ height: '100%', background: 'var(--primary)', width: `${(regenState.current / Math.max(1, regenState.total)) * 100}%`, transition: 'width 0.3s' }} />
                </div>

                <div style={{ background: 'var(--bg-surface2)', padding: '1rem', borderRadius: 'var(--r-md)', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Current Product:</span>
                    <span style={{ fontWeight: 600 }}>{regenState.currentItemName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Estimated Time Remaining:</span>
                    <span style={{ fontWeight: 600 }}>
                      {Math.ceil(((regenState.total - regenState.current) * 0.4))} seconds
                    </span>
                  </div>
                </div>
              </>
            )}

            {regenState.status === 'finished' && (
              <>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <div style={{ width: '64px', height: '64px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                    <ImageIcon size={32} />
                  </div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Image Regeneration Completed</h3>
                </div>

                <div style={{ background: 'var(--bg-surface2)', padding: '1.5rem', borderRadius: 'var(--r-md)', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Total Products:</span>
                    <span style={{ fontWeight: 700 }}>{regenState.total}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Successfully Updated:</span>
                    <span style={{ fontWeight: 700, color: '#22c55e' }}>{regenState.successCount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Failed:</span>
                    <span style={{ fontWeight: 700, color: regenState.failCount > 0 ? 'var(--danger)' : 'var(--text)' }}>{regenState.failCount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Time Taken:</span>
                    <span style={{ fontWeight: 700 }}>{Math.round((Date.now() - regenState.startTime) / 1000)} Seconds</span>
                  </div>
                </div>

                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setRegenState({ ...regenState, status: 'idle' })}>
                  Close
                </button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default MenuManager;



