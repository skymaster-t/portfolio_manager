// frontend/src/app/holdings/components/HoldingsTable.tsx
'use client';

import { useState, useMemo, Fragment } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';

interface UnderlyingDetail {
  symbol: string;
  allocation_percent: number | null;
  current_price: number | null;
  daily_change_percent: number | null;
}

interface Holding {
  id: number;
  symbol: string;
  type: 'stock' | 'etf';
  quantity: number;
  purchase_price: number;
  current_price: number | null;
  market_value: number | null;
  daily_change_percent: number | null;
  all_time_change_percent: number | null;
  currency: 'CAD' | 'USD';
  underlying_details: UnderlyingDetail[];
}

interface Props {
  holdings: Holding[];
  totalValue: number;
  rate: number;
}

const formatCAD = (val: number) => val.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
const formatNative = (val: number, currency: 'CAD' | 'USD') =>
  val.toLocaleString(currency === 'CAD' ? 'en-CA' : 'en-US', { style: 'currency', currency });
const formatPercent = (val: number | null) => (val === null ? '—' : `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`);

type SortKey =
  | 'symbol'
  | 'currency'
  | 'quantity'
  | 'avg_cost'
  | 'price'
  | 'market_value'
  | 'percent'
  | 'daily'
  | 'total';

export default function HoldingsTable({ holdings, totalValue, rate }: Props) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('percent');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const enrichedHoldings = useMemo(() => {
    return holdings
      .filter((h) => h.symbol.toLowerCase().includes(search.toLowerCase()))
      .map((h) => {
        const conversion = h.currency === 'CAD' ? 1 : rate;
        const nativeMV = h.market_value || 0;
        const marketCAD = nativeMV * conversion;
        const currentCAD = h.current_price ? h.current_price * conversion : null;
        const avgCostCAD = h.purchase_price * conversion;
        const percent = totalValue > 0 ? (marketCAD / totalValue) * 100 : 0;

        return { ...h, marketCAD, currentCAD, avgCostCAD, percent };
      });
  }, [holdings, search, totalValue, rate]);

  const sortedHoldings = useMemo(() => {
    return [...enrichedHoldings].sort((a, b) => {
      let aVal: any = 0;
      let bVal: any = 0;

      switch (sortKey) {
        case 'symbol':
          aVal = a.symbol.toLowerCase();
          bVal = b.symbol.toLowerCase();
          break;
        case 'currency':
          aVal = a.currency;
          bVal = b.currency;
          break;
        case 'quantity':
          aVal = a.quantity || 0;
          bVal = b.quantity || 0;
          break;
        case 'avg_cost':
          aVal = a.avgCostCAD;
          bVal = b.avgCostCAD;
          break;
        case 'price':
          aVal = a.currentCAD ?? -Infinity;
          bVal = b.currentCAD ?? -Infinity;
          break;
        case 'market_value':
          aVal = a.marketCAD;
          bVal = b.marketCAD;
          break;
        case 'percent':
          aVal = a.percent;
          bVal = b.percent;
          break;
        case 'daily':
          aVal = a.daily_change_percent ?? -Infinity;
          bVal = b.daily_change_percent ?? -Infinity;
          break;
        case 'total':
          aVal = a.all_time_change_percent ?? -Infinity;
          bVal = b.all_time_change_percent ?? -Infinity;
          break;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [enrichedHoldings, sortKey, sortDirection]);

  if (holdings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No holdings in this portfolio
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Input
        placeholder="Search by symbol..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left"><button className="flex items-center gap-1 font-medium hover:text-foreground/80" onClick={() => handleSort('symbol')}>Symbol{sortKey === 'symbol' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}</button></TableHead>
              <TableHead className="text-left"><button className="flex items-center gap-1 font-medium hover:text-foreground/80" onClick={() => handleSort('currency')}>Currency{sortKey === 'currency' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}</button></TableHead>
              <TableHead className="text-left"><button className="flex items-center gap-1 font-medium hover:text-foreground/80" onClick={() => handleSort('quantity')}>Quantity{sortKey === 'quantity' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}</button></TableHead>
              <TableHead className="text-left"><button className="flex items-center gap-1 font-medium hover:text-foreground/80" onClick={() => handleSort('avg_cost')}>Avg. Cost{sortKey === 'avg_cost' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}</button></TableHead>
              <TableHead className="text-left"><button className="flex items-center gap-1 font-medium hover:text-foreground/80" onClick={() => handleSort('price')}>Current Price{sortKey === 'price' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}</button></TableHead>
              <TableHead className="text-left"><button className="flex items-center gap-1 font-medium hover:text-foreground/80" onClick={() => handleSort('market_value')}>Market Value{sortKey === 'market_value' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}</button></TableHead>
              <TableHead className="text-left"><button className="flex items-center gap-1 font-medium hover:text-foreground/80" onClick={() => handleSort('percent')}>% of Portfolio{sortKey === 'percent' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}</button></TableHead>
              <TableHead className="text-left"><button className="flex items-center gap-1 font-medium hover:text-foreground/80" onClick={() => handleSort('daily')}>Daily Change{sortKey === 'daily' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}</button></TableHead>
              <TableHead className="text-left"><button className="flex items-center gap-1 font-medium hover:text-foreground/80" onClick={() => handleSort('total')}>Total Return{sortKey === 'total' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}</button></TableHead>
              <TableHead className="text-left" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedHoldings.map((h) => {
              const isExpandable = h.type === 'etf' && h.underlying_details.length > 0;
              const isExpanded = expanded.has(h.id);

              return (
                <Fragment key={h.id}>
                  <TableRow
                    className={isExpandable ? 'cursor-pointer hover:bg-muted/30' : ''}
                    onClick={() => isExpandable && toggleExpand(h.id)}
                  >
                    <TableCell className="text-left font-medium">
                      <div className="flex items-center">
                        {isExpandable && (
                          <ChevronRight
                            className={`h-4 w-4 mr-2 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        )}
                        {h.symbol}
                        {isExpandable && (
                          <Badge variant="secondary" className="ml-2 rounded-full w-6 h-6 p-0 flex items-center justify-center text-xs">
                            {h.underlying_details.length}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-left"><Badge variant="outline">{h.currency}</Badge></TableCell>
                    <TableCell className="text-left">{h.quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-left">{formatNative(h.purchase_price, h.currency)}</TableCell>
                    <TableCell className="text-left">{h.current_price ? formatNative(h.current_price, h.currency) : '—'}</TableCell>
                    <TableCell className="text-left">{h.market_value ? formatNative(h.market_value, h.currency) : '—'}</TableCell>
                    <TableCell className="text-left font-medium">{h.percent.toFixed(1)}%</TableCell>
                    <TableCell className={`text-left font-semibold ${h.daily_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(h.daily_change_percent)}</TableCell>
                    <TableCell className={`text-left font-semibold ${h.all_time_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(h.all_time_change_percent)}</TableCell>
                    <TableCell className="text-left" />
                  </TableRow>

                  {isExpanded && (
                    <TableRow key={`${h.id}-details`}>
                      <TableCell colSpan={10} className="p-0 bg-muted/20">
                        <div className="p-6">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-left">Underlying</TableHead>
                                <TableHead className="text-left">Allocation %</TableHead>
                                <TableHead className="text-left">Price</TableHead>
                                <TableHead className="text-left">Daily %</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {h.underlying_details.map((u, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-left">{u.symbol}</TableCell>
                                  <TableCell className="text-left">{u.allocation_percent?.toFixed(1) ?? '—'}%</TableCell>
                                  <TableCell className="text-left">{u.current_price ? formatNative(u.current_price, h.currency) : '—'}</TableCell>
                                  <TableCell className={`text-left font-medium ${u.daily_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(u.daily_change_percent)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}