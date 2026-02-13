// src/app/budget/page.tsx (full file – Income & Expenses cards now reliably fixed medium height with scroll)
// - Card: h-[600px] flex flex-col (fixed total height)
// - CardContent: flex-1 overflow-y-auto (scrolls content, header fixed)
// - Removed conflicting h-[600px] from CardContent
// - Added pb-6 for comfortable bottom padding when scrolled
// - All previous features unchanged: summary top, dividends bottom, manual overrides, compact ledger, safe null handling, fixed 2 decimals

'use client';

import { useState } from 'react';
import axios from 'axios';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Edit, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { useBudgetSummary, useBudgetItems, useAllHoldings } from '@/lib/queries';
import { formatCurrency } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableHeader,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

const INCOME_CATEGORIES = [
  'Salary',
  'Bonus',
  'Freelance',
  'Rental',
  'Investment',
  'Pension',
  'Other',
];

const EXPENSE_CATEGORIES = [
  'Rent/Mortgage',
  'Utilities',
  'Groceries',
  'Dining',
  'Transportation',
  'Insurance',
  'Healthcare',
  'Entertainment',
  'Debt Payment',
  'Savings',
  'Other',
];

export default function BudgetPage() {
  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch: refetchSummary,
  } = useBudgetSummary();

  const {
    data: items = [],
    isLoading: itemsLoading,
    isError: itemsError,
    refetch: refetchItems,
  } = useBudgetItems();

  const { data: allHoldings = [] } = useAllHoldings();

  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [currentType, setCurrentType] = useState<'income' | 'expense'>('income');

  const [form, setForm] = useState({
    name: '',
    amount_monthly: '',
    category: '',
  });

  // Dividend manual override states
  const [dividendDialogOpen, setDividendDialogOpen] = useState(false);
  const [dividendMode, setDividendMode] = useState<'add' | 'edit'>('add');
  const [selectedHoldingId, setSelectedHoldingId] = useState<number | null>(null);
  const [divForm, setDivForm] = useState({
    annual_per_share: '',
    yield_percent: '',
  });

  const item_type = editingItem ? editingItem.item_type : currentType;
  const categories = item_type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!form.category) {
      toast.error('Category is required');
      return;
    }
    const amount = parseFloat(form.amount_monthly);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Valid monthly amount is required');
      return;
    }

    const payload = {
      item_type,
      name: form.name.trim(),
      amount_monthly: amount,
      category: form.category,
    };

    try {
      if (editingItem) {
        await axios.put(`${API_BASE}/budget/items/${editingItem.id}`, payload);
        toast.success('Item updated');
      } else {
        await axios.post(`${API_BASE}/budget/items`, payload);
        toast.success('Item added');
      }
      await Promise.all([refetchSummary(), refetchItems()]);
    } catch (err) {
      toast.error('Failed to save item');
    }

    setOpen(false);
    setEditingItem(null);
    setForm({ name: '', amount_monthly: '', category: '' });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this item?')) return;

    try {
      await axios.delete(`${API_BASE}/budget/items/${id}`);
      toast.success('Item deleted');
      await Promise.all([refetchSummary(), refetchItems()]);
    } catch (err) {
      toast.error('Failed to delete item');
    }
  };

  const startEdit = (item: any) => {
    setEditingItem(item);
    setCurrentType(item.item_type);
    setForm({
      name: item.name,
      amount_monthly: item.amount_monthly.toString(),
      category: item.category || '',
    });
    setOpen(true);
  };

  const openAddDialog = (type: 'income' | 'expense') => {
    setCurrentType(type);
    setEditingItem(null);
    setForm({ name: '', amount_monthly: '', category: '' });
    setOpen(true);
  };

  // Dividend handlers
  const openDividendDialog = (mode: 'add' | 'edit', item?: any) => {
    setDividendMode(mode);
    if (mode === 'edit' && item) {
      setSelectedHoldingId(item.holding_id);
      setDivForm({
        annual_per_share: item.dividend_annual_per_share?.toString() || '',
        yield_percent: '',
      });
    } else {
      setSelectedHoldingId(null);
      setDivForm({ annual_per_share: '', yield_percent: '' });
    }
    setDividendDialogOpen(true);
  };

  const handleDividendSave = async () => {
    if (!selectedHoldingId) {
      toast.error('Select a holding');
      return;
    }

    const payload: any = {};
    if (divForm.annual_per_share.trim() !== '') {
      const val = parseFloat(divForm.annual_per_share);
      if (isNaN(val) || val < 0) {
        toast.error('Valid annual dividend required');
        return;
      }
      payload.dividend_annual_per_share = val;
    } else {
      payload.dividend_annual_per_share = null;
    }

    try {
      await axios.patch(`${API_BASE}/holdings/${selectedHoldingId}/dividend`, payload);
      toast.success(dividendMode === 'add' ? 'Manual dividend added' : 'Dividend updated');
      refetchSummary();
      setDividendDialogOpen(false);
    } catch (err) {
      toast.error('Failed to save dividend');
    }
  };

  const handleDividendRevert = async (holding_id: number) => {
    if (!confirm('Revert to auto-update from Yahoo Finance?')) return;
    try {
      await axios.patch(`${API_BASE}/holdings/${holding_id}/dividend`, {
        dividend_annual_per_share: null,
      });
      toast.success('Reverted to auto-update');
      refetchSummary();
    } catch (err) {
      toast.error('Failed to revert');
    }
  };

  if (summaryError || itemsError) return <div className="p-8 text-red-600">Failed to load budget data</div>;
  if (summaryLoading || itemsLoading) return <div className="p-8"><Skeleton className="h-96 w-full" /></div>;

  // Safe defaults to prevent undefined crashes
  const safeSummary = {
    expected_dividend_income_monthly_cad: summary?.expected_dividend_income_monthly_cad ?? 0,
    expected_dividend_income_annual_cad: summary?.expected_dividend_income_annual_cad ?? 0,
    dividend_breakdown: summary?.dividend_breakdown ?? [],
    other_income_monthly: summary?.other_income_monthly ?? 0,
    total_expenses_monthly: summary?.total_expenses_monthly ?? 0,
    total_income_monthly: summary?.total_income_monthly ?? 0,
    net_surplus_monthly: summary?.net_surplus_monthly ?? 0,
  };

  // Group items by category
  const groupItems = (type: 'income' | 'expense') => {
    const filtered = items.filter((i: any) => i.item_type === type);
    const grouped = filtered.reduce((acc: Record<string, any[]>, item: any) => {
      const cat = item.category || 'Uncategorized';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});

    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  };

  const groupedIncome = groupItems('income');
  const groupedExpenses = groupItems('expense');

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">Monthly Budget</h1>

      {/* Monthly Summary */}
      <Card className={safeSummary.net_surplus_monthly >= 0 ? 'border-green-500' : 'border-red-500'}>
        <CardHeader>
          <CardTitle>Monthly Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-sm text-muted-foreground">Total Income</div>
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(safeSummary.total_income_monthly)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Expenses</div>
              <div className="text-3xl font-bold text-red-600">
                {formatCurrency(safeSummary.total_expenses_monthly)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Net Surplus / Deficit</div>
              <div className={`text-3xl font-bold ${safeSummary.net_surplus_monthly >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(safeSummary.net_surplus_monthly)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Income & Expenses – fixed medium height (600px) with reliable scroll */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Income */}
        <Card className="h-[600px] flex flex-col">  {/* Fixed card height */}
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Income</CardTitle>
            <Button onClick={() => openAddDialog('income')}>Add Income</Button>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto pb-6">  {/* Scrollable content */}
            <div className="text-lg font-semibold mb-6 text-green-600">
              {formatCurrency(safeSummary.other_income_monthly)}
            </div>

            {groupedIncome.length === 0 ? (
              <p className="text-muted-foreground">No income items yet</p>
            ) : (
              <div className="space-y-8">
                {groupedIncome.map(([category, catItems]) => {
                  const catTotal = catItems.reduce((sum: number, i: any) => sum + i.amount_monthly, 0);
                  return (
                    <div key={category} className="space-y-3">
                      <div className="flex items-center justify-between rounded-lg bg-green-50 px-4 py-3">
                        <span className="text-sm font-semibold text-green-900">
                          {category}
                        </span>
                        <span className="text-sm font-bold text-green-700">
                          {formatCurrency(catTotal)}
                        </span>
                      </div>

                      <div className="space-y-2 ml-4">
                        {catItems.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3 flex-1">
                              <span className="text-sm font-medium text-gray-900">{item.name}</span>
                              <div className="flex-1 border-b border-dotted border-gray-400" />
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-green-700 w-24 text-right">
                                {formatCurrency(item.amount_monthly)}
                              </span>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => startEdit(item)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card className="h-[600px] flex flex-col">  {/* Fixed card height */}
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Expenses</CardTitle>
            <Button onClick={() => openAddDialog('expense')}>Add Expense</Button>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto pb-6">  {/* Scrollable content */}
            <div className="text-lg font-semibold mb-6 text-red-600">
              {formatCurrency(safeSummary.total_expenses_monthly)}
            </div>

            {groupedExpenses.length === 0 ? (
              <p className="text-muted-foreground">No expense items yet</p>
            ) : (
              <div className="space-y-8">
                {groupedExpenses.map(([category, catItems]) => {
                  const catTotal = catItems.reduce((sum: number, i: any) => sum + i.amount_monthly, 0);
                  return (
                    <div key={category} className="space-y-3">
                      <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3">
                        <span className="text-sm font-semibold text-red-900">
                          {category}
                        </span>
                        <span className="text-sm font-bold text-red-700">
                          {formatCurrency(catTotal)}
                        </span>
                      </div>

                      <div className="space-y-2 ml-4">
                        {catItems.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3 flex-1">
                              <span className="text-sm font-medium text-gray-900">{item.name}</span>
                              <div className="flex-1 border-b border-dotted border-gray-400" />
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-red-700 w-24 text-right">
                                {formatCurrency(item.amount_monthly)}
                              </span>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => startEdit(item)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expected Dividend Income – at bottom */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Expected Dividend Income (from Portfolio)</CardTitle>
          <Button variant="outline" size="sm" onClick={() => openDividendDialog('add')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Manual Dividend
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="text-lg font-semibold">
              Monthly: {formatCurrency(safeSummary.expected_dividend_income_monthly_cad)}
            </div>
            <div className="text-lg font-semibold">
              Annual: {formatCurrency(safeSummary.expected_dividend_income_annual_cad)}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Estimates based on trailing 12-month dividends (auto or manual override).
          </p>

          {safeSummary.dividend_breakdown.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">Annual Div/Share</TableHead>
                  <TableHead className="text-right">Annual (CAD)</TableHead>
                  <TableHead className="text-right">Monthly (CAD)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {safeSummary.dividend_breakdown.map((item: any) => (
                  <TableRow key={item.holding_id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {item.symbol}
                        {item.is_manual && <Badge variant="secondary">Manual</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity ?? 0}</TableCell>
                    <TableCell className="text-right">
                      {item.dividend_annual_per_share ? item.dividend_annual_per_share.toFixed(4) : '—'}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(item.annual_dividends_cad ?? 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.monthly_dividends_cad ?? 0)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openDividendDialog('edit', item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDividendRevert(item.holding_id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">No dividend-paying holdings in your portfolio yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Income/Expense Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem
                ? `Edit ${item_type === 'income' ? 'Income' : 'Expense'}`
                : `Add ${item_type === 'income' ? 'Income' : 'Expense'}`}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={item_type === 'income' ? 'e.g. Salary' : 'e.g. Rent'}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="category">Category <span className="text-red-500">*</span></Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="amount">Monthly Amount (CAD)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={form.amount_monthly}
                onChange={(e) => setForm({ ...form, amount_monthly: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <p className="text-sm text-muted-foreground">
              Portfolio dividend income is auto-calculated above. Use this section for other recurring income/expenses.
            </p>
          </div>

          <DialogFooter className="mt-8 pt-6 border-t border-border">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingItem ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Dividend Dialog */}
      <Dialog open={dividendDialogOpen} onOpenChange={setDividendDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dividendMode === 'add' ? 'Add Manual Dividend' : 'Edit Manual Dividend'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {dividendMode === 'add' && (
              <div className="grid gap-2">
                <Label htmlFor="holding">Holding <span className="text-red-500">*</span></Label>
                <Select onValueChange={(v) => setSelectedHoldingId(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select holding" />
                  </SelectTrigger>
                  <SelectContent>
                    {allHoldings.map((h: any) => (
                      <SelectItem key={h.id} value={h.id.toString()}>
                        {h.symbol} ({h.type.toUpperCase()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {dividendMode === 'edit' && selectedHoldingId && (
              <p className="font-medium">
                {safeSummary.dividend_breakdown.find((i: any) => i.holding_id === selectedHoldingId)?.symbol}
              </p>
            )}

            <div className="grid gap-2">
              <Label htmlFor="annual">Annual Dividend per Share</Label>
              <Input
                id="annual"
                type="number"
                step="0.01"
                value={divForm.annual_per_share}
                onChange={(e) => setDivForm({ ...divForm, annual_per_share: e.target.value })}
                placeholder="e.g. 2.40 (leave blank to revert to auto)"
              />
            </div>

            <p className="text-sm text-muted-foreground">
              Manual values will no longer be auto-updated. Leave blank to revert to Yahoo Finance data.
            </p>
          </div>

          <DialogFooter className="mt-8 pt-6 border-t border-border">
            <Button variant="outline" onClick={() => setDividendDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDividendSave}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}