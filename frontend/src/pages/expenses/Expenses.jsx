import React, { useEffect, useState, useCallback } from 'react';
import { FaPlus, FaEdit, FaTrash, FaReceipt } from 'react-icons/fa';
import api from '../../api/axios';
import Modal from '../../components/common/Modal';

const CATEGORIES = ['equipment', 'maintenance', 'utilities', 'salaries', 'rent', 'medical', 'travel', 'marketing', 'training', 'other'];
const EMPTY = { title: '', category: 'other', amount: '', currency: 'USD', exchange_rate: 1, expense_date: new Date().toISOString().slice(0, 10), description: '', receipt_number: '', paid_by: '' };

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [totalPages, setTotalPages] = useState(1);
  const [totalAmount, setTotalAmount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = { page, page_size: pageSize };
    if (search) params.search = search;
    if (catFilter) params.category = catFilter;
    try {
      const r = await api.get('/expenses/', { params });
      const data = r.data.results || r.data;
      setExpenses(data);
      setTotalPages(Math.ceil((r.data.count || data.length) / pageSize));
      setTotalAmount(data.reduce((sum, e) => sum + parseFloat(e.amount_base || e.amount || 0), 0));
    } finally { setLoading(false); }
  }, [page, pageSize, search, catFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditData(null); setForm(EMPTY); setErrors({}); setShowModal(true); };
  const openEdit = (e) => { setEditData(e); setForm({ ...e }); setErrors({}); setShowModal(true); };
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.title) e.title = 'Required';
    if (!form.amount) e.amount = 'Required';
    if (!form.expense_date) e.expense_date = 'Required';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editData) await api.put(`/expenses/${editData.id}/`, form);
      else await api.post('/expenses/', form);
      setShowModal(false); load();
    } catch (err) {
      if (err.response?.data) setErrors(err.response.data);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    await api.delete(`/expenses/${id}/`); load();
  };

  const getCatColor = (cat) => ({
    equipment: '#2563eb', maintenance: '#ea580c', utilities: '#7c3aed', salaries: '#16a34a',
    rent: '#d97706', medical: '#dc2626', travel: '#0891b2', marketing: '#db2777', training: '#65a30d', other: '#6b7280'
  }[cat] || '#6b7280');
  const sortedExpenses = [...expenses].sort((a, b) =>
    String(a?.title || '').localeCompare(String(b?.title || ''), undefined, { sensitivity: 'base' })
  );

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div><h1>Expenses</h1><p>Track academy operational expenses</p></div>
        <button className="btn btn-primary" onClick={openCreate}><FaPlus /> Add Expense</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ borderLeft: '4px solid #dc2626', padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total (Base Currency)</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#dc2626' }}>${totalAmount.toFixed(2)}</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #2563eb', padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Records (this page)</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{expenses.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <input className="form-control" placeholder="Search title or description…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ maxWidth: 260 }} />
          <select className="form-control" value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(1); }} style={{ maxWidth: 160 }}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c}</option>)}
          </select>
        </div>

        {loading ? <div className="loading-wrap"><div className="spinner" /></div> : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Date</th><th>Title</th><th>Category</th><th>Amount</th><th>Currency</th><th>Rate</th><th>Base Amount</th><th>Paid By</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr><td colSpan={9}><div className="empty-state"><div className="icon"><FaReceipt /></div><h3>No expenses</h3></div></td></tr>
                  ) : sortedExpenses.map(e => (
                    <tr key={e.id}>
                      <td>{e.expense_date}</td>
                      <td style={{ fontWeight: 600 }}>{e.title}</td>
                      <td>
                        <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: getCatColor(e.category) + '20', color: getCatColor(e.category), textTransform: 'capitalize' }}>{e.category}</span>
                      </td>
                      <td>{e.amount}</td>
                      <td>{e.currency}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{e.exchange_rate}</td>
                      <td style={{ fontWeight: 700 }}>{e.amount_base} USD</td>
                      <td>{e.paid_by || '—'}</td>
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-icon" onClick={() => openEdit(e)}><FaEdit /></button>
                          <button className="btn btn-icon btn-danger" onClick={() => handleDelete(e.id)}><FaTrash /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                <span>{page} / {totalPages}</span>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
              </div>
            )}
          </>
        )}
      </div>

      <Modal open={showModal} title={editData ? 'Edit Expense' : 'Add Expense'} onClose={() => setShowModal(false)}
        footer={<><button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>}>
        <div className="form-grid">
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label>Title *</label>
            <input className="form-control" value={form.title} onChange={e => set('title', e.target.value)} />
            {errors.title && <div className="form-error">{errors.title}</div>}
          </div>
          <div className="form-group">
            <label>Category</label>
            <select className="form-control" value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Date *</label>
            <input className="form-control" type="date" value={form.expense_date} onChange={e => set('expense_date', e.target.value)} />
            {errors.expense_date && <div className="form-error">{errors.expense_date}</div>}
          </div>
          <div className="form-group">
            <label>Amount *</label>
            <input className="form-control" type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} />
            {errors.amount && <div className="form-error">{errors.amount}</div>}
          </div>
          <div className="form-group">
            <label>Currency</label>
            <select className="form-control" value={form.currency} onChange={e => set('currency', e.target.value)}>
              <option value="USD">USD</option><option value="CDF">CDF</option><option value="EUR">EUR</option>
            </select>
          </div>
          <div className="form-group">
            <label>Exchange Rate to USD</label>
            <input className="form-control" type="number" step="0.0001" value={form.exchange_rate} onChange={e => set('exchange_rate', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Receipt Number</label>
            <input className="form-control" value={form.receipt_number} onChange={e => set('receipt_number', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Paid By</label>
            <input className="form-control" value={form.paid_by} onChange={e => set('paid_by', e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label>Description</label>
            <textarea className="form-control" rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          {form.amount && form.exchange_rate && (
            <div style={{ gridColumn: '1/-1', background: '#f8fafc', borderRadius: 8, padding: 12, border: '1px solid var(--border)' }}>
              <strong>Base Amount (USD): </strong>{(parseFloat(form.amount || 0) * parseFloat(form.exchange_rate || 1)).toFixed(2)}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
