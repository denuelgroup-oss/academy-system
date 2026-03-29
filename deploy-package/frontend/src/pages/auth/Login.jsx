import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FaFutbol, FaEye, FaEyeSlash } from 'react-icons/fa';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate('/');
    } catch {
      setError('Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0d1b2a 0%, #1a2d42 50%, #0d2a1a 100%)',
      padding: 16,
    }}>
      {/* Decorative circles */}
      <div style={{ position: 'absolute', top: 80, left: 80, width: 200, height: 200, borderRadius: '50%', background: 'rgba(0,166,81,.06)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 80, right: 80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(37,99,235,.05)', pointerEvents: 'none' }} />

      <div style={{
        background: '#fff', borderRadius: 20, padding: '44px 40px',
        width: '100%', maxWidth: 420, boxShadow: '0 25px 60px rgba(0,0,0,.35)',
        position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, background: 'var(--green)', borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', fontSize: 30, color: '#fff', boxShadow: '0 8px 24px rgba(0,166,81,.35)',
          }}>
            <FaFutbol />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--dark)', letterSpacing: -.5 }}>
            Academy<span style={{ color: 'var(--green)' }}>PRO</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 4 }}>
            Football Academy Management System
          </p>
        </div>

        {error && (
          <div className="alert alert-danger">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>Username</label>
            <input
              type="text"
              className="form-control"
              placeholder="Enter your username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              autoFocus
            />
          </div>
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                className="form-control"
                placeholder="Enter your password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                {showPw ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '11px 0', fontSize: 15 }}
            disabled={loading}
          >
            {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Signing in…</> : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} AcademyPRO. All rights reserved.
        </p>
      </div>
    </div>
  );
}
