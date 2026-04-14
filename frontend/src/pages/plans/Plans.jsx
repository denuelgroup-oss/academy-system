import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaTrash, FaSearch, FaLayerGroup } from 'react-icons/fa';
import api from '../../api/axios';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';

const DURATIONS = ['day', 'week', 'month', 'year'];
const DEFAULT_PLAN = {
  name: '',
  plan_type: 'subscription',
  description: '',
  price: '',
  currency: 'USD',
  duration: 'month',
  duration_value: 1,
  duration_days: 30,
  features: '',
  auto_renew_clients: false,
  max_sessions_per_week: 0,
  is_active: true,
};

export default function Plans() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planMenu, setPlanMenu] = useState('subscription');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(DEFAULT_PLAN);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/plans/?ordering=price');
      setPlans(res.data.results || res.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = plans.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesMenu = p.plan_type === planMenu;
    return matchesSearch && matchesMenu;
  });
  const sortedFiltered = [...filtered].sort((a, b) =>
    String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' })
  );

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...DEFAULT_PLAN,
      plan_type: planMenu,
      duration: planMenu === 'one_time' ? 'day' : 'month',
      duration_value: 1,
      auto_renew_clients: false,
    });
    setError('');
    setModalOpen(true);
  };
  const openEdit = (p) => { setEditing(p); setForm({ ...p }); setError(''); setModalOpen(true); };

  const handlePlanTypeChange = (planType) => {
    if (planType === 'one_time') {
      setForm({
        ...form,
        plan_type: 'one_time',
        duration: 'day',
        duration_value: 1,
        max_sessions_per_week: 0,
        features: '',
        auto_renew_clients: false,
      });
      return;
    }

    setForm({
      ...form,
      plan_type: 'subscription',
      duration: form.duration === 'day' && Number(form.duration_value || 1) === 1 ? 'month' : form.duration,
      duration_value: Number(form.duration_value || 1),
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        plan_type: form.plan_type || 'subscription',
        duration: form.plan_type === 'one_time' ? 'day' : form.duration,
        duration_value: form.plan_type === 'one_time' ? 1 : Number(form.duration_value || 1),
        max_sessions_per_week: form.plan_type === 'one_time' ? 0 : Number(form.max_sessions_per_week || 0),
        features: form.plan_type === 'one_time' ? '' : (form.features || ''),
        auto_renew_clients: form.plan_type === 'one_time' ? false : !!form.auto_renew_clients,
      };

      if (editing) await api.put(`/plans/${editing.id}/`, payload);
      else {
        const res = await api.post('/plans/', payload);
        if (payload.plan_type === 'subscription' && res.data?.id) {
          navigate(`/classes?attach_plan=${res.data.id}`);
          return;
        }
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data ? JSON.stringify(err.response.data) : 'Save failed.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this plan?')) return;
    await api.delete(`/plans/${id}/`);
    load();
  };

  const formatDuration = (p) => {
    const value = p.duration_value || 1;
    const unit = p.duration || 'month';
    const label = value === 1 ? unit : `${unit}s`;
    return `${value} ${label}`;
  };

  return (
    <div>
      <div className="page-header-row">
        <div className="page-header">
          <h1>Plans</h1>
          <p>Create and manage subscription plans and one time plans</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <FaPlus /> New Plan
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={`btn ${planMenu === 'subscription' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setPlanMenu('subscription')}
          >
            Subscription Plans
          </button>
          <button
            type="button"
            className={`btn ${planMenu === 'one_time' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setPlanMenu('one_time')}
          >
            One Time Plans
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-info">
            <div className="stat-card-label">Total Plans</div>
            <div className="stat-card-value">{plans.length}</div>
          </div>
          <div className="stat-card-icon stat-green"><FaLayerGroup /></div>
        </div>
        <div className="stat-card">
          <div className="stat-card-info">
            <div className="stat-card-label">Active Plans</div>
            <div className="stat-card-value">{plans.filter(p => p.is_active).length}</div>
          </div>
          <div className="stat-card-icon stat-blue"><FaLayerGroup /></div>
        </div>
        <div className="stat-card">
          <div className="stat-card-info">
            <div className="stat-card-label">Total Clients</div>
            <div className="stat-card-value">{plans.reduce((s, p) => s + (p.client_count || 0), 0)}</div>
          </div>
          <div className="stat-card-icon stat-warn"><FaLayerGroup /></div>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="search-input-wrap">
            <FaSearch className="search-icon" />
            <input className="form-control" placeholder="Search plans…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
          </div>
        </div>

        {loading ? <div className="loading-wrap"><div className="spinner" /></div> : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Plan Name</th>
                  <th>Type</th>
                  <th>Price</th>
                  <th>Duration</th>
                  <th>Days</th>
                  <th>Sessions/Week</th>
                  <th>Clients</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9}>
                    <div className="empty-state"><div className="icon"><FaLayerGroup /></div><h3>No plans found</h3></div>
                  </td></tr>
                ) : sortedFiltered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.description?.slice(0, 50)}</div>
                    </td>
                    <td>
                      <span className="badge-pill badge-coach" style={{ textTransform: 'capitalize' }}>
                        {p.plan_type === 'one_time' ? 'One Time' : 'Subscription'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--green)' }}>{p.price} {p.currency}</td>
                    <td style={{ textTransform: 'capitalize' }}>{formatDuration(p)}</td>
                    <td>{p.duration_days}</td>
                    <td>{p.plan_type === 'one_time' ? '-' : (p.max_sessions_per_week === 0 ? 'Unlimited' : p.max_sessions_per_week)}</td>
                    <td><span style={{ fontWeight: 600 }}>{p.client_count || 0}</span></td>
                    <td><StatusBadge value={p.is_active ? 'active' : 'inactive'} /></td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>Edit</button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(p.id)}><FaTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Plan Cards View */}
      {!loading && sortedFiltered.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="card-title" style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Plan Overview Cards</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {sortedFiltered.map(p => (
              <div key={p.id} className="card" style={{ borderTop: `4px solid ${p.is_active ? 'var(--green)' : 'var(--border)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, textTransform: 'capitalize' }}>
                      {p.plan_type === 'one_time' ? 'One Time Plan' : `${formatDuration(p)} plan`}
                    </div>
                  </div>
                  <StatusBadge value={p.is_active ? 'active' : 'inactive'} />
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--green)', marginBottom: 8 }}>
                  {p.price} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>{p.currency}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>{p.client_count || 0} clients</span>
                  <span>{p.duration_days} days</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Plan' : 'Create New Plan'}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update Plan' : 'Create Plan'}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-group form-full">
              <label>Plan Name *</label>
              <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Premium Monthly" />
            </div>
            <div className="form-group">
              <label>Plan Type</label>
              <select className="form-control" value={form.plan_type || 'subscription'} onChange={e => handlePlanTypeChange(e.target.value)}>
                <option value="subscription">Subscription Plan</option>
                <option value="one_time">One Time Plan</option>
              </select>
            </div>
            <div className="form-group">
              <label>Price *</label>
              <input type="number" min="0" step="0.01" className="form-control" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Currency</label>
              <select className="form-control" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                <option value="USD">USD</option>
                <option value="CDF">CDF</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            {form.plan_type !== 'one_time' && (
              <div className="form-group">
                <label>Duration Unit</label>
                <select
                  className="form-control"
                  value={form.duration}
                  onChange={e => setForm({ ...form, duration: e.target.value })}
                >
                  {DURATIONS.map(d => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
                </select>
              </div>
            )}
            {form.plan_type !== 'one_time' && (
              <div className="form-group">
                <label>Duration Number</label>
                <input type="number" min="1" className="form-control" value={form.duration_value || 1} onChange={e => setForm({ ...form, duration_value: parseInt(e.target.value || '1', 10) })} />
              </div>
            )}
            {form.plan_type !== 'one_time' && (
              <div className="form-group">
                <label>Sessions/Week (0 = unlimited)</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={form.max_sessions_per_week}
                  onChange={e => setForm({ ...form, max_sessions_per_week: parseInt(e.target.value || '0', 10) })}
                />
              </div>
            )}
            <div className="form-group form-full">
              <label>Description</label>
              <textarea className="form-control" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group form-full">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                Active Plan
              </label>
            </div>
            {form.plan_type !== 'one_time' && (
              <div className="form-group form-full">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!form.auto_renew_clients}
                    onChange={e => setForm({ ...form, auto_renew_clients: e.target.checked })}
                  />
                  Auto-renew clients by default
                </label>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
