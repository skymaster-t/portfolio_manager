// src/app/holdings/components/SortablePortfolioCard.tsx
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

interface PortfolioWithData {
  id: number;
  name: string;
  is_default: boolean;
  totalValue: number;
  gainLoss: number;
  allTimePercent: number;
  pieData: { name: string; value: number }[];
}

interface Props {
  portfolio: PortfolioWithData;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  currencyFormatter: Intl.NumberFormat;
  displayCurrency: 'CAD' | 'USD';
  exchangeRate: number;
}

// Stronger hover highlight (kept for tooltip visibility)
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="#ffffff"
        strokeWidth={6}
      />
    </g>
  );
};

// External label – close to pie
const renderCustomizedLabel = (props: any) => {
  const RADIAN = Math.PI / 180;
  const {
    cx,
    cy,
    midAngle,
    outerRadius,
    percent,
    name,
  } = props;

  if (percent < 0.05) return null;

  const radius = outerRadius + 15;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <g>
      <rect
        x={x - 32}
        y={y - 14}
        rx={10}
        ry={10}
        width={64}
        height={28}
        fill="#374151"
      />
      <text
        x={x}
        y={y - 2}
        fill="#f3f4f6"
        textAnchor="middle"
        className="text-xs font-medium"
      >
        {name}
      </text>
      <text
        x={x}
        y={y + 10}
        fill="#f3f4f6"
        textAnchor="middle"
        className="text-xs font-bold"
      >
        {(percent * 100).toFixed(0)}%
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
  currencyFormatter,
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

  const cardValue = displayCurrency === 'CAD' ? portfolio.totalValue * exchangeRate : portfolio.totalValue;
  const cardGainLoss = displayCurrency === 'CAD' ? portfolio.gainLoss * exchangeRate : portfolio.gainLoss;

  const percentText = portfolio.allTimePercent >= 0
    ? `(+${portfolio.allTimePercent.toFixed(2)}%)`
    : `(${portfolio.allTimePercent.toFixed(2)}%)`;

  const percentColor = portfolio.allTimePercent >= 0 ? 'text-green-600' : 'text-red-600';

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0];
    const formattedValue = currencyFormatter.format(
      displayCurrency === 'CAD' ? data.value * exchangeRate : data.value
    );

    return (
      <div className="bg-gray-800 text-white rounded-md px-3 py-2 text-xs shadow-lg">
        <p className="font-semibold">{data.name}</p>
        <p className="font-medium">{formattedValue}</p>
      </div>
    );
  };

  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  
    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    );
  };
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`cursor-pointer transition-all hover:shadow-2xl overflow-hidden rounded-2xl bg-white shadow-xl ${
        isSelected ? 'ring-4 ring-indigo-500/50' : ''
      }`}
      onClick={onSelect}
    >
      {/* Gradient header – full bleed top */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-t-2xl px-6 py-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="cursor-grab active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-6 w-6" />
            </div>
            <div className="text-2xl font-bold font-sans">{portfolio.name}</div>
            {portfolio.is_default && (
              <Badge className="bg-white/20 text-white font-bold border-white/30">
                Default
              </Badge>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* White body */}
      <div className="bg-white px-6 pb-6">
        <div className="pt-6">
          <div className="text-4xl font-bold mb-2">{currencyFormatter.format(cardValue)}</div>
          <div className={`text-xl font-medium ${cardGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {cardGainLoss >= 0 ? '+' : ''}{currencyFormatter.format(cardGainLoss)}{' '}
            <span className={percentColor}>{percentText}</span>
          </div>

          {/* Pie chart – completely non-interactive except tooltip */}
          <ResponsiveContainer width="100%" height={340} className="mt-8 select-none">
            <PieChart>
              <Pie
                data={portfolio.pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={renderCustomizedLabel}
                labelLine={false}
                isAnimationActive={false}
                cursor="default"
                activeShape={renderActiveShape}
                // Disable any Recharts click/hover events from interfering
                onClick={() => {}}
                onMouseEnter={() => {}}
                onMouseLeave={() => {}}
              >
                {portfolio.pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.name === 'Other' ? OTHER_COLOR : COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>

              <RechartsTooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {portfolio.pieData.map((entry, index) => {
              const slicePercent = portfolio.totalValue > 0
                ? (entry.value / portfolio.totalValue * 100).toFixed(1)
                : '0.0';

              return (
                <div
                  key={entry.name}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 text-white text-xs font-medium"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: entry.name === 'Other' ? OTHER_COLOR : COLORS[index % COLORS.length],
                    }}
                  />
                  <span>{entry.name}</span>
                  <span className="text-gray-300">{slicePercent}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}