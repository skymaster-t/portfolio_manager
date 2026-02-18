// src/app/budget/components/CategoryPieChart.tsx
'use client';

import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Sector } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#f97316', '#a855f7', '#ec4899', '#14b8a6', '#6366f1', '#f43f5e'];

const NEON_RED = '#FF4500';

const OTHER_THRESHOLD = 100;

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
        fill={NEON_RED}
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

interface Props {
  data: { category: string; total: number }[];
  title: string;
  type: 'income' | 'expense';
}

export function CategoryPieChart({ data, title, type }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const baseData = data.map(item => ({
    category: item.category,
    total: Math.abs(item.total),
    name: item.category,
    value: Math.abs(item.total),
  }));

  const sortedBase = [...baseData].sort((a, b) => b.value - a.value);

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

    const totalSum = result.reduce((sum, item) => sum + item.value, 0);
    result.forEach(item => {
      item.percentage = (item.value / totalSum) * 100;
    });

    return result;
  })();

  const legendData = (() => {
    const totalSum = baseData.reduce((sum, item) => sum + item.value, 0);
    return sortedBase.map(item => ({
      name: item.category,
      value: item.value,
      percentage: (item.value / totalSum) * 100,
    }));
  })();

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0].payload;
      return (
        <div className="bg-background/95 border border-border rounded-lg p-3 shadow-lg min-w-[200px] text-sm">
          <p className="font-semibold">{entry.name}</p>
          <p className="text-muted-foreground mt-1">
            {formatCurrency(entry.value)}
          </p>
          <p className="text-muted-foreground mt-1">
            {entry.percentage?.toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = (props: any) => {
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
    <Card className="shadow-lg rounded-xl overflow-hidden flex flex-col h-[520px]">
      <CardHeader className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 flex-shrink-0">
        <CardTitle className="text-xl font-bold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/40 scrollbar-track-transparent">
          <div className="h-full w-full p-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <filter id="neonGlowMedium" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4.5" result="blur" />
                    <feColorMatrix
                      in="blur"
                      mode="matrix"
                      values="1 0 0 0 0   0 0 0 0 0   0 0 0 0 0   0 0 0 0.85 0"
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
        </div>
      </CardContent>
    </Card>
  );
}