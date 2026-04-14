import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaFutbol, FaUsers } from 'react-icons/fa';
import api from '../../api/axios';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';

const DEFAULT_CLASS = {
  name: '',
  description: '',
  skills: '',
  center: '',
  level: '',
  plans: [],
  max_students: 20,
  coach: '',
  is_active: true,
};

export default function Classes() {
  const location = useLocation();
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(DEFAULT_CLASS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [planToAdd, setPlanToAdd] = useState('');
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [attachPlanId, setAttachPlanId] = useState(null);
  const [attachPlanName, setAttachPlanName] = useState('');
  const [selectedExistingClass, setSelectedExistingClass] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState('');

  const toArray = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  };

  const load = async () => {
    setLoading(true);
    try {
      const [classRes, coachRes, planRes] = await Promise.all([
        api.get('/classes/?ordering=name'),
        api.get('/auth/users/?role=coach'),
        api.get('/plans/?is_active=true&ordering=name'),
      ]);
      setClasses(toArray(classRes.data));
      setCoaches(toArray(coachRes.data));
      setPlans(toArray(planRes.data));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const planParam = query.get('attach_plan');
    if (!planParam || plans.length === 0) return;

    const planId = parseInt(planParam, 10);
    if (!Number.isInteger(planId)) {
      navigate('/classes', { replace: true });
      return;
    }

    const exists = plans.some((p) => p.id === planId);
    if (exists) {
      // Directly open Create Class form with the new plan pre-filled
      setEditing(null);
      setForm({ ...DEFAULT_CLASS, plans: [planId] });
      setPlanToAdd('');
      setError('');
      setModalOpen(true);
    }

    navigate('/classes', { replace: true });
  }, [location.search, plans, navigate]);

  const filtered = classes.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.plan_names || []).join(' ').toLowerCase().includes(search.toLowerCase())
  );
  const sortedFiltered = [...filtered].sort((a, b) =>
    String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' })
  );
  const sortedClasses = [...classes].sort((a, b) =>
    String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' })
  );
  const sortedPlans = [...plans].sort((a, b) =>
    String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' })
  );
  const sortedCoaches = [...coaches].sort((a, b) =>
    String(a?.full_name || a?.username || '').localeCompare(String(b?.full_name || b?.username || ''), undefined, { sensitivity: 'base' })
  );

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_CLASS);
    setPlanToAdd('');
    setError('');
    setModalOpen(true);
  };
  const openEdit = (c) => {
    setEditing(c);
    setForm({ ...c, plans: c.plans || [], coach: c.coach || '' });
    setPlanToAdd('');
    setError('');
    setModalOpen(true);
  };

  const handleAddPlanToClass = () => {
    if (!planToAdd) return;
    const planId = parseInt(planToAdd, 10);
    if (!Number.isInteger(planId)) return;
    const merged = Array.from(new Set([...(form.plans || []), planId]));
    setForm({ ...form, plans: merged });
    setPlanToAdd('');
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, coach: form.coach || null, plans: form.plans || [] };
      if (editing) await api.put(`/classes/${editing.id}/`, payload);
      else {
        const res = await api.post('/classes/', payload);
        if (res.data?.id) {
          navigate(`/classes/schedule?new_class=${res.data.id}`);
          return;
        }
      }
      setModalOpen(false); load();
    } catch (err) {
      setError(err.response?.data ? JSON.stringify(err.response.data) : 'Save failed.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this class? All related data will be affected.')) return;
    await api.delete(`/classes/${id}/`);
    load();
  };

  const openCreateWithPlan = () => {
    if (!attachPlanId) return;
    setAttachModalOpen(false);
    setEditing(null);
    setForm({ ...DEFAULT_CLASS, plans: [attachPlanId] });
    setError('');
    setModalOpen(true);
  };

  const handleAttachToExistingClass = async () => {
    if (!attachPlanId || !selectedExistingClass) {
      setAttachError('Please select an existing class.');
      return;
    }

    const classId = parseInt(selectedExistingClass, 10);
    const classObj = classes.find((c) => c.id === classId);
    if (!classObj) {
      setAttachError('Selected class was not found.');
      return;
    }

    const mergedPlans = Array.from(new Set([...(classObj.plans || []), attachPlanId]));

    setAttaching(true);
    setAttachError('');
    try {
      await api.patch(`/classes/${classId}/`, { plans: mergedPlans });
      setAttachModalOpen(false);
      setAttachPlanId(null);
      setAttachPlanName('');
      setSelectedExistingClass('');
      load();
    } catch (err) {
      setAttachError(err.response?.data ? JSON.stringify(err.response.data) : 'Attach failed.');
    } finally {
      setAttaching(false);
    }
  };

  return (
    <div>
      <div className="page-header-row">
        <div className="page-header">
          <h1>Classes</h1>
          <p>Manage training classes, linked plans and coach assignments</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><FaPlus /> New Class</button>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="search-input-wrap">
            <FaSearch className="search-icon" />
            <input className="form-control" placeholder="Search classes…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
          </div>
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 13 }}>{filtered.length} class(es)</span>
        </div>

        {loading ? <div className="loading-wrap"><div className="spinner" /></div> : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Class Name</th>
                  <th>Plans</th>
                  <th>Coach</th>
                  <th>Students</th>
                  <th>Max</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7}>
                    <div className="empty-state"><div className="icon"><FaFutbol /></div><h3>No classes found</h3></div>
                  </td></tr>
                ) : sortedFiltered.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {[c.center, c.level].filter(Boolean).join(' • ') || c.description?.slice(0, 40)}
                      </div>
                    </td>
                    <td>
                      {(c.plan_names || []).length ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {[...(c.plan_names || [])].sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })).map((p) => <span key={p} className="badge-pill badge-coach">{p}</span>)}
                        </div>
                      ) : '—'}
                    </td>
                    <td>{c.coach_name || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                        <FaUsers style={{ color: 'var(--green)' }} /> {c.student_count}
                      </span>
                    </td>
                    <td>{c.max_students}</td>
                    <td><StatusBadge value={c.is_active ? 'active' : 'inactive'} /></td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-outline btn-sm btn-icon" onClick={() => openEdit(c)}><FaEdit /></button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(c.id)}><FaTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={attachModalOpen}
        onClose={() => setAttachModalOpen(false)}
        title="Attach Plan To Class"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setAttachModalOpen(false)}>Cancel</button>
            <button className="btn btn-outline" onClick={openCreateWithPlan}>Create New Class Instead</button>
            <button
              className="btn btn-primary"
              onClick={handleAttachToExistingClass}
              disabled={attaching || classes.length === 0}
            >
              {attaching ? 'Attaching…' : 'Attach To Existing Class'}
            </button>
          </>
        }
      >
        <p style={{ marginTop: 0 }}>
          Plan <strong>{attachPlanName}</strong> was created. You can attach it to an existing class or create a new class.
        </p>
        {attachError && <div className="alert alert-danger">{attachError}</div>}
        <div className="form-group">
          <label>Select Existing Class</label>
          <select
            className="form-control"
            value={selectedExistingClass}
            onChange={(e) => setSelectedExistingClass(e.target.value)}
            disabled={classes.length === 0}
          >
            <option value="">— Select class —</option>
            {sortedClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {classes.length === 0 && (
            <small style={{ color: 'var(--text-muted)' }}>No class exists yet. Use Create New Class Instead.</small>
          )}
        </div>
      </Modal>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Class' : 'Create New Class'}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update Class' : 'Create Class'}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-group form-full">
              <label>Class Name *</label>
              <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. U12 Boys, Senior Team" />
            </div>
            <div className="form-group">
              <label>Center</label>
              <input className="form-control" value={form.center || ''} onChange={e => setForm({ ...form, center: e.target.value })} placeholder="e.g. Main Campus" />
            </div>
            <div className="form-group">
              <label>Level</label>
              <input className="form-control" value={form.level || ''} onChange={e => setForm({ ...form, level: e.target.value })} placeholder="e.g. Beginner, Intermediate, Advanced" />
            </div>
            {editing && (
              <div className="form-group form-full">
                <label>Plan</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    className="form-control"
                    value={planToAdd}
                    onChange={(e) => setPlanToAdd(e.target.value)}
                  >
                    <option value="">— Select plan to add —</option>
                    {sortedPlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.price} {p.currency})
                        {(form.plans || []).includes(p.id) ? ' - already attached' : ''}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-outline" onClick={handleAddPlanToClass}>Add Plan</button>
                </div>
              </div>
            )}
            <div className="form-group">
              <label>Max Students</label>
              <input type="number" min="1" className="form-control" value={form.max_students} onChange={e => setForm({ ...form, max_students: parseInt(e.target.value) })} />
            </div>
            <div className="form-group form-full">
              <label>Assign Coach</label>
              <select className="form-control" value={form.coach} onChange={e => setForm({ ...form, coach: e.target.value })}>
                <option value="">— No coach assigned —</option>
                {sortedCoaches.map(c => <option key={c.id} value={c.id}>{c.full_name || c.username}</option>)}
              </select>
            </div>
            <div className="form-group form-full">
              <label>Description</label>
              <textarea className="form-control" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group form-full">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                Active Class
              </label>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
