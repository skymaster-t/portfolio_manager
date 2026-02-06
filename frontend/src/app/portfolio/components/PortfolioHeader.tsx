// src/app/portfolio/components/PortfolioHeader.tsx (updated: increased spacing above "Last updated" text – now bottom-6 for cleaner breathing room)
'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
  lastUpdated?: string; // e.g., "5 minutes ago" or "Loading..."
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
  lastUpdated = 'Loading...',
}: Props) {
  const displayValue = (cadValue: number) => 
    displayCurrency === 'CAD' ? cadValue : cadValue / exchangeRate;

  const formatter = new Intl.NumberFormat(displayCurrency === 'CAD' ? 'en-CA' : 'en-US', {
    style: 'currency',
    currency: displayCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const percentFormatter = (value: number) =>
    `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-3xl font-bold">Portfolio Summary</CardTitle>

          {/* Currency Switch Buttons */}
          <div className="flex gap-2">
            <Button
              variant={displayCurrency === 'CAD' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDisplayCurrency('CAD')}
            >
              CAD
            </Button>
            <Button
              variant={displayCurrency === 'USD' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDisplayCurrency('USD')}
            >
              USD
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative pb-12"> {/* Increased bottom padding for more breathing room */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Total Value */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total Value</p>
            {isLoading ? (
              <Skeleton className="h-12 w-64 mx-auto mt-3" />
            ) : (
              <p className="text-4xl md:text-5xl font-bold mt-2">
                {formatter.format(displayValue(totalValue))}
              </p>
            )}
          </div>

          {/* Today's Change */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Today's Change</p>
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

          {/* All-Time Return */}
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
        </div>

        {/* Last Updated – bottom-right with more spacing above */}
        <p className="absolute bottom-6 right-6 text-sm text-muted-foreground">
          Last updated {lastUpdated}
        </p>
      </CardContent>
    </Card>
  );
}