import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FaTachometerAlt, FaLayerGroup, FaUsers, FaCalendarAlt, FaUserCheck,
  FaSync, FaFileInvoiceDollar, FaMoneyBillWave, FaClock,
  FaUserCog, FaDollarSign, FaChartBar,
  FaCog, FaFutbol, FaChevronDown, FaChevronRight,
} from 'react-icons/fa';
import { MdAttachMoney } from 'react-icons/md';

const NavSection = ({ title, children }) => (
  <div>
    <div className="sidebar-section-title">{title}</div>
    {children}
  </div>
);

const NavItem = ({ to, icon, label }) => (
  <NavLink to={to} className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
    <span className="icon">{icon}</span>
    <span>{label}</span>
  </NavLink>
);

// eslint-disable-next-line no-unused-vars
const CollapseSection = ({ title, icon, children, basePaths }) => {
  const location = useLocation();
  const isActive = basePaths.some((p) => location.pathname.startsWith(p));
  const [open, setOpen] = useState(isActive);

  return (
    <div>
      <div
        className={`sidebar-item${isActive ? ' active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        style={{ justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="icon">{icon}</span>
          <span>{title}</span>
        </span>
        <span style={{ fontSize: 11 }}>{open ? <FaChevronDown /> : <FaChevronRight />}</span>
      </div>
      {open && <div style={{ paddingLeft: 12 }}>{children}</div>}
    </div>
  );
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const initials = user ? (user.full_name || user.username || 'U').slice(0, 2).toUpperCase() : 'U';

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon"><FaFutbol /></div>
        <div className="sidebar-logo-text">Academy<span>PRO</span></div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <NavSection title="Main">
          <NavItem to="/"       icon={<FaTachometerAlt />} label="Dashboard" />
          <NavItem to="/plans"  icon={<FaLayerGroup />}    label="Plans" />
        </NavSection>

        <NavSection title="Academy">
          <NavItem to="/classes"          icon={<FaFutbol />}      label="Classes" />
          <NavItem to="/classes/schedule" icon={<FaCalendarAlt />} label="Class Schedule" />
          <NavItem to="/clients"          icon={<FaUsers />}       label="Clients" />
          <NavItem to="/clients/attendance" icon={<FaUserCheck />} label="Client Attendance" />
          <NavItem to="/clients/renewals"   icon={<FaSync />}      label="Client Renewals" />
        </NavSection>

        <NavSection title="Sales">
          <NavItem to="/sales/invoices" icon={<FaFileInvoiceDollar />} label="Invoices" />
          <NavItem to="/sales/payments" icon={<FaMoneyBillWave />}     label="Received Payments" />
          <NavItem to="/sales/pending"  icon={<FaClock />}             label="Pending Payments" />
        </NavSection>

        <NavSection title="Staff">
          <NavItem to="/staff/attendance" icon={<FaUserCheck />} label="Staff Attendance" />
          <NavItem to="/staff/users"      icon={<FaUserCog />}   label="Users" />
          <NavItem to="/staff/salary"     icon={<FaDollarSign />} label="Salary" />
        </NavSection>

        <NavSection title="Finance">
          <NavItem to="/expenses" icon={<MdAttachMoney />} label="Expenses" />
        </NavSection>

        <NavSection title="Analytics">
          <NavItem to="/reports"  icon={<FaChartBar />} label="Reports" />
        </NavSection>

        <NavSection title="System">
          <NavItem to="/settings" icon={<FaCog />} label="Settings" />
        </NavSection>
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.full_name || user?.username}</div>
            <div className="sidebar-user-role">{user?.role || 'admin'}</div>
          </div>
          <button
            onClick={logout}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', fontSize: 14, cursor: 'pointer', marginLeft: 4 }}
            title="Logout"
          >⏻</button>
        </div>
      </div>
    </aside>
  );
}
