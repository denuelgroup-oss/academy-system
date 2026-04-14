import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaClock, FaFileInvoiceDollar } from 'react-icons/fa';
import api from '../../api/axios';
import StatusBadge from '../../components/common/StatusBadge';

export default function PendingPayments() {
  const [pending, setPending] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [clients, setClients] = useState([]);
  const [oneTimePlans, setOneTimePlans] = useState([]);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, o, c, plansRes] = await Promise.all([
        api.get('/sales/invoices/pending/'),
        api.get('/sales/invoices/overdue/'),
        api.get('/clients/?page_size=1000'),
        api.get('/plans/?plan_type=one_time&is_active=true&page_size=1000'),
      ]);
      const pendingData = (p.data.results || p.data).filter(inv => ['draft', 'sent', 'partial'].includes(inv.status));
      const overdueData = (o.data.results || o.data).filter(inv => inv.status === 'overdue');
      setPending(pendingData);
      setOverdue(overdueData);
      setClients(c.data.results || c.data || []);
      setOneTimePlans(plansRes.data.results || plansRes.data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const markOverdue = async () => {
    await api.post('/sales/invoices/mark-overdue/');
    load();
  };

  const data = tab === 'pending' ? pending : overdue;
  const sortedData = [...data].sort((a, b) =>
    String(a?.client_name || '').localeCompare(String(b?.client_name || ''), undefined, { sensitivity: 'base' })
  );
  const pendingInvoicesTotal = pending.reduce((sum, inv) => sum + parseFloat(inv.amount_due || 0), 0);
  const overdueInvoicesTotal = overdue.reduce((sum, inv) => sum + parseFloat(inv.amount_due || 0), 0);
  const oneTimePlanPrices = Object.fromEntries(oneTimePlans.map(p => [p.id, parseFloat(p.price || 0)]));
  const oneTimePlansPendingTotal = clients.reduce((sum, client) => {
    const ids = client.one_time_plans || [];
    return sum + ids.reduce((inner, pid) => inner + (oneTimePlanPrices[pid] || 0), 0);
  }, 0);
  const totalAmount = tab === 'pending'
    ? pendingInvoicesTotal + oneTimePlansPendingTotal
    : overdueInvoicesTotal;
  const baseCurrency = pending[0]?.currency || overdue[0]?.currency || oneTimePlans[0]?.currency || 'USD';

  const fmt = (value, currency = baseCurrency) => `${parseFloat(value || 0).toFixed(2)} ${currency}`;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div><h1>Pending Payments</h1><p>View pending invoices and track overdue separately</p></div>
        <button className="btn btn-outline" onClick={markOverdue}>
          <FaClock /> Mark Overdue
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ borderLeft: '4px solid #d97706', padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Pending Invoices</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{pending.length}</div>
          <div style={{ fontSize: 12, color: '#d97706' }}>
            {fmt(pendingInvoicesTotal)} outstanding
          </div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #dc2626', padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Overdue Invoices</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{overdue.length}</div>
          <div style={{ fontSize: 12, color: '#dc2626' }}>
            {fmt(overdueInvoicesTotal)} overdue
          </div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #0891b2', padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>One-Time Plans Pending</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{fmt(oneTimePlansPendingTotal)}</div>
          <div style={{ fontSize: 12, color: '#0e7490' }}>Included in Pending tab total</div>
        </div>
        <div
          className="card"
          style={{
            border: '1px solid #bfdbfe',
            background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
            padding: 20,
          }}
        >
          <div style={{ fontSize: 13, color: '#1e40af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Current Tab Total</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#1d4ed8', marginTop: 4 }}>{fmt(totalAmount)}</div>
          <div style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>
            {tab === 'pending'
              ? `Invoices ${fmt(pendingInvoicesTotal)} + One-time ${fmt(oneTimePlansPendingTotal)}`
              : `Overdue invoices ${fmt(overdueInvoicesTotal)}`}
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 4, marginBottom: 16, width: 'fit-content' }}>
          {['pending', 'overdue'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600,
              background: tab === t ? (t === 'overdue' ? '#dc2626' : 'var(--primary)') : 'transparent',
              color: tab === t ? '#fff' : 'var(--text-muted)',
            }}>{t === 'pending' ? `Pending (${pending.length})` : `Overdue (${overdue.length})`}</button>
          ))}
        </div>

        {loading ? <div className="loading-wrap"><div className="spinner" /></div> : (
          sortedData.length === 0 ? (
            <div className="empty-state">
              <div className="icon" style={{ color: '#16a34a' }}><FaFileInvoiceDollar /></div>
              <h3>All clear!</h3>
              <p>No {tab} invoices at this time.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Invoice #</th><th>Client</th><th>Total</th><th>Paid</th><th>Amount Due</th><th>Due Date</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {sortedData.map(inv => {
                    const daysOverdue = Math.ceil((new Date() - new Date(inv.due_date)) / 86400000);
                    return (
                      <tr key={inv.id}>
                        <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{inv.invoice_number}</td>
                        <td>
                          <Link to={`/clients/${inv.client}`} className="client-link">{inv.client_name}</Link>
                        </td>
                        <td>{inv.total_amount} {inv.currency}</td>
                        <td style={{ color: '#16a34a' }}>{inv.amount_paid} {inv.currency}</td>
                        <td style={{ fontWeight: 700, color: '#dc2626' }}>{inv.amount_due} {inv.currency}</td>
                        <td>
                          <span>{inv.due_date}</span>
                          {tab === 'overdue' && daysOverdue > 0 && (
                            <span style={{ marginLeft: 6, fontSize: 11, color: '#dc2626', fontWeight: 600 }}>({daysOverdue}d late)</span>
                          )}
                        </td>
                        <td><StatusBadge status={inv.status} /></td>
                        <td>
                          <Link
                            to={`/sales/payments?invoice=${inv.id}&amount=${inv.amount_due || 0}&currency=${inv.currency || 'USD'}`}
                            className="btn btn-outline"
                            style={{ fontSize: 12, padding: '4px 8px', minHeight: 'auto' }}
                          >
                            Process Payment
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
