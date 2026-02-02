// src/app/holdings/components/PortfolioHeader.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';

interface Props {
  totalValue: number;
  gainLoss: number;
  dailyChange: number;
  costBasis: number;
  marketValue: number;
  currencyFormatter: Intl.NumberFormat;
  percentFormatter: (v: number) => string;
  displayCurrency: 'CAD' | 'USD';
  setDisplayCurrency: (v: 'CAD' | 'USD') => void;
  exchangeRate: number;
  isLoading: boolean;
  onAddPortfolio: () => void;
  onAddHolding: () => void;
  hasSelectedPortfolio: boolean;
}

export function PortfolioHeader({
  totalValue,
  gainLoss,
  dailyChange,
  costBasis,
  marketValue,
  currencyFormatter,
  percentFormatter,
  displayCurrency,
  setDisplayCurrency,
  exchangeRate,
  isLoading,
  onAddPortfolio,
  onAddHolding,
  hasSelectedPortfolio,
}: Props) {
  const displayedTotal = displayCurrency === 'CAD' ? totalValue * exchangeRate : totalValue;
  const displayedGainLoss = displayCurrency === 'CAD' ? gainLoss * exchangeRate : gainLoss;
  const displayedDaily = displayCurrency === 'CAD' ? dailyChange * exchangeRate : dailyChange;

  const gainLossColor = displayedGainLoss >= 0 ? 'text-green-400' : 'text-red-400';
  const dailyColor = displayedDaily >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="relative overflow-hidden rounded-3xl shadow-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white mb-12">
      <div className="absolute inset-0 bg-black/10" />
      <div className="relative z-10 p-8 md:p-12">
        {/* Top row – title left, add buttons top-right */}
        <div className="flex justify-between items-start mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Portfolio Overview
          </h1>

          <div className="flex gap-4">
            <Button
              size="lg"
              variant="secondary"
              className="bg-white/20 backdrop-blur hover:bg-white/30 text-white border border-white/30"
              onClick={onAddPortfolio}
            >
              <Plus className="h-5 w-5 mr-2" />
              New Portfolio
            </Button>

            <Button
              size="lg"
              variant="secondary"
              className="bg-white/20 backdrop-blur hover:bg-white/30 text-white border border-white/30"
              onClick={onAddHolding}
              disabled={!hasSelectedPortfolio}
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Holding
            </Button>
          </div>
        </div>

        {/* Bottom section – totals left, currency bottom-right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-end">
          <div className="space-y-6">
            <p className="text-xl md:text-2xl opacity-90">
              Total Across All Portfolios
            </p>

            <div className="text-5xl md:text-6xl font-extrabold">
              {isLoading ? '...' : currencyFormatter.format(displayedTotal)}
            </div>

            <div className="space-y-4">
              <div className={`text-2xl font-bold ${gainLossColor}`}>
                {displayedGainLoss >= 0 ? '+' : ''}
                {currencyFormatter.format(displayedGainLoss)}
                {' '}
                ({costBasis > 0 ? percentFormatter((gainLoss / costBasis) * 100) : '0.00%'})
              </div>

              <div className={`text-xl ${dailyColor}`}>
                {displayedDaily >= 0 ? '↑' : '↓'} {currencyFormatter.format(displayedDaily)} today
                {' '}
                ({marketValue > 0 ? percentFormatter((dailyChange / marketValue) * 100) : '0.00%'})
              </div>
            </div>
          </div>

          {/* Currency selector – strictly bottom-right */}
          <div className="flex justify-end">
            <Select value={displayCurrency} onValueChange={(v) => setDisplayCurrency(v as 'CAD' | 'USD')}>
              <SelectTrigger className="w-32 bg-white/20 backdrop-blur text-white border-white/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CAD">CAD</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}