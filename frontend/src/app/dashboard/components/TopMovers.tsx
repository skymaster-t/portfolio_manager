// src/app/dashboard/components/TopMovers.tsx
'use client';

import { ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAllHoldings } from '@/lib/queries';

export function TopMovers() {
  const { data: holdings = [], isLoading } = useAllHoldings();

  if (isLoading) return <Skeleton className="h-96 w-full rounded-lg" />;

  const valid = holdings.filter((h) => h.daily_change_percent !== null);
  const gainers = [...valid]
    .sort((a, b) => (b.daily_change_percent || 0) - (a.daily_change_percent || 0))
    .slice(0, 5);
  const losers = [...valid]
    .sort((a, b) => (a.daily_change_percent || 0) - (b.daily_change_percent || 0))
    .slice(0, 5);

  const MoverRow = ({ h }: { h: any }) => (
    <div className="flex items-center justify-between py-2">
      <span className="font-medium">{h.symbol}</span>
      <div className="flex items-center gap-2">
        {h.daily_change_percent! >= 0 ? (
          <ArrowUp className="h-4 w-4 text-green-600" />
        ) : (
          <ArrowDown className="h-4 w-4 text-red-600" />
        )}
        <span className={h.daily_change_percent! >= 0 ? 'text-green-600' : 'text-red-600'}>
          {h.daily_change_percent!.toFixed(2)}%
        </span>
      </div>
    </div>
  );

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle>Top Movers Today</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <p className="mb-3 text-sm font-semibold text-green-600">Gainers</p>
            {gainers.length === 0 ? (
              <p className="text-muted-foreground">No gainers</p>
            ) : (
              gainers.map((h) => <MoverRow key={h.id} h={h} />)
            )}
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold text-red-600">Losers</p>
            {losers.length === 0 ? (
              <p className="text-muted-foreground">No losers</p>
            ) : (
              losers.map((h) => <MoverRow key={h.id} h={h} />)
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}