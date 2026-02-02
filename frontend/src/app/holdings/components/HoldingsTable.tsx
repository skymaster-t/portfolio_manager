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
  daily_change_percent?: number;
  all_time_gain_loss?: number;
  underlying_details?: {
    symbol: string;
    allocation_percent?: number;
    current_price?: number;
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
                {/* Main row – whole row clickable if has underlyings */}
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
                  <TableCell>
                    {holding.daily_change_percent !== undefined ? (
                      <Badge
                        variant={
                          holding.daily_change_percent >= 0 ? 'default' : 'destructive'
                        }
                      >
                        {holding.daily_change_percent >= 0 ? '+' : ''}
                        {holding.daily_change_percent.toFixed(2)}%
                      </Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell
                    className={holding.all_time_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}
                  >
                    {holding.all_time_gain_loss
                      ? currencyFormatter.format(
                          displayCurrency === 'CAD'
                            ? holding.all_time_gain_loss * exchangeRate
                            : holding.all_time_gain_loss
                        )
                      : '-'}
                  </TableCell>
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

                {/* Underlying details row – not clickable */}
                {hasUnderlyings(holding) &&
                  expandedHoldings.has(holding.id) && (
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
                                  {u.allocation_percent
                                    ? `${u.allocation_percent.toFixed(2)}%`
                                    : '-'}
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
                                <TableCell>
                                  {u.daily_change_percent !== undefined ? (
                                    <Badge
                                      variant={
                                        u.daily_change_percent >= 0 ? 'default' : 'destructive'
                                      }
                                    >
                                      {u.daily_change_percent >= 0 ? '+' : ''}
                                      {u.daily_change_percent.toFixed(2)}%
                                    </Badge>
                                  ) : '-'}
                                </TableCell>
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