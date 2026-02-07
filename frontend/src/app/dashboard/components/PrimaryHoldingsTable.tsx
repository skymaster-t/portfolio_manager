// src/app/dashboard/components/PrimaryHoldingsTable.tsx (updated: flat line fallback if no day_chart data – visible line after hours; faint X/Y axis lines (no labels/ticks); line connecting points colored green/red; domain padding; reliable premium mini chart)
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
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
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
  day_chart?: { time: number; price: number }[];
}

interface Props {
  totalValue: number;
}

export function PrimaryHoldingsTable({ totalValue }: Props) {
  const { data: holdings = [], isLoading } = useAllHoldings();

  const primaryHoldings = holdings.filter((h: Holding) => h.type === 'stock' || h.type === 'etf');

  const localTotal = primaryHoldings.reduce((sum, h) => sum + (h.market_value || 0), 0);
  const effectiveTotal = totalValue > 0 ? totalValue : localTotal;

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
                <TableHead className="text-center">1-Day Chart</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHoldings.map((h) => {
                const isPositive = (h.daily_change_percent || 0) >= 0;
                const changeAbs = h.daily_change !== null ? Math.abs(h.daily_change) : null;
                const alloc = effectiveTotal > 0 && h.market_value !== null ? (h.market_value / effectiveTotal) * 100 : 0;

                // Chart data – use day_chart if available, fallback flat line from current_price
                const chartPoints = h.day_chart && h.day_chart.length > 0 ? h.day_chart : [];
                const chartData = chartPoints.length > 0
                  ? chartPoints.map(p => ({ price: p.price }))
                  : Array(20).fill({ price: h.current_price || 0 }); // Flat line – visible after hours

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
                          <span className={`font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {isPositive ? '+' : ''}{h.daily_change_percent.toFixed(2)}%
                          </span>
                          <span className={`text-sm opacity-80 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            ({new Intl.NumberFormat('en-CA', {
                              style: 'currency',
                              currency: 'CAD',
                            }).format(changeAbs!)})
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      <ResponsiveContainer width={140} height={60}>
                        <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                          {/* Faint axis lines – no labels/ticks */}
                          <XAxis hide />
                          <YAxis
                            domain={['dataMin - 0.5', 'dataMax + 0.5']}
                            hide
                          />
                          <CartesianGrid stroke="none" />

                          {/* Line – green/red */}
                          <Line
                            type="monotone"
                            dataKey="price"
                            stroke={isPositive ? '#10b981' : '#ef4444'}
                            strokeWidth={2}
                            dot={false}
                          />

                          {/* Tooltip – price on hover */}
                          <Tooltip
                            cursor={{ stroke: '#e0e0e0', strokeDasharray: '3 3', strokeOpacity: 0.5 }}
                            content={({ active, payload }) => {
                              if (active && payload && payload.length > 0) {
                                const price = payload[0].value as number;
                                return (
                                  <div className="bg-white border border-gray-300 rounded shadow-sm px-2 py-1 text-xs font-medium">
                                    {new Intl.NumberFormat('en-CA', {
                                      style: 'currency',
                                      currency: 'CAD',
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    }).format(price)}
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
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