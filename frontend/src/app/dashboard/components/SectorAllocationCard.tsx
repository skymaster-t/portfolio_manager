// src/app/dashboard/components/SectorAllocationCard.tsx (updated – full-width responsive layout; labels always shown fully with no truncation; better proportions for wide screens)
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import {
  Cpu, Heart, DollarSign, ShoppingCart, Factory, Zap, Home, Briefcase, Globe, Package,
} from 'lucide-react';

const sectorIconMap: Record<string, any> = {
  Technology: Cpu,
  Healthcare: Heart,
  'Financial Services': DollarSign,
  'Consumer Cyclical': ShoppingCart,
  Industrials: Factory,
  Energy: Zap,
  'Real Estate': Home,
  'Communication Services': Briefcase,
  'Consumer Defensive': Package,
  Other: Globe,
};

const sectorColors = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

interface SectorItem {
  sector: string;
  value: number;
  percentage: number;
}

interface Props {
  data?: SectorItem[];
  totalValue?: number;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  displayCurrency: 'CAD' | 'USD';
  exchangeRate: number;
}

export function SectorAllocationCard({
  data = [],
  totalValue = 0,
  isLoading = false,
  isError = false,
  errorMessage = 'Failed to load sector data',
  displayCurrency,
  exchangeRate,
}: Props) {
  const convertedTotal = displayCurrency === 'USD' ? totalValue / exchangeRate : totalValue;

  const convertedData = data.map((item) => ({
    ...item,
    value: displayCurrency === 'USD' ? item.value / exchangeRate : item.value,
  }));

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader><CardTitle>Sector Allocation</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-96 w-full" /></CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sector Allocation</CardTitle>
        </CardHeader>
        <CardContent className="flex h-96 flex-col items-center justify-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-lg font-medium text-destructive">{errorMessage}</p>
          <p className="text-sm text-muted-foreground">
            Check console for details or ensure the backend is running.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader><CardTitle>Sector Allocation</CardTitle></CardHeader>
        <CardContent className="flex h-96 items-center justify-center text-muted-foreground">
          No sector data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Sector Allocation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {convertedData.map((item, idx) => {
          const Icon = sectorIconMap[item.sector] || Globe;
          const color = sectorColors[idx % sectorColors.length];

          return (
            <div key={item.sector} className="flex items-center gap-6">
              {/* Label + Icon – takes as much space as needed, no truncation */}
              <div className="flex items-center gap-3 min-w-[200px] flex-shrink-0">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${color}20` }}
                >
                  <Icon className="h-6 w-6" style={{ color }} />
                </div>
                <span className="text-sm font-medium whitespace-nowrap">
                  {item.sector}
                </span>
              </div>

              {/* Progress bar – takes remaining space */}
              <div className="flex-1">
                <div className="h-10 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${item.percentage}%`, backgroundColor: color }}
                  />
                </div>
              </div>

              {/* Percentage + Value – fixed width right-aligned */}
              <div className="w-40 text-right flex-shrink-0">
                <span className="text-sm font-semibold">{item.percentage.toFixed(1)}%</span>
                <span className="ml-4 text-sm text-muted-foreground">
                  {new Intl.NumberFormat('en-CA', {
                    style: 'currency',
                    currency: displayCurrency,
                    maximumFractionDigits: 0,
                  }).format(item.value)}
                </span>
              </div>
            </div>
          );
        })}

        <div className="mt-8 border-t pt-6 text-center text-lg font-semibold">
          Total:{' '}
          {new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: displayCurrency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(convertedTotal)}
        </div>
      </CardContent>
    </Card>
  );
}