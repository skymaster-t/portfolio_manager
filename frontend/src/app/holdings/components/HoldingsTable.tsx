// src/app/holdings/components/HoldingsTable.tsx (fixed hydration + Turbopack parsing error: all {/* */} comments placed on their own lines with newlines for safe parsing; main table medium text-sm + standard px-4 py-2 padding; underlying sub-table medium text-sm + standard padding; indented auto-sized; professional readable density)
'use client';

import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  type: 'stock' | 'etf';
  quantity: number;
  purchase_price: number;
  current_price?: number | null;
  market_value?: number | null;
  daily_change_percent?: number | null;
  all_time_change_percent?: number | null;
  all_time_gain_loss?: number | null;
  currency: 'CAD' | 'USD';
  underlying_details?: UnderlyingDetail[];
}

interface Props {
  holdings: Holding[];
  totalValue: number;
  rate: number;
  onEdit: (holding: Holding) => void;
  onDelete: (holding: Holding) => void;
  onAdd?: () => void;
}

export default function HoldingsTable({ holdings, totalValue, rate, onEdit, onDelete, onAdd }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatCurrency = (value: number | undefined | null, currency: 'CAD' | 'USD') => {
    if (value == null) return '-';
    const prefix = currency === 'CAD' ? 'C$' : '$';
    return `${prefix}${value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (value: number | undefined | null) => {
    if (value == null) return '-';
    const color = value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-muted-foreground';
    return <span className={cn('font-medium', color)}>{value >= 0 ? '+' : ''}{value.toFixed(2)}%</span>;
  };

  return (
    <div className="space-y-6">
      {onAdd && (
        <div className="flex justify-end">
          <Button
            onClick={onAdd}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Holding
          </Button>
        </div>
      )}

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 px-3 py-2" />
              <TableHead className="px-4 py-2">Symbol</TableHead>
              <TableHead className="px-4 py-2">Currency</TableHead>
              <TableHead className="text-right px-4 py-2">Quantity</TableHead>
              <TableHead className="text-right px-4 py-2">Avg Cost</TableHead>
              <TableHead className="text-right px-4 py-2">Current Price</TableHead>
              <TableHead className="text-right px-4 py-2">Market Value</TableHead>
              <TableHead className="text-right px-4 py-2">Allocation</TableHead>
              <TableHead className="text-right px-4 py-2">Daily %</TableHead>
              <TableHead className="text-right px-4 py-2">Total %</TableHead>
              <TableHead className="text-right px-4 py-2">Gain/Loss</TableHead>
              <TableHead className="w-[100px] px-3 py-2">Actions</TableHead>
            </TableRow>
          </TableHeader>

          {/* */}
          <TableBody>
            {/* */}
            {holdings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                  No holdings in this portfolio yet.
                </TableCell>
              </TableRow>
            ) : (
              holdings.map((holding) => {
                const contribValue =
                  holding.currency === 'USD' && holding.market_value
                    ? holding.market_value * rate
                    : holding.market_value || 0;

                const allocation = totalValue > 0 ? ((contribValue / totalValue) * 100).toFixed(1) : '0.0';
                const isExpanded = expandedIds.has(holding.id);
                const hasUnderlyings = holding.type === 'etf' && holding.underlying_details && holding.underlying_details.length > 0;

                return (
                  <React.Fragment key={holding.id}>
                    <TableRow>
                      <TableCell className="px-3 py-2">
                        {hasUnderlyings && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => toggleExpand(holding.id)}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        )}
                      </TableCell>

                      <TableCell className="px-4 py-2 font-medium">{holding.symbol}</TableCell>

                      <TableCell className="px-4 py-2">
                        <Badge variant="outline">{holding.currency}</Badge>
                      </TableCell>

                      <TableCell className="text-right px-4 py-2">
                        {holding.quantity.toLocaleString('en-CA')}
                      </TableCell>

                      <TableCell className="text-right px-4 py-2">
                        {formatCurrency(holding.purchase_price, holding.currency)}
                      </TableCell>

                      <TableCell className="text-right px-4 py-2">
                        {formatCurrency(holding.current_price, holding.currency)}
                      </TableCell>

                      <TableCell className="text-right px-4 py-2 font-medium">
                        {formatCurrency(contribValue, 'CAD')}
                      </TableCell>

                      <TableCell className="text-right px-4 py-2">{allocation}%</TableCell>

                      <TableCell className="text-right px-4 py-2">
                        {formatPercent(holding.daily_change_percent)}
                      </TableCell>

                      <TableCell className="text-right px-4 py-2">
                        {formatPercent(holding.all_time_change_percent)}
                      </TableCell>

                      <TableCell className="text-right px-4 py-2">
                        {formatCurrency(holding.all_time_gain_loss ?? undefined, holding.currency)}
                      </TableCell>

                      <TableCell className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="icon" variant="ghost" onClick={() => onEdit(holding)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(holding)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* */}

                    {isExpanded && hasUnderlyings && (
                      <TableRow>
                        <TableCell colSpan={12} className="p-0">
                          <div className="pl-12 py-3 bg-muted/30 border-t">
                            <Table className="text-sm w-auto">
                              <TableHeader>
                                {/* */}
                                <TableRow>
                                  <TableHead className="px-4 py-2">Underlying Symbol</TableHead>
                                  {/* */}
                                  <TableHead className="text-right px-4 py-2">Allocation %</TableHead>
                                  {/* */}
                                  <TableHead className="text-right px-4 py-2">Current Price</TableHead>
                                  {/* */}
                                  <TableHead className="text-right px-4 py-2">Daily %</TableHead>
                                </TableRow>
                              </TableHeader>

                              {/* */}
                              <TableBody>
                                {/* */}
                                {holding.underlying_details!.map((u, idx) => (
                                  <React.Fragment key={idx}>
                                    <TableRow>
                                      <TableCell className="px-4 py-2 font-medium">{u.symbol}</TableCell>

                                      <TableCell className="text-right px-4 py-2">
                                        {u.allocation_percent != null ? `${u.allocation_percent.toFixed(2)}%` : '-'}
                                      </TableCell>

                                      <TableCell className="text-right px-4 py-2">
                                        {u.current_price != null ? formatCurrency(u.current_price, holding.currency) : '-'}
                                      </TableCell>

                                      <TableCell className="text-right px-4 py-2">
                                        {formatPercent(u.daily_change_percent)}
                                      </TableCell>
                                    </TableRow>

                                    {/* */}
                                  </React.Fragment>
                                ))}
                              </TableBody>

                              {/* */}
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}

                    {/* */}
                  </React.Fragment>
                );
              })
            )}

            {/* */}
          </TableBody>

          {/* */}
        </Table>
      </div>
    </div>
  );
}