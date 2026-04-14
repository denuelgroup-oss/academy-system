import React, { useEffect, useState, useCallback } from 'react';
import { FaPlus, FaEdit, FaTrash, FaMoneyBillWave } from 'react-icons/fa';
import api from '../../api/axios';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const now = new Date();
const EMPTY = { staff: '', month: now.getMonth() + 1, year: now.getFullYear(), base_amount: '', bonus: 0, deductions: 0, currency: 'USD', payment_date: '', status: 'pending', notes: '' };

export default function Salary() {
  const [salaries, setSalaries] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/staff/salary/', { params: { month, year } });
      setSalaries(r.data.results || r.data);
    } finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/auth/users/?page_size=200').then(r => setStaff(r.data.results || r.data)); }, []);

  const openCreate = () => { setEditData(null); setForm({ ...EMPTY, month, year }); setErrors({}); setShowModal(true); };
  const openEdit = (s) => { setEditData(s); setForm({ ...s }); setErrors({}); setShowModal(true); };
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.staff) e.staff = 'Required';
    if (!form.base_amount) e.base_amount = 'Required';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editData) await api.put(`/staff/salary/${editData.id}/`, form);
      else await api.post('/staff/salary/', form);
      setShowModal(false); load();
    } catch (err) {
      if (err.response?.data) setErrors(err.response.data);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete salary record?')) return;
    await api.delete(`/staff/salary/${id}/`); load();
  };

  const totalPaid = salaries.filter(s => s.status === 'paid').reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
  const totalPending = salaries.filter(s => s.status === 'pending').reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
  const sortedSalaries = [...salaries].sort((a, b) =>
    String(a?.staff_name || '').localeCompare(String(b?.staff_name || ''), undefined, { sensitivity: 'base' })
  );
  const sortedStaff = [...staff].sort((a, b) => {
    const nameA = `${a?.first_name || ''} ${a?.last_name || ''}`.trim() || a?.username || '';
    const nameB = `${b?.first_name || ''} ${b?.last_name || ''}`.trim() || b?.username || '';
    return String(nameA).localeCompare(String(nameB), undefined, { sensitivity: 'base' });
  });

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div><h1>Salary Management</h1><p>Manage monthly staff salaries</p></div>
        <button className="btn btn-primary" onClick={openCreate}><FaPlus /> Add Salary</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ borderLeft: '4px solid #16a34a', padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Paid</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#16a34a' }}>${totalPaid.toFixed(2)}</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #d97706', padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Pending</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#d97706' }}>${totalPending.toFixed(2)}</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #2563eb', padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Records</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{salaries.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          <select className="form-control" value={month} onChange={e => setMonth(Number(e.target.value))} style={{ maxWidth: 140 }}>
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select className="form-control" value={year} onChange={e => setYear(Number(e.target.value))} style={{ maxWidth: 100 }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {loading ? <div className="loading-wrap"><div className="spinner" /></div> : (
          salaries.length === 0 ? (
            <div className="empty-state"><div className="icon"><FaMoneyBillWave /></div><h3>No records for {MONTHS[month - 1]} {year}</h3></div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Staff Member</th><th>Base</th><th>Bonus</th><th>Deductions</th><th>Total</th><th>Currency</th><th>Payment Date</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {sortedSalaries.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.staff_name}</td>
                      <td>{s.base_amount}</td>
                      <td style={{ color: '#16a34a' }}>+{s.bonus}</td>
                      <td style={{ color: '#dc2626' }}>-{s.deductions}</td>
                      <td style={{ fontWeight: 700 }}>{s.total_amount}</td>
                      <td>{s.currency}</td>
                      <td>{s.payment_date || '—'}</td>
                      <td><StatusBadge status={s.status} /></td>
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-icon" onClick={() => openEdit(s)}><FaEdit /></button>
                          <button className="btn btn-icon btn-danger" onClick={() => handleDelete(s.id)}><FaTrash /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <Modal open={showModal} title={editData ? 'Edit Salary' : 'Add Salary Record'} onClose={() => setShowModal(false)}
        footer={<><button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>}>
        <div className="form-grid">
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label>Staff Member *</label>
            <select className="form-control" value={form.staff} onChange={e => {
              const user = staff.find(u => u.id === parseInt(e.target.value));
              set('staff', e.target.value);
              if (user?.profile?.salary_base) set('base_amount', user.profile.salary_base);
            }}>
              <option value="">— Select Staff —</option>
              {sortedStaff.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name} || @{u.username}</option>)}
            </select>
            {errors.staff && <div className="form-error">{errors.staff}</div>}
          </div>
          <div className="form-group">
            <label>Month</label>
            <select className="form-control" value={form.month} onChange={e => set('month', Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Year</label>
            <select className="form-control" value={form.year} onChange={e => set('year', Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Base Amount *</label>
            <input className="form-control" type="number" step="0.01" value={form.base_amount} onChange={e => set('base_amount', e.target.value)} />
            {errors.base_amount && <div className="form-error">{errors.base_amount}</div>}
          </div>
          <div className="form-group">
            <label>Bonus</label>
            <input className="form-control" type="number" step="0.01" value={form.bonus} onChange={e => set('bonus', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Deductions</label>
            <input className="form-control" type="number" step="0.01" value={form.deductions} onChange={e => set('deductions', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Currency</label>
            <select className="form-control" value={form.currency} onChange={e => set('currency', e.target.value)}>
              <option value="USD">USD</option><option value="CDF">CDF</option><option value="EUR">EUR</option>
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select className="form-control" value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="pending">Pending</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="form-group">
            <label>Payment Date</label>
            <input className="form-control" type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label>Notes</label>
            <textarea className="form-control" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          {(form.base_amount || form.bonus || form.deductions) && (
            <div style={{ gridColumn: '1/-1', background: '#f8fafc', borderRadius: 8, padding: 12, border: '1px solid var(--border)' }}>
              <strong>Total = </strong>{(parseFloat(form.base_amount || 0) + parseFloat(form.bonus || 0) - parseFloat(form.deductions || 0)).toFixed(2)} {form.currency}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
