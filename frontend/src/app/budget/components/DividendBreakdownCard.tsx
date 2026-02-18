// src/app/budget/components/DividendBreakdownCard.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DividendBreakdownCardProps {
  summary: any;
  allHoldings: any[];
  onOpenDividend: (mode: 'add' | 'edit', holdingId?: number) => void;
  onDeleteManualDividend: (holdingId: number, symbol: string) => void;
}

export function DividendBreakdownCard({
  summary,
  allHoldings,
  onOpenDividend,
  onDeleteManualDividend,
}: DividendBreakdownCardProps) {
  return (
    <Card className="shadow-lg rounded-xl overflow-hidden flex flex-col h-[520px]">
      <CardHeader className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 flex-shrink-0">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-bold">Dividend Breakdown</CardTitle>
          <Button variant="outline" size="sm" onClick={() => onOpenDividend('add')}>
            Add Manual Override
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/40 scrollbar-track-transparent">
        <div className="p-3">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background border-b">
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Annual / Share</TableHead>
                <TableHead>Annual Total (CAD)</TableHead>
                <TableHead>Monthly (CAD)</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.dividend_breakdown.map((item: any) => (
                <TableRow key={item.holding_id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{item.symbol}</TableCell>
                  <TableCell>{item.quantity.toLocaleString()}</TableCell>
                  <TableCell>
                    {item.dividend_annual_per_share
                      ? formatCurrency(item.dividend_annual_per_share)
                      : 'Auto'}
                    {item.is_manual && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Manual
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatCurrency(item.annual_dividends_cad)}</TableCell>
                  <TableCell>{formatCurrency(item.monthly_dividends_cad)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onOpenDividend('edit', item.holding_id)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>

                      <TooltipProvider>
                        {item.is_manual && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => onDeleteManualDividend(item.holding_id, item.symbol)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Remove manual override</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TooltipProvider>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {(!summary.dividend_breakdown || summary.dividend_breakdown.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No dividend-paying holdings found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}