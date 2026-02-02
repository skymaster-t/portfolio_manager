// src/app/holdings/components/HoldingsTable.tsx
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
import { Edit, Trash2, ChevronRight, ChevronDown } from 'lucide-react';

interface Holding {
  id: number;
  symbol: string;
  type: 'stock' | 'etf';
  quantity: number;
  purchase_price: number;
  current_price?: number;
  market_value?: number;
  daily_change?: number; // per share daily dollar change
  daily_change_percent?: number;
  all_time_gain_loss?: number;
  underlying_details?: {
    symbol: string;
    allocation_percent?: number;
    current_price?: number;
    daily_change?: number; // per share daily dollar change from FMP "change"
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
  currencyFormatter: Intl.NumberFormat;
  displayCurrency: 'CAD' | 'USD';
  exchangeRate: number;
}

export function HoldingsTable({
  holdings,
  portfolioName,
  expandedHoldings,
  onToggleExpand,
  onEditHolding,
  onDeleteHolding,
  currencyFormatter,
  displayCurrency,
  exchangeRate,
}: Props) {
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

  const hasUnderlyings = (holding: Holding) =>
    holding.type === 'etf' && (holding.underlying_details?.length || 0) > 0;

  // Main holding daily: percent Badge + total position dollar change
  const formatDailyChange = (holding: Holding) => {
    if (holding.daily_change_percent === undefined || holding.daily_change === undefined) return '-';

    const totalDollar = holding.daily_change * holding.quantity;
    const isPositive = totalDollar >= 0;
    const formattedDollar = currencyFormatter.format(
      displayCurrency === 'CAD' ? totalDollar * exchangeRate : totalDollar
    );

    return (
      <div className="flex items-center gap-2">
        <Badge variant={isPositive ? 'default' : 'destructive'}>
          {isPositive ? '+' : ''}{holding.daily_change_percent.toFixed(2)}%
        </Badge>
        <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
          {isPositive ? '+' : ''}{formattedDollar}
        </span>
      </div>
    );
  };

  // Main all-time G/L: percent Badge + total dollar
  const formatAllTimeGL = (holding: Holding) => {
    if (holding.all_time_gain_loss === undefined) return '-';

    const costBasis = holding.quantity * holding.purchase_price;
    const percent = costBasis > 0 ? (holding.all_time_gain_loss / costBasis) * 100 : 0;
    const isPositive = percent >= 0;
    const formattedDollar = currencyFormatter.format(
      displayCurrency === 'CAD' ? holding.all_time_gain_loss * exchangeRate : holding.all_time_gain_loss
    );

    return (
      <div className="flex items-center gap-2">
        <Badge variant={isPositive ? 'default' : 'destructive'}>
          {isPositive ? '+' : ''}{percent.toFixed(2)}%
        </Badge>
        <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
          {isPositive ? '+' : ''}{formattedDollar}
        </span>
      </div>
    );
  };

  // Underlying daily: percent Badge + per share dollar change (FMP "change")
  const formatUnderlyingDaily = (u: NonNullable<Holding['underlying_details']>[number]) => {
    if (u.daily_change_percent === undefined || u.daily_change === undefined) return '-';

    const isPositive = u.daily_change >= 0;
    const formattedDollar = currencyFormatter.format(
      displayCurrency === 'CAD' ? u.daily_change * exchangeRate : u.daily_change
    );

    return (
      <div className="flex items-center gap-2">
        <Badge variant={isPositive ? 'default' : 'destructive'}>
          {isPositive ? '+' : ''}{u.daily_change_percent.toFixed(2)}%
        </Badge>
        <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
          {isPositive ? '+' : ''}{formattedDollar}
        </span>
      </div>
    );
  };

  return (
    <Card className="mt-16">
      <CardHeader>
        <CardTitle className="text-2xl">Holdings – {portfolioName}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Avg Cost</TableHead>
              <TableHead>Current Price</TableHead>
              <TableHead>Market Value</TableHead>
              <TableHead>Daily ∆</TableHead>
              <TableHead>All-Time G/L</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map((holding) => (
              <Fragment key={holding.id}>
                <TableRow
                  className={hasUnderlyings(holding) ? 'cursor-pointer hover:bg-muted/50' : ''}
                  onClick={hasUnderlyings(holding) ? () => onToggleExpand(holding.id) : undefined}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{holding.symbol}</span>
                      {hasUnderlyings(holding) && (
                        <>
                          <span className="text-sm text-muted-foreground">
                            ({holding.underlying_details!.length})
                          </span>
                          <div className="h-4 w-4">
                            {expandedHoldings.has(holding.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{holding.type.toUpperCase()}</Badge>
                  </TableCell>
                  <TableCell>{holding.quantity.toLocaleString()}</TableCell>
                  <TableCell>
                    {currencyFormatter.format(
                      displayCurrency === 'CAD'
                        ? holding.purchase_price * exchangeRate
                        : holding.purchase_price
                    )}
                  </TableCell>
                  <TableCell>
                    {holding.current_price
                      ? currencyFormatter.format(
                          displayCurrency === 'CAD'
                            ? holding.current_price * exchangeRate
                            : holding.current_price
                        )
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {holding.market_value
                      ? currencyFormatter.format(
                          displayCurrency === 'CAD'
                            ? holding.market_value * exchangeRate
                            : holding.market_value
                        )
                      : '-'}
                  </TableCell>
                  <TableCell>{formatDailyChange(holding)}</TableCell>
                  <TableCell>{formatAllTimeGL(holding)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditHolding(holding);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteHolding(holding);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>

                {hasUnderlyings(holding) && expandedHoldings.has(holding.id) && (
                  <TableRow key={`${holding.id}-underlyings`}>
                    <TableCell colSpan={9} className="bg-muted/50 p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Underlying</TableHead>
                            <TableHead>Allocation</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Daily ∆</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {holding.underlying_details!.map((u) => (
                            <TableRow key={u.symbol}>
                              <TableCell className="font-medium">{u.symbol}</TableCell>
                              <TableCell>
                                {u.allocation_percent ? `${u.allocation_percent.toFixed(2)}%` : '-'}
                              </TableCell>
                              <TableCell>
                                {u.current_price
                                  ? currencyFormatter.format(
                                      displayCurrency === 'CAD'
                                        ? u.current_price * exchangeRate
                                        : u.current_price
                                    )
                                  : '-'}
                              </TableCell>
                              <TableCell>{formatUnderlyingDaily(u)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}