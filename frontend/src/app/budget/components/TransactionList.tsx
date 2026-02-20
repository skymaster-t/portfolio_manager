// src/app/budget/components/TransactionList.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, isWithinInterval, startOfMonth, endOfMonth, subDays, subMonths, startOfYear, endOfDay } from 'date-fns';
import { CalendarIcon, ChevronRight, Loader2, Search } from 'lucide-react';

import { useTransactions, useCategories } from '@/lib/queries';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

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

interface TransactionListProps {
  accounts: any[];
  selectedAccountId: number | null;
  onAccountChange: (id: number | null) => void;
}

export function TransactionList({ accounts, selectedAccountId, onAccountChange }: TransactionListProps) {
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const queryClient = useQueryClient();

  // Range persistence
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

  // Account filter (-1 = All)
  const [setSelectedAccountId] = useState<number>(-1);

  // NEW: Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadAccountId, setUploadAccountId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    localStorage.setItem('transactionRangeOption', rangeOption);
  }, [rangeOption]);

  useEffect(() => {
    if (rangeOption === 'custom' && customRange) {
      localStorage.setItem('transactionCustomRange', JSON.stringify(customRange));
    }
  }, [customRange, rangeOption]);

  // Effective date range with better partial handling
  const effectiveRange = useMemo((): DateRange => {
    const today = new Date();
    let range: DateRange = { from: undefined, to: undefined };

    switch (rangeOption) {
      case 'last7':
        range = { from: subDays(today, 7), to: today };
        break;
      case 'last30':
        range = { from: subDays(today, 30), to: today };
        break;
      case 'thisMonth':
        range = { from: startOfMonth(today), to: today };
        break;
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        range = { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
        break;
      case 'thisYear':
        range = { from: startOfYear(today), to: today };
        break;
      case 'custom':
        range = customRange || { from: undefined, to: undefined };
        if (range.from && !range.to) {
          range.to = today;
        } else if (!range.from && range.to) {
          range.from = subDays(range.to, 30);
        }
        break;
      default:
        break;
    }

    if (range.from) {
      const fromClone = new Date(range.from);
      fromClone.setHours(0, 0, 0, 0);
      range.from = fromClone;
    }
    if (range.to) {
      range.to = endOfDay(range.to);
    }

    return range;
  }, [rangeOption, customRange]);

  // Filtered transactions – now with search
  const filteredTransactions = useMemo(() => {
    let filtered = transactions || [];

    const { from, to } = effectiveRange;

    if (from || to) {
      filtered = filtered.filter((t: any) => {
        const txDate = new Date(t.date);
        txDate.setHours(0, 0, 0, 0);

        let inRange = true;

        if (from) inRange = inRange && txDate >= from;
        if (to) inRange = inRange && txDate <= to;

        return inRange;
      });
    }

    if (selectedAccountId !== null) {
      filtered = filtered.filter((t: any) => t.account_id === selectedAccountId);
    }

    // NEW: Search filter on description (case-insensitive)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((t: any) =>
        t.description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [transactions, effectiveRange, selectedAccountId, searchQuery]);

  // Range totals
  const rangeTotals = useMemo(() => {
    let income = 0;
    let expense = 0;

    filteredTransactions.forEach((t: any) => {
      if (t.amount > 0) income += t.amount;
      else expense += Math.abs(t.amount);
    });

    return { income, expense, net: income - expense };
  }, [filteredTransactions]);

  // Grouped by category
  const grouped = useMemo(() => {
    const groups = new Map<number, any[]>();
    filteredTransactions.forEach((t: any) => {
      if (!groups.has(t.category_id)) groups.set(t.category_id, []);
      groups.get(t.category_id)!.push(t);
    });

    const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));
    return sortedCategories.filter(c => groups.has(c.id));
  }, [filteredTransactions, categories]);

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
      await axios.patch(`${API_BASE}/transactions/${transactionId}`, { category_id: newCategoryId });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Category updated');
    } catch (err: any) {
      toast.error(`Failed: ${err.response?.data?.detail || 'Unknown error'}`);
    }
  };

  const handleAccountChange = async (transactionId: number, newAccountId: number) => {
    try {
      await axios.patch(`${API_BASE}/transactions/${transactionId}`, { account_id: newAccountId });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Account updated');
    } catch (err: any) {
      toast.error(`Failed: ${err.response?.data?.detail || 'Unknown error'}`);
    }
  };

  const uniqueAccounts = useMemo(() => {
    const accMap = new Map(accounts.map(acc => [acc.id, acc]));
    return Array.from(
      new Set(transactions.map((t: any) => t.account_id).filter(id => id !== null))
    )
      .map(id => accMap.get(id))
      .filter(Boolean);
  }, [transactions, accounts]);

  // Upload logic
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }
    if (!uploadAccountId) {
      toast.error('Please select an account');
      return;
    }

    setUploadOpen(false);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(
        `${API_BASE}/transactions/upload?account_id=${uploadAccountId}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      toast.success(`Uploaded: ${res.data.new} new transactions`);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (err: any) {
      toast.error(`Upload failed: ${err.response?.data?.detail || 'Unknown error'}`);
    } finally {
      setUploading(false);
      setFile(null);
      setUploadAccountId(null);
    }
  };

  return (
    <TooltipProvider>
      <Card className="shadow-lg rounded-xl overflow-hidden">
        <CardHeader className="p-4 bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-xl font-bold">Transactions</CardTitle>

            <div className="flex items-center gap-3 flex-wrap">
              <Select value={rangeOption} onValueChange={(v: RangeOption) => setRangeOption(v)}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RANGE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedAccountId?.toString() ?? 'all'}
                onValueChange={(val) => {
                  if (val === 'all') {
                    onAccountChange(null);
                  } else {
                    onAccountChange(parseInt(val));
                  }
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map((acc: any) => (
                    <SelectItem key={acc.id} value={acc.id.toString()}>
                      {acc.name} {acc.type ? `(${acc.type})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {rangeOption === 'custom' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 px-2">
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="range"
                      selected={customRange}
                      onSelect={(newRange) => {
                        if (newRange?.from && !newRange.to) {
                          setCustomRange({ from: newRange.from, to: new Date() });
                        } else {
                          setCustomRange(newRange);
                        }
                      }}
                      initialFocus
                      className={cn(
                        "w-full rounded-md",
                        "[&_.rdp-month]:p-0",
                        "[&_.rdp-day_button]:h-9 [&_.rdp-day_button]:w-9 [&_.rdp-day_button]:text-sm [&_.rdp-day_button]:font-medium",
                        "[&_.rdp-caption_label]:text-base [&_.rdp-caption_label]:font-semibold [&_.rdp-caption]:pb-2",
                        "[&_.rdp-nav_button]:h-8 [&_.rdp-nav_button]:w-8 [&_.rdp-nav]:justify-between [&_.rdp-nav]:px-2",
                        "[&_.rdp-weekday]:text-xs [&_.rdp-weekday]:font-medium [&_.rdp-weekday]:text-muted-foreground",
                        "[&_.rdp-day_selected]:!bg-primary [&_.rdp-day_selected]:!text-white [&_.rdp-day_selected]:!rounded-lg [&_.rdp-day_selected]:!font-semibold",
                        "[&_.rdp-day_today]:!border-2 [&_.rdp-day_today]:!border-primary/60 [&_.rdp-day_today]:!rounded-lg [&_.rdp-day_today]:!font-bold [&_.rdp-day_today]:!bg-primary/10",
                        "[&_.rdp-day_range_middle]:!bg-primary/15 [&_.rdp-day_range_middle]:!text-foreground"
                      )}
                    />
                  </PopoverContent>
                </Popover>
              )}

              {/* NEW: Search Input */}
              <div className="relative w-[220px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  className="pl-9 h-8 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {uploading ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md text-sm text-muted-foreground border border-border/50">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Uploading…</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setUploadOpen(true)}
                  disabled={uploading}
                >
                  Upload CSV
                </Button>
              )}

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
          <div className="max-h-[600px] overflow-y-auto">
            <div className="space-y-4">
              {grouped.map((category: any) => {
                const isExpanded = expandedCategories.has(category.id);
                const categoryTransactions = filteredTransactions.filter(t => t.category_id === category.id);

                return (
                  <div key={category.id}>
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
                                    {t.clean_description || t.description}  {/* ← cleaned first, fallback to raw */}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-md break-words p-3 text-sm space-y-1">
                                  <div>{t.clean_description || t.description}</div>
                                  {t.clean_description && t.clean_description !== t.description && (
                                    <div className="text-xs text-muted-foreground italic">
                                      Original: {t.description}
                                    </div>
                                  )}
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
                              <Select
                                value={t.account_id?.toString() || ''}
                                onValueChange={(v) => handleAccountChange(t.id, parseInt(v))}
                              >
                                <SelectTrigger className="w-40 h-7 text-xs rounded-md border-border/70">
                                  <SelectValue placeholder="No Account" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[240px] overflow-y-auto text-xs">
                                  {accounts.map((acc: any) => (
                                    <SelectItem key={acc.id} value={acc.id.toString()}>
                                      {acc.name}
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

      {/* Upload CSV Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Transactions CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file">Select CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-select">Select Account</Label>
              <Select
                onValueChange={(v) => setUploadAccountId(parseInt(v))}
                value={uploadAccountId?.toString()}
                disabled={uploading}
              >
                <SelectTrigger id="account-select">
                  <SelectValue placeholder="Choose account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc: any) => (
                    <SelectItem key={acc.id} value={acc.id.toString()}>
                      {acc.name} {acc.type ? `(${acc.type})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleUpload}
              disabled={uploading || !file || !uploadAccountId}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Start Upload'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}