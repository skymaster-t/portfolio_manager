// src/app/dashboard/components/HistoryChart.tsx (updated: dynamic Y-axis with ±10% padding around data range)
'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ChartPoint {
  label: string;
  tooltipLabel: string;
  value: number;
  daily_change: number;
  daily_percent: number;
  all_time_percent: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border bg-background p-4 shadow-sm">
        <p className="font-semibold">{data.tooltipLabel}</p>
        <p className="text-lg font-bold">
          {new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: 'CAD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(data.value)}
        </p>
        <p className={data.daily_change >= 0 ? 'text-green-600' : 'text-red-600'}>
          Daily: {data.daily_change >= 0 ? '+' : ''}{' '}
          {new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: 'CAD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(data.daily_change)}{' '}
          ({(data.daily_percent >= 0 ? '+' : '') + data.daily_percent.toFixed(2)}%)
        </p>
        <p className={data.all_time_percent >= 0 ? 'text-green-600' : 'text-red-600'}>
          All Time Return: {(data.all_time_percent >= 0 ? '+' : '') + data.all_time_percent.toFixed(2)}%
        </p>
      </div>
    );
  }
  return null;
};

interface Props {
  data: ChartPoint[];
}

export function HistoryChart({ data }: Props) {
  if (data.length === 0) return null;

  // Compute Y-axis domain: ±10% padding around actual data range
  const values = data.map((d) => d.value);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);

  let yLower = dataMin;
  let yUpper = dataMax;

  if (dataMin === dataMax) {
    // Flat line – symmetric ±10%
    yLower = dataMin * 0.9;
    yUpper = dataMin * 1.1;
  } else {
    const range = dataMax - dataMin;
    const padding = range * 0.1;
    yLower = dataMin - padding;
    yUpper = dataMax + padding;
  }

  // Optional: force Y-axis to start at 0 if all values ≥ 0 (common for portfolio total value charts)
  // Uncomment if you prefer the axis to never go below zero:
  // if (dataMin >= 0) yLower = Math.max(0, yLower);

  const yDomain: [number, number] = [yLower, yUpper];

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis
          domain={yDomain}
          tick={{ fontSize: 12 }}
          tickFormatter={(value) =>
            new Intl.NumberFormat('en-CA', {
              style: 'currency',
              currency: 'CAD',
              notation: 'compact',
              maximumFractionDigits: 1,
            }).format(value)
          }
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#3b82f6"
          strokeWidth={3}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}