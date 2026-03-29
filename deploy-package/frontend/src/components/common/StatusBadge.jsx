import React from 'react';

export default function StatusBadge({ value }) {
  if (!value) return <span className="badge-pill badge-inactive">—</span>;
  const cls = `badge-pill badge-${value.toLowerCase().replace(/\s/g, '-')}`;
  return <span className={cls}>{value.charAt(0).toUpperCase() + value.slice(1)}</span>;
}
