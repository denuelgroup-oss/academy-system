import React, { useEffect, useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaPlus, FaTrash, FaMoneyBillWave } from 'react-icons/fa';
import api from '../../api/axios';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';

const EMPTY = { invoice: '', amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'cash', currency: 'USD', reference_number: '', notes: '' };

export default function ReceivedPayments() {
  const location = useLocation();
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [totalReceived, setTotalReceived] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/sales/payments/', { params: { page, page_size: pageSize, ordering: '-payment_date' } });
      const data = r.data.results || r.data;
      setPayments(data);
      setTotalPages(Math.ceil((r.data.count || data.length) / pageSize));
      setTotalReceived(data.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0));
    } finally { setLoading(false); }
  }, [page, pageSize]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    Promise.all([
      api.get('/sales/invoices/?status=draft&page_size=200'),
      api.get('/sales/invoices/?status=partial&page_size=200'),
      api.get('/sales/invoices/?status=sent&page_size=200'),
      api.get('/sales/invoices/?status=overdue&page_size=200'),
    ]).then(([r0, r1, r2, r3]) => {
      const merged = [
        ...(r0.data.results || r0.data),
        ...(r1.data.results || r1.data),
        ...(r2.data.results || r2.data),
        ...(r3.data.results || r3.data),
      ];

      // Prevent duplicate invoices when combining statuses.
      const uniqueMap = new Map();
      merged.forEach(inv => uniqueMap.set(inv.id, inv));
      setInvoices(Array.from(uniqueMap.values()));
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const invoiceId = params.get('invoice');
    if (!invoiceId || invoices.length === 0) return;

    const invoice = invoices.find(i => String(i.id) === String(invoiceId));
    const amountFromQuery = params.get('amount');
    const currencyFromQuery = params.get('currency');

    if (!invoice) {
      // If the requested invoice isn't in the loaded status buckets, fetch it directly
      // so one-time payment flow cannot silently fall back to another invoice.
      api.get(`/sales/invoices/${invoiceId}/`).then(({ data }) => {
        setInvoices(prev => {
          if (prev.some(i => String(i.id) === String(data.id))) return prev;
          return [data, ...prev];
        });
        setForm(f => ({
          ...f,
          invoice: invoiceId,
          amount: amountFromQuery || data?.amount_due || '',
          currency: currencyFromQuery || data?.currency || f.currency,
        }));
        setErrors({});
        setShowModal(true);
      });
      return;
    }

    setForm(f => ({
      ...f,
      invoice: invoiceId,
      amount: amountFromQuery || invoice?.amount_due || '',
      currency: currencyFromQuery || invoice?.currency || f.currency,
    }));
    setErrors({});
    setShowModal(true);
  }, [location.search, invoices]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.invoice) e.invoice = 'Required';
    if (!form.amount) e.amount = 'Required';
    if (!form.payment_date) e.payment_date = 'Required';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await api.post('/sales/payments/', form);
      setShowModal(false); setForm(EMPTY); load();
    } catch (err) {
      if (err.response?.data) setErrors(err.response.data);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this payment record?')) return;
    await api.delete(`/sales/payments/${id}/`); load();
  };

  const sortedPayments = [...payments].sort((a, b) =>
    String(a?.client_name || '').localeCompare(String(b?.client_name || ''), undefined, { sensitivity: 'base' })
  );
  const sortedInvoices = [...invoices].sort((a, b) =>
    String(a?.client_name || '').localeCompare(String(b?.client_name || ''), undefined, { sensitivity: 'base' })
  );

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div><h1>Received Payments</h1><p>Track only recorded payments received from clients</p></div>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setErrors({}); setShowModal(true); }}><FaPlus /> Record Payment</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ borderLeft: '4px solid var(--primary)', padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Received (page)</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--primary)' }}>${totalReceived.toFixed(2)}</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #2563eb', padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Transactions</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{payments.length}</div>
        </div>
      </div>

      <div className="card">
        {loading ? <div className="loading-wrap"><div className="spinner" /></div> : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Date</th><th>Invoice #</th><th>Client</th><th>Amount</th><th>Method</th><th>Reference</th><th>Invoice Status</th><th></th></tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr><td colSpan={8}><div className="empty-state"><div className="icon"><FaMoneyBillWave /></div><h3>No payments yet</h3></div></td></tr>
                  ) : sortedPayments.map(p => (
                    <tr key={p.id}>
                      <td>{p.payment_date}</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{p.invoice_number}</td>
                      <td>
                        {p.client_id ? <Link to={`/clients/${p.client_id}`} className="client-link">{p.client_name}</Link> : p.client_name}
                      </td>
                      <td style={{ fontWeight: 600, color: '#16a34a' }}>{p.amount} {p.currency}</td>
                      <td style={{ textTransform: 'capitalize' }}>{p.payment_method?.replace('_', ' ')}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{p.reference_number || p.reference || '—'}</td>
                      <td><StatusBadge status={p.invoice_status} /></td>
                      <td><button className="btn btn-icon btn-danger" onClick={() => handleDelete(p.id)}><FaTrash /></button></td>
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

      <Modal open={showModal} title="Record Payment" onClose={() => setShowModal(false)}
        footer={<><button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>}>
        <div className="form-grid">
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label>Invoice *</label>
            <select className="form-control" value={form.invoice} onChange={e => set('invoice', e.target.value)}>
              <option value="">— Select Invoice —</option>
              {sortedInvoices.map(inv => <option key={inv.id} value={inv.id}>{inv.invoice_number} — {inv.client_name} (Due: {inv.amount_due} {inv.currency})</option>)}
            </select>
            {errors.invoice && <div className="form-error">{errors.invoice}</div>}
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
            <label>Payment Date *</label>
            <input className="form-control" type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} />
            {errors.payment_date && <div className="form-error">{errors.payment_date}</div>}
          </div>
          <div className="form-group">
            <label>Payment Method</label>
            <select className="form-control" value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
              {['cash','bank_transfer','mobile_money','check','card'].map(m => <option key={m} value={m} style={{ textTransform: 'capitalize' }}>{m.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label>Reference Number</label>
            <input className="form-control" placeholder="Trans ID, receipt #…" value={form.reference_number} onChange={e => set('reference_number', e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label>Notes</label>
            <textarea className="form-control" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
