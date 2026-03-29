import React, { useEffect, useState } from 'react';
import { FaUserTie, FaSave } from 'react-icons/fa';
import api from '../../api/axios';

const STATUS_OPTIONS = ['present', 'absent', 'late', 'excused', 'on_leave'];
const STATUS_COLORS = { present: '#16a34a', absent: '#dc2626', late: '#ea580c', excused: '#2563eb', on_leave: '#7c3aed' };

export default function StaffAttendance() {
  const [staff, setStaff] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/auth/users/?page_size=200').then(r => {
      const data = r.data.results || r.data;
      setStaff(data.filter(u => u.profile?.role !== undefined));
    });
  }, []);

  useEffect(() => {
    if (!staff.length || !date) return;
    setLoading(true); setSaved(false);
    api.get('/staff/attendance/by-date/', { params: { date } })
      .then(r => {
        const existing = {};
        (r.data || []).forEach(rec => { existing[rec.staff] = { status: rec.status, notes: rec.notes || '' }; });
        setRecords(staff.map(u => ({
          staff_id: u.id,
          name: `${u.first_name} ${u.last_name}`.trim() || u.username,
          role: u.profile?.role || 'staff',
          status: existing[u.id]?.status || 'present',
          notes: existing[u.id]?.notes || '',
        })));
      })
      .finally(() => setLoading(false));
  }, [date, staff]);

  const setStatus = (staffId, status) => setRecords(prev => prev.map(r => r.staff_id === staffId ? { ...r, status } : r));

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    try {
      await Promise.all(records.map(r =>
        api.post('/staff/attendance/', { staff: r.staff_id, date, status: r.status, notes: r.notes })
          .catch(() => null)
      ));
      setSaved(true);
    } finally { setSaving(false); }
  };

  const summary = { present: 0, absent: 0, late: 0, excused: 0, on_leave: 0 };
  records.forEach(r => { if (summary[r.status] !== undefined) summary[r.status]++; });

  return (
    <div>
      <div className="page-header">
        <h1>Staff Attendance</h1>
        <p>Mark daily attendance for all staff members</p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          <div className="form-group" style={{ minWidth: 200 }}>
            <label>Date</label>
            <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {STATUS_OPTIONS.map(s => (
              <button key={s} className="btn btn-outline btn-sm" onClick={() => setRecords(prev => prev.map(r => ({ ...r, status: s })))}
                style={{ textTransform: 'capitalize' }}>All {s.replace('_', ' ')}</button>
            ))}
          </div>
        </div>
      </div>

      {records.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {Object.entries(summary).filter(([, v]) => v > 0).map(([status, count]) => (
            <div key={status} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[status] }} />
              <span style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: 13 }}>{status.replace('_', ' ')}: {count}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        {loading ? <div className="loading-wrap"><div className="spinner" /></div> : (
          records.length === 0 ? (
            <div className="empty-state"><div className="icon"><FaUserTie /></div><h3>No staff members found</h3></div>
          ) : (
            <>
              {saved && <div className="alert alert-success" style={{ marginBottom: 16 }}>✓ Staff attendance saved!</div>}
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>#</th><th>Name</th><th>Role</th><th>Status</th><th>Notes</th></tr>
                  </thead>
                  <tbody>
                    {records.map((r, i) => (
                      <tr key={r.staff_id}>
                        <td style={{ color: 'var(--text-muted)', width: 40 }}>{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{r.name}</td>
                        <td><span className={`badge badge-${r.role === 'coach' ? 'coach' : 'admin'}`} style={{ textTransform: 'capitalize' }}>{r.role}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {STATUS_OPTIONS.map(st => (
                              <button key={st} onClick={() => setStatus(r.staff_id, st)} style={{
                                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                                background: r.status === st ? STATUS_COLORS[st] : '#f1f5f9',
                                color: r.status === st ? '#fff' : 'var(--text-muted)',
                                textTransform: 'capitalize', transition: 'all .15s',
                              }}>{st.replace('_', ' ')}</button>
                            ))}
                          </div>
                        </td>
                        <td>
                          <input className="form-control" style={{ width: 180 }} placeholder="Note…"
                            value={r.notes} onChange={e => setRecords(prev => prev.map(x => x.staff_id === r.staff_id ? { ...x, notes: e.target.value } : x))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  <FaSave /> {saving ? 'Saving…' : 'Save Attendance'}
                </button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
