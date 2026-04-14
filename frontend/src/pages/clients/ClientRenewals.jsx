import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaSyncAlt, FaExclamationTriangle } from 'react-icons/fa';
import api from '../../api/axios';

export default function ClientRenewals() {
  const [expiring, setExpiring] = useState([]);
  const [expired, setExpired] = useState([]);
  const [tab, setTab] = useState('expiring');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(30);
  const [invoiceMsg, setInvoiceMsg] = useState('');
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState({});
  const [selectedExpired, setSelectedExpired] = useState({});
  const [renewing, setRenewing] = useState(false);

  const calcEndDate = (startDateStr, plan) => {
    if (!startDateStr || !plan) return '';
    const [y, m, d] = startDateStr.split('-').map(Number);
    const end = new Date(y, m - 1, d);
    const val = plan.duration_value || 1;

    if (plan.duration === 'month') {
      const endMonthIndex = end.getMonth() + val;
      const periodEnd = new Date(end.getFullYear(), endMonthIndex, 0);
      const ey = periodEnd.getFullYear();
      const em = String(periodEnd.getMonth() + 1).padStart(2, '0');
      const ed = String(periodEnd.getDate()).padStart(2, '0');
      return `${ey}-${em}-${ed}`;
    }

    switch (plan.duration) {
      case 'day': end.setDate(end.getDate() + val); break;
      case 'week': end.setDate(end.getDate() + val * 7); break;
      case 'year': end.setFullYear(end.getFullYear() + val); break;
      default:
        break;
    }
    const ey = end.getFullYear();
    const em = String(end.getMonth() + 1).padStart(2, '0');
    const ed = String(end.getDate()).padStart(2, '0');
    return `${ey}-${em}-${ed}`;
  };

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const renewalStartDate = (client) => {
    // Always extend from the last known subscription end date when present.
    if (client.subscription_end) return client.subscription_end;
    return todayStr();
  };

  const nextMonthlyStartDate = (anchorDateStr) => {
    const [y, m] = anchorDateStr.split('-').map(Number);
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  };

  const load = async () => {
    setLoading(true);
    try {
      const [e, x] = await Promise.allSettled([
        api.get(`/clients/expiring-soon/?days=${days}`),
        api.get('/clients/expired/'),
      ]);

      if (e.status === 'fulfilled') setExpiring(e.value.data.results || e.value.data);
      else setExpiring([]);

      if (x.status === 'fulfilled') setExpired(x.value.data.results || x.value.data);
      else setExpired([]);

      if (e.status === 'rejected' || x.status === 'rejected') {
        setInvoiceMsg('Some renewal data could not be loaded. Please refresh and try again.');
      }
    } catch {
      setExpiring([]);
      setExpired([]);
      setInvoiceMsg('Failed to load renewals data.');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    api.get('/plans/active/')
      .then(r => {
        const list = r.data.results || r.data;
        // Renewals must use subscription plans only.
        setPlans(
          (list || [])
            .filter(p => p.plan_type !== 'one_time')
            .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' }))
        );
      })
      .catch(() => {
        setPlans([]);
        setInvoiceMsg('Failed to load active plans.');
      });
    load();
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshStatuses = async () => {
    setRefreshing(true);
    await api.post('/clients/refresh-statuses/');
    await load();
    setRefreshing(false);
  };

  const resolvePlanForClient = (client) => {
    const picked = selectedPlan[client.id];
    return plans.find(p => p.id === parseInt(picked, 10)) || plans.find(p => p.id === client.plan);
  };

  const renewClient = async (client) => {
    const plan = resolvePlanForClient(client);
    if (!plan) {
      throw new Error(`No plan selected for ${client.full_name}`);
    }

    const baseStart = renewalStartDate(client);
    const start = plan.duration === 'month' ? nextMonthlyStartDate(baseStart) : baseStart;
    const end = calcEndDate(start, plan);
    await api.patch(`/clients/${client.id}/`, {
      plan: plan.id,
      subscription_start: start,
      subscription_end: end,
      status: 'active',
      auto_renew: !!plan.auto_renew_clients,
    });
  };

  const renewSelectedExpired = async () => {
    const ids = Object.keys(selectedExpired).filter(id => selectedExpired[id]);
    if (!ids.length) {
      setInvoiceMsg('Select expired clients to renew.');
      return;
    }

    setRenewing(true);
    try {
      const selectedClients = expired.filter(c => ids.includes(String(c.id)));
      let success = 0;
      const failed = [];
      for (const client of selectedClients) {
        try {
          await renewClient(client);
          success += 1;
        } catch {
          failed.push(client.full_name);
        }
      }
      setSelectedExpired({});
      await load();
      if (failed.length) {
        setInvoiceMsg(`${success} renewed, ${failed.length} failed.`);
      } else {
        setInvoiceMsg(`${success} client(s) renewed successfully.`);
      }
      setTimeout(() => setInvoiceMsg(''), 3500);
    } catch {
      setInvoiceMsg('Failed to renew selected clients.');
    } finally {
      setRenewing(false);
    }
  };

  const renewAllExpired = async () => {
    if (!expired.length) {
      setInvoiceMsg('No expired clients to renew.');
      return;
    }

    setRenewing(true);
    try {
      let success = 0;
      const failed = [];
      for (const client of expired) {
        try {
          await renewClient(client);
          success += 1;
        } catch {
          failed.push(client.full_name);
        }
      }
      setSelectedExpired({});
      await load();
      if (failed.length) {
        setInvoiceMsg(`${success} renewed, ${failed.length} failed.`);
      } else {
        setInvoiceMsg(`${success} client(s) renewed successfully.`);
      }
      setTimeout(() => setInvoiceMsg(''), 3500);
    } catch {
      setInvoiceMsg('Failed to renew all expired clients.');
    } finally {
      setRenewing(false);
    }
  };

  const renderTable = (data, isExpiredTab = false) => {
    const sortedData = [...data].sort((a, b) =>
      String(a?.full_name || '').localeCompare(String(b?.full_name || ''), undefined, { sensitivity: 'base' })
    );

    return (
    sortedData.length === 0 ? (
      <div className="empty-state">
        <div className="icon"><FaSyncAlt /></div>
        <h3>No clients found</h3>
      </div>
    ) : (
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {isExpiredTab && (
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={sortedData.length > 0 && sortedData.every(c => selectedExpired[c.id])}
                    onChange={(e) => {
                      const { checked } = e.target;
                      const next = { ...selectedExpired };
                      sortedData.forEach(c => { next[c.id] = checked; });
                      setSelectedExpired(next);
                    }}
                  />
                </th>
              )}
              <th>Client</th>
              <th>Plan</th>
              <th>Class</th>
              <th>Subscription End</th>
              <th>Days Left</th>
              <th>Renewal Plan</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map(c => {
              const daysLeft = c.days_until_expiry;
              let urgencyColor = '#16a34a';
              if (daysLeft <= 0) urgencyColor = '#dc2626';
              else if (daysLeft <= 7) urgencyColor = '#dc2626';
              else if (daysLeft <= 14) urgencyColor = '#ea580c';
              else if (daysLeft <= 30) urgencyColor = '#d97706';
              return (
                <tr key={c.id}>
                  {isExpiredTab && (
                    <td>
                      <input
                        type="checkbox"
                        checked={!!selectedExpired[c.id]}
                        onChange={(e) => setSelectedExpired(prev => ({ ...prev, [c.id]: e.target.checked }))}
                      />
                    </td>
                  )}
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      <Link to={`/clients/${c.id}`} className="client-link">{c.full_name}</Link>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.phone}</div>
                  </td>
                  <td>{c.plan_name || '—'}</td>
                  <td>{c.class_name || '—'}</td>
                  <td>{c.subscription_end || '—'}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: urgencyColor }}>
                      {daysLeft <= 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d`}
                    </span>
                  </td>
                  <td>
                    <select
                      className="form-control"
                      style={{ minWidth: 150 }}
                      value={selectedPlan[c.id] || (c.plan || '')}
                      onChange={e => setSelectedPlan(p => ({ ...p, [c.id]: e.target.value }))}
                    >
                      <option value="">— Same plan —</option>
                      {plans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.price} {p.currency})</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )
  );
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Client Renewals</h1>
          <p>Manage subscription renewals for expiring and expired clients</p>
        </div>
        <button className="btn btn-outline" onClick={refreshStatuses} disabled={refreshing}>
          <FaSyncAlt /> {refreshing ? 'Refreshing…' : 'Refresh Statuses'}
        </button>
      </div>

      {invoiceMsg && <div className="alert alert-success" style={{ marginBottom: 16 }}>{invoiceMsg}</div>}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ borderLeft: '4px solid #d97706', padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Expiring Soon</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{expiring.length}</div>
          <div style={{ fontSize: 12, color: '#d97706' }}>Within {days} days</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #dc2626', padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Expired</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{expired.length}</div>
          <div style={{ fontSize: 12, color: '#dc2626' }}>Need renewal</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 4 }}>
            {['expiring', 'expired'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600,
                background: tab === t ? 'var(--primary)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-muted)',
              }}>{t === 'expiring' ? `Expiring (${expiring.length})` : `Expired (${expired.length})`}</button>
            ))}
          </div>
          {tab === 'expiring' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Show within</span>
              {[7, 14, 30, 60].map(d => (
                <button key={d} onClick={() => setDays(d)} className="btn btn-outline btn-sm" style={{ background: days === d ? 'var(--primary)' : undefined, color: days === d ? '#fff' : undefined }}>{d}d</button>
              ))}
            </div>
          )}

          {tab === 'expired' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={renewSelectedExpired} disabled={renewing}>
                <FaSyncAlt /> {renewing ? 'Renewing…' : 'Renew Selected'}
              </button>
              <button className="btn btn-outline btn-sm" onClick={renewAllExpired} disabled={renewing || expired.length === 0}>
                <FaExclamationTriangle /> {renewing ? 'Renewing…' : 'Renew All'}
              </button>
            </div>
          )}
        </div>

        {loading ? <div className="loading-wrap"><div className="spinner" /><span>Loading…</span></div>
          : tab === 'expiring' ? renderTable(expiring, false) : renderTable(expired, true)}
      </div>
    </div>
  );
}
