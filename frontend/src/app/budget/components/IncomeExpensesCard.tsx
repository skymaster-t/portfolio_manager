// src/app/budget/components/IncomeExpensesCard.tsx
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronDown, ChevronRight, Edit, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface IncomeExpensesCardProps {
  summary: any;
  onAdd: () => void;
  onEdit: (item: any) => void;
  onDelete: (id: number, name: string) => void;
}

export function IncomeExpensesCard({
  summary,
  onAdd,
  onEdit,
  onDelete,
}: IncomeExpensesCardProps) {
  const TABLE_MAX_HEIGHT = '340px';

  // Track which categories are expanded (separate state for income/expense)
  const [expandedIncome, setExpandedIncome] = useState<Set<number>>(new Set());
  const [expandedExpense, setExpandedExpense] = useState<Set<number>>(new Set());

  // Group income items by category_id
  const incomeGroups = useMemo(() => {
    const groups = new Map<number, any[]>();
    const items = summary.income_items || [];

    items.forEach((item: any) => {
      const catId = item.category_id;
      if (!groups.has(catId)) groups.set(catId, []);
      groups.get(catId)!.push(item);
    });

    // Sort groups by category name (need categories data or fallback to id)
    return Array.from(groups.entries()).sort((a, b) => {
      const nameA = a[1][0]?.category?.name || `Category ${a[0]}`;
      const nameB = b[1][0]?.category?.name || `Category ${b[0]}`;
      return nameA.localeCompare(nameB);
    });
  }, [summary.income_items]);

  // Group expense items by category_id
  const expenseGroups = useMemo(() => {
    const groups = new Map<number, any[]>();
    const items = summary.expense_items || [];

    items.forEach((item: any) => {
      const catId = item.category_id;
      if (!groups.has(catId)) groups.set(catId, []);
      groups.get(catId)!.push(item);
    });

    return Array.from(groups.entries()).sort((a, b) => {
      const nameA = a[1][0]?.category?.name || `Category ${a[0]}`;
      const nameB = b[1][0]?.category?.name || `Category ${b[0]}`;
      return nameA.localeCompare(nameB);
    });
  }, [summary.expense_items]);

  const toggleIncomeCategory = (catId: number) => {
    setExpandedIncome(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const toggleExpenseCategory = (catId: number) => {
    setExpandedExpense(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="py-3 flex-shrink-0">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Income & Expenses</CardTitle>
          <Button onClick={onAdd} size="sm">
            <Plus className="mr-1 h-3 w-3" /> Add Item
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-3 flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="grid md:grid-cols-2 gap-6 flex-1 min-h-0">
          {/* Income Side */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <h3 className="font-semibold">Income</h3>
              <Badge variant="secondary" className="text-xs">
                {formatCurrency(summary.other_income_monthly + summary.expected_dividend_income_monthly_cad)} / mo
              </Badge>
            </div>

            <div className="border rounded-md overflow-hidden flex flex-col flex-1">
              <div className="flex-1 overflow-y-auto" style={{ maxHeight: TABLE_MAX_HEIGHT }}>
                <div className="divide-y divide-border">
                  {incomeGroups.map(([catId, items]) => {
                    const category = items[0]?.category;
                    const isExpanded = expandedIncome.has(catId);
                    const total = items.reduce((sum, i) => sum + i.amount_monthly, 0);

                    return (
                      <div key={catId}>
                        <button
                          onClick={() => toggleIncomeCategory(catId)}
                          className="w-full flex items-center justify-between py-2.5 px-4 bg-muted/70 hover:bg-muted/90 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <span className="font-medium text-sm">
                              {category?.name || `Category ${catId}`}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {items.length}
                            </Badge>
                          </div>
                          <span className="text-sm font-medium">
                            {formatCurrency(total)}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="bg-muted/20">
                            {items.map((item: any) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between py-2 px-6 border-t border-border/50 hover:bg-muted/30 transition-colors text-sm"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate max-w-[220px]">
                                    {item.name}
                                  </div>
                                </div>
                                <div className="text-right font-medium">
                                  {formatCurrency(item.amount_monthly)}
                                </div>
                                <div className="flex items-center gap-1 ml-4">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => onEdit(item)}
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => onDelete(item.id, item.name)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Expenses Side – identical structure */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <h3 className="font-semibold">Expenses</h3>
              <Badge variant="secondary" className="text-xs">
                {formatCurrency(summary.total_expenses_monthly)} / mo
              </Badge>
            </div>

            <div className="border rounded-md overflow-hidden flex flex-col flex-1">
              <div className="flex-1 overflow-y-auto" style={{ maxHeight: TABLE_MAX_HEIGHT }}>
                <div className="divide-y divide-border">
                  {expenseGroups.map(([catId, items]) => {
                    const category = items[0]?.category;
                    const isExpanded = expandedExpense.has(catId);
                    const total = items.reduce((sum, i) => sum + i.amount_monthly, 0);

                    return (
                      <div key={catId}>
                        <button
                          onClick={() => toggleExpenseCategory(catId)}
                          className="w-full flex items-center justify-between py-2.5 px-4 bg-muted/70 hover:bg-muted/90 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <span className="font-medium text-sm">
                              {category?.name || `Category ${catId}`}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {items.length}
                            </Badge>
                          </div>
                          <span className="text-sm font-medium">
                            {formatCurrency(total)}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="bg-muted/20">
                            {items.map((item: any) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between py-2 px-6 border-t border-border/50 hover:bg-muted/30 transition-colors text-sm"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate max-w-[220px]">
                                    {item.name}
                                  </div>
                                </div>
                                <div className="text-right font-medium">
                                  {formatCurrency(item.amount_monthly)}
                                </div>
                                <div className="flex items-center gap-1 ml-4">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => onEdit(item)}
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => onDelete(item.id, item.name)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}