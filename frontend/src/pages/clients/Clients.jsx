import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaUsers, FaEye } from 'react-icons/fa';
import api from '../../api/axios';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';

const DEFAULT_CLIENT = {
  first_name: '', last_name: '', date_of_birth: '', gender: '', phone: '', email: '',
  address: '', emergency_contact: '', emergency_phone: '',
  one_time_plans: [],
  plan: '', academy_class: '', enrollment_date: new Date().toISOString().slice(0, 10),
  subscription_start: '', subscription_end: '', auto_renew: false, status: 'active', notes: '',
  invoice_date: new Date().toISOString().slice(0, 10),
  invoice_number: '',
};

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [plans, setPlans] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [count, setCount] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(DEFAULT_CLIENT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page, page_size: pageSize });
    params.set('ordering', 'first_name,last_name');
    if (search) params.set('search', search);
    if (filterStatus) params.set('status', filterStatus);
    try {
      const [cRes, pRes, clRes] = await Promise.all([
        api.get(`/clients/?${params}`),
        api.get('/plans/?is_active=true'),
        api.get('/classes/active/'),
      ]);
      setClients(cRes.data.results || cRes.data);
      setCount(cRes.data.count || 0);
      setPlans(pRes.data.results || pRes.data);
      setClasses(clRes.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, filterStatus, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); load(); }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-generate invoice number for new clients based on name + month
  useEffect(() => {
    if (editing) return;
    const f = form.first_name?.trim();
    const l = form.last_name?.trim();
    const d = form.invoice_date;
    if (!f || !l || !d) return;
    const prefix = `${f[0].toUpperCase()}${l[0].toUpperCase()}${d.slice(5, 7)}`;
    api.get(`/sales/invoices/next-number/?prefix=${prefix}`)
      .then(res => {
        const seq = String(res.data.seq).padStart(2, '0');
        setForm(prev => ({ ...prev, invoice_number: `${prefix}${seq}` }));
      })
      .catch(() => {});
  }, [form.first_name, form.last_name, form.invoice_date, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => { setEditing(null); setForm(DEFAULT_CLIENT); setError(''); setModalOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({
      ...c,
      plan: c.plan || '',
      one_time_plans: c.one_time_plans || [],
      academy_class: c.academy_class || '',
      gender: c.gender || '',
      date_of_birth: c.date_of_birth || '',
      subscription_start: c.subscription_start || '',
      subscription_end: c.subscription_end || '',
      auto_renew: !!c.auto_renew,
    });
    setError('');
    setModalOpen(true);
  };
  const openView = (c) => { setSelected(c); setViewOpen(true); };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        plan: form.plan || null,
        one_time_plans: form.one_time_plans || [],
        academy_class: form.academy_class || null,
        date_of_birth: form.date_of_birth || null,
        subscription_start: form.subscription_start || null,
        subscription_end: form.subscription_end || null,
      };
      if (editing) await api.put(`/clients/${editing.id}/`, payload);
      else await api.post('/clients/', payload);
      setModalOpen(false); load();
    } catch (err) {
      setError(err.response?.data ? JSON.stringify(err.response.data) : 'Save failed.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this client?')) return;
    await api.delete(`/clients/${id}/`);
    load();
  };

  const totalPages = Math.ceil(count / pageSize);

  // Calendar-accurate end date: uses month/year units so Feb stays correct
  const calcEndDate = (startDateStr, plan) => {
    if (!startDateStr || !plan) return '';
    // Parse as local date to avoid UTC-offset shifting the day
    const [y, m, d] = startDateStr.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    const val = plan.duration_value || 1;

    if (plan.duration === 'month') {
      // Monthly plans are always full calendar months: start on day 1 and end on month last day.
      const periodStart = new Date(y, m - 1, 1);
      const endMonthIndex = periodStart.getMonth() + val;
      const periodEnd = new Date(periodStart.getFullYear(), endMonthIndex, 0);
      const ey = periodEnd.getFullYear();
      const em = String(periodEnd.getMonth() + 1).padStart(2, '0');
      const ed = String(periodEnd.getDate()).padStart(2, '0');
      return `${ey}-${em}-${ed}`;
    }

    switch (plan.duration) {
      case 'day':  start.setDate(start.getDate() + val); break;
      case 'week': start.setDate(start.getDate() + val * 7); break;
      case 'year': start.setFullYear(start.getFullYear() + val); break;
      default:
        break;
    }
    const ey = start.getFullYear();
    const em = String(start.getMonth() + 1).padStart(2, '0');
    const ed = String(start.getDate()).padStart(2, '0');
    return `${ey}-${em}-${ed}`;
  };

  // Auto-fill subscription_end based on subscription plan selection
  const handlePlanChange = (planId) => {
    const plan = subscriptionPlans.find(p => String(p.id) === String(planId));
    const planNum = planId ? parseInt(planId, 10) : null;
    const classStillValid = !planNum || !form.academy_class || classes.some(c => String(c.id) === String(form.academy_class) && (c.plans || []).includes(planNum));
    setForm({
      ...form,
      plan: planId,
      academy_class: classStillValid ? form.academy_class : '',
      subscription_end: plan ? calcEndDate(form.subscription_start, plan) : '',
      auto_renew: !!plan && !!plan.auto_renew_clients,
    });
  };

  const handleOneTimePlansChange = (e) => {
    const selectedIds = Array.from(e.target.selectedOptions).map(opt => Number(opt.value));
    setForm({ ...form, one_time_plans: selectedIds });
  };

  const handleStartChange = (date) => {
    const plan = subscriptionPlans.find(p => String(p.id) === String(form.plan));
    let normalizedStart = date;
    if (plan?.duration === 'month' && date) {
      const [y, m] = date.split('-').map(Number);
      normalizedStart = `${y}-${String(m).padStart(2, '0')}-01`;
    }
    setForm({
      ...form,
      subscription_start: normalizedStart,
      subscription_end: plan ? calcEndDate(normalizedStart, plan) : '',
    });
  };

  const subscriptionPlans = plans.filter(p => p.plan_type !== 'one_time');
  const oneTimePlans = plans.filter(p => p.plan_type === 'one_time');
  const filteredClasses = form.plan
    ? classes.filter(c => (c.plans || []).includes(parseInt(form.plan, 10)))
    : classes;
  const sortedClients = [...clients].sort((a, b) => {
    const nameA = (a?.full_name || `${a?.first_name || ''} ${a?.last_name || ''}`.trim() || '').toLowerCase();
    const nameB = (b?.full_name || `${b?.first_name || ''} ${b?.last_name || ''}`.trim() || '').toLowerCase();
    return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
  });
  const sortedSubscriptionPlans = [...subscriptionPlans].sort((a, b) =>
    String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' })
  );
  const sortedOneTimePlans = [...oneTimePlans].sort((a, b) =>
    String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' })
  );
  const sortedFilteredClasses = [...filteredClasses].sort((a, b) =>
    String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' })
  );

  return (
    <div>
      <div className="page-header-row">
        <div className="page-header">
          <h1>Clients</h1>
          <p>Register and manage academy students</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><FaPlus /> Add Client</button>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="search-input-wrap">
            <FaSearch className="search-icon" />
            <input className="form-control" placeholder="Search by name, phone, email…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32, width: 260 }} />
          </div>
          <select className="form-control" style={{ width: 140 }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            {['active', 'inactive', 'expired', 'pending', 'suspended'].map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
          </select>
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 13 }}>{count} client(s)</span>
        </div>

        {loading ? <div className="loading-wrap"><div className="spinner" /></div> : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Contact</th>
                  <th>Plan</th>
                  <th>Class</th>
                  <th>Subscription</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state"><div className="icon"><FaUsers /></div><h3>No clients found</h3><p>Add your first client using the button above</p></div></td></tr>
                ) : sortedClients.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        <Link to={`/clients/${c.id}`} className="client-link">{c.full_name}</Link>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Enrolled {c.enrollment_date}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{c.phone || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.email || ''}</div>
                    </td>
                    <td>{c.plan_name ? <span className="badge-pill badge-coach">{c.plan_name}</span> : '—'}</td>
                    <td>{c.class_name || '—'}</td>
                    <td style={{ fontSize: 12 }}>{c.subscription_start || '—'}</td>
                    <td style={{ fontSize: 12 }}>
                      {c.subscription_end ? (
                        <span style={{ color: c.days_until_expiry != null && c.days_until_expiry <= 7 ? 'var(--danger)' : c.days_until_expiry != null && c.days_until_expiry <= 30 ? 'var(--warning)' : 'inherit' }}>
                          {c.subscription_end}
                          {c.days_until_expiry != null && c.days_until_expiry >= 0 && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.days_until_expiry}d left</div>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                    <td><StatusBadge value={c.status} /></td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-outline btn-sm btn-icon" onClick={() => openView(c)} title="View"><FaEye /></button>
                        <button className="btn btn-outline btn-sm btn-icon" onClick={() => openEdit(c)} title="Edit"><FaEdit /></button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(c.id)} title="Delete"><FaTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>←</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
              <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>→</button>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Client' : 'Register New Client'}
        size="modal-lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update Client' : 'Register Client'}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSave}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>Personal Information</p>
          <div className="form-grid form-grid-3" style={{ marginBottom: 20 }}>
            <div className="form-group">
              <label>First Name *</label>
              <input className="form-control" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Last Name *</label>
              <input className="form-control" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Gender</label>
              <select className="form-control" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                <option value="">—</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Date of Birth</label>
              <input type="date" className="form-control" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input className="form-control" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" className="form-control" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-group form-full">
              <label>Address</label>
              <input className="form-control" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Emergency Contact</label>
              <input className="form-control" value={form.emergency_contact} onChange={e => setForm({ ...form, emergency_contact: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Emergency Phone</label>
              <input className="form-control" value={form.emergency_phone} onChange={e => setForm({ ...form, emergency_phone: e.target.value })} />
            </div>
          </div>

          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>Academy Information</p>
          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label>Subscription Plan</label>
              <select className="form-control" value={form.plan} onChange={e => handlePlanChange(e.target.value)}>
                <option value="">— Select subscription plan —</option>
                {sortedSubscriptionPlans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.price} {p.currency})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>One Time Plans (Multiple)</label>
              <select
                className="form-control"
                multiple
                size={Math.min(5, Math.max(3, oneTimePlans.length || 3))}
                value={(form.one_time_plans || []).map(String)}
                onChange={handleOneTimePlansChange}
              >
                {sortedOneTimePlans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.price} {p.currency})</option>)}
              </select>
              <small style={{ color: 'var(--text-muted)' }}>Hold Ctrl (or Cmd) to select multiple one-time plans.</small>
            </div>
            <div className="form-group">
              <label>Class</label>
              <select className="form-control" value={form.academy_class} onChange={e => setForm({ ...form, academy_class: e.target.value })}>
                <option value="">— Select class —</option>
                {sortedFilteredClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select className="form-control" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {['active', 'inactive', 'expired', 'pending', 'suspended'].map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Enrollment Date</label>
              <input type="date" className="form-control" value={form.enrollment_date} onChange={e => setForm({ ...form, enrollment_date: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Subscription Start</label>
              <input type="date" className="form-control" value={form.subscription_start} onChange={e => handleStartChange(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Subscription End</label>
              <input
                type="date"
                className="form-control"
                value={form.subscription_end}
                onChange={e => setForm({ ...form, subscription_end: e.target.value })}
                disabled={!form.plan}
              />
              {!form.plan && (
                <small style={{ color: 'var(--text-muted)' }}>Select a subscription plan to use subscription dates.</small>
              )}
            </div>
            <div className="form-group form-full">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!form.auto_renew}
                  onChange={e => setForm({ ...form, auto_renew: e.target.checked })}
                />
                Auto-renew this client subscription
              </label>
            </div>
            <div className="form-group form-full">
              <label>Notes</label>
              <textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>

          {!editing && (
            <>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 20, marginBottom: 12 }}>Invoice Details</p>
              <div className="form-grid form-grid-3">
                <div className="form-group">
                  <label>Invoice Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.invoice_date}
                    onChange={e => setForm({ ...form, invoice_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Invoice Number</label>
                  <input
                    className="form-control"
                    value={form.invoice_number}
                    onChange={e => setForm({ ...form, invoice_number: e.target.value })}
                    placeholder="Auto-generated from name + month"
                  />
                  <small style={{ color: 'var(--text-muted)' }}>Format: initials + month + sequence (e.g. JD0301)</small>
                </div>
              </div>
            </>
          )}
        </form>
      </Modal>

      {/* View Modal */}
      <Modal open={viewOpen} onClose={() => setViewOpen(false)} title="Client Details" size="modal-lg">
        {selected && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {[
                ['Full Name', selected.full_name],
                ['Gender', selected.gender === 'M' ? 'Male' : selected.gender === 'F' ? 'Female' : selected.gender || '—'],
                ['Date of Birth', selected.date_of_birth || '—'],
                ['Phone', selected.phone || '—'],
                ['Email', selected.email || '—'],
                ['Address', selected.address || '—'],
                ['Emergency Contact', selected.emergency_contact || '—'],
                ['Emergency Phone', selected.emergency_phone || '—'],
                ['Plan', selected.plan_name || '—'],
                ['Class', selected.class_name || '—'],
                ['Enrollment Date', selected.enrollment_date],
                ['Subscription Start', selected.subscription_start || '—'],
                ['Subscription End', selected.subscription_end || '—'],
                ['Days Until Expiry', selected.days_until_expiry != null ? `${selected.days_until_expiry} days` : '—'],
                ['Status', null],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {label === 'Status' ? <StatusBadge value={selected.status} /> : val}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
