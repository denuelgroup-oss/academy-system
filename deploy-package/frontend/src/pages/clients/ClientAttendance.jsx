import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FaUserCheck, FaSave } from 'react-icons/fa';
import api from '../../api/axios';

const STATUS_OPTIONS = ['present', 'absent', 'late', 'excused'];
const STATUS_COLORS = { present: '#16a34a', absent: '#dc2626', late: '#ea580c', excused: '#2563eb' };

export default function ClientAttendance() {
  const location = useLocation();
  const qp = new URLSearchParams(location.search);
  const [date, setDate] = useState(qp.get('date') || new Date().toISOString().slice(0, 10));
  const [filterClass, setFilterClass] = useState(qp.get('class') || '');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadStudents = async () => {
    if (!date) return;
    setLoading(true); setSaved(false);
    try {
      const params = { date };
      if (filterClass) params.academy_class = filterClass;
      const res = await api.get('/attendance/by-date/', { params });
      setStudents(res.data.map(s => ({ ...s, status: s.status || 'present' })));
    } finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadStudents(); }, [date, filterClass]);

  const setStatus = (clientId, status) => {
    setStudents(prev => prev.map(s => s.client_id === clientId ? { ...s, status } : s));
  };

  const markAll = (status) => setStudents(prev => prev.map(s => ({ ...s, status })));

  const handleSave = async () => {
    if (!date || students.length === 0) return;
    setSaving(true); setSaved(false);
    try {
      await api.post('/attendance/bulk-mark/', {
        date,
        records: students.map(s => ({ client_id: s.client_id, status: s.status, notes: s.notes || '' })),
      });
      setSaved(true);
    } finally { setSaving(false); }
  };

  const summary = { present: 0, absent: 0, late: 0, excused: 0 };
  students.forEach(s => { if (summary[s.status] !== undefined) summary[s.status]++; });

  return (
    <div>
      <div className="page-header">
        <h1>Client Attendance</h1>
        <p>Mark attendance for training sessions by class and date</p>
      </div>

      {/* Controls */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          <div className="form-group" style={{ minWidth: 160 }}>
            <label>Date</label>
            <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
      </div>

      {date && (
        <>
          {/* Summary Bar */}
          {students.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              {Object.entries(summary).map(([status, count]) => (
                <div key={status} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[status] }} />
                  <span style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: 13 }}>{status}: {count}</span>
                </div>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                {STATUS_OPTIONS.map(s => <button key={s} className="btn btn-outline btn-sm" onClick={() => markAll(s)} style={{ textTransform: 'capitalize' }}>All {s}</button>)}
              </div>
            </div>
          )}

          <div className="card">
            {loading ? <div className="loading-wrap"><div className="spinner" /><span>Loading students…</span></div> : (
              students.length === 0 ? (
                <div className="empty-state">
                  <div className="icon"><FaUserCheck /></div>
                  <h3>No students found</h3>
                  <p>No active students in this class</p>
                </div>
              ) : (
                <>
                  {saved && <div className="alert alert-success" style={{ marginBottom: 16 }}>✓ Attendance saved successfully!</div>}
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Student Name</th>
                          <th>Attendance Status</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((s, i) => (
                          <tr key={s.client_id}>
                            <td style={{ color: 'var(--text-muted)', width: 40 }}>{i + 1}</td>
                            <td style={{ fontWeight: 600 }}>{s.client_name}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {STATUS_OPTIONS.map(st => (
                                  <button
                                    key={st}
                                    onClick={() => setStatus(s.client_id, st)}
                                    style={{
                                      padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                                      background: s.status === st ? STATUS_COLORS[st] : '#f1f5f9',
                                      color: s.status === st ? '#fff' : 'var(--text-muted)',
                                      textTransform: 'capitalize', transition: 'all .15s',
                                    }}
                                  >
                                    {st}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td>
                              <input
                                className="form-control"
                                style={{ width: 200 }}
                                placeholder="Optional note…"
                                value={s.notes || ''}
                                onChange={e => setStudents(prev => prev.map(x => x.client_id === s.client_id ? { ...x, notes: e.target.value } : x))}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ gap: 8 }}>
                      <FaSave /> {saving ? 'Saving…' : 'Save Attendance'}
                    </button>
                  </div>
                </>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
