// src/app/holdings/components/PortfolioHeader.tsx (reduced font sizes by ~2 Tailwind steps, modern sans-serif font)
'use client';

import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  totalValue: number;
  gainLoss: number;
  dailyChange: number;
  dailyPercent: number;
  allTimePercent: number;
  marketValue: number;
  displayCurrency: 'CAD' | 'USD';
  setDisplayCurrency: (c: 'CAD' | 'USD') => void;
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
  dailyPercent,
  allTimePercent,
  displayCurrency,
  setDisplayCurrency,
  exchangeRate,
  isLoading,
  onAddPortfolio,
  onAddHolding,
  hasSelectedPortfolio,
}: Props) {
  const displayValue = (cadValue: number) => 
    displayCurrency === 'CAD' ? cadValue : cadValue / exchangeRate;

  const formatter = new Intl.NumberFormat(displayCurrency === 'CAD' ? 'en-CA' : 'en-US', {
    style: 'currency',
    currency: displayCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const percentFormatter = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  return (
    <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-0 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-4xl font-bold text-gray-800">Portfolio Overview</CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex rounded-lg border border-gray-300 bg-white p-1">
              <button
                onClick={() => setDisplayCurrency('CAD')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  displayCurrency === 'CAD'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                CAD
              </button>
              <button
                onClick={() => setDisplayCurrency('USD')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  displayCurrency === 'USD'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                USD
              </button>
            </div>

            <Button onClick={onAddPortfolio} className="bg-indigo-600 hover:bg-indigo-700">
              <PlusCircle className="mr-2 h-5 w-5" />
              Add Portfolio
            </Button>

            <Button
              onClick={onAddHolding}
              disabled={!hasSelectedPortfolio}
              className="bg-white text-black hover:bg-gray-100 border border-gray-300 shadow-sm disabled:opacity-50"
            >
              <PlusCircle className="mr-2 h-5 w-5 text-indigo-600" />
              Add Holding
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Total Market Value – reduced to text-5xl, modern sans-serif */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Total Market Value</p>
          {isLoading ? (
            <Skeleton className="h-14 w-72 mt-3 mx-auto" />
          ) : (
            <p className="text-5xl font-bold font-sans">
              {formatter.format(displayValue(totalValue))}
            </p>
          )}
        </div>

        {/* Today's Return – dollar text-4xl, percent text-2xl */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Today's Return</p>
          {isLoading ? (
            <div className="flex items-baseline justify-center gap-4 mt-3">
              <Skeleton className="h-12 w-44" />
              <Skeleton className="h-9 w-32" />
            </div>
          ) : (
            <div className="flex items-baseline justify-center gap-3 mt-2">
              <p className={`text-4xl font-bold font-sans ${dailyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatter.format(displayValue(dailyChange))}
              </p>
              <p className={`text-2xl font-bold font-sans ${dailyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ({percentFormatter(dailyPercent)})
              </p>
            </div>
          )}
        </div>

        {/* All-Time Return – dollar text-4xl, percent text-2xl */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">All-Time Return</p>
          {isLoading ? (
            <div className="flex items-baseline justify-center gap-4 mt-3">
              <Skeleton className="h-12 w-44" />
              <Skeleton className="h-9 w-32" />
            </div>
          ) : (
            <div className="flex items-baseline justify-center gap-3 mt-2">
              <p className={`text-4xl font-bold font-sans ${gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatter.format(displayValue(gainLoss))}
              </p>
              <p className={`text-2xl font-bold font-sans ${gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ({percentFormatter(allTimePercent)})
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}