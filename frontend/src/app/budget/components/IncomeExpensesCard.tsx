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
  const [expandedIncome, setExpandedIncome] = useState<Set<number>>(new Set());
  const [expandedExpense, setExpandedExpense] = useState<Set<number>>(new Set());

  const incomeGroups = useMemo(() => {
    const groups = new Map<number, any[]>();
    const items = summary.income_items || [];

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
  }, [summary.income_items]);

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
    <Card className="shadow-lg rounded-xl overflow-hidden flex flex-col h-[520px]">
      <CardHeader className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <CardTitle className="text-xl font-bold">Income & Expenses</CardTitle>
          <Button
            variant="default"
            size="sm"
            className="h-8 gap-1"
            onClick={onAdd}
          >
            <Plus className="h-4 w-4 mr-2" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/40 scrollbar-track-transparent">
        <div className="space-y-6 p-4">
          {/* Income Section */}
          <div>
            <div className="flex items-center justify-between mb-2 sticky top-0 bg-background z-10 py-1">
              <h3 className="font-semibold text-base">Income</h3>
              <Badge variant="outline" className="text-green-600">
                {formatCurrency(summary.other_income_monthly)}
              </Badge>
            </div>
            <div className="space-y-1">
              {incomeGroups.map(([catId, items]) => {
                const isExpanded = expandedIncome.has(catId);
                const total = items.reduce((sum, i) => sum + i.amount_monthly, 0);
                const category = items[0]?.category;

                return (
                  <div key={catId} className="border rounded-md overflow-hidden">
                    <button
                      onClick={() => toggleIncomeCategory(catId)}
                      className="w-full flex items-center justify-between py-2.5 px-3 bg-muted/50 hover:bg-muted/70 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
                        <span className="font-medium text-sm">
                          {category?.name || `Category ${catId}`}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {items.length}
                        </Badge>
                      </div>
                      <span className="text-sm font-medium text-green-600">
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
                            <div className="text-right font-medium text-green-600">
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

          {/* Expense Section */}
          <div>
            <div className="flex items-center justify-between mb-2 sticky top-0 bg-background z-10 py-1">
              <h3 className="font-semibold text-base">Expenses</h3>
              <Badge variant="outline" className="text-red-600">
                {formatCurrency(summary.total_expenses_monthly)}
              </Badge>
            </div>
            <div className="space-y-1">
              {expenseGroups.map(([catId, items]) => {
                const isExpanded = expandedExpense.has(catId);
                const total = items.reduce((sum, i) => sum + i.amount_monthly, 0);
                const category = items[0]?.category;

                return (
                  <div key={catId} className="border rounded-md overflow-hidden">
                    <button
                      onClick={() => toggleExpenseCategory(catId)}
                      className="w-full flex items-center justify-between py-2.5 px-3 bg-muted/50 hover:bg-muted/70 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
                        <span className="font-medium text-sm">
                          {category?.name || `Category ${catId}`}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {items.length}
                        </Badge>
                      </div>
                      <span className="text-sm font-medium text-red-600">
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
                            <div className="text-right font-medium text-red-600">
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
      </CardContent>
    </Card>
  );
}