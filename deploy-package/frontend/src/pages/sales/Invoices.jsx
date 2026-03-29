import React, { useEffect, useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaPlus, FaEdit, FaTrash, FaEye, FaFileInvoiceDollar } from 'react-icons/fa';
import api from '../../api/axios';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';

const EMPTY = { client: '', amount: '', due_date: '', invoice_type: 'subscription', description: '', tax_rate: 0, currency: 'USD' };

export default function Invoices() {
  const location = useLocation();
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showView, setShowView] = useState(false);
  const [editData, setEditData] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [autoOpenedInvoice, setAutoOpenedInvoice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = { page, search };
    if (statusFilter) params.status = statusFilter;
    try {
      const r = await api.get('/sales/invoices/', { params });
      setInvoices(r.data.results || r.data);
      setTotalPages(Math.ceil((r.data.count || (r.data.results || r.data).length) / 25));
    } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/clients/?page_size=200').then(r => setClients(r.data.results || r.data)); }, []);

  useEffect(() => {
    const invoiceFromQuery = new URLSearchParams(location.search).get('invoice');
    if (!invoiceFromQuery) return;
    setSearch(invoiceFromQuery);
    setPage(1);
  }, [location.search]);

  const openCreate = () => { setEditData(null); setForm(EMPTY); setErrors({}); setShowModal(true); };
  const openEdit = (inv) => { setEditData(inv); setForm({ ...inv, client: inv.client }); setErrors({}); setShowModal(true); };
  const openView = async (inv) => {
    setViewInvoice(inv);
    const r = await api.get(`/sales/payments/?invoice=${inv.id}`);
    setPayments(r.data.results || r.data);
    setShowView(true);
  };

  const validate = () => {
    const e = {};
    if (!form.client) e.client = 'Required';
    if (!form.amount) e.amount = 'Required';
    if (!form.due_date) e.due_date = 'Required';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editData) await api.put(`/sales/invoices/${editData.id}/`, form);
      else await api.post('/sales/invoices/', form);
      setShowModal(false); load();
    } catch (err) {
      if (err.response?.data) setErrors(err.response.data);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this invoice?')) return;
    await api.delete(`/sales/invoices/${id}/`); load();
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const invoiceFromQuery = new URLSearchParams(location.search).get('invoice');
    if (!invoiceFromQuery || invoices.length === 0) return;
    if (autoOpenedInvoice === invoiceFromQuery) return;

    const target = invoices.find(
      inv => String(inv.invoice_number || '').toLowerCase() === invoiceFromQuery.toLowerCase()
    );
    if (!target) return;

    setEditData(target);
    setForm({ ...target, client: target.client });
    setErrors({});
    setShowModal(true);
    setAutoOpenedInvoice(invoiceFromQuery);
  }, [location.search, invoices, autoOpenedInvoice]);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div><h1>Invoices</h1><p>Manage client invoices and billing</p></div>
        <button className="btn btn-primary" onClick={openCreate}><FaPlus /> New Invoice</button>
      </div>

      <div className="card">
        <div className="filter-bar">
          <input className="form-control" placeholder="Search invoice # or client…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ maxWidth: 260 }} />
          <select className="form-control" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ maxWidth: 160 }}>
            <option value="">All Statuses</option>
            {['draft','sent','paid','partial','overdue','cancelled'].map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
          </select>
        </div>

        {loading ? <div className="loading-wrap"><div className="spinner" /></div> : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Invoice #</th><th>Client</th><th>Type</th><th>Amount</th><th>Paid</th><th>Due</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr><td colSpan={8}><div className="empty-state"><div className="icon"><FaFileInvoiceDollar /></div><h3>No invoices</h3></div></td></tr>
                  ) : invoices.map(inv => (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{inv.invoice_number}</td>
                      <td>
                        <Link to={`/clients/${inv.client}`} className="client-link">{inv.client_name}</Link>
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{inv.invoice_type}</td>
                      <td style={{ fontWeight: 600 }}>{inv.total_amount} {inv.currency}</td>
                      <td style={{ color: '#16a34a' }}>{inv.amount_paid} {inv.currency}</td>
                      <td>{inv.due_date}</td>
                      <td><StatusBadge status={inv.status} /></td>
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-icon" title="View" onClick={() => openView(inv)}><FaEye /></button>
                          <button className="btn btn-icon" title="Edit" onClick={() => openEdit(inv)}><FaEdit /></button>
                          <button className="btn btn-icon btn-danger" title="Delete" onClick={() => handleDelete(inv.id)}><FaTrash /></button>
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

      {/* Create/Edit Modal */}
      <Modal open={showModal} title={editData ? 'Edit Invoice' : 'New Invoice'} onClose={() => setShowModal(false)}
        footer={<><button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>}>
        <div className="form-grid">
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label>Client *</label>
            <select className="form-control" value={form.client} onChange={e => set('client', e.target.value)}>
              <option value="">— Select Client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
            {errors.client && <div className="form-error">{errors.client}</div>}
          </div>
          <div className="form-group">
            <label>Invoice Type</label>
            <select className="form-control" value={form.invoice_type} onChange={e => set('invoice_type', e.target.value)}>
              {['subscription','renewal','registration','other'].map(t => <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Currency</label>
            <select className="form-control" value={form.currency} onChange={e => set('currency', e.target.value)}>
              <option value="USD">USD</option><option value="CDF">CDF</option><option value="EUR">EUR</option>
            </select>
          </div>
          <div className="form-group">
            <label>Amount *</label>
            <input className="form-control" type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} />
            {errors.amount && <div className="form-error">{errors.amount}</div>}
          </div>
          <div className="form-group">
            <label>Tax Rate (%)</label>
            <input className="form-control" type="number" step="0.1" value={form.tax_rate} onChange={e => set('tax_rate', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Due Date *</label>
            <input className="form-control" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            {errors.due_date && <div className="form-error">{errors.due_date}</div>}
          </div>
          {editData && (
            <div className="form-group">
              <label>Status</label>
              <select className="form-control" value={form.status} onChange={e => set('status', e.target.value)}>
                {['draft','sent','paid','partial','overdue','cancelled'].map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
              </select>
            </div>
          )}
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label>Description</label>
            <textarea className="form-control" rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal open={showView} title="Invoice Details" onClose={() => setShowView(false)} size="large"
        footer={<button className="btn btn-outline" onClick={() => setShowView(false)}>Close</button>}>
        {viewInvoice && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              {[
                ['Invoice #', viewInvoice.invoice_number],
                ['Client', viewInvoice.client_name],
                ['Type', viewInvoice.invoice_type],
                ['Status', <StatusBadge status={viewInvoice.status} />],
                ['Amount', `${viewInvoice.amount} ${viewInvoice.currency}`],
                ['Tax', `${viewInvoice.tax_amount} ${viewInvoice.currency}`],
                ['Total', `${viewInvoice.total_amount} ${viewInvoice.currency}`],
                ['Paid', `${viewInvoice.amount_paid} ${viewInvoice.currency}`],
                ['Amount Due', `${viewInvoice.amount_due} ${viewInvoice.currency}`],
                ['Due Date', viewInvoice.due_date],
              ].map(([k, v]) => (
                <div key={k}><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{k}</div><div style={{ fontWeight: 600 }}>{v}</div></div>
              ))}
            </div>
            <h4 style={{ marginBottom: 12 }}>Payment History</h4>
            {payments.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No payments recorded.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead><tr style={{ background: '#f8fafc' }}>{['Date','Amount','Method','Reference'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px' }}>{p.payment_date}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.amount} {p.currency}</td>
                      <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>{p.payment_method?.replace('_', ' ')}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{p.reference_number || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
