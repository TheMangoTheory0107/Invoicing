"use client";

import { useState } from "react";
import { SERIES } from "./types";

export interface TrendPoint {
  month: string;
  label: string;
  needs: number;
  wants: number;
  invested: number;
  income: number;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const compact = (n: number) =>
  n >= 100000 ? `${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L` : n >= 1000 ? `${Math.round(n / 1000)}K` : `${Math.round(n)}`;

function niceMax(v: number) {
  if (v <= 0) return 1000;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const steps = [1, 2, 2.5, 5, 10];
  for (const s of steps) if (s * pow >= v) return s * pow;
  return 10 * pow;
}

const SEGMENTS: { key: "needs" | "wants" | "invested"; label: string; color: string }[] = [
  { key: "needs", label: "Needs", color: SERIES.needs },
  { key: "wants", label: "Wants", color: SERIES.wants },
  { key: "invested", label: "Invested", color: SERIES.invested },
];

// Month-on-month stacked columns (needs / wants / invested) with an income tick per month.
export default function TrendChart({ points }: { points: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const W = 720;
  const H = 260;
  const pad = { l: 48, r: 12, t: 16, b: 28 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const max = niceMax(Math.max(...points.map((p) => Math.max(p.needs + p.wants + p.invested, p.income))));
  const y = (v: number) => pad.t + plotH - (Math.max(0, v) / max) * plotH;
  const band = plotW / points.length;
  const barW = Math.min(24, band * 0.5);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <div className="text-sm font-semibold text-slate-800">Month on month</div>
          <div className="text-xs text-slate-500">Where each month&apos;s money went, against income (dark tick)</div>
        </div>
        <button onClick={() => setShowTable((s) => !s)} className="text-xs text-brand hover:underline">
          {showTable ? "Show chart" : "Show table"}
        </button>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-slate-600 mb-2">
        {SEGMENTS.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-slate-800" />
          Income
        </span>
      </div>

      {showTable ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b">
              <th className="py-2">Month</th>
              <th className="text-right">Income</th>
              <th className="text-right">Needs</th>
              <th className="text-right">Wants</th>
              <th className="text-right">Invested</th>
              <th className="text-right">Left over</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.month} className="border-b border-slate-100">
                <td className="py-1.5">{p.label}</td>
                <td className="text-right">{inr(p.income)}</td>
                <td className="text-right">{inr(p.needs)}</td>
                <td className="text-right">{inr(p.wants)}</td>
                <td className="text-right">{inr(p.invested)}</td>
                <td className="text-right">{inr(p.income - p.needs - p.wants - p.invested)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Monthly spending trend">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
                <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#64748b">
                  {compact(t)}
                </text>
              </g>
            ))}
            {points.map((p, i) => {
              const cx = pad.l + band * i + band / 2;
              let base = 0;
              const segs = SEGMENTS.map((s) => ({ ...s, v: Math.max(0, p[s.key]) })).filter((s) => s.v > 0);
              return (
                <g key={p.month}>
                  {hover === i && <rect x={pad.l + band * i} y={pad.t} width={band} height={plotH} fill="#f1f5f9" />}
                  {segs.map((s, si) => {
                    const top = y(base + s.v);
                    const bottom = y(base);
                    base += s.v;
                    const isTop = si === segs.length - 1;
                    const h = Math.max(0, bottom - top - (si > 0 ? 2 : 0)); // 2px surface gap
                    const r = isTop ? Math.min(4, h) : 0;
                    const x0 = cx - barW / 2;
                    const yTop = top;
                    const path = isTop
                      ? `M${x0},${yTop + h} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + barW - r} Q${x0 + barW},${yTop} ${x0 + barW},${yTop + r} V${yTop + h} Z`
                      : `M${x0},${yTop} H${x0 + barW} V${yTop + h} H${x0} Z`;
                    return <path key={s.key} d={path} fill={s.color} />;
                  })}
                  {p.income > 0 && (
                    <line x1={cx - barW / 2 - 6} x2={cx + barW / 2 + 6} y1={y(p.income)} y2={y(p.income)} stroke="#1e293b" strokeWidth={2} strokeLinecap="round" />
                  )}
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill="#475569">
                    {p.label}
                  </text>
                  <rect
                    x={pad.l + band * i}
                    y={pad.t}
                    width={band}
                    height={plotH + 20}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                </g>
              );
            })}
            <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="#cbd5e1" strokeWidth={1} />
          </svg>
          {hover !== null && (
            <div
              className="absolute top-2 pointer-events-none bg-white border border-slate-200 shadow-md rounded-md px-3 py-2 text-xs text-slate-700"
              style={{
                left: `${((pad.l + band * hover + band / 2) / W) * 100}%`,
                transform: hover > points.length / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
              }}
            >
              <div className="font-semibold text-slate-900 mb-1">{points[hover].label}</div>
              <Row label="Income" value={points[hover].income} />
              {SEGMENTS.map((s) => (
                <Row key={s.key} label={s.label} value={points[hover][s.key]} color={s.color} />
              ))}
              <Row
                label="Left over"
                value={points[hover].income - points[hover].needs - points[hover].wants - points[hover].invested}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="flex items-center gap-1.5">
        {color && <span className="inline-block w-2 h-2 rounded-sm" style={{ background: color }} />}
        {label}
      </span>
      <span className="tabular-nums">{inr(value)}</span>
    </div>
  );
}
