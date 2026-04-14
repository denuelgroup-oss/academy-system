import React, { useEffect, useState, useCallback } from 'react';
import { FaPlus, FaEdit, FaTrash, FaUsers } from 'react-icons/fa';
import api from '../../api/axios';
import Modal from '../../components/common/Modal';

const ROLES = ['admin', 'coach', 'staff', 'receptionist'];
const EMPTY = { username: '', email: '', first_name: '', last_name: '', password: '', profile: { role: 'staff', phone: '', hire_date: '', salary_base: '' } };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (roleFilter) params.role = roleFilter;
    try {
      const r = await api.get('/auth/users/', { params });
      setUsers(r.data.results || r.data);
    } finally { setLoading(false); }
  }, [search, roleFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditData(null); setForm(EMPTY); setErrors({}); setShowModal(true); };
  const openEdit = (u) => {
    setEditData(u);
    setForm({
      username: u.username, email: u.email, first_name: u.first_name, last_name: u.last_name, password: '',
      profile: { role: u.profile?.role || 'staff', phone: u.profile?.phone || '', hire_date: u.profile?.hire_date || '', salary_base: u.profile?.salary_base || '' },
    });
    setErrors({}); setShowModal(true);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setProfile = (k, v) => setForm(f => ({ ...f, profile: { ...f.profile, [k]: v } }));

  const validate = () => {
    const e = {};
    if (!form.username) e.username = 'Required';
    if (!form.email) e.email = 'Required';
    if (!editData && !form.password) e.password = 'Required for new users';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const payload = { ...form };
    if (!payload.password) delete payload.password;
    try {
      if (editData) await api.put(`/auth/users/${editData.id}/`, payload);
      else await api.post('/auth/users/', payload);
      setShowModal(false); load();
    } catch (err) {
      if (err.response?.data) setErrors(err.response.data);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    await api.delete(`/auth/users/${id}/`); load();
  };

  const getRoleColor = (role) => ({ admin: '#dc2626', coach: '#16a34a', staff: '#2563eb', receptionist: '#7c3aed' }[role] || '#6b7280');
  const sortedUsers = [...users].sort((a, b) => {
    const nameA = `${a?.first_name || ''} ${a?.last_name || ''}`.trim() || a?.username || '';
    const nameB = `${b?.first_name || ''} ${b?.last_name || ''}`.trim() || b?.username || '';
    return String(nameA).localeCompare(String(nameB), undefined, { sensitivity: 'base' });
  });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div><h1>System Users</h1><p>Manage staff accounts and roles</p></div>
        <button className="btn btn-primary" onClick={openCreate}><FaPlus /> Add User</button>
      </div>

      <div className="card">
        <div className="filter-bar">
          <input className="form-control" placeholder="Search name or username…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 260 }} />
          <select className="form-control" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ maxWidth: 160 }}>
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r} style={{ textTransform: 'capitalize' }}>{r}</option>)}
          </select>
        </div>

        {loading ? <div className="loading-wrap"><div className="spinner" /></div> : (
          users.length === 0 ? (
            <div className="empty-state"><div className="icon"><FaUsers /></div><h3>No users found</h3></div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Phone</th><th>Hire Date</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {sortedUsers.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: getRoleColor(u.profile?.role), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                            {(u.first_name?.[0] || u.username[0]).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600 }}>{u.first_name} {u.last_name}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>@{u.username}</td>
                      <td>{u.email}</td>
                      <td><span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: getRoleColor(u.profile?.role) + '20', color: getRoleColor(u.profile?.role), textTransform: 'capitalize' }}>{u.profile?.role || '—'}</span></td>
                      <td>{u.profile?.phone || '—'}</td>
                      <td>{u.profile?.hire_date || '—'}</td>
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-icon" onClick={() => openEdit(u)}><FaEdit /></button>
                          <button className="btn btn-icon btn-danger" onClick={() => handleDelete(u.id)}><FaTrash /></button>
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

      <Modal open={showModal} title={editData ? 'Edit User' : 'Add User'} onClose={() => setShowModal(false)}
        footer={<><button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>}>
        <div className="form-grid">
          <div className="form-group">
            <label>First Name</label>
            <input className="form-control" value={form.first_name} onChange={e => set('first_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Last Name</label>
            <input className="form-control" value={form.last_name} onChange={e => set('last_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Username *</label>
            <input className="form-control" value={form.username} onChange={e => set('username', e.target.value)} />
            {errors.username && <div className="form-error">{errors.username}</div>}
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input className="form-control" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            {errors.email && <div className="form-error">{errors.email}</div>}
          </div>
          <div className="form-group">
            <label>Password {editData ? '(leave blank to keep)' : '*'}</label>
            <input className="form-control" type="password" value={form.password} onChange={e => set('password', e.target.value)} />
            {errors.password && <div className="form-error">{errors.password}</div>}
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input className="form-control" value={form.profile.phone} onChange={e => setProfile('phone', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select className="form-control" value={form.profile.role} onChange={e => setProfile('role', e.target.value)}>
              {ROLES.map(r => <option key={r} value={r} style={{ textTransform: 'capitalize' }}>{r}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Hire Date</label>
            <input className="form-control" type="date" value={form.profile.hire_date} onChange={e => setProfile('hire_date', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Base Salary</label>
            <input className="form-control" type="number" step="0.01" value={form.profile.salary_base} onChange={e => setProfile('salary_base', e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
