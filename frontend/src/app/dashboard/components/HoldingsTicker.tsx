// src/app/dashboard/components/HoldingsTicker.tsx (updated: tighter spacing (mx-6), faster scroll (~2.5s per item, min 20s); rounded light green/red boxes; gain/loss below symbol+price)
'use client';

import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useAllHoldings } from '@/lib/queries';

interface Underlying {
  symbol: string;
  allocation_percent: number | null;
  current_price: number | null;
  daily_change: number | null;
  daily_change_percent: number | null;
}

interface Holding {
  id: number;
  symbol: string;
  current_price: number | null;
  daily_change: number | null;
  daily_change_percent: number | null;
  underlying_details?: Underlying[];
}

export function HoldingsTicker() {
  const { data: holdings = [], isLoading } = useAllHoldings();

  if (isLoading || holdings.length === 0) {
    return (
      <div className="bg-muted py-4 text-center text-muted-foreground">
        {isLoading ? 'Loading holdings...' : 'No holdings to display'}
      </div>
    );
  }

  // Flatten: main holdings + underlyings
  const tickerItems: {
    symbol: string;
    price: number | null;
    change: number | null;
    percent: number | null;
    isUnderlying: boolean;
  }[] = [];

  holdings.forEach((h) => {
    tickerItems.push({
      symbol: h.symbol,
      price: h.current_price,
      change: h.daily_change,
      percent: h.daily_change_percent,
      isUnderlying: false,
    });

    (h.underlying_details || []).forEach((u) => {
      tickerItems.push({
        symbol: u.symbol,
        price: u.current_price,
        change: u.daily_change,
        percent: u.daily_change_percent,
        isUnderlying: true,
      });
    });
  });

  const duration = Math.max(20, tickerItems.length * .1);

  // Duplicate for seamless infinite loop
  const duplicatedItems = [...tickerItems, ...tickerItems];

  return (
    <div className="bg-background border-y py-4 overflow-hidden">
      <div
        className="flex items-center whitespace-nowrap animate-marquee"
        style={{ animationDuration: `${duration}s` }}
      >
        {duplicatedItems.map((item, index) => {
          const isPositive = (item.change || 0) >= 0;
          const changeAbs = item.change !== null ? Math.abs(item.change) : null;

          return (
            <div
              key={index}
              className={`mx-6 flex flex-col items-center justify-center rounded-xl px-5 py-3 min-w-[200px] shadow-sm ${
                isPositive ? 'bg-green-50' : 'bg-red-50'
              }`}
            >
              {/* Symbol + Price row */}
              <div className="flex items-center gap-3">
                <span
                  className={`font-black uppercase tracking-wider ${
                    item.isUnderlying ? 'text-base opacity-80' : 'text-xl'
                  }`}
                >
                  {item.symbol}
                </span>

                <span className="font-bold text-lg">
                  {item.price !== null
                    ? new Intl.NumberFormat('en-CA', {
                        style: 'currency',
                        currency: 'CAD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(item.price)
                    : '-'}
                </span>
              </div>

              {/* Gain/Loss row – smaller text below */}
              <div className="mt-1.5 flex items-center gap-1.5 text-sm">
                {isPositive ? (
                  <ArrowUpRight className="h-5 w-5 text-green-600" />
                ) : (
                  <ArrowDownRight className="h-5 w-5 text-red-600" />
                )}
                <span className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {changeAbs !== null
                    ? new Intl.NumberFormat('en-CA', {
                        style: 'currency',
                        currency: 'CAD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(changeAbs)
                    : '-'}
                  {' '}
                  ({item.percent !== null
                    ? `${isPositive ? '+' : ''}${item.percent.toFixed(2)}%`
                    : '-'})
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}