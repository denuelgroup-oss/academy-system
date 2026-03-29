import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaCalendarAlt, FaPlus, FaEdit, FaTrash, FaUserCheck } from 'react-icons/fa';
import api from '../../api/axios';
import Modal from '../../components/common/Modal';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_OPTIONS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DEFAULT_SCHEDULE = {
  academy_class: '',
  day_of_week: 'monday',
  start_time: '09:00',
  end_time: '10:00',
  start_date: '',
  end_date: '',
  location: '',
  notes: '',
};

const formatClock = (timeStr) => {
  if (!timeStr) return '-';
  const [hour, minute] = timeStr.split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${suffix}`;
};

const formatLongDate = (dateStr) => {
  if (!dateStr) return 'No date';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
};

const toIsoDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function ClassSchedule() {
  const [schedules, setSchedules] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState('tomorrow');
  const [customDate, setCustomDate] = useState(() => toIsoDate(new Date()));
  const [filterCenter, setFilterCenter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(DEFAULT_SCHEDULE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const autoOpenedRef = useRef(false);

  const selectedDate = useMemo(() => {
    if (datePreset === 'custom') {
      const d = new Date(customDate);
      if (!Number.isNaN(d.getTime())) return d;
    }
    const now = new Date();
    const selected = new Date(now);
    if (datePreset === 'tomorrow') selected.setDate(now.getDate() + 1);
    return selected;
  }, [datePreset, customDate]);

  const selectedIsoDate = useMemo(() => toIsoDate(selectedDate), [selectedDate]);
  const selectedDay = DAYS[selectedDate.getDay()];

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('day_of_week', selectedDay);
      if (filterCenter) params.set('academy_class__center', filterCenter);
      const [schRes, classRes] = await Promise.all([
        api.get(`/classes/schedules/?${params}`),
        api.get('/classes/active/'),
      ]);
      setSchedules(schRes.data.results || schRes.data);
      setClasses(classRes.data);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [filterCenter, selectedDay]);

  // Detect ?new_class=<id> from redirect after class creation — auto-open schedule form
  useEffect(() => {
    if (autoOpenedRef.current || classes.length === 0) return;
    const params = new URLSearchParams(location.search);
    const classId = params.get('new_class');
    if (!classId) return;
    autoOpenedRef.current = true;
    const id = parseInt(classId, 10);
    if (classes.some((c) => c.id === id)) {
      setEditing(null);
      setForm({ ...DEFAULT_SCHEDULE, academy_class: String(id) });
      setError('');
      setModalOpen(true);
    }
    navigate('/classes/schedule', { replace: true });
  }, [location.search, classes, navigate]);

  const centers = useMemo(() => {
    const set = new Set(classes.map((c) => c.center).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [classes]);

  const filteredRows = useMemo(() => {
    return schedules
      .filter((s) => {
        const start = s.start_date || '0000-01-01';
        const end = s.end_date || '9999-12-31';
        return start <= selectedIsoDate && selectedIsoDate <= end;
      })
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  }, [schedules, selectedIsoDate]);

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_SCHEDULE);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      academy_class: String(s.academy_class),
      day_of_week: s.day_of_week,
      start_time: s.start_time || '09:00',
      end_time: s.end_time || '10:00',
      start_date: s.start_date || '',
      end_date: s.end_date || '',
      location: s.location || '',
      notes: s.notes || '',
    });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.academy_class) { setError('Please select a class.'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        academy_class: parseInt(form.academy_class, 10),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      if (editing) await api.put(`/classes/schedules/${editing.id}/`, payload);
      else await api.post('/classes/schedules/', payload);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data ? JSON.stringify(err.response.data) : 'Save failed.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this schedule?')) return;
    await api.delete(`/classes/schedules/${id}/`);
    load();
  };

  const centerLabel = filterCenter || 'All Centres';

  return (
    <div>
      <div className="page-header-row">
        <div className="page-header">
          <h1>Class Schedule</h1>
          <p>Manage weekly class timings and sessions</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><FaPlus /> New Schedule</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          <select className="form-control" style={{ width: 170 }} value={datePreset} onChange={(e) => setDatePreset(e.target.value)}>
            <option value="today">Today</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="custom">Custom</option>
          </select>
          {datePreset === 'custom' && (
            <input
              type="date"
              className="form-control"
              style={{ width: 170 }}
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
            />
          )}
          <select className="form-control" style={{ width: 190 }} value={filterCenter} onChange={(e) => setFilterCenter(e.target.value)}>
            <option value="">All centers</option>
            {centers.map((center) => <option key={center} value={center}>{center}</option>)}
          </select>
        </div>
      </div>

      {loading ? <div className="loading-wrap"><div className="spinner" /></div> : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Coach</th>
                  <th>Details</th>
                  <th>Timing</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state">
                        <div className="icon"><FaCalendarAlt /></div>
                        <h3>No classes scheduled</h3>
                        <p>Click "New Schedule" to add timing for a class.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    <tr>
                      <td colSpan={5} style={{ background: 'var(--surface)', fontWeight: 700 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{formatLongDate(selectedIsoDate)}</span>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{filteredRows.length} session(s)</span>
                        </div>
                      </td>
                    </tr>
                    {filteredRows.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ea5d62', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
                              {(s.class_name || 'A').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{s.class_name}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatClock(s.start_time)} - {formatClock(s.end_time)}</div>
                            </div>
                          </div>
                        </td>
                        <td>{s.coach_name || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</td>
                        <td>
                          <div style={{ fontSize: 13 }}>{s.student_count || 0} Students</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.class_center || centerLabel}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: 13 }}>
                            <div>{formatClock(s.start_time)} — {formatClock(s.end_time)}</div>
                            {s.location && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.location}</div>}
                          </div>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="btn btn-sm"
                              style={{ background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}
                              onClick={() => navigate(`/clients/attendance?date=${selectedIsoDate}&class=${s.academy_class}`)}
                              title="Take attendance for this class"
                            >
                              <FaUserCheck /> Take Attendance
                            </button>
                            <button className="btn btn-outline btn-sm btn-icon" onClick={() => openEdit(s)}><FaEdit /></button>
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(s.id)}><FaTrash /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Schedule' : 'New Class Schedule'}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Create Schedule'}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-group form-full">
              <label>Class *</label>
              <select className="form-control" value={form.academy_class} onChange={e => setForm({ ...form, academy_class: e.target.value })} required>
                <option value="">-- Select class --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Day of Week *</label>
              <select className="form-control" value={form.day_of_week} onChange={e => setForm({ ...form, day_of_week: e.target.value })}>
                {DAY_OPTIONS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Location</label>
              <input className="form-control" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Field A" />
            </div>
            <div className="form-group">
              <label>Start Time *</label>
              <input type="time" className="form-control" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>End Time *</label>
              <input type="time" className="form-control" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Start Date</label>
              <input type="date" className="form-control" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input type="date" className="form-control" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <div className="form-group form-full">
              <label>Notes</label>
              <textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
