// src/app/dashboard/components/PrimaryHoldingsTable.tsx (updated: robust allocation % with fallback sum of displayed holdings if prop totalValue 0; no sorting (static descending allocation); daily change percent primary + $ in brackets with arrow – reliable, no crashes)
'use client';

import { ArrowUp, ArrowDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAllHoldings } from '@/lib/queries';

interface Holding {
  id: number;
  symbol: string;
  current_price: number | null;
  market_value: number | null;
  daily_change: number | null;
  daily_change_percent: number | null;
}

interface Props {
  totalValue: number; // Global total from dashboard (combined all portfolios)
}

export function PrimaryHoldingsTable({ totalValue }: Props) {
  const { data: holdings = [], isLoading } = useAllHoldings();

  // Primary holdings only (stocks/ETFs)
  const primaryHoldings = holdings.filter((h: Holding) => h.type === 'stock' || h.type === 'etf');

  // Fallback: if global total 0 or missing, use sum of primary market_values
  const localTotal = primaryHoldings.reduce((sum, h) => sum + (h.market_value || 0), 0);
  const effectiveTotal = totalValue > 0 ? totalValue : localTotal;

  // Static sort: descending by allocation %
  const sortedHoldings = [...primaryHoldings].sort((a, b) => {
    const allocA = effectiveTotal > 0 && a.market_value !== null ? (a.market_value / effectiveTotal) * 100 : 0;
    const allocB = effectiveTotal > 0 && b.market_value !== null ? (b.market_value / effectiveTotal) * 100 : 0;
    return allocB - allocA;
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Primary Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sortedHoldings.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Primary Holdings</CardTitle>
        </CardHeader>
        <CardContent className="flex h-96 items-center justify-center text-muted-foreground">
          No primary holdings
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Primary Holdings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Market Value</TableHead>
                <TableHead className="text-right">Allocation %</TableHead>
                <TableHead className="text-right">Daily Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHoldings.map((h) => {
                const isPositive = (h.daily_change_percent || 0) >= 0;
                const changeAbs = h.daily_change !== null ? Math.abs(h.daily_change) : null;
                const alloc = effectiveTotal > 0 && h.market_value !== null ? (h.market_value / effectiveTotal) * 100 : 0;

                return (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.symbol}</TableCell>
                    <TableCell className="text-right">
                      {h.current_price !== null
                        ? new Intl.NumberFormat('en-CA', {
                            style: 'currency',
                            currency: 'CAD',
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(h.current_price)
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {h.market_value !== null
                        ? new Intl.NumberFormat('en-CA', {
                            style: 'currency',
                            currency: 'CAD',
                          }).format(h.market_value)
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {alloc.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {h.daily_change_percent === null || h.daily_change === null ? (
                        '-'
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          {isPositive ? (
                            <ArrowUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <ArrowDown className="h-4 w-4 text-red-600" />
                          )}
                          <span className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {isPositive ? '+' : ''}{h.daily_change_percent.toFixed(2)}%
                            <span className="text-sm opacity-80">
                              {' '}
                              ({new Intl.NumberFormat('en-CA', {
                                style: 'currency',
                                currency: 'CAD',
                              }).format(changeAbs!)})
                            </span>
                          </span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}