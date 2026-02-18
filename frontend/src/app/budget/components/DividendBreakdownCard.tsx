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
    <Card className="flex flex-col max-h-[480px] overflow-hidden"> {/* Added max height to constrain card */}
      <CardHeader className="py-3 flex-shrink-0">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Dividend Breakdown</CardTitle>
          <Button variant="outline" size="sm" onClick={() => onOpenDividend('add')}>
            Add Manual Override
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-3 flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="border rounded-md flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-3 pb-3 pt-1">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background border-b shadow-sm">
                  <TableRow className="text-sm">
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
                    <TableRow key={item.holding_id} className="text-sm hover:bg-muted/50">
                      <TableCell className="font-medium py-2">{item.symbol}</TableCell>
                      <TableCell className="py-2">{item.quantity.toLocaleString()}</TableCell>
                      <TableCell className="py-2">
                        {item.dividend_annual_per_share
                          ? formatCurrency(item.dividend_annual_per_share)
                          : 'Auto'}
                        {item.is_manual && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Manual
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-2">{formatCurrency(item.annual_dividends_cad)}</TableCell>
                      <TableCell className="py-2">{formatCurrency(item.monthly_dividends_cad)}</TableCell>
                      <TableCell className="text-right py-2">
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}