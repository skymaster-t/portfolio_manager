// src/app/holdings/components/HoldingsTable.tsx (updated: edit/delete buttons have stronger, colored hover highlights + larger icons)
'use client';

import { Fragment } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Edit, Trash2, ChevronRight, ChevronDown } from 'lucide-react';

interface Holding {
  id: number;
  symbol: string;
  type: 'stock' | 'etf';
  quantity: number;
  purchase_price: number;
  current_price?: number;
  market_value?: number;
  daily_change?: number;
  daily_change_percent?: number;
  all_time_gain_loss?: number;
  all_time_change_percent?: number;
  underlying_details?: {
    symbol: string;
    allocation_percent?: number | null;
    current_price?: number;
    daily_change?: number;
    daily_change_percent?: number;
  }[];
}

interface Props {
  holdings: Holding[];
  portfolioName: string;
  expandedHoldings: Set<number>;
  onToggleExpand: (id: number) => void;
  onEditHolding: (h: Holding) => void;
  onDeleteHolding: (h: Holding) => void;
  displayCurrency: 'CAD' | 'USD';
  exchangeRate: number;
  isLoading: boolean;
}

export function HoldingsTable({
  holdings,
  portfolioName,
  expandedHoldings,
  onToggleExpand,
  onEditHolding,
  onDeleteHolding,
  displayCurrency,
  exchangeRate,
  isLoading,
}: Props) {
  const formatter = new Intl.NumberFormat(displayCurrency === 'CAD' ? 'en-CA' : 'en-US', {
    style: 'currency',
    currency: displayCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const isCadTicker = (symbol: string) => symbol.toUpperCase().endsWith('.TO');

  const getDisplayAmount = (nativeAmount: number | undefined, isCad: boolean): number => {
    if (nativeAmount === undefined || nativeAmount === null) return 0;
    const cadAmount = isCad ? nativeAmount : nativeAmount * exchangeRate;
    return displayCurrency === 'CAD' ? cadAmount : cadAmount / exchangeRate;
  };

  const formatDailyChange = (holding: Holding) => {
    const isCad = isCadTicker(holding.symbol);
    if (holding.daily_change == null || holding.daily_change_percent == null) return '-';
    const amount = formatter.format(getDisplayAmount(holding.daily_change, isCad));
    const percent = `${holding.daily_change_percent >= 0 ? '+' : ''}${holding.daily_change_percent.toFixed(2)}%`;
    return `${amount} (${percent})`;
  };

  const formatAllTime = (holding: Holding) => {
    const isCad = isCadTicker(holding.symbol);
    if (holding.all_time_gain_loss == null || holding.all_time_change_percent == null) return '-';
    const amount = formatter.format(getDisplayAmount(holding.all_time_gain_loss, isCad));
    const percent = `${holding.all_time_change_percent >= 0 ? '+' : ''}${holding.all_time_change_percent.toFixed(2)}%`;
    return `${amount} (${percent})`;
  };

  const formatUnderlyingDaily = (u: any) => {
    if (u.daily_change == null || u.daily_change_percent == null) return '-';
    const amount = formatter.format(getDisplayAmount(u.daily_change, isCadTicker(u.symbol)));
    const percent = `${u.daily_change_percent >= 0 ? '+' : ''}${u.daily_change_percent.toFixed(2)}%`;
    return `${amount} (${percent})`;
  };

  const hasUnderlyings = (holding: Holding) =>
    holding.type === 'etf' && (holding.underlying_details?.length || 0) > 0;

  const portfolioTotalValue = holdings.reduce(
    (sum, h) => sum + (h.market_value || 0),
    0
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            <Skeleton className="h-8 w-64" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Ratio</TableHead>
                <TableHead className="text-center">Type</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Purchase Price</TableHead>
                <TableHead>Current Price</TableHead>
                <TableHead>Market Value</TableHead>
                <TableHead>Daily ∆</TableHead>
                <TableHead>All-Time ∆</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(8)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Skeleton className="h-8 w-8 rounded" />
                      <Skeleton className="h-8 w-8 rounded" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  if (holdings.length === 0) {
    return (
      <Card className="mt-16">
        <CardHeader>
          <CardTitle className="text-2xl">Holdings – {portfolioName}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center py-12 text-muted-foreground">
            No holdings yet – add one using the button above.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Holdings – {portfolioName}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead className="text-right">Ratio</TableHead>
              <TableHead className="text-center">Type</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Purchase Price</TableHead>
              <TableHead>Current Price</TableHead>
              <TableHead>Market Value</TableHead>
              <TableHead>Daily ∆</TableHead>
              <TableHead>All-Time ∆</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map((holding) => {
              const isCad = isCadTicker(holding.symbol);
              const isExpanded = expandedHoldings.has(holding.id);

              const ratio =
                portfolioTotalValue > 0 && holding.market_value != null
                  ? (holding.market_value / portfolioTotalValue) * 100
                  : 0;

              return (
                <Fragment key={holding.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => hasUnderlyings(holding) && onToggleExpand(holding.id)}
                  >
                    <TableCell>
                      {hasUnderlyings(holding) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand(holding.id);
                          }}
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{holding.symbol}</TableCell>
                    <TableCell className="text-right font-medium">
                      {holding.market_value != null ? `${ratio.toFixed(2)}%` : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {holding.type === 'stock' && (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          Stock
                        </Badge>
                      )}
                      {holding.type === 'etf' && <Badge variant="secondary">ETF</Badge>}
                    </TableCell>
                    <TableCell>{holding.quantity.toLocaleString()}</TableCell>
                    <TableCell>
                      {formatter.format(getDisplayAmount(holding.purchase_price, isCad))}
                    </TableCell>
                    <TableCell>
                      {holding.current_price != null
                        ? formatter.format(getDisplayAmount(holding.current_price, isCad))
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {holding.market_value != null
                        ? formatter.format(getDisplayAmount(holding.market_value, isCad))
                        : '-'}
                    </TableCell>
                    <TableCell
                      className={`font-bold ${holding.daily_change >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {formatDailyChange(holding)}
                    </TableCell>
                    <TableCell
                      className={`font-bold ${holding.all_time_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {formatAllTime(holding)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {/* Edit button – stronger indigo hover highlight + larger icon */}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditHolding(holding);
                          }}
                          className="hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
                        >
                          <Edit className="h-5 w-5" />
                        </Button>
                        {/* Delete button – stronger red hover highlight + larger icon */}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteHolding(holding);
                          }}
                          className="hover:bg-red-100 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {hasUnderlyings(holding) && isExpanded && (
                    <TableRow>
                      <TableCell colSpan={11} className="bg-muted/50 p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Underlying</TableHead>
                              <TableHead className="text-right">Allocation</TableHead>
                              <TableHead className="text-right">Price</TableHead>
                              <TableHead className="text-right">Daily ∆</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {holding.underlying_details!.map((u) => {
                              const uIsCad = isCadTicker(u.symbol);
                              const uDisplayedPrice = getDisplayAmount(u.current_price, uIsCad);
                              const dailySignClass = u.daily_change_percent >= 0 ? 'text-green-600' : 'text-red-600';

                              return (
                                <TableRow key={u.symbol}>
                                  <TableCell className="font-medium">{u.symbol}</TableCell>
                                  <TableCell className="text-right">
                                    {u.allocation_percent != null
                                      ? `${u.allocation_percent.toFixed(2)}%`
                                      : 'N/A'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {u.current_price != null
                                      ? formatter.format(uDisplayedPrice)
                                      : '-'}
                                  </TableCell>
                                  <TableCell className={`text-right ${dailySignClass}`}>
                                    {formatUnderlyingDaily(u)}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}