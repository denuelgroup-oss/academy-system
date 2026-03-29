import React, { useEffect, useState } from 'react';
import { FaPlus, FaEdit, FaTrash, FaSave, FaCog } from 'react-icons/fa';
import api from '../../api/axios';
import Modal from '../../components/common/Modal';

export default function Settings() {
  const [tab, setTab] = useState('system');
  const [settings, setSettings] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editData, setEditData] = useState(null);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [systemEdits, setSystemEdits] = useState({});
  const [savingSystem, setSavingSystem] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [s, c, r] = await Promise.all([
        api.get('/settings/system/'),
        api.get('/settings/currencies/'),
        api.get('/settings/exchange-rates/'),
      ]);
      setSettings(s.data.results || s.data);
      setCurrencies(c.data.results || c.data);
      setRates(r.data.results || r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadSettings(); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openModal = (type, data = null) => {
    setModalType(type);
    setEditData(data);
    if (type === 'currency') setForm(data ? { ...data } : { code: '', name: '', symbol: '', is_base: false });
    if (type === 'rate') setForm(data ? { ...data } : { from_currency: '', to_currency: '', rate: '', effective_date: new Date().toISOString().slice(0, 10) });
    if (type === 'setting') setForm(data ? { ...data } : { key: '', value: '', description: '' });
    setErrors({}); setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const endpointMap = { currency: '/settings/currencies/', rate: '/settings/exchange-rates/', setting: '/settings/system/' };
      const ep = endpointMap[modalType];
      if (editData) await api.put(`${ep}${editData.id}/`, form);
      else await api.post(ep, form);
      setShowModal(false); loadSettings();
    } catch (err) {
      if (err.response?.data) setErrors(err.response.data);
    } finally { setSaving(false); }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Delete this entry?')) return;
    const endpointMap = { currency: '/settings/currencies/', rate: '/settings/exchange-rates/', setting: '/settings/system/' };
    await api.delete(`${endpointMap[type]}${id}/`); loadSettings();
  };

  const handleSystemSave = async () => {
    setSavingSystem(true);
    try {
      await Promise.all(Object.entries(systemEdits).map(([id, value]) =>
        api.patch(`/settings/system/${id}/`, { value })
      ));
      setSystemEdits({}); loadSettings();
    } finally { setSavingSystem(false); }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Configure system preferences, currencies and exchange rates</p>
      </div>

      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 4, marginBottom: 20, width: 'fit-content' }}>
        {[['system', 'System Settings'], ['currencies', 'Currencies'], ['exchange_rates', 'Exchange Rates']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600,
            background: tab === t ? 'var(--primary)' : 'transparent',
            color: tab === t ? '#fff' : 'var(--text-muted)',
          }}>{label}</button>
        ))}
      </div>

      {loading && <div className="loading-wrap"><div className="spinner" /></div>}

      {/* System Settings */}
      {tab === 'system' && !loading && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3>System Configuration</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {Object.keys(systemEdits).length > 0 && (
                <button className="btn btn-primary" onClick={handleSystemSave} disabled={savingSystem}>
                  <FaSave /> {savingSystem ? 'Saving…' : 'Save Changes'}
                </button>
              )}
              <button className="btn btn-outline" onClick={() => openModal('setting')}><FaPlus /> Add</button>
            </div>
          </div>
          {settings.length === 0 ? (
            <div className="empty-state"><div className="icon"><FaCog /></div><h3>No system settings configured</h3></div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {settings.map(s => (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '200px 1fr auto', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.key}</div>
                    {s.description && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.description}</div>}
                  </div>
                  <input className="form-control" value={systemEdits[s.id] ?? s.value}
                    onChange={e => setSystemEdits(prev => ({ ...prev, [s.id]: e.target.value }))} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-icon" onClick={() => openModal('setting', s)}><FaEdit /></button>
                    <button className="btn btn-icon btn-danger" onClick={() => handleDelete('setting', s.id)}><FaTrash /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Currencies */}
      {tab === 'currencies' && !loading && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3>Currencies</h3>
            <button className="btn btn-outline" onClick={() => openModal('currency')}><FaPlus /> Add Currency</button>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Code</th><th>Name</th><th>Symbol</th><th>Base Currency</th><th>Actions</th></tr></thead>
              <tbody>
                {currencies.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700 }}>{c.code}</td>
                    <td>{c.name}</td>
                    <td>{c.symbol}</td>
                    <td>{c.is_base ? <span className="badge badge-active">Base</span> : <span className="badge" style={{ background: '#f1f5f9', color: '#6b7280' }}>—</span>}</td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-icon" onClick={() => openModal('currency', c)}><FaEdit /></button>
                        <button className="btn btn-icon btn-danger" onClick={() => handleDelete('currency', c.id)}><FaTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Exchange Rates */}
      {tab === 'exchange_rates' && !loading && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3>Exchange Rates</h3>
            <button className="btn btn-outline" onClick={() => openModal('rate')}><FaPlus /> Add Rate</button>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>From</th><th>To</th><th>Rate</th><th>Effective Date</th><th>Actions</th></tr></thead>
              <tbody>
                {rates.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 700 }}>{r.from_currency_code}</td>
                    <td style={{ fontWeight: 700 }}>{r.to_currency_code}</td>
                    <td style={{ fontWeight: 600, color: '#2563eb' }}>{r.rate}</td>
                    <td>{r.effective_date}</td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-icon" onClick={() => openModal('rate', r)}><FaEdit /></button>
                        <button className="btn btn-icon btn-danger" onClick={() => handleDelete('rate', r.id)}><FaTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generic Modal */}
      <Modal open={showModal} title={
        modalType === 'currency' ? (editData ? 'Edit Currency' : 'Add Currency') :
        modalType === 'rate' ? (editData ? 'Edit Rate' : 'Add Exchange Rate') :
        (editData ? 'Edit Setting' : 'Add Setting')
      } onClose={() => setShowModal(false)}
        footer={<><button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>}>

        {modalType === 'currency' && (
          <div className="form-grid">
            <div className="form-group"><label>Code</label><input className="form-control" maxLength={5} style={{ textTransform: 'uppercase' }} value={form.code || ''} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="USD" />{errors.code && <div className="form-error">{errors.code}</div>}</div>
            <div className="form-group"><label>Name</label><input className="form-control" value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="US Dollar" /></div>
            <div className="form-group"><label>Symbol</label><input className="form-control" value={form.symbol || ''} onChange={e => set('symbol', e.target.value)} placeholder="$" /></div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
              <input type="checkbox" id="is_base" checked={!!form.is_base} onChange={e => set('is_base', e.target.checked)} />
              <label htmlFor="is_base" style={{ marginBottom: 0 }}>Set as base currency</label>
            </div>
          </div>
        )}

        {modalType === 'rate' && (
          <div className="form-grid">
            <div className="form-group">
              <label>From Currency</label>
              <select className="form-control" value={form.from_currency || ''} onChange={e => set('from_currency', e.target.value)}>
                <option value="">— Select —</option>
                {currencies.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>To Currency</label>
              <select className="form-control" value={form.to_currency || ''} onChange={e => set('to_currency', e.target.value)}>
                <option value="">— Select —</option>
                {currencies.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Rate</label><input className="form-control" type="number" step="0.0001" value={form.rate || ''} onChange={e => set('rate', e.target.value)} /></div>
            <div className="form-group"><label>Effective Date</label><input className="form-control" type="date" value={form.effective_date || ''} onChange={e => set('effective_date', e.target.value)} /></div>
          </div>
        )}

        {modalType === 'setting' && (
          <div className="form-grid">
            <div className="form-group"><label>Key</label><input className="form-control" value={form.key || ''} onChange={e => set('key', e.target.value)} placeholder="academy_name" /></div>
            <div className="form-group"><label>Value</label><input className="form-control" value={form.value || ''} onChange={e => set('value', e.target.value)} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Description</label><input className="form-control" value={form.description || ''} onChange={e => set('description', e.target.value)} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
