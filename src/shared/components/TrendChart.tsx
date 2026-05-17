// CR-P1-06: Reusable trending chart for vitals and lab values.
//
// Usage:
//
//   <TrendChart
//     title="HbA1c (%)"
//     data={[
//       { date: '2025-11-10', value: 8.4 },
//       { date: '2026-02-12', value: 7.6 },
//       { date: '2026-05-01', value: 7.1 },
//     ]}
//     unit="%"
//     reference={{ low: 4.0, high: 5.6 }}
//     targetCeiling={7.0}
//   />
//
// The reference band (grey shading) shows the normal range. A target
// line can be drawn for chronic-disease control goals (HbA1c < 7).
//
// Built on `recharts` which is already in package.json — no new dep.

import { useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
    ReferenceArea, ReferenceLine, ResponsiveContainer,
} from 'recharts';

export interface TrendDatum {
    date: string;         // ISO date or display string
    value: number | null; // null = missing
    label?: string;       // optional tooltip label
}

interface TrendChartProps {
    title: string;
    data: TrendDatum[];
    unit?: string;
    reference?: { low?: number; high?: number };
    targetCeiling?: number;
    targetFloor?: number;
    height?: number;
    color?: string;
    /** Pretty-format a value for display */
    formatValue?: (v: number) => string;
}

export function TrendChart({
    title, data, unit, reference, targetCeiling, targetFloor,
    height = 220, color = '#2563eb', formatValue,
}: TrendChartProps) {
    const display = useMemo(() => data.filter(d => d.value !== null && d.value !== undefined), [data]);
    const empty = display.length === 0;

    const fmt = formatValue ?? ((v: number) => unit ? `${v} ${unit}` : `${v}`);

    return (
        <div style={{
            padding: '1rem',
            background: 'var(--color-surface, white)',
            borderRadius: 12,
            border: '1px solid var(--color-border, #e5e7eb)',
        }}>
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                marginBottom: '0.5rem',
            }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{title}</h3>
                {display.length > 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #6b7280)' }}>
                        Latest: <strong>{fmt(display[display.length - 1].value!)}</strong>
                    </span>
                )}
            </div>

            {empty ? (
                <div style={{
                    height, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-muted, #6b7280)', fontSize: '0.875rem',
                }}>
                    No data points yet
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={height}>
                    <LineChart data={display} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                            formatter={(v) => (typeof v === 'number' ? fmt(v) : String(v ?? ''))}
                            labelStyle={{ fontSize: 12 }}
                            contentStyle={{ fontSize: 12, padding: '4px 8px' }}
                        />
                        {reference?.low !== undefined && reference?.high !== undefined && (
                            <ReferenceArea
                                y1={reference.low} y2={reference.high}
                                strokeOpacity={0} fillOpacity={0.08}
                                fill="#10b981"
                            />
                        )}
                        {targetCeiling !== undefined && (
                            <ReferenceLine
                                y={targetCeiling}
                                stroke="#f59e0b" strokeDasharray="4 4"
                                label={{ value: `≤ ${targetCeiling}`, fontSize: 10, fill: '#92400e', position: 'right' }}
                            />
                        )}
                        {targetFloor !== undefined && (
                            <ReferenceLine
                                y={targetFloor}
                                stroke="#f59e0b" strokeDasharray="4 4"
                                label={{ value: `≥ ${targetFloor}`, fontSize: 10, fill: '#92400e', position: 'right' }}
                            />
                        )}
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke={color}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}

export default TrendChart;
