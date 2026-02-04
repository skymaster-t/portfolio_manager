// src/app/holdings/components/SortablePortfolioCard.tsx (fixed – title truncated at 20 characters with ellipsis, no overflow pushing buttons, header flush & consistent height)
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Edit, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Sector,
  LabelList,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const OTHER_COLOR = '#94a3b8';

interface PortfolioSummary {
  id: number;
  name: string;
  isDefault: boolean;
  totalValue: number;
  gainLoss: number;
  dailyChange: number;
  dailyPercent: number;
  allTimePercent: number;
  pieData: { name: string; value: number }[];
}

interface Props {
  portfolio: PortfolioSummary;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  displayCurrency: 'CAD' | 'USD';
  exchangeRate: number;
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

const CustomTooltip = ({ active, payload, displayCurrency, exchangeRate }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const total = payload[0].payload.total || 1;

    const formatter = new Intl.NumberFormat(displayCurrency === 'CAD' ? 'en-CA' : 'en-US', {
      style: 'currency',
      currency: displayCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    const displayedValue = displayCurrency === 'CAD' ? data.value : data.value / exchangeRate;

    return (
      <div className="rounded-lg border bg-background p-3 shadow-sm">
        <p className="font-medium">{data.name}</p>
        <p className="text-sm">
          {formatter.format(displayedValue)} ({((data.value / total) * 100).toFixed(1)}%)
        </p>
      </div>
    );
  }
  return null;
};

const CustomLabel = (props: any) => {
  const { cx, cy, midAngle, outerRadius, name, value, total } = props;

  if (!name || value <= 0 || !total) return null;

  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 40;
  let x = cx + radius * Math.cos(-midAngle * RADIAN);
  let y = cy + radius * Math.sin(-midAngle * RADIAN);

  const percent = ((value / total) * 100).toFixed(1);

  const isLeft = x < cx;
  const alignX = isLeft ? x - 10 : x + 10;

  return (
    <g>
      <foreignObject x={alignX - 80} y={y - 25} width="160" height="50">
        <div className="bg-gray-700 text-white text-xs font-medium rounded-lg px-4 py-2 shadow-lg whitespace-nowrap flex items-center justify-center">
          {name} {percent}%
        </div>
      </foreignObject>
    </g>
  );
};

export function SortablePortfolioCard({
  portfolio,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  displayCurrency,
  exchangeRate,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: portfolio.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatter = new Intl.NumberFormat(displayCurrency === 'CAD' ? 'en-CA' : 'en-US', {
    style: 'currency',
    currency: displayCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const percentFormatter = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

  const displayValue = (cadValue: number) => displayCurrency === 'CAD' ? cadValue : cadValue / exchangeRate;

  // Truncate to max 20 characters + ellipsis (original logic restored)
  const truncatedName = portfolio.name.length > 20
    ? `${portfolio.name.slice(0, 20)}...`
    : portfolio.name;

  // Full data for legend
  const fullLegendEntries = portfolio.pieData;

  // Pie chart data: group <8% into "Other"
  const threshold = 0.08 * portfolio.totalValue;
  const mainHoldings = portfolio.pieData.filter(item => item.value >= threshold);
  const otherValue = portfolio.pieData.reduce((sum, item) => item.value < threshold ? sum + item.value : sum, 0);

  const pieDataForChart = [...mainHoldings];
  if (otherValue > 0) {
    pieDataForChart.push({ name: 'Other', value: otherValue });
  }

  // Enrich for label and tooltip
  const enrichedPieData = pieDataForChart.map(entry => ({ ...entry, total: portfolio.totalValue }));

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-pointer transition-all hover:shadow-xl overflow-hidden relative ${
        isSelected ? 'ring-4 ring-indigo-500' : ''
      }`}
      onClick={onSelect}
    >
      {/* Gradient header – flush with top */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-t-lg h-28 flex items-center px-6 -mt-6 relative">
        {/* Default badge – centered above title */}
        {portfolio.isDefault && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2">
            <Badge>Default</Badge>
          </div>
        )}

        {/* Main row – grip, truncated title, buttons */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <div {...attributes} {...listeners} className="cursor-grab touch-none">
              <GripVertical className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 leading-tight">
              {truncatedName}
            </h3>
          </div>
          <div className="flex gap-2">
            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <CardContent className="p-6 space-y-6">
        <div className="text-center">
          <p className="text-4xl font-bold">
            {formatter.format(displayValue(portfolio.totalValue))}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Total Value</p>
        </div>

        <div className="grid grid-cols-2 gap-6 text-center">
          <div>
            <p className="text-sm text-muted-foreground">Today's Return</p>
            <p className={`text-2xl font-bold ${portfolio.dailyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatter.format(displayValue(portfolio.dailyChange))}
            </p>
            <p className={`text-xl font-medium ${portfolio.dailyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {percentFormatter(portfolio.dailyPercent)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">All-Time Return</p>
            <p className={`text-2xl font-bold ${portfolio.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatter.format(displayValue(portfolio.gainLoss))}
            </p>
            <p className={`text-xl font-medium ${portfolio.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {percentFormatter(portfolio.allTimePercent)}
            </p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={340}>
          <PieChart>
            <Pie
              data={enrichedPieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
              activeShape={renderActiveShape}
            >
              {enrichedPieData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.name === 'Other' ? OTHER_COLOR : COLORS[index % COLORS.length]}
                />
              ))}
              <LabelList content={<CustomLabel />} />
            </Pie>
            <RechartsTooltip content={<CustomTooltip displayCurrency={displayCurrency} exchangeRate={exchangeRate} />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend shows full detailed holdings */}
        <div className="flex flex-wrap justify-center gap-2">
          {fullLegendEntries.map((entry, idx) => {
            const color = COLORS[idx % COLORS.length];
            const slicePercent = portfolio.totalValue > 0
              ? (entry.value / portfolio.totalValue * 100).toFixed(1)
              : '0.0';

            return (
              <div
                key={entry.name}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium"
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span>{entry.name}</span>
                <span>{slicePercent}%</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}