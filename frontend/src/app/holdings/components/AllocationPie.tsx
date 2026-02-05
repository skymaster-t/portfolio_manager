// frontend/src/app/holdings/components/AllocationPie.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Sector,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const OTHER_COLOR = '#94a3b8';

interface Props {
  pieData: { name: string; value: number }[];
}

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const { name, value, total } = payload[0].payload;
    const percent = ((value / total) * 100).toFixed(1);

    return (
      <div className="rounded-lg border bg-background p-3 shadow-sm">
        <p className="font-medium">{name}</p>
        <p className="text-sm">
          {value.toLocaleString('en-CA', {
            style: 'currency',
            currency: 'CAD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}{' '}
          ({percent}%)
        </p>
      </div>
    );
  }
  return null;
};

const renderCustomizedLabel = (props: any) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, name, value, total } = props;

  if (!total || value <= 0) return null;

  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 15;

  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  const percent = ((value / total) * 100).toFixed(1);
  const labelText = `${name} ${percent}%`;

  const textLength = labelText.length * 7.2;
  const padding = 8;

  return (
    <g>
      <rect
        x={x - textLength / 2 - padding}
        y={y - 11}
        width={textLength + 2 * padding}
        height={22}
        fill="#334155"
        rx="8"
        ry="8"
      />
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight="500"
      >
        {labelText}
      </text>
    </g>
  );
};

export default function AllocationPie({ pieData }: Props) {
  if (pieData.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No holdings
        </CardContent>
      </Card>
    );
  }

  const TOP_N = 8;
  const sorted = [...pieData].sort((a, b) => b.value - a.value);
  const mainSlices = sorted.slice(0, TOP_N);
  const otherValue = sorted.slice(TOP_N).reduce((sum, item) => sum + item.value, 0);

  const displayData = otherValue > 0 ? [...mainSlices, { name: 'Other', value: otherValue }] : mainSlices;

  const totalValue = pieData.reduce((sum, item) => sum + item.value, 0);
  const enrichedData = displayData.map((entry) => ({ ...entry, total: totalValue }));

  const legendData = [...pieData].sort((a, b) => b.value - a.value);

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Portfolio Allocation</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center pb-8">
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={enrichedData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={95}
              paddingAngle={3}
              dataKey="value"
              activeShape={renderActiveShape}
              label={renderCustomizedLabel}
              labelLine={false}
              startAngle={90}
              endAngle={-270}
            >
              {enrichedData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.name === 'Other' ? OTHER_COLOR : COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <RechartsTooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        <div className="mt-6 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {legendData.map((entry, idx) => {
              const color = COLORS[idx % COLORS.length];
              const percent =
                totalValue > 0 ? ((entry.value / totalValue) * 100).toFixed(1) : '0.0';

              return (
                <div
                  key={entry.name}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm font-medium"
                >
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                  <span>{entry.name}</span>
                  <span className="text-muted-foreground">{percent}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}