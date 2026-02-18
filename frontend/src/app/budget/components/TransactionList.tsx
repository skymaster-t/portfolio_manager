// src/app/budget/components/TransactionList.tsx
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { format, isWithinInterval, startOfMonth, endOfMonth, subDays, subMonths, startOfYear } from 'date-fns';
import { CalendarIcon, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

import { useTransactions, useCategories } from '@/lib/queries';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

// Predefined range options
type RangeOption = 'all' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';

const RANGE_LABELS: Record<RangeOption, string> = {
  all: 'All Time',
  last7: 'Last 7 Days',
  last30: 'Last 30 Days',
  thisMonth: 'This Month',
  lastMonth: 'Last Month',
  thisYear: 'This Year',
  custom: 'Custom Range',
};

export function TransactionList() {
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const queryClient = useQueryClient();

  // Persist range in localStorage
  const [rangeOption, setRangeOption] = useState<RangeOption>(() => {
    const saved = localStorage.getItem('transactionRangeOption');
    return (saved as RangeOption) || 'thisMonth';
  });

  const [customRange, setCustomRange] = useState<DateRange | undefined>(() => {
    const saved = localStorage.getItem('transactionCustomRange');
    return saved ? JSON.parse(saved) : {
      from: startOfMonth(new Date()),
      to: new Date(),
    };
  });

  useEffect(() => {
    localStorage.setItem('transactionRangeOption', rangeOption);
  }, [rangeOption]);

  useEffect(() => {
    if (rangeOption === 'custom' && customRange) {
      localStorage.setItem('transactionCustomRange', JSON.stringify(customRange));
    }
  }, [customRange, rangeOption]);

  // Compute effective date range
  const effectiveRange = useMemo((): DateRange => {
    const today = new Date();

    switch (rangeOption) {
      case 'last7':
        return { from: subDays(today, 7), to: today };
      case 'last30':
        return { from: subDays(today, 30), to: today };
      case 'thisMonth':
        return { from: startOfMonth(today), to: today };
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
      case 'thisYear':
        return { from: startOfYear(today), to: today };
      case 'custom':
        return customRange || { from: undefined, to: undefined };
      default:
        return { from: undefined, to: undefined };
    }
  }, [rangeOption, customRange]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    if (!effectiveRange.from || !effectiveRange.to) return transactions;

    return transactions.filter((t: any) => {
      const txDate = new Date(t.date);
      return isWithinInterval(txDate, {
        start: effectiveRange.from!,
        end: effectiveRange.to!,
      });
    });
  }, [transactions, effectiveRange]);

  // Calculate totals for range
  const rangeTotals = useMemo(() => {
    let income = 0;
    let expense = 0;

    filteredTransactions.forEach((t: any) => {
      if (t.amount > 0) income += t.amount;
      else expense += Math.abs(t.amount);
    });

    return { income, expense, net: income - expense };
  }, [filteredTransactions]);

  // Group filtered transactions by category (alphabetical)
  const grouped = useMemo(() => {
    const groups = new Map<number, any[]>();
    filteredTransactions.forEach((t: any) => {
      if (!groups.has(t.category_id)) groups.set(t.category_id, []);
      groups.get(t.category_id)!.push(t);
    });

    const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));
    return sortedCategories.filter(c => groups.has(c.id));
  }, [filteredTransactions, categories]);

  // Track expanded categories
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());

  const toggleCategory = (categoryId: number) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) newSet.delete(categoryId);
      else newSet.add(categoryId);
      return newSet;
    });
  };

  const handleCategoryChange = async (transactionId: number, newCategoryId: number) => {
    try {
      await axios.patch(`${API_BASE}/transactions/${transactionId}`, {
        category_id: newCategoryId,
      });

      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['transactionSummary'] });

      toast.success("Category updated");
    } catch (err: any) {
      toast.error(`Failed: ${err.response?.data?.detail || 'Unknown error'}`);
    }
  };

  // Format range for display
  const rangeLabel = useMemo(() => {
    if (!effectiveRange.from) return "All Time";
    if (!effectiveRange.to) return format(effectiveRange.from, "MMMM yyyy");
    return `${format(effectiveRange.from, "MMM d, yyyy")} – ${format(effectiveRange.to, "MMM d, yyyy")}`;
  }, [effectiveRange]);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
  
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }
  
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
  
    try {
      const res = await axios.post(`${API_BASE}/transactions/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Uploaded! ${res.data.processed} transactions processed, ${res.data.new} new, ${res.data.skipped} skipped`);
  
      // Immediate refetch
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['transactionSummary'] }),
      ]);
    } catch (err: any) {
      toast.error(`Upload failed: ${err.response?.data?.detail || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <TooltipProvider>
      <Card className="border border-border/60 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="py-4 px-6 border-b bg-gradient-to-r from-background via-muted/30 to-background">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-semibold tracking-tight">Transactions</CardTitle>

            <div className="flex items-center gap-3">
              {uploading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                  <span>Uploading...</span>
                </div>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    Upload CSV
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Bank transactions
                  </span>

                  {/* Hidden file input */}
                  <input
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </>
              )}
            </div>

            {/* Modern date range picker */}
            <div className="flex items-center gap-5">

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-10 min-w-[280px] px-4 text-sm font-medium justify-between rounded-lg",
                      "border border-primary/30 hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary/20",
                      "bg-background shadow-sm hover:shadow transition-all duration-200",
                      !effectiveRange.from && "text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-primary/80" />
                      <span className="truncate">{rangeLabel}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-70 ml-2" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent 
                  className="w-[280px] p-0 shadow-lg border border-border rounded-xl overflow-hidden" 
                  align="end"
                  sideOffset={8}
                >
                  {rangeOption === 'custom' && (
                    <div className="p-2 bg-background">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={effectiveRange.from || new Date()}
                        selected={customRange}
                        onSelect={setCustomRange}
                        numberOfMonths={1}
                        className={cn(
                          "w-full rounded-md",
                          // Compact, no overflow styles
                          "[&_.rdp-month]:p-0",
                          "[&_.rdp-day_button]:h-9 [&_.rdp-day_button]:w-9 [&_.rdp-day_button]:text-sm [&_.rdp-day_button]:font-medium",
                          "[&_.rdp-caption_label]:text-base [&_.rdp-caption_label]:font-semibold [&_.rdp-caption]:pb-2",
                          "[&_.rdp-nav_button]:h-8 [&_.rdp-nav_button]:w-8 [&_.rdp-nav]:justify-between [&_.rdp-nav]:px-2",
                          "[&_.rdp-weekday]:text-xs [&_.rdp-weekday]:font-medium [&_.rdp-weekday]:text-muted-foreground",
                          // Selected/today overrides
                          "[&_.rdp-day_selected]:!bg-primary [&_.rdp-day_selected]:!text-white [&_.rdp-day_selected]:!rounded-lg [&_.rdp-day_selected]:!font-semibold",
                          "[&_.rdp-day_today]:!border-2 [&_.rdp-day_today]:!border-primary/60 [&_.rdp-day_today]:!rounded-lg [&_.rdp-day_today]:!font-bold [&_.rdp-day_today]:!bg-primary/10",
                          "[&_.rdp-day_range_middle]:!bg-primary/15 [&_.rdp-day_range_middle]:!text-foreground"
                        )}
                      />
                    </div>
                  )}

                  {/* Predefined ranges – bottom, separated */}
                  <div className="p-3 border-t bg-muted/30 rounded-b-xl">
                    <div className="max-h-[180px] overflow-y-auto px-1">
                      <div className="grid grid-cols-2 gap-2">
                        {/* Custom Range first */}
                        <Button
                          variant={rangeOption === 'custom' ? "default" : "outline"}
                          size="sm"
                          className="justify-start text-sm h-9 rounded-md"
                          onClick={() => setRangeOption('custom')}
                        >
                          Custom Range
                        </Button>

                        {/* This Month second */}
                        <Button
                          variant={rangeOption === 'thisMonth' ? "default" : "outline"}
                          size="sm"
                          className="justify-start text-sm h-9 rounded-md"
                          onClick={() => setRangeOption('thisMonth')}
                        >
                          This Month
                        </Button>

                        {/* Other presets */}
                        {Object.entries(RANGE_LABELS)
                          .filter(([key]) => key !== 'custom' && key !== 'thisMonth' && key !== 'all')
                          .map(([key, label]) => (
                            <Button
                              key={key}
                              variant={rangeOption === key ? "default" : "outline"}
                              size="sm"
                              className="justify-start text-sm h-9 rounded-md"
                              onClick={() => setRangeOption(key as RangeOption)}
                            >
                              {label}
                            </Button>
                          ))}

                        {/* All Time last */}
                        <Button
                          variant={rangeOption === 'all' ? "default" : "outline"}
                          size="sm"
                          className="justify-start text-sm h-9 rounded-md col-span-2 border-t mt-2 pt-3"
                          onClick={() => setRangeOption('all')}
                        >
                          All Time
                        </Button>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>


              {/* Totals – elegant pill */}
              <Badge
                variant="outline"
                className="px-5 py-2 text-sm font-medium rounded-full shadow-sm border-primary/30 bg-gradient-to-r from-background to-muted/20 transition-all duration-200 hover:shadow-md"
              >
                <span className="text-green-600 font-semibold">+{formatCurrency(rangeTotals.income)}</span>
                <span className="mx-2 text-muted-foreground">/</span>
                <span className="text-red-600 font-semibold">-{formatCurrency(rangeTotals.expense)}</span>
                <span className="mx-2 text-muted-foreground">=</span>
                <span
                  className={cn(
                    rangeTotals.net >= 0 ? 'text-green-600' : 'text-red-600',
                    'font-semibold'
                  )}
                >
                  {formatCurrency(Math.abs(rangeTotals.net))}
                </span>
              </Badge>

            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <div className="max-h-[600px] overflow-y-auto"> {/* Fixed height + scroll for entire list */}
            <div className="space-y-4">
              {grouped.map((category: any) => {
                const isExpanded = expandedCategories.has(category.id);
                const categoryTransactions = filteredTransactions.filter(t => t.category_id === category.id);

                return (
                  <div key={category.id}>
                    {/* Darker, compact category header */}
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="w-full flex items-center justify-between py-2.5 px-4 bg-muted/80 rounded-lg text-left hover:bg-muted/90 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
                        <span className="font-medium text-sm">{category.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {categoryTransactions.length}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0))}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="pl-8 pr-4 py-2 space-y-1">
                        {categoryTransactions.map((t: any) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between py-2 px-3 bg-muted/10 rounded border border-border/30 hover:bg-muted/20 transition-colors text-sm"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="text-muted-foreground w-20 shrink-0 text-xs">
                                {format(new Date(t.date), 'MMM d')}
                              </div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="font-medium truncate max-w-[220px]">
                                    {t.description}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-md break-words p-3 text-sm">
                                  {t.description}
                                </TooltipContent>
                              </Tooltip>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className={`font-medium ${t.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(Math.abs(t.amount))}
                              </span>
                              <Select
                                value={t.category_id.toString()}
                                onValueChange={(v) => handleCategoryChange(t.id, parseInt(v))}
                              >
                                <SelectTrigger className="w-40 h-7 text-xs rounded-md border-border/70">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-[240px] overflow-y-auto text-xs">
                                  {categories.map((c: any) => (
                                    <SelectItem key={c.id} value={c.id.toString()}>
                                      {c.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
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
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}