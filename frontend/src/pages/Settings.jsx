import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings as SettingsIcon, Store, Users, Package, Receipt, 
  Printer, Bell, Database, Palette, Shield, Info, 
  Save, RotateCcw, Check, User, Lock, LogOut, Eye, EyeOff
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../api';

const SETTINGS_SECTIONS = [
  { id: 'users', title: 'User & Role Management', desc: 'Manage staff accounts and permissions', icon: Users },
  { id: 'inventory', title: 'Inventory Settings', desc: 'Low stock alerts and tracking rules', icon: Package },
  { id: 'tax', title: 'Tax & GST Settings', desc: 'Manage tax rates and GST numbers', icon: Receipt },
  { id: 'billing', title: 'Billing & Invoice Settings', desc: 'Receipt footers and invoice formatting', icon: Receipt },
  { id: 'printer', title: 'Printer Settings', desc: 'Thermal printer connection and layout', icon: Printer },
  { id: 'backup', title: 'Backup & Restore', desc: 'Export database and secure backups', icon: Database },
];

const defaultSettings = {
  language: 'English',
  timezone: 'Asia/Kolkata',
  dateFormat: 'DD-MM-YYYY',
  timeFormat: '12 Hours',
  shopName: 'TGM PANDI CAFE',
  shopAddress: '123 Main Street, Food City',
  shopPhone: '+91 9876543210',
  shopEmail: 'hello@tgmpandicafe.com',
  gstNumber: '29ABCDE1234F1Z5',
  taxRate: 5,
  currency: '₹',
  footerMessage: 'Thank you for visiting! Please come again.',
  invoicePrefix: 'INV-',
  nextInvoiceNumber: '1001',
  autoPrintReceipt: true,
  showGST: true,
  enableLowStockAlert: true,
  globalMinStock: 10,
  allowNegativeStock: false,
  autoStockUpdate: true,
  requirePinCheckout: 'Disabled',
  sessionTimeout: '30 Minutes',
  theme: 'light',
};

const Settings = () => {
  const [saved, setSaved] = useState(false);
  
  const [settings, setSettings] = useState(() => {
    const savedSettings = localStorage.getItem('appSettings');
    return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
  });

  const [backupStartDate, setBackupStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // Default 30 days ago
    return d.toISOString().split('T')[0];
  });
  const [backupEndDate, setBackupEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const handleExportBackup = async () => {
    try {
      const [billsData, menuData, purchasesData] = await Promise.all([
        api.getBills().catch(() => []),
        api.getMenu().catch(() => []),
        api.getPurchases().catch(() => [])
      ]);

      const filteredBills = billsData.filter(bill => {
        if (!bill.date_time) return false;
        const billDate = bill.date_time.split('T')[0];
        return billDate >= backupStartDate && billDate <= backupEndDate;
      });

      const filteredPurchases = purchasesData.filter(purchase => {
        if (!purchase.date) return false;
        return purchase.date >= backupStartDate && purchase.date <= backupEndDate;
      });

      const billsSheetData = filteredBills.map(bill => ({
        'Bill Number': bill.bill_number,
        'Date & Time': new Date(bill.date_time).toLocaleString(),
        'Subtotal': bill.subtotal,
        'Tax': bill.tax,
        'Total': bill.total,
        'Payment Method': bill.payment_method
      }));

      const billItemsSheetData = [];
      filteredBills.forEach(bill => {
        if (bill.items && bill.items.length > 0) {
          bill.items.forEach(item => {
            billItemsSheetData.push({
              'Bill Number': bill.bill_number,
              'Date & Time': new Date(bill.date_time).toLocaleString(),
              'Item Name': item.item_name,
              'Quantity': item.quantity,
              'Price': item.price,
              'Total': item.total
            });
          });
        }
      });

      const menuSheetData = menuData.map(item => ({
        'ID': item.id,
        'Name': item.name,
        'Category': item.category,
        'Price': item.price,
        'Stock Count': item.stock_count,
        'Min Stock': item.min_stock
      }));

      const purchasesSheetData = filteredPurchases.map(p => ({
        'Date': p.date,
        'Description': p.description,
        'Quantity': p.quantity,
        'Price': p.price,
        'Total': p.total,
        'Category': p.category
      }));

      const workbook = XLSX.utils.book_new();

      const billsWs = XLSX.utils.json_to_sheet(billsSheetData);
      XLSX.utils.book_append_sheet(workbook, billsWs, "Bills Summary");

      if (billItemsSheetData.length > 0) {
        const itemsWs = XLSX.utils.json_to_sheet(billItemsSheetData);
        XLSX.utils.book_append_sheet(workbook, itemsWs, "Detailed Bill Items");
      }

      if (menuSheetData.length > 0) {
        const menuWs = XLSX.utils.json_to_sheet(menuSheetData);
        XLSX.utils.book_append_sheet(workbook, menuWs, "Menu & Inventory");
      }

      if (purchasesSheetData.length > 0) {
        const purchasesWs = XLSX.utils.json_to_sheet(purchasesSheetData);
        XLSX.utils.book_append_sheet(workbook, purchasesWs, "Purchases & Expenses");
      }

      const fileName = `TGM_Cafe_Backup_${backupStartDate}_to_${backupEndDate}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      const notif = document.createElement('div');
      notif.className = 'animate-fade-in';
      notif.style.cssText = 'position:fixed;bottom:20px;right:20px;background:var(--success);color:white;padding:1rem;border-radius:8px;z-index:9999;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);';
      notif.innerHTML = `<strong>Backup downloaded successfully!</strong><br/>Data filtered from ${backupStartDate} to ${backupEndDate}`;
      document.body.appendChild(notif);
      setTimeout(() => notif.remove(), 4000);

    } catch (err) {
      console.error("Backup failed", err);
      alert("Failed to export backup: " + err.message);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleSave = () => {
    localStorage.setItem('appSettings', JSON.stringify(settings));
    if (settings.theme !== localStorage.getItem('theme')) {
      localStorage.setItem('theme', settings.theme);
      document.documentElement.setAttribute('data-theme', settings.theme);
    }
    
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all settings to their defaults?")) {
      setSettings(defaultSettings);
    }
  };

  const SectionHeader = ({ id, title, desc, icon: Icon }) => (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <Icon size={20} color="var(--primary)" />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{title}</h3>
      </div>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>{desc}</p>
    </div>
  );

  const role = localStorage.getItem('role') || 'sales';
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    localStorage.removeItem('full_name');
    navigate('/login');
  };

  if (role === 'sales') {
    return <SalesSettings onLogout={handleLogout} />;
  }

  return (
    <div className="page-scroll" style={{ backgroundColor: 'var(--bg-surface2)' }}>
      {/* Sticky Header */}
      <div style={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 10, 
        backgroundColor: 'var(--bg-surface)', 
        padding: '1.5rem',
        borderBottom: '1px solid var(--border)',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div>
          <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Settings</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>Manage all POS system configurations.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className="btn btn-outline premium-hover" 
            onClick={handleReset}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', background: 'var(--bg-surface)' }}
          >
            <RotateCcw size={16} /> Reset
          </button>
          <button 
            className="btn btn-primary premium-hover" 
            onClick={handleSave}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', background: saved ? 'var(--success)' : '' }}
          >
            {saved ? <Check size={16} /> : <Save size={16} />} 
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        


        {/* User & Role Management */}
        <section className="card" style={{ padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <SectionHeader {...SETTINGS_SECTIONS.find(s => s.id === 'users')} />
          <div style={{ padding: '1rem', background: 'var(--bg-surface2)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div>
              <h4 style={{ fontWeight: 600, margin: 0 }}>Admin</h4>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Full system access</span>
            </div>
            <button className="btn btn-outline" style={{ padding: '0.25rem 0.75rem' }} onClick={() => alert('Editing Admin role will be available in the next update.')}>Edit</button>
          </div>
          <div style={{ padding: '1rem', background: 'var(--bg-surface2)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontWeight: 600, margin: 0 }}>Cashier</h4>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Billing and basic history</span>
            </div>
            <button className="btn btn-outline" style={{ padding: '0.25rem 0.75rem' }} onClick={() => alert('Editing Cashier role will be available in the next update.')}>Edit</button>
          </div>
          <button className="btn btn-outline" style={{ marginTop: '1rem', borderStyle: 'dashed' }} onClick={() => alert('Custom Role creation will be available in the next update.')}>+ Add New Role</button>
        </section>

        {/* Inventory Settings */}
        <section className="card" style={{ padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <SectionHeader {...SETTINGS_SECTIONS.find(s => s.id === 'inventory')} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input type="checkbox" name="enableLowStockAlert" checked={settings.enableLowStockAlert} onChange={handleChange} style={{ width: '16px', height: '16px' }} />
              <span style={{ fontWeight: 500 }}>Enable Low Stock Alert</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input type="checkbox" name="allowNegativeStock" checked={settings.allowNegativeStock} onChange={handleChange} style={{ width: '16px', height: '16px' }} />
              <span style={{ fontWeight: 500 }}>Allow Negative Stock (Sell items even if out of stock)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input type="checkbox" name="autoStockUpdate" checked={settings.autoStockUpdate} onChange={handleChange} style={{ width: '16px', height: '16px' }} />
              <span style={{ fontWeight: 500 }}>Auto Stock Update on Bill Deletion</span>
            </label>
            <div style={{ marginTop: '0.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Minimum Stock Threshold</label>
              <input type="number" name="globalMinStock" value={settings.globalMinStock} onChange={handleChange} className="input" style={{ maxWidth: '200px' }} />
            </div>
          </div>
        </section>

        {/* Tax & GST Settings */}
        <section className="card" style={{ padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <SectionHeader {...SETTINGS_SECTIONS.find(s => s.id === 'tax')} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>GST Number</label>
              <input type="text" name="gstNumber" value={settings.gstNumber} onChange={handleChange} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Default Tax Rate (%)</label>
              <input type="number" name="taxRate" value={settings.taxRate} onChange={handleChange} className="input" />
            </div>
          </div>
        </section>

        {/* Billing & Invoice */}
        <section className="card" style={{ padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <SectionHeader {...SETTINGS_SECTIONS.find(s => s.id === 'billing')} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Invoice Prefix</label>
              <input type="text" name="invoicePrefix" value={settings.invoicePrefix} onChange={handleChange} className="input" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Next Invoice Number</label>
              <input type="text" name="nextInvoiceNumber" value={settings.nextInvoiceNumber} onChange={handleChange} className="input" />
            </div>
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Receipt Footer Message</label>
            <textarea name="footerMessage" value={settings.footerMessage} onChange={handleChange} className="input" style={{ minHeight: '80px', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input type="checkbox" name="autoPrintReceipt" checked={settings.autoPrintReceipt} onChange={handleChange} style={{ width: '16px', height: '16px' }} />
              <span style={{ fontWeight: 500 }}>Auto Print Receipt</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input type="checkbox" name="showGST" checked={settings.showGST} onChange={handleChange} style={{ width: '16px', height: '16px' }} />
              <span style={{ fontWeight: 500 }}>Show GST on Receipt</span>
            </label>
          </div>
        </section>

        {/* Printer Settings */}
        <section className="card" style={{ padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <SectionHeader {...SETTINGS_SECTIONS.find(s => s.id === 'printer')} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Primary Receipt Printer</label>
              <select className="input" style={{ maxWidth: '400px' }}>
                <option>System Default Printer</option>
                <option>EPSON TM-T88VI</option>
                <option>Save as PDF</option>
              </select>
            </div>
            <div>
              <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => window.print()}><Printer size={16} /> Test Print</button>
            </div>
          </div>
        </section>

        {/* Backup & Restore */}
        <section className="card" style={{ padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <SectionHeader {...SETTINGS_SECTIONS.find(s => s.id === 'backup')} />
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Safely export your menu items, billing history, and purchase records to your local device.</p>
          
          <div style={{ background: 'var(--bg-surface2)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
            <h4 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '1rem', color: 'var(--text)' }}>Download Data by Date Range</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Start Date</label>
                <input 
                  type="date" 
                  value={backupStartDate} 
                  onChange={(e) => setBackupStartDate(e.target.value)} 
                  className="input" 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>End Date</label>
                <input 
                  type="date" 
                  value={backupEndDate} 
                  onChange={(e) => setBackupEndDate(e.target.value)} 
                  className="input" 
                />
              </div>
            </div>
            <button 
              className="btn btn-primary premium-hover" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'center', padding: '0.65rem' }} 
              onClick={handleExportBackup}
            >
              <Database size={16} /> Download Backup (Excel)
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
            <div>
              <h4 style={{ fontWeight: 600, fontSize: '0.95rem', margin: 0, color: 'var(--text)' }}>System Restore</h4>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Restore configuration settings from a previous backup file</span>
            </div>
            <button className="btn btn-outline" onClick={() => alert('Please select a valid backup spreadsheet to restore system data.')}>Restore Data...</button>
          </div>
        </section>

      </div>
    </div>
  );
};

const SalesSettings = ({ onLogout }) => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [profile, setProfile] = useState({ full_name: '', email: '', mobile: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const username = localStorage.getItem('username');

  useEffect(() => {
    setProfile(prev => ({ ...prev, full_name: localStorage.getItem('full_name') || '' }));
  }, []);

  const handleThemeChange = (e) => {
    const newTheme = e.target.value;
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleProfileChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
  };

  const saveProfile = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, ...profile })
      });
      if (res.ok) {
        localStorage.setItem('full_name', profile.full_name);
        window.dispatchEvent(new Event('profile-updated'));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const changePassword = async () => {
    setError('');
    setSuccessMsg('');
    const { currentPassword, newPassword, confirmPassword } = passwords;
    
    if (newPassword !== confirmPassword) {
      return setError('New passwords do not match');
    }
    
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!strongRegex.test(newPassword)) {
      return setError('Password must be at least 8 chars long, contain 1 uppercase, 1 lowercase, 1 number and 1 special character.');
    }

    try {
      const res = await fetch('http://localhost:5000/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, currentPassword, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Password changed successfully. Please log in again.');
        setTimeout(() => onLogout(), 2000);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  return (
    <div className="page-scroll" style={{ backgroundColor: 'var(--bg-surface2)' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-surface)', padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
        <div>
          <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>My Settings</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>Manage your personal account preferences.</p>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Profile */}
        <section className="card" style={{ padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
            <User size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>My Profile</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
            <div>
              <label className="input-label">Full Name</label>
              <input type="text" name="full_name" value={profile.full_name} onChange={handleProfileChange} className="input" />
            </div>
            <div>
              <label className="input-label">Email</label>
              <input type="email" name="email" value={profile.email} onChange={handleProfileChange} className="input" />
            </div>
            <div>
              <label className="input-label">Mobile Number</label>
              <input type="text" name="mobile" value={profile.mobile} onChange={handleProfileChange} className="input" />
            </div>
            <div>
              <label className="input-label">Username (Read-Only)</label>
              <input type="text" value={username} disabled className="input" style={{ opacity: 0.7 }} />
            </div>
            <button className="btn btn-primary" onClick={saveProfile} style={{ alignSelf: 'flex-start', background: saved ? 'var(--success)' : '' }}>
              {saved ? 'Saved!' : 'Update Profile'}
            </button>
          </div>
        </section>

        {/* Change Password */}
        <section className="card" style={{ padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Lock size={20} color="var(--primary)" />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Change Password</h3>
            </div>
            <button 
              className="btn btn-outline" 
              style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }} 
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {error && <div style={{ color: 'var(--error)', padding: '1rem', background: 'var(--error-glow)', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}
          {successMsg && <div style={{ color: 'var(--success)', padding: '1rem', background: 'var(--success-glow)', borderRadius: '8px', marginBottom: '1rem' }}>{successMsg}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
            <div>
              <label className="input-label">Current Password</label>
              <input type={showPassword ? 'text' : 'password'} name="currentPassword" value={passwords.currentPassword} onChange={handlePasswordChange} className="input" />
            </div>
            <div>
              <label className="input-label">New Password</label>
              <input type={showPassword ? 'text' : 'password'} name="newPassword" value={passwords.newPassword} onChange={handlePasswordChange} className="input" />
            </div>
            <div>
              <label className="input-label">Confirm New Password</label>
              <input type={showPassword ? 'text' : 'password'} name="confirmPassword" value={passwords.confirmPassword} onChange={handlePasswordChange} className="input" />
            </div>
            <button className="btn btn-outline" onClick={changePassword} style={{ alignSelf: 'flex-start' }}>Change Password</button>
          </div>
        </section>

        {/* Theme Preferences */}
        <section className="card" style={{ padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
            <Palette size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Theme Settings</h3>
          </div>
          <div>
            <label className="input-label">Theme Mode</label>
            <select value={theme} onChange={handleThemeChange} className="input" style={{ maxWidth: '300px' }}>
              <option value="light">Light Mode</option>
              <option value="dark">Dark Mode</option>
            </select>
          </div>
        </section>

        {/* Logout */}
        <section className="card" style={{ padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
            <LogOut size={20} color="var(--error)" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--error)' }}>Logout</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>End your current session and return to the login page safely.</p>
          <button className="btn" style={{ background: 'var(--error)', color: '#fff', border: 'none' }} onClick={onLogout}>Log Out</button>
        </section>
      </div>
    </div>
  );
};

export default Settings;
