import React from 'react';
import { useLocation } from 'react-router-dom';
import { FaBell, FaFutbol } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';

const TITLES = {
  '/':                    'Dashboard',
  '/plans':               'Plans',
  '/classes':             'Classes',
  '/classes/schedule':    'Class Schedule',
  '/clients':             'Clients',
  '/clients/attendance':  'Client Attendance',
  '/clients/renewals':    'Client Renewals',
  '/sales/invoices':      'Invoices',
  '/sales/payments':      'Received Payments',
  '/sales/pending':       'Pending Payments',
  '/staff/attendance':    'Staff Attendance',
  '/staff/users':         'System Users',
  '/staff/salary':        'Salary Management',
  '/expenses':            'Expenses',
  '/reports':             'Reports & Analytics',
  '/settings':            'Settings',
};

export default function Navbar() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const title = pathname.startsWith('/clients/') && pathname !== '/clients/attendance' && pathname !== '/clients/renewals'
    ? 'Client Profile'
    : (TITLES[pathname] || 'AcademyPRO');
  const initials = user ? (user.full_name || user.username || 'U').slice(0, 2).toUpperCase() : 'U';

  return (
    <header className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--green)', fontSize: 18 }}><FaFutbol /></span>
        <span className="navbar-title">{title}</span>
      </div>
      <div className="navbar-right">
        <button className="navbar-btn" title="Notifications">
          <FaBell />
        </button>
        <div className="navbar-user">
          <div className="navbar-avatar">{initials}</div>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{user?.full_name || user?.username}</span>
        </div>
      </div>
    </header>
  );
}
