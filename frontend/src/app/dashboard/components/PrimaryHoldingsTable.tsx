// src/app/dashboard/components/PrimaryHoldingsTable.tsx
'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
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
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useAllHoldings } from '@/lib/queries';

interface UnderlyingDetail {
  symbol: string;
  allocation_percent?: number | null;
  current_price?: number | null;
  daily_change?: number | null;
  daily_change_percent?: number | null;
}

interface Holding {
  id: number;
  symbol: string;
  type?: 'stock' | 'etf';
  current_price: number | null;
  market_value: number | null;
  daily_change: number | null;
  daily_change_percent: number | null;
  day_chart?: { time: number; price: number }[];
  underlying_details?: UnderlyingDetail[];
}

interface Props {
  totalValue?: number;
}

export function PrimaryHoldingsTable({ totalValue = 0 }: Props) {
  const { data: holdings = [], isLoading } = useAllHoldings();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const primaryHoldings: Holding[] = holdings.filter(
    (h): h is Holding & { type: 'stock' | 'etf' } =>
      h.type === 'stock' || h.type === 'etf'
  );

  const localTotal = primaryHoldings.reduce((sum, h) => sum + (h.market_value || 0), 0);
  const effectiveTotal = totalValue > 0 ? totalValue : localTotal;

  const sortedHoldings = [...primaryHoldings].sort((a, b) => {
    const allocA =
      effectiveTotal > 0 && a.market_value !== null
        ? (a.market_value / effectiveTotal) * 100
        : 0;
    const allocB =
      effectiveTotal > 0 && b.market_value !== null
        ? (b.market_value / effectiveTotal) * 100
        : 0;
    return allocB - allocA;
  });

  const formatPrice = (value: number | null) =>
    value !== null
      ? new Intl.NumberFormat('en-CA', {
          style: 'currency',
          currency: 'CAD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(value)
      : '-';

  const formatPercent = (value: number | null) => {
    if (value == null) return '-';
    const isPositive = value >= 0;
    return (
      <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
        {isPositive ? '+' : ''}{value.toFixed(2)}%
      </span>
    );
  };

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
                <TableHead className="text-right">Daily Change</TableHead>
                <TableHead className="text-right">Allocation</TableHead>
                <TableHead>Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHoldings.map((h) => {
                const isExpanded = expandedIds.has(h.id);
                const hasUnderlyings =
                  h.type === 'etf' && h.underlying_details && h.underlying_details.length > 0;

                const allocation =
                  effectiveTotal > 0 && h.market_value !== null
                    ? (h.market_value / effectiveTotal) * 100
                    : 0;

                const isPositive = (h.daily_change_percent || 0) >= 0;
                const changeAbs = h.daily_change !== null ? Math.abs(h.daily_change) : null;

                let chartData = h.day_chart || [];
                if (chartData.length === 0 && h.current_price !== null) {
                  chartData = [{ time: 0, price: h.current_price }];
                } else if (chartData.length === 1) {
                  chartData = [...chartData, { ...chartData[0], time: 1 }];
                }

                return (
                  <React.Fragment key={h.id}>
                    {/* Main holding row */}
                    <TableRow className={isExpanded ? 'bg-muted/20' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {hasUnderlyings && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => toggleExpand(h.id)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <span className="font-semibold">{h.symbol}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-right font-medium">
                        {formatPrice(h.current_price)}
                      </TableCell>

                      <TableCell className="text-right">
                        {h.daily_change_percent != null ? (
                          <div className="flex flex-col items-end">
                            <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
                              {isPositive ? '+' : ''}{h.daily_change_percent.toFixed(2)}%
                            </span>
                            <span className="text-sm opacity-80">
                              ({changeAbs !== null ? formatPrice(changeAbs) : '-'})
                            </span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>

                      <TableCell className="text-right font-medium">
                        {allocation.toFixed(1)}%
                      </TableCell>

                      <TableCell className="py-2">
                        <ResponsiveContainer width={140} height={60}>
                          <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                            <XAxis hide />
                            <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} hide />
                            <Line
                              type="monotone"
                              dataKey="price"
                              stroke={isPositive ? '#10b981' : '#ef4444'}
                              strokeWidth={2}
                              dot={false}
                            />
                            <Tooltip
                              cursor={{ stroke: '#e0e0e0', strokeDasharray: '3 3' }}
                              content={({ active, payload }) => {
                                if (active && payload && payload.length > 0) {
                                  const price = payload[0].value as number;
                                  return (
                                    <div className="rounded border bg-white px-2 py-1 text-xs font-medium shadow-sm">
                                      {formatPrice(price)}
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

                    {/* Compact underlying sub-table */}
                    {isExpanded && hasUnderlyings && (
                      <TableRow key={`underlyings-${h.id}`}>
                        <TableCell colSpan={5} className="p-0">
                          <div className="pl-8 py-2 bg-muted/20">
                            <Table className="text-xs">
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="px-3 py-1 text-xs font-medium">
                                    Underlying Symbol
                                  </TableHead>
                                  <TableHead className="px-3 py-1 text-right text-xs font-medium">
                                    Allocation %
                                  </TableHead>
                                  <TableHead className="px-3 py-1 text-right text-xs font-medium">
                                    Current Price
                                  </TableHead>
                                  <TableHead className="px-3 py-1 text-right text-xs font-medium">
                                    Daily %
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {h.underlying_details!.map((u) => (
                                  <TableRow key={u.symbol}>
                                    <TableCell className="px-3 py-1.5 font-medium">
                                      {u.symbol}
                                    </TableCell>
                                    <TableCell className="px-3 py-1.5 text-right">
                                      {u.allocation_percent != null
                                        ? `${u.allocation_percent.toFixed(2)}%`
                                        : '-'}
                                    </TableCell>
                                    <TableCell className="px-3 py-1.5 text-right">
                                      {formatPrice(u.current_price)}
                                    </TableCell>
                                    <TableCell className="px-3 py-1.5 text-right">
                                      {formatPercent(u.daily_change_percent)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}