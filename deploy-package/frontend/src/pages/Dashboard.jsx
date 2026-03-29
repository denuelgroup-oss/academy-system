import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  FaUsers, FaFileInvoiceDollar, FaDollarSign, FaExclamationTriangle,
  FaSync, FaArrowRight,
} from 'react-icons/fa';
import { MdTrendingDown } from 'react-icons/md';
import api from '../api/axios';
import StatCard from '../components/common/StatCard';

const PIE_COLORS = ['#00a651', '#2563eb', '#f59e0b', '#ef4444', '#7c3aed', '#0891b2'];

export default function Dashboard() {
  const [kpi, setKpi] = useState(null);
  const [financial, setFinancial] = useState(null);
  const [clientReport, setClientReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/reports/dashboard/'),
      api.get('/reports/financial/'),
      api.get('/reports/clients/'),
    ]).then(([k, f, c]) => {
      setKpi(k.data);
      setFinancial(f.data);
      setClientReport(c.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="loading-wrap"><div className="spinner" /><span>Loading dashboard…</span></div>
  );

  const finance = kpi?.finance || {};
  const clients = kpi?.clients || {};
  const invoices = kpi?.invoices || {};

  const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v || 0);

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back! Here's what's happening at AcademyPRO today.</p>
      </div>

      {/* KPI Cards */}
      <div className="stat-grid">
        <StatCard
          label="Active Clients"
          value={clients.total_active ?? 0}
          sub={`+${clients.new_this_month ?? 0} this month`}
          icon={<FaUsers />}
          colorClass="stat-green"
        />
        <StatCard
          label="Revenue This Month"
          value={fmt(finance.revenue_this_month)}
          sub={`Profit: ${fmt(finance.profit_this_month)}`}
          icon={<FaDollarSign />}
          colorClass="stat-blue"
        />
        <StatCard
          label="Pending Payments"
          value={fmt(finance.pending_amount)}
          sub={`${invoices.pending_count} invoice(s) pending`}
          icon={<FaFileInvoiceDollar />}
          colorClass="stat-warn"
        />
        <StatCard
          label="Expiring Soon"
          value={clients.expiring_soon ?? 0}
          sub="Subscriptions in 30 days"
          icon={<FaSync />}
          colorClass="stat-danger"
        />
        <StatCard
          label="Expenses This Month"
          value={fmt(finance.expenses_this_month)}
          sub="All categories"
          icon={<MdTrendingDown />}
          colorClass="stat-purple"
        />
        <StatCard
          label="Overdue Invoices"
          value={invoices.overdue_count ?? 0}
          sub="Require immediate action"
          icon={<FaExclamationTriangle />}
          colorClass="stat-danger"
        />
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Revenue vs Expenses */}
        <div className="chart-card">
          <div className="card-title" style={{ marginBottom: 20 }}>Revenue vs Expenses ({financial?.year})</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={financial?.chart_data || []} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00a651" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#00a651" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend />
              <Area type="monotone" dataKey="revenue" stroke="#00a651" fill="url(#colorRev)" name="Revenue" strokeWidth={2} />
              <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="url(#colorExp)" name="Expenses" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Clients by Status */}
        <div className="chart-card">
          <div className="card-title" style={{ marginBottom: 20 }}>Clients by Status</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={clientReport?.by_status || []}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ status, count }) => `${status}: ${count}`}
                labelLine={false}
              >
                {(clientReport?.by_status || []).map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Profit Bar */}
        <div className="chart-card">
          <div className="card-title" style={{ marginBottom: 20 }}>Monthly Profit ({financial?.year})</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={financial?.chart_data || []} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Bar dataKey="profit" name="Profit" radius={[4, 4, 0, 0]}>
                {(financial?.chart_data || []).map((entry, i) => (
                  <Cell key={i} fill={entry.profit >= 0 ? '#00a651' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Clients by Plan */}
        <div className="chart-card">
          <div className="card-title" style={{ marginBottom: 20 }}>Clients by Plan</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={clientReport?.by_plan || []}
              layout="vertical"
              margin={{ top: 5, right: 20, bottom: 0, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="plan__name" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Bar dataKey="count" name="Clients" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Links */}
      <div className="card">
        <div className="card-title">Quick Actions</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { to: '/clients', label: 'Add Client', color: 'var(--green)' },
            { to: '/sales/invoices', label: 'Create Invoice', color: 'var(--blue)' },
            { to: '/clients/attendance', label: 'Mark Attendance', color: '#7c3aed' },
            { to: '/clients/renewals', label: 'Check Renewals', color: '#f59e0b' },
            { to: '/reports', label: 'View Reports', color: '#0891b2' },
          ].map(({ to, label, color }) => (
            <Link
              key={to}
              to={to}
              className="btn"
              style={{ background: color, color: '#fff', gap: 6 }}
            >
              {label} <FaArrowRight style={{ fontSize: 11 }} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
