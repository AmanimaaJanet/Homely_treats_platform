import React from 'react';

/**
 * Charts without a charting library.
 *
 * Three shapes cover everything the shop actually needs to see: columns over time,
 * horizontal bars for comparing named things (zones, products, payment methods), and a
 * line for shape. Hand-rolled SVG keeps the bundle small and the colours on-brand —
 * a 40 kB charting dependency for four tables is not a trade worth making.
 */

const money = (n) =>
  `GH₵ ${Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

export function ColumnChart({ data, valueKey = 'revenue', labelKey = 'date', height = 130, format = money, emptyLabel = 'Nothing in this range yet' }) {
  if (!data?.length) return <p className="muted small">{emptyLabel}</p>;
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);

  return (
    <div className="mini-columns" style={{ height }}>
      {data.map((d) => {
        const value = Number(d[valueKey]) || 0;
        const pct = (value / max) * 100;
        return (
          <div className="mini-column" key={d[labelKey]} title={`${d[labelKey]} · ${format(value)}`}>
            <span className="mini-column-bar" style={{ height: `${Math.max(pct, value > 0 ? 3 : 0)}%` }} />
            <span className="mini-column-label">
              {String(d[labelKey]).slice(-2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function BarList({ data, labelKey = 'name', valueKey = 'revenue', format = money, secondary }) {
  if (!data?.length) return <p className="muted small">Nothing in this range yet</p>;
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);

  return (
    <div className="mini-bars">
      {data.map((d) => (
        <div className="mini-bar-row" key={d[labelKey]}>
          <span className="mini-bar-label" title={d[labelKey]}>{d[labelKey]}</span>
          <span className="mini-bar-track">
            <span className="mini-bar-fill" style={{ width: `${(Number(d[valueKey]) / max) * 100}%` }} />
          </span>
          <span className="mini-bar-value">
            {format(d[valueKey])}
            {secondary ? <span className="muted small"> · {secondary(d)}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LineChart({ data, valueKey = 'revenue', labelKey = 'month', height = 120, format = money }) {
  if (!data?.length) return <p className="muted small">Not enough history yet</p>;
  const values = data.map((d) => Number(d[valueKey]) || 0);
  const max = Math.max(...values, 1);
  const step = data.length > 1 ? 100 / (data.length - 1) : 0;
  const points = values.map((v, i) => `${i * step},${100 - (v / max) * 92}`).join(' ');

  return (
    <div className="mini-line">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} role="img" aria-label="Trend">
        <polyline points={points} fill="none" stroke="#B4634B" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        <polyline
          points={`0,100 ${points} ${100},100`}
          fill="rgba(180,99,75,.10)"
          stroke="none"
        />
      </svg>
      <div className="mini-line-labels">
        {data.map((d) => (
          <span key={d[labelKey]}>{d[labelKey]}</span>
        ))}
      </div>
      <p className="muted small">Peak {format(max)}</p>
    </div>
  );
}
