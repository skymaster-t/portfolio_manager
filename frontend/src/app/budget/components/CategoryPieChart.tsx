// src/app/budget/components/CategoryPieChart.tsx
'use client';

import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Sector } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#f97316', '#a855f7', '#ec4899', '#14b8a6', '#6366f1', '#f43f5e'];

interface Props {
  data: { category: string; total: number }[];
  title: string;
  type: 'income' | 'expense';
}

const NEON_YELLOW = '#FFFF00';
const OTHER_THRESHOLD = 100; // $100

const renderActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill } = props;

  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={NEON_YELLOW}
        filter="url(#neonGlowMedium)"
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

export function CategoryPieChart({ data, title, type }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  // ────────────────────────────────────────────────
  // 1. Prepare base data with absolute values
  // ────────────────────────────────────────────────
  const baseData = data.map(item => ({
    category: item.category,
    total: Math.abs(item.total),
    name: item.category,
    value: Math.abs(item.total),
  }));

  // ────────────────────────────────────────────────
  // 2. Sort descending by value (biggest → smallest)
  // ────────────────────────────────────────────────
  const sortedBase = [...baseData].sort((a, b) => b.value - a.value);

  // ────────────────────────────────────────────────
  // 3. Group small items (< $100) into "Other" for PIE ONLY
  // ────────────────────────────────────────────────
  const pieDataForChart = (() => {
    const significant = sortedBase.filter(item => item.value >= OTHER_THRESHOLD);
    const smallItems = sortedBase.filter(item => item.value < OTHER_THRESHOLD);

    const otherTotal = smallItems.reduce((sum, item) => sum + item.value, 0);

    const result = [...significant];

    if (otherTotal > 0) {
      result.push({
        category: 'Other',
        name: 'Other',
        value: otherTotal,
        total: otherTotal,
      });
    }

    // Recalculate percentages based on what’s actually shown in the pie
    const totalSum = result.reduce((sum, d) => sum + d.value, 0);
    return result.map(item => ({
      ...item,
      percentage: totalSum > 0 ? (item.value / totalSum) * 100 : 0,
    }));
  })();

  // ────────────────────────────────────────────────
  // 4. Legend uses FULL sorted list (no grouping)
  // ────────────────────────────────────────────────
  const legendData = sortedBase.map(item => ({
    ...item,
    // percentage not shown in legend for cleanliness
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      return (
        <div className="bg-background border border-border rounded-md p-3 shadow-lg text-sm min-w-[160px]">
          <p className="font-semibold text-foreground">{entry.name}</p>
          <p className="text-muted-foreground font-medium">
            {formatCurrency(entry.value)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {entry.payload.percentage?.toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = (props: any) => {
    // We ignore Recharts payload and use our own sorted + full list
    return (
      <div className="mt-3 px-3 pb-2">
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-2.5 text-sm">
          {legendData.map((entry, index) => {
            const color = COLORS[index % COLORS.length];
            return (
              <li key={`legend-${index}`} className="flex items-center gap-2">
                <div
                  className="h-3.5 w-3.5 rounded-full shrink-0 border border-border/30"
                  style={{ backgroundColor: color }}
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium truncate leading-tight">{entry.name}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatCurrency(entry.value)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-1 pb-0 flex flex-col">
        <div className="flex-1 min-h-[360px] sm:min-h-[380px] lg:min-h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                <filter id="neonGlowMedium" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4.5" result="blur" />
                  <feColorMatrix
                    in="blur"
                    mode="matrix"
                    values="0 0 0 0 1   0 0 0 0 1   0 0 0 0 0   0 0 0 0.85 0"
                    result="glow"
                  />
                  <feComposite in="SourceGraphic" in2="glow" operator="over" />
                </filter>
              </defs>

              <Pie
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
                data={pieDataForChart}
                cx="50%"
                cy="42%"
                innerRadius={60}
                outerRadius={105}
                paddingAngle={1.5}
                dataKey="value"
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(undefined)}
              >
                {pieDataForChart.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>

              <Tooltip content={<CustomTooltip />} />
              <Legend
                content={renderLegend}
                verticalAlign="bottom"
                wrapperStyle={{ outline: 'none' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}