import React from 'react';

export default function StatCard({ label, value, sub, icon, colorClass = 'stat-green' }) {
  return (
    <div className="stat-card">
      <div className="stat-card-info">
        <div className="stat-card-label">{label}</div>
        <div className="stat-card-value">{value}</div>
        {sub && <div className="stat-card-sub">{sub}</div>}
      </div>
      {icon && (
        <div className={`stat-card-icon ${colorClass}`}>{icon}</div>
      )}
    </div>
  );
}
