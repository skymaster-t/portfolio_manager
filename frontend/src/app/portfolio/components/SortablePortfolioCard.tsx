// src/app/holdings/components/SortablePortfolioCard.tsx (updated: edit/delete buttons have stronger, colored hover highlights)
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
        outerRadius={outerRadius + 8}
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

const renderCustomizedLabel = (props: any) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, name, value, total } = props;

  if (!total || value <= 0) return null;

  const RADIAN = Math.PI / 180;
  // Closer to the pie slices (original was +40, now much tighter)
  const radius = outerRadius + 25;

  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  const percent = ((value / total) * 100).toFixed(1);
  const labelText = `${name} ${percent}%`;

  // Approximate width for smaller font
  const textLength = labelText.length * 7.2;
  const padding = 8;

  return (
    <g>
      {/* Dark grey rounded background box */}
      <rect
        x={x - textLength / 2 - padding}
        y={y - 10}
        width={textLength + 2 * padding}
        height={20}
        fill="#334155" // slate-700 dark grey
        rx="8"
        ry="8"
      />

      {/* Single-line white text – smaller and centered */}
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

  const truncatedName = portfolio.name.length > 16
    ? `${portfolio.name.slice(0, 16)}...`
    : portfolio.name;

  const fullLegendEntries = portfolio.pieData;

  const threshold = 0.08 * portfolio.totalValue;
  let mainHoldings = portfolio.pieData.filter(item => item.value >= threshold);
  const otherValue = portfolio.pieData.reduce((sum, item) => item.value < threshold ? sum + item.value : sum, 0);

  mainHoldings = mainHoldings.sort((a, b) => b.value - a.value);

  const pieDataForChart = [...mainHoldings];
  if (otherValue > 0) {
    pieDataForChart.push({ name: 'Other', value: otherValue });
  }

  const enrichedPieData = pieDataForChart.map(entry => ({ ...entry, total: portfolio.totalValue }));

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`transition-all hover:shadow-xl overflow-hidden relative`}      
    >
      <div className="flex items-center justify-between p-6 pb-4 bg-gradient-to-br from-indigo-50 to-purple-50 border-0 shadow-lg">
        {/* Left side: grip + title + badge */}
        <div className="flex items-center gap-4">
          <div
            {...attributes}
            {...listeners}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-grab active:cursor-grabbing transition-colors"
          >
            <GripVertical className="h-5 w-5" />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-2xl font-semibold truncate">{truncatedName}</h3>
            {portfolio.isDefault && <Badge variant="secondary">Default</Badge>}
          </div>
        </div>

        {/* Right side: edit + delete buttons (unchanged except explicit h-10 w-10 for safety) */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="h-10 w-10 hover:bg-indigo-600 hover:text-white transition-all duration-200"
          >
            <Edit className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-10 w-10 hover:bg-red-600 hover:text-white transition-all duration-200"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <CardContent className="px-6 py-4 space-y-4">
        <div className="text-center">
          <p className="text-4xl font-bold">
            {formatter.format(displayValue(portfolio.totalValue))}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Total Value</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-center">
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

        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={enrichedPieData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              activeShape={renderActiveShape}
              label={renderCustomizedLabel}
              labelLine={false}
              startAngle={90}
              endAngle={-270}
            >
              {enrichedPieData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.name === 'Other' ? OTHER_COLOR : COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <RechartsTooltip content={<CustomTooltip displayCurrency={displayCurrency} exchangeRate={exchangeRate} />} />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex flex-wrap justify-center gap-2">
          {fullLegendEntries.map((entry, idx) => {
            const color = COLORS[idx % COLORS.length];
            const slicePercent = portfolio.totalValue > 0
              ? (entry.value / portfolio.totalValue * 100).toFixed(1)
              : '0.0';

            return (
              <div
                key={entry.name}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-muted text-muted-foreground text-xs font-medium"
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