import React, { useEffect, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FaChartBar, FaUsers, FaUserCheck, FaDollarSign } from 'react-icons/fa'; // eslint-disable-line no-unused-vars
import api from '../../api/axios';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const COLORS = ['#00a651','#2563eb','#dc2626','#d97706','#7c3aed','#0891b2','#db2777','#65a30d'];
const now = new Date();

const TABS = ['financial', 'clients', 'attendance'];

export default function Reports() {
  const [tab, setTab] = useState('financial');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [financial, setFinancial] = useState(null);
  const [clients, setClients] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadFinancial = async () => {
    setLoading(true);
    try { const r = await api.get('/reports/financial/', { params: { year } }); setFinancial(r.data); }
    finally { setLoading(false); }
  };
  const loadClients = async () => {
    setLoading(true);
    try { const r = await api.get('/reports/clients/', { params: { year } }); setClients(r.data); }
    finally { setLoading(false); }
  };
  const loadAttendance = async () => {
    setLoading(true);
    try { const r = await api.get('/reports/attendance/', { params: { year, month } }); setAttendance(r.data); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (tab === 'financial') loadFinancial();
    else if (tab === 'clients') loadClients();
    else if (tab === 'attendance') loadAttendance();
  }, [tab, year, month]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div><h1>Reports &amp; Analytics</h1><p>Comprehensive data insights for your academy</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'attendance' && (
            <select className="form-control" value={month} onChange={e => setMonth(Number(e.target.value))} style={{ maxWidth: 120 }}>
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          )}
          <select className="form-control" value={year} onChange={e => setYear(Number(e.target.value))} style={{ maxWidth: 100 }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 4, marginBottom: 20, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 24px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600,
            background: tab === t ? 'var(--primary)' : 'transparent',
            color: tab === t ? '#fff' : 'var(--text-muted)',
            textTransform: 'capitalize',
          }}>{t === 'financial' ? 'Financial' : t === 'clients' ? 'Clients' : 'Attendance'}</button>
        ))}
      </div>

      {loading && <div className="loading-wrap"><div className="spinner" /><span>Loading report…</span></div>}

      {/* Financial Report */}
      {tab === 'financial' && financial && !loading && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 16, marginBottom: 20 }}>
            {[
              { label: 'Total Revenue', value: `$${(financial.totals?.total_revenue || 0).toFixed(2)}`, color: '#16a34a' },
              { label: 'Total Expenses', value: `$${(financial.totals?.total_expenses || 0).toFixed(2)}`, color: '#dc2626' },
              { label: 'Net Profit', value: `$${(financial.totals?.total_profit || 0).toFixed(2)}`, color: (financial.totals?.total_profit || 0) >= 0 ? '#16a34a' : '#dc2626' },
            ].map(s => (
              <div key={s.label} className="card" style={{ borderLeft: `4px solid ${s.color}`, padding: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div className="chart-card" style={{ marginBottom: 20 }}>
            <h3>Revenue vs Expenses vs Profit ({year})</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={financial.chart_data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="revenue" stroke="#00a651" fill="#00a65120" name="Revenue" />
                <Area type="monotone" dataKey="expenses" stroke="#dc2626" fill="#dc262620" name="Expenses" />
                <Area type="monotone" dataKey="profit" stroke="#2563eb" fill="#2563eb20" name="Profit" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {financial.expenses_by_category?.length > 0 && (
            <div className="chart-card">
              <h3>Expenses by Category</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={financial.expenses_by_category} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="category" type="category" width={100} style={{ textTransform: 'capitalize' }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Client Report */}
      {tab === 'clients' && clients && !loading && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 20 }}>
            <div className="chart-card">
              <h3>By Status</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={Object.entries(clients.by_status || {}).map(([k, v]) => ({ name: k, value: v }))} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {Object.keys(clients.by_status || {}).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card">
              <h3>By Gender</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={Object.entries(clients.by_gender || {}).map(([k, v]) => ({ name: k, value: v }))} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {Object.keys(clients.by_gender || {}).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card">
              <h3>Enrollment Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={clients.enrollment_trend || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#00a651" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="chart-card">
              <h3>By Plan</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={(clients.by_plan || []).map(p => ({ name: p.plan__name || 'None', count: p.count }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card">
              <h3>By Class</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={(clients.by_class || []).map(c => ({ name: c.academy_class__name || 'None', count: c.count }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Report */}
      {tab === 'attendance' && attendance && !loading && (
        <div>
          {attendance.client_attendance?.summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 16, marginBottom: 20 }}>
              {Object.entries(attendance.client_attendance.summary).map(([k, v], i) => (
                <div key={k} className="card" style={{ borderLeft: `4px solid ${COLORS[i % COLORS.length]}`, padding: 20 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{k}</div>
                  <div style={{ fontSize: 26, fontWeight: 700 }}>{v}</div>
                </div>
              ))}
            </div>
          )}
          {attendance.client_attendance?.by_class?.length > 0 && (
            <div className="chart-card" style={{ marginBottom: 20 }}>
              <h3>Attendance by Class</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={attendance.client_attendance.by_class}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="academy_class__name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="present" fill="#16a34a" stackId="a" />
                  <Bar dataKey="absent" fill="#dc2626" stackId="a" />
                  <Bar dataKey="late" fill="#ea580c" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {attendance.staff_attendance?.length > 0 && (
            <div className="chart-card">
              <h3>Staff Attendance Summary</h3>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Name</th><th>Present</th><th>Absent</th><th>Late</th><th>On Leave</th></tr></thead>
                  <tbody>
                    {attendance.staff_attendance.map((s, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{s.staff__first_name} {s.staff__last_name}</td>
                        <td style={{ color: '#16a34a', fontWeight: 600 }}>{s.present || 0}</td>
                        <td style={{ color: '#dc2626', fontWeight: 600 }}>{s.absent || 0}</td>
                        <td style={{ color: '#ea580c', fontWeight: 600 }}>{s.late || 0}</td>
                        <td style={{ color: '#7c3aed', fontWeight: 600 }}>{s.on_leave || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
