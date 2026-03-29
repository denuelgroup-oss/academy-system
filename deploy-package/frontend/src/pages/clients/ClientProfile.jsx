import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  FaArrowLeft, FaUser, FaPhone, FaEnvelope, FaMapMarkerAlt,
  FaCalendarAlt, FaUserShield, FaIdCard, FaCheckCircle,
  FaClock, FaStar, FaMoneyBillWave, FaExclamationTriangle,
  FaFileInvoiceDollar, FaChevronDown, FaChevronRight, FaEdit,
} from 'react-icons/fa';
import api from '../../api/axios';
import StatusBadge from '../../components/common/StatusBadge';

const getInitials = (name = '') =>
  name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() || '').join('');

const nameToColor = (name = '') => {
  const colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

export default function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [overview, setOverview] = useState(null);
  const [oneTimePlans, setOneTimePlans] = useState([]);
  const [processingPlanId, setProcessingPlanId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeNav, setActiveNav] = useState('overview');
  const [sectionOpen, setSectionOpen] = useState({ current: true, past: true, upcoming: true });

  const toggleSection = (key) => setSectionOpen(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    const loadClient = async () => {
      setLoading(true);
      try {
        const [clientRes, overviewRes, plansRes] = await Promise.all([
          api.get(`/clients/${id}/`),
          api.get(`/clients/${id}/overview/`),
          api.get('/plans/?plan_type=one_time&is_active=true&page_size=1000'),
        ]);
        setClient(clientRes.data);
        setOverview(overviewRes.data);
        setOneTimePlans(plansRes.data.results || plansRes.data || []);
      } finally {
        setLoading(false);
      }
    };
    loadClient();
  }, [id]);

  if (loading) {
    return (
      <div className="loading-wrap">
        <div className="spinner" />
        <span>Loading client profile...</span>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="card">
        <h3>Client not found</h3>
        <Link to="/clients" className="btn btn-outline" style={{ marginTop: 12 }}>
          <FaArrowLeft /> Back to Clients
        </Link>
      </div>
    );
  }

  const navItems = [
    { key: 'overview', label: 'Overview', tab: 'overview' },
    { key: 'info', label: 'Info', tab: 'info' },
    { key: 'plan', label: 'Plan', tab: 'subscription', editable: true },
    { key: 'pending', label: 'Pending', tab: 'subscription' },
    { key: 'paid', label: 'Paid', tab: 'subscription' },
    { key: 'attendance', label: 'Attendance', tab: 'attendance' },
    { key: 'performance', label: 'Performance', tab: 'attendance' },
  ];

  const avatarColor = nameToColor(client.full_name);
  const attendanceRate = overview?.attendance?.rate ?? 0;
  const daysLeft = client.days_until_expiry;
  const expiryColor = daysLeft != null
    ? (daysLeft <= 7 ? '#ef4444' : daysLeft <= 30 ? '#f59e0b' : '#10b981')
    : '#6b7280';
  const performanceColor = {
    'Excellent': '#10b981', 'Good': '#3b82f6',
    'Average': '#f59e0b', 'Needs Improvement': '#ef4444',
  }[overview?.performance] || '#6b7280';

  const formatMoney = (amount, currency = 'USD') => {
    const value = Number(amount || 0);
    if (Number.isNaN(value)) return `0 ${currency}`;
    return `${value.toFixed(2)} ${currency}`;
  };

  const selectedOneTimePlans = oneTimePlans.filter(
    p => (client?.one_time_plans || []).includes(p.id)
  );
  const oneTimePlansPending = selectedOneTimePlans.reduce((sum, p) => sum + parseFloat(p.price || 0), 0);
  const invoicePending = parseFloat(overview?.pending || 0);
  const totalPendingWithOneTime = invoicePending + oneTimePlansPending;
  const pendingCurrency = client?.plan_detail?.currency || selectedOneTimePlans[0]?.currency || 'USD';

  const processOneTimePlanPayment = async (plan) => {
    if (!client || !plan) return;
    setProcessingPlanId(plan.id);
    try {
      const q = new URLSearchParams({
        client: String(client.id),
        plan: String(plan.id),
        status: 'draft,sent,partial,overdue',
        ordering: '-created_at',
        page_size: '1',
      });
      const existingRes = await api.get(`/sales/invoices/?${q.toString()}`);
      const existing = (existingRes.data.results || existingRes.data || [])[0];

      let invoice = existing;
      if (!invoice) {
        const issueDate = new Date().toISOString().slice(0, 10);
        const dueDate = new Date(Date.now() + (7 * 86400000)).toISOString().slice(0, 10);
        const createRes = await api.post('/sales/invoices/', {
          client: client.id,
          plan: plan.id,
          amount: plan.price,
          currency: plan.currency || pendingCurrency,
          issue_date: issueDate,
          due_date: dueDate,
          status: 'sent',
          notes: `One-time plan payment - ${plan.name}`,
        });
        invoice = createRes.data;
      }

      navigate(`/sales/payments?invoice=${invoice.id}&amount=${invoice.amount_due || plan.price || 0}&currency=${invoice.currency || plan.currency || pendingCurrency}`);
    } finally {
      setProcessingPlanId(null);
    }
  };

  const StatCard = ({ label, value, sub, color, icon }) => (
    <div style={{
      background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)', flex: 1, minWidth: 160,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, background: color + '1a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, fontSize: 18, flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color, marginTop: 2, fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );

  const InfoRow = ({ icon, label, value }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ color: 'var(--primary)', fontSize: 15, marginTop: 2, width: 18, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{value || '-'}</div>
      </div>
    </div>
  );

  const SectionHeader = ({ title }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '20px 0 8px', paddingBottom: 6, borderBottom: '2px solid var(--border)' }}>
      {title}
    </div>
  );

  const GridBox = ({ label, value, valueColor }) => (
    <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: valueColor || 'var(--text-primary)' }}>{value || '-'}</div>
    </div>
  );

  const renderOverview = () => {
    const row = overview?.abonnement_row || {};
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Quick stats */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <StatCard
            label="Plan"
            value={overview?.plan_name || client.plan_detail?.name || '-'}
            icon={<FaIdCard />}
            color="#8b5cf6"
          />
          <StatCard label="Total Paid" value={`${overview?.paid ?? 0}`} icon={<FaMoneyBillWave />} color="#10b981" />
          <StatCard
            label="Pending"
            value={formatMoney(totalPendingWithOneTime, pendingCurrency)}
            icon={<FaExclamationTriangle />}
            color={totalPendingWithOneTime > 0 ? '#ef4444' : '#10b981'}
            sub={`Invoices ${formatMoney(invoicePending, pendingCurrency)} + One-time ${formatMoney(oneTimePlansPending, pendingCurrency)}`}
          />
          <StatCard
            label="Items"
            value={`${overview?.items_count ?? 0}`}
            icon={<FaFileInvoiceDollar />}
            color="#3b82f6"
            sub="invoices"
          />
          <StatCard
            label="Attendance"
            value={`${attendanceRate}%`}
            icon={<FaCheckCircle />}
            color={attendanceRate >= 75 ? '#10b981' : attendanceRate >= 50 ? '#f59e0b' : '#ef4444'}
            sub={`${overview?.attendance?.present ?? 0} / ${overview?.attendance?.total ?? 0} sessions`}
          />
          <StatCard
            label="Days Until Expiry"
            value={daysLeft != null ? `${daysLeft}d` : '-'}
            icon={<FaClock />}
            color={expiryColor}
            sub={client.subscription_end || undefined}
          />
          <StatCard
            label="Performance"
            value={overview?.performance || '-'}
            icon={<FaStar />}
            color={performanceColor}
          />
        </div>

        {/* Subscription summary */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Subscription Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <GridBox label="Plan" value={row.abonnement} />
            <GridBox label="Class" value={row.classe_vacation} />
            <GridBox label="Invoice" value={row.invoice_no} />
            <GridBox label="Due Date" value={row.due_date} />
            <GridBox label="Attendance" value={row.attendance} />
            <GridBox label="Fees" value={row.fees} />
          </div>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Invoice Status:</span>
            <StatusBadge value={row.status || client.status} />
          </div>
        </div>

      </div>
    );
  };

  const renderInfo = () => (
    <div className="card" style={{ marginBottom: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
        <div>
          <SectionHeader title="Personal Details" />
          <InfoRow icon={<FaUser />} label="Full Name" value={client.full_name} />
          <InfoRow icon={<FaIdCard />} label="Gender" value={client.gender === 'M' ? 'Male' : client.gender === 'F' ? 'Female' : client.gender} />
          <InfoRow icon={<FaCalendarAlt />} label="Date of Birth" value={client.date_of_birth} />
          <InfoRow icon={<FaPhone />} label="Phone" value={client.phone} />
          <InfoRow icon={<FaEnvelope />} label="Email" value={client.email} />
          <InfoRow icon={<FaMapMarkerAlt />} label="Address" value={client.address} />
        </div>
        <div>
          <SectionHeader title="Emergency Contact" />
          <InfoRow icon={<FaUserShield />} label="Contact Name" value={client.emergency_contact} />
          <InfoRow icon={<FaPhone />} label="Contact Phone" value={client.emergency_phone} />
          <SectionHeader title="Notes" />
          <div style={{ fontSize: 14, color: 'var(--text-primary)', padding: '10px 0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {client.notes || '-'}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSubscription = () => {
    const row = overview?.abonnement_row || {};
    const normalizeStatus = (value) => String(value || '').trim().toLowerCase();
    const isPaidStatus = (value) => normalizeStatus(value) === 'paid';
    const isPendingStatus = (value) => !isPaidStatus(value);

    const currentRows = [{
      invoiceId: row.invoice_id || null,
      planName: row.abonnement || client.plan_detail?.name || '-',
      periodStart: row.period_start || client.subscription_start || '-',
      periodEnd: row.period_end || client.subscription_end || '-',
      className: row.classe_vacation || client.class_detail?.name || '-',
      invoiceNo: row.invoice_no || '-',
      dueDate: row.due_date || '-',
      attendance: row.attendance || '-',
      fees: row.fees || '-',
      status: row.status || client.status || '-',
    }];

    const mapRow = (r) => ({
      invoiceId: r.invoice_id || null,
      planName: r.abonnement || '-',
      periodStart: r.period_start || '-',
      periodEnd: r.period_end || '-',
      className: r.classe_vacation || '-',
      invoiceNo: r.invoice_no || '-',
      dueDate: r.due_date || '-',
      attendance: r.attendance || '-',
      fees: r.fees || '-',
      status: r.status || '-',
    });

    const pastRows = (overview?.past_rows || []).map(mapRow);
    const upcomingRows = (overview?.upcoming_rows || []).map(mapRow);
    const statusFilter = activeNav === 'paid' ? 'paid' : activeNav === 'pending' ? 'pending' : 'all';
    const applyStatusFilter = (rows) => {
      if (statusFilter === 'paid') return rows.filter(r => isPaidStatus(r.status));
      if (statusFilter === 'pending') return rows.filter(r => isPendingStatus(r.status));
      return rows;
    };

    const filteredCurrentRows = applyStatusFilter(currentRows);
    const filteredUpcomingRows = applyStatusFilter(upcomingRows);
    const filteredPastRows = applyStatusFilter(pastRows);
    const totalPaidAmount = parseFloat(overview?.paid || 0);

    const renderSubRow = (entry) => {
      const parts = String(entry.attendance).split(/[/|]/).map(v => v.trim());
      const leftAttendance = parts[0] || '-';
      const rightAttendance = parts[1] || '-';
      return (
        <div
          key={`${entry.invoiceNo}-${entry.periodStart}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '2.2fr 1.6fr 1fr 1fr 1fr 1fr 0.9fr 0.55fr',
            padding: '8px 12px 9px',
            alignItems: 'center',
            borderBottom: '1px solid #f3f4f6',
            columnGap: 6,
            minWidth: 890,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: '#58b66c',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 13,
            }}>
              {(entry.planName || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', lineHeight: 1.15 }}>{entry.planName}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{entry.periodStart} - {entry.periodEnd}</div>
            </div>
          </div>

          <div style={{ fontSize: 14, color: '#111827' }}>{entry.className}</div>

          <div>
            <div style={{ fontSize: 14, color: '#111827', lineHeight: 1.15 }}>{entry.invoiceNo}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{entry.periodStart}</div>
          </div>

          <div style={{ fontSize: 14, color: '#111827' }}>{entry.dueDate}</div>

          <div style={{ fontSize: 15, fontWeight: 600 }}>
            <span style={{ color: '#10b981' }}>{leftAttendance}</span>
            <span style={{ color: '#9ca3af' }}> | </span>
            <span style={{ color: '#ef4444' }}>{rightAttendance}</span>
          </div>

          <div style={{ fontSize: 15, color: '#ef4444' }}>{entry.fees}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 13, color: '#111827' }}>{entry.status}</div>
            {entry.invoiceNo !== '-' && (
              <Link
                to={`/sales/invoices?invoice=${encodeURIComponent(entry.invoiceNo)}`}
                className="btn btn-outline"
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  minHeight: 'auto',
                  lineHeight: 1.2,
                }}
              >
                Edit
              </Link>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {entry.invoiceId && activeNav !== 'plan' && (
              <Link
                to={`/sales/payments?invoice=${entry.invoiceId}`}
                className="btn"
                title="Process Payment"
                style={{
                  width: 32,
                  height: 32,
                  padding: 0,
                  minHeight: 'auto',
                  lineHeight: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 10,
                  background: '#f97316',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 10px rgba(249,115,22,0.24)',
                }}
              >
                <FaMoneyBillWave style={{ fontSize: 13 }} />
              </Link>
            )}
          </div>
        </div>
      );
    };

    const SectionToggle = ({ sectionKey, label, count, color }) => (
      <button
        type="button"
        onClick={() => toggleSection(sectionKey)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '8px 12px', width: '100%', textAlign: 'left',
          borderTop: '1px solid #f3f4f6',
        }}
      >
        <span style={{ color: '#6b7280', fontSize: 11, transition: 'transform 0.15s' }}>
          {sectionOpen[sectionKey] ? <FaChevronDown /> : <FaChevronRight />}
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{label}</span>
        <span style={{
          fontSize: 11, fontWeight: 600,
          background: color + '1a', color,
          borderRadius: 10, padding: '1px 7px', marginLeft: 2,
        }}>{count}</span>
      </button>
    );

    return (
      <div className="card" style={{ marginBottom: 0, padding: 0, overflow: 'hidden' }}>
        {statusFilter === 'paid' ? (
          <div
            style={{
              margin: 12,
              borderRadius: 12,
              border: '1px solid #86efac',
              background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfeff 100%)',
              padding: '10px 14px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 14,
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FaMoneyBillWave style={{ color: '#15803d' }} />
              <div>
                <div style={{ fontSize: 12, color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Total Paid Amount</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: '#14532d' }}>{formatMoney(totalPaidAmount, pendingCurrency)}</div>
              </div>
            </div>
            <div style={{ color: '#166534', fontSize: 12, fontWeight: 600 }}>
              Collected from paid invoices
            </div>
          </div>
        ) : (
          <div
            style={{
              margin: 12,
              borderRadius: 12,
              border: '1px solid #fed7aa',
              background: 'linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)',
              padding: '10px 14px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 14,
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FaExclamationTriangle style={{ color: '#ea580c' }} />
              <div>
                <div style={{ fontSize: 12, color: '#9a3412', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Total Pending Amount</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: '#7c2d12' }}>{formatMoney(totalPendingWithOneTime, pendingCurrency)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: '#9a3412', fontSize: 12, fontWeight: 600 }}>
              <span>Invoices: {formatMoney(invoicePending, pendingCurrency)}</span>
              <span>One-time plans: {formatMoney(oneTimePlansPending, pendingCurrency)}</span>
            </div>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2.2fr 1.6fr 1fr 1fr 1fr 1fr 0.9fr 0.55fr',
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
            color: '#6b7280',
            fontSize: 11,
            fontWeight: 500,
            background: '#f9fafb',
            minWidth: 890,
          }}>
            <div>Abonnement</div>
            <div>Classe Vacation</div>
            <div>Invoice no.</div>
            <div>Due Date</div>
            <div>Attendance</div>
            <div>Fees</div>
            <div>Status</div>
            <div></div>
          </div>

          <SectionToggle sectionKey="current" label="Current" count={filteredCurrentRows.length} color="#10b981" />
          {sectionOpen.current && (
            filteredCurrentRows.length === 0
              ? <div style={{ padding: '6px 12px 10px', color: '#9ca3af', fontSize: 11 }}>No current subscriptions for this filter.</div>
              : filteredCurrentRows.map(renderSubRow)
          )}

          <SectionToggle sectionKey="upcoming" label="Upcoming" count={filteredUpcomingRows.length} color="#3b82f6" />
          {sectionOpen.upcoming && (
            filteredUpcomingRows.length === 0
              ? <div style={{ padding: '6px 12px 10px', color: '#9ca3af', fontSize: 11 }}>No upcoming subscriptions.</div>
              : filteredUpcomingRows.map(renderSubRow)
          )}

          <SectionToggle sectionKey="past" label="Past" count={filteredPastRows.length} color="#6b7280" />
          {sectionOpen.past && (
            filteredPastRows.length === 0
              ? <div style={{ padding: '6px 12px 10px', color: '#9ca3af', fontSize: 11 }}>No past subscriptions yet.</div>
              : filteredPastRows.map(renderSubRow)
          )}
        </div>

        {client.one_time_plans?.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px 10px' }}>
            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, color: '#374151' }}>
              One-Time Plans
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selectedOneTimePlans.map(plan => (
                <div
                  key={plan.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#eff6ff',
                    color: 'var(--primary)',
                    border: '1px solid #bfdbfe',
                    borderRadius: 20,
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  <span>{plan.name} ({formatMoney(plan.price, plan.currency)})</span>
                  {statusFilter === 'pending' && (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => processOneTimePlanPayment(plan)}
                      disabled={processingPlanId === plan.id}
                      style={{
                        background: '#f97316',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 14,
                        padding: '3px 8px',
                        minHeight: 'auto',
                        fontSize: 10,
                        lineHeight: 1.2,
                        fontWeight: 700,
                      }}
                    >
                      {processingPlanId === plan.id ? 'Processing...' : 'Process Payment'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAttendance = () => {
    const att = overview?.attendance || {};
    const rate = att.rate ?? 0;
    const present = att.present ?? 0;
    const total = att.total ?? 0;
    const absent = total - present;
    const barColor = rate >= 75 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#ef4444';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Attendance Summary</div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Attendance Rate</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: barColor }}>{rate}%</span>
            </div>
            <div style={{ background: '#f3f4f6', borderRadius: 10, height: 12, overflow: 'hidden' }}>
              <div style={{ width: `${rate}%`, background: barColor, height: '100%', borderRadius: 10, transition: 'width 0.4s ease' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              {present} present out of {total} total sessions
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
            {[
              { label: 'Present', value: present, color: '#10b981', bg: '#f0fdf4' },
              { label: 'Absent', value: absent, color: '#ef4444', bg: '#fef2f2' },
              { label: 'Total Sessions', value: total, color: '#3b82f6', bg: '#eff6ff' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} style={{ background: bg, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Performance Rating</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: performanceColor + '1a', border: `3px solid ${performanceColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FaStar style={{ color: performanceColor, fontSize: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: performanceColor }}>{overview?.performance || '-'}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Based on attendance rate of {rate}%</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'info':         return renderInfo();
      case 'subscription': return renderSubscription();
      case 'attendance':   return renderAttendance();
      default:             return renderOverview();
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link to="/clients" className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FaArrowLeft /> Back to Clients
        </Link>
      </div>

      {/* Profile Hero */}
      <div className="card" style={{ marginBottom: 16, padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: avatarColor, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 700, flexShrink: 0, letterSpacing: 1,
            boxShadow: `0 4px 12px ${avatarColor}55`,
          }}>
            {getInitials(client.full_name)}
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{client.full_name}</h2>
              <StatusBadge value={client.status} />
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              {client.phone && (
                <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <FaPhone style={{ fontSize: 11 }} /> {client.phone}
                </span>
              )}
              {client.email && (
                <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <FaEnvelope style={{ fontSize: 11 }} /> {client.email}
                </span>
              )}
              {client.plan_detail?.name && (
                <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <FaIdCard style={{ fontSize: 11 }} /> {client.plan_detail.name}
                </span>
              )}
              {client.class_detail?.name && (
                <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <FaCalendarAlt style={{ fontSize: 11 }} /> {client.class_detail.name}
                </span>
              )}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Enrolled</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{client.enrollment_date || '-'}</div>
          </div>
        </div>
      </div>

      {/* Top navigation */}
      <div
        style={{
          marginBottom: 16,
          background: '#f3f4f6',
          border: '1px solid #e5e7eb',
          borderRadius: 4,
          overflowX: 'auto',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(110px, 1fr))',
            minWidth: 770,
          }}
        >
          {navItems.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setActiveNav(item.key);
                setActiveTab(item.tab);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeNav === item.key ? '2px solid #60a5fa' : '2px solid transparent',
                color: activeNav === item.key ? '#60a5fa' : '#6b7280',
                fontSize: 14,
                fontWeight: 500,
                padding: '14px 10px',
                cursor: 'pointer',
                letterSpacing: '0.02em',
              }}
            >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span>{item.label}</span>
                  {item.editable && <FaEdit style={{ fontSize: 11 }} />}
                </span>
            </button>
          ))}
        </div>
      </div>

      {renderTabContent()}
    </div>
  );
}

