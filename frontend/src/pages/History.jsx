import React, { useState, useEffect } from 'react';
import { Download, Search, FileSpreadsheet, Receipt, Edit, Trash2, Ban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, socket } from '../api';
import * as XLSX from 'xlsx';

const History = () => {
  const [bills, setBills] = useState([]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]); // Default today
  const [billToDelete, setBillToDelete] = useState(null);
  const [billToVoid, setBillToVoid] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadBills();
    
    // Auto-refresh when bills change
    const handleUpdate = (data) => {
      if (data.table === 'bills' || data.table === 'bill_items') loadBills();
    };
    socket.on('database_update', handleUpdate);
    return () => socket.off('database_update', handleUpdate);
  }, []);

  const loadBills = async () => {
    try {
      const data = await api.getBills();
      setBills(data);
    } catch (err) {
      console.error("Failed to load bills", err);
    }
  };

  const filteredBills = bills.filter(bill => {
    const matchesSearch = bill.bill_number.toLowerCase().includes(search.toLowerCase());
    const matchesDate = !dateFilter || bill.date_time.startsWith(dateFilter);
    return matchesSearch && matchesDate;
  });

  const handleDeleteConfirm = async () => {
    if (!billToDelete) return;
    try {
      await api.deleteBill(billToDelete.id);
      await loadBills();
      
      // Notify other clients
      socket.emit('database_update', { table: 'menu' });
      
      // Trigger a global UI success notification
      const notif = document.createElement('div');
      notif.className = 'animate-fade-in';
      notif.style.cssText = 'position:fixed;bottom:20px;right:20px;background:var(--success);color:white;padding:1rem;border-radius:8px;z-index:9999;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);';
      notif.innerHTML = '<strong>Bill deleted successfully.</strong><br/>Stock has been restored.';
      document.body.appendChild(notif);
      setTimeout(() => notif.remove(), 4000);
      
    } catch (err) {
      console.error("Error deleting bill", err);
      alert('Failed to delete bill: ' + err.message);
    } finally {
      setBillToDelete(null);
    }
  };

  const handleEdit = (bill) => {
    navigate('/billing', { state: { editBill: bill } });
  };

  const handleVoidConfirm = async () => {
    if (!billToVoid) return;
    try {
      await api.voidBill(billToVoid.id, voidReason.trim() || 'No reason provided');
      await loadBills();

      const notif = document.createElement('div');
      notif.className = 'animate-fade-in';
      notif.style.cssText = 'position:fixed;bottom:20px;right:20px;background:var(--warning, #f59e0b);color:white;padding:1rem;border-radius:8px;z-index:9999;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);';
      notif.innerHTML = '<strong>Bill voided.</strong><br/>Stock has been restored.';
      document.body.appendChild(notif);
      setTimeout(() => notif.remove(), 4000);
    } catch (err) {
      console.error("Error voiding bill", err);
      alert('Failed to void bill: ' + (err?.response?.data?.error || err.message));
    } finally {
      setBillToVoid(null);
      setVoidReason('');
    }
  };

  const exportToExcel = () => {
    if (filteredBills.length === 0) {
      alert("No data to export for selected criteria.");
      return;
    }

    // Prepare data for Excel
    const exportData = [];
    
    filteredBills.forEach(bill => {
      // Add row for each item in the bill to make it detailed
      if (bill.items && bill.items.length > 0) {
        bill.items.forEach((item, idx) => {
          exportData.push({
            'Bill Number': idx === 0 ? bill.bill_number : '',
            'Date & Time': idx === 0 ? new Date(bill.date_time).toLocaleString() : '',
            'Item Name': item.item_name,
            'Quantity': item.quantity,
            'Price': item.price,
            'Total': item.total,
            'Bill Total': idx === 0 ? bill.total : '',
            'Payment Method': idx === 0 ? bill.payment_method : ''
          });
        });
      } else {
        // Fallback if no items array
        exportData.push({
          'Bill Number': bill.bill_number,
          'Date & Time': new Date(bill.date_time).toLocaleString(),
          'Item Name': '-',
          'Quantity': '-',
          'Price': '-',
          'Total': '-',
          'Bill Total': bill.total,
          'Payment Method': bill.payment_method
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Report");
    
    // Generate filename
    const dateStr = dateFilter || 'All_Dates';
    const fileName = `Cafe_Sales_Report_${dateStr}.xlsx`;

    // Trigger download
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="page-scroll">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Header Area */}
        <div>
          <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: '2rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.5rem' }}>Sales History</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>View past transactions and export sales reports.</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
            <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '300px' }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input"
                type="text"
                placeholder="Search Bill No..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '40px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 200px', maxWidth: '300px' }}>
              <input
                className="input"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{ flex: 1 }}
              />
              {dateFilter && (
                <button className="btn btn-outline" onClick={() => setDateFilter('')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                  Clear
                </button>
              )}
            </div>
          </div>

          <button className="btn btn-primary" onClick={exportToExcel} style={{ backgroundColor: 'var(--success)', borderColor: 'var(--success)', boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)', width: 'auto', flex: '0 0 auto' }}>
            <FileSpreadsheet size={18} /> <span className="desktop-only">Export Excel</span>
          </button>
        </div>

        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, border: 'none' }}>
            <table>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th style={{ paddingLeft: '1.5rem' }}>Bill Number</th>
                  <th className="desktop-only">Date & Time</th>
                  <th>Items (Qty)</th>
                  <th className="desktop-only">Payment</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right', paddingRight: '1.5rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map(bill => {
                  const isVoided = bill.status === 'voided';
                  return (
                  <tr key={bill.id} style={isVoided ? { opacity: 0.6 } : undefined}>
                    <td style={{ fontWeight: 700, color: 'var(--primary)', paddingLeft: '1.5rem', fontFamily: "'Inter', sans-serif", fontSize: '1.05rem' }}>
                      #{bill.bill_number}
                      {isVoided && (
                        <span title={bill.void_reason || 'Voided'} style={{ marginLeft: '0.5rem', padding: '0.15rem 0.5rem', borderRadius: 'var(--r-full)', background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em', verticalAlign: 'middle' }}>VOIDED</span>
                      )}
                    </td>
                    <td className="desktop-only" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
                      {new Date(bill.date_time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-light)', fontSize: '0.9rem' }}>
                      {bill.items ? bill.items.map(i => `${i.item_name} (x${i.quantity})`).join(', ') : 'N/A'}
                    </td>
                    <td className="desktop-only">
                      <span style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: 'var(--r-full)',
                        backgroundColor: 'var(--bg-surface2)',
                        border: '1px solid var(--border)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--text)'
                      }}>
                        {bill.payment_method}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: "'Inter', sans-serif", fontSize: '1.1rem', color: 'var(--text)', textDecoration: isVoided ? 'line-through' : 'none' }}>₹{bill.total.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', paddingRight: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        {!isVoided && (
                          <>
                            <button className="icon-btn" style={{ color: 'var(--primary)' }} onClick={() => handleEdit(bill)} title="Edit Bill">
                              <Edit size={18} />
                            </button>
                            <button className="icon-btn" style={{ color: 'var(--warning, #f59e0b)' }} onClick={() => { setBillToVoid(bill); setVoidReason(''); }} title="Void Bill (restores stock, keeps record)">
                              <Ban size={18} />
                            </button>
                          </>
                        )}
                        <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={() => setBillToDelete(bill)} title="Delete Bill">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {filteredBills.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <Receipt size={48} opacity={0.3} />
                        <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>No bills found for the selected criteria.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      {billToDelete && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="card modal-container" style={{ width: '400px', maxWidth: '100%', animation: 'slideUp 0.3s var(--ease)', border: '1px solid var(--border-strong)', background: 'var(--bg-surface-solid)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--danger)' }}>Delete Bill</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Deleting this bill will permanently remove the invoice and restore all sold items back into inventory.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setBillToDelete(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: 'var(--danger)', color: 'white' }} onClick={handleDeleteConfirm}>
                Delete & Restore Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Confirmation Modal */}
      {billToVoid && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="card modal-container" style={{ width: '420px', maxWidth: '100%', animation: 'slideUp 0.3s var(--ease)', border: '1px solid var(--border-strong)', background: 'var(--bg-surface-solid)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--warning, #f59e0b)' }}>Void Bill</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: '1.5' }}>
              Voiding marks this bill as canceled (keeps the record for audit), restores stock, and excludes it from sales totals.
            </p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text)', fontSize: '0.9rem' }}>Reason (optional)</label>
              <input
                className="input"
                type="text"
                placeholder="e.g. Customer canceled, Wrong entry..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                style={{ width: '100%' }}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => { setBillToVoid(null); setVoidReason(''); }}>Cancel</button>
              <button className="btn btn-primary" style={{ background: 'var(--warning, #f59e0b)', color: 'white' }} onClick={handleVoidConfirm}>
                Void & Restore Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;



