// src/app/budget/page.tsx
'use client';

import { useState, useMemo } from 'react';
import axios from 'axios';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  useBudgetSummary, 
  useBudgetItems, 
  useAllHoldings, 
  useCategories, 
  useTransactionSummary, 
  useAccounts,
  useTransactions 
} from '@/lib/queries';
import { formatCurrency } from '@/lib/utils';

import { TransactionList } from './components/TransactionList';
import { CategoryPieChart } from './components/CategoryPieChart';
import { CategoryManager } from './components/CategoryManager';

import { BudgetSummaryCards } from './components/BudgetSummaryCards';
import { IncomeExpensesCard } from './components/IncomeExpensesCard';
import { DividendBreakdownCard } from './components/DividendBreakdownCard';
import { BudgetItemDialog } from './components/BudgetItemDialog';
import { DividendDialog } from './components/DividendDialog';
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

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
  const { data: categories = [] } = useCategories();
  const { data: transactionSummary = { income: [], expense: [] } } = useTransactionSummary();
  const { data: transactions = [] } = useTransactions();
  const { data: accounts = [] } = useAccounts();

  const incomeCategories = categories.filter((c: any) => c.type === 'income');
  const expenseCategories = categories.filter((c: any) => c.type === 'expense');

  // ── Item dialog state ─────────────────────────────────────
  const [openItem, setOpenItem] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [currentType, setCurrentType] = useState<'income' | 'expense'>('income');
  const [form, setForm] = useState({ name: '', amount_monthly: '', category_id: '' });

  // ── Dividend dialog state ────────────────────────────────
  const [dividendDialogOpen, setDividendDialogOpen] = useState(false);
  const [dividendMode, setDividendMode] = useState<'add' | 'edit'>('add');
  const [selectedHoldingId, setSelectedHoldingId] = useState<number | null>(null);
  const [divForm, setDivForm] = useState({ annual_per_share: '' });

  // ── Delete confirm state ─────────────────────────────────
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState<any>(null);
  
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  // Safe summary fallback
  const safeSummary = summary || {
    expected_dividend_income_monthly_cad: 0,
    expected_dividend_income_annual_cad: 0,
    dividend_breakdown: [],
    other_income_monthly: 0,
    total_expenses_monthly: 0,
    total_income_monthly: 0,
    net_surplus_monthly: 0,
    income_items: [],
    expense_items: [],
  };

  // ── Handlers ─────────────────────────────────────────────
  const handleEdit = (item: any) => {
    setCurrentType(item.item_type);
    setForm({
      name: item.name,
      amount_monthly: item.amount_monthly.toString(),
      category_id: item.category_id.toString(),
    });
    setEditingItem(item);
    setOpenItem(true);
  };

  const handleSaveItem = async () => {
    if (!form.name.trim() || !form.amount_monthly || !form.category_id) {
      toast.error('All fields required');
      return;
    }

    try {
      const payload = {
        item_type: currentType,
        name: form.name,
        amount_monthly: parseFloat(form.amount_monthly),
        category_id: parseInt(form.category_id),
      };

      if (editingItem) {
        await axios.patch(`${API_BASE}/budget/items/${editingItem.id}`, payload);
        toast.success('Item updated');
      } else {
        await axios.post(`${API_BASE}/budget/items`, payload);
        toast.success('Item added');
      }

      await Promise.all([refetchSummary(), refetchItems()]);
      setOpenItem(false);
      setEditingItem(null);
    } catch (err: any) {
      toast.error(`Failed: ${err.response?.data?.detail || 'Unknown error'}`);
    }
  };

  const handleDelete = (id: number, name: string) => {
    confirmDelete(
      'Delete Item',
      `Delete "${name}"? This cannot be undone.`,
      async () => {
        try {
          await axios.delete(`${API_BASE}/budget/items/${id}`);
          toast.success('Item deleted');
          await Promise.all([refetchSummary(), refetchItems()]);
        } catch (err: any) {
          toast.error(`Failed: ${err.response?.data?.detail || 'Unknown error'}`);
        }
      }
    );
  };

  const openDividendDialog = (mode: 'add' | 'edit', holdingId?: number) => {
    setDividendMode(mode);
    setSelectedHoldingId(holdingId || null);

    if (holdingId) {
      const breakdown = safeSummary.dividend_breakdown.find((b: any) => b.holding_id === holdingId);
      setDivForm({
        annual_per_share: breakdown?.dividend_annual_per_share?.toString() || '',
      });
    } else {
      setDivForm({ annual_per_share: '' });
    }

    setDividendDialogOpen(true);
  };

  const handleDividendSave = async () => {
    if (!selectedHoldingId) {
      toast.error('No holding selected');
      return;
    }

    try {
      await axios.patch(`${API_BASE}/holdings/${selectedHoldingId}/dividend`, {
        dividend_annual_per_share: divForm.annual_per_share ? parseFloat(divForm.annual_per_share) : null,
      });
      toast.success('Dividend override saved');

      // Critical: Refetch summary to update DividendBreakdownCard
      await refetchSummary();

      setDividendDialogOpen(false);
    } catch (err: any) {
      toast.error(`Failed: ${err.response?.data?.detail || 'Unknown error'}`);
    }
  };

  const handleResetManualDividend = async (holdingId: number) => {
    if (!holdingId) return;

    try {
      await axios.patch(`${API_BASE}/holdings/${holdingId}/dividend`, {
        dividend_annual_per_share: null,
      });
      toast.success('Manual override reset');

      // Critical: Refetch summary to update DividendBreakdownCard
      await refetchSummary();

      setDividendDialogOpen(false);
    } catch (err: any) {
      toast.error(`Failed: ${err.response?.data?.detail || 'Unknown error'}`);
    }
  };

  const handleDeleteManualDividend = (holdingId: number, symbol: string) => {
    confirmDelete(
      'Remove Override',
      `Remove manual dividend override for ${symbol}? This will revert to auto-fetched data.`,
      async () => {
        await handleResetManualDividend(holdingId);
      }
    );
  };

  const confirmDelete = (title: string, message: string, onConfirm: () => Promise<void>) => {
    setDeleteInfo({ title, message, onConfirm });
    setDeleteConfirmOpen(true);
  };

  const computedTransactionSummary = useMemo(() => {
    let filteredTx = transactions;

    if (selectedAccountId !== null) {
      filteredTx = filteredTx.filter((t: any) => t.account_id === selectedAccountId);
    }

    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();

    filteredTx.forEach((t: any) => {
      const catName = t.category?.name || 'Uncategorized';
      const amount = Math.abs(t.amount);
      if (t.amount > 0) {
        incomeMap.set(catName, (incomeMap.get(catName) || 0) + amount);
      } else {
        expenseMap.set(catName, (expenseMap.get(catName) || 0) + amount);
      }
    });

    return {
      income: Array.from(incomeMap.entries()).map(([category, total]) => ({ category, total })),
      expense: Array.from(expenseMap.entries()).map(([category, total]) => ({ category, total })),
    };
  }, [transactions, selectedAccountId]);

  if (summaryLoading || itemsLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (summaryError || itemsError) {
    return <div className="text-destructive">Error loading budget data</div>;
  }

  return (
    <div className="space-y-8">
      {/* 1. Summary cards – full width */}
      <BudgetSummaryCards summary={safeSummary} />

      {/* 2. Main management row – Income/Expenses + Category Manager side by side */}
      <div className="grid lg:grid-cols-5 gap-8">
        {/* Income & Expenses takes more space */}
        <div className="lg:col-span-3">
          <IncomeExpensesCard
            summary={safeSummary}
            onAdd={() => {
              setCurrentType('income');
              setForm({ name: '', amount_monthly: '', category_id: '' });
              setEditingItem(null);
              setOpenItem(true);
            }}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
  
        {/* Category Manager on the right */}
        <div className="lg:col-span-2">
          <CategoryManager onConfirmDelete={confirmDelete} />
        </div>
      </div>

      {/* 3. Visual breakdowns – side by side */}
      <div className="grid md:grid-cols-2 gap-8">
        <CategoryPieChart data={computedTransactionSummary.income} title="Income Breakdown" type="income" />
        <CategoryPieChart data={computedTransactionSummary.expense} title="Expense Breakdown" type="expense" />
      </div>

      {/* 4. Transactions – full width, detailed list */}
      <TransactionList 
        accounts={accounts} 
        selectedAccountId={selectedAccountId}
        onAccountChange={setSelectedAccountId}
      />

      {/* 5. Dividends at the bottom */}
      <DividendBreakdownCard
        summary={safeSummary}
        allHoldings={allHoldings}
        onOpenDividend={openDividendDialog}
        onDeleteManualDividend={handleDeleteManualDividend}
      />

      {/* Reusable dialogs (unchanged) */}
      <BudgetItemDialog
        open={openItem}
        onOpenChange={setOpenItem}
        editingItem={editingItem}
        currentType={currentType}
        setCurrentType={setCurrentType}
        form={form}
        setForm={setForm}
        categories={categories}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        onSave={handleSaveItem}
      />

      <DividendDialog
        open={dividendDialogOpen}
        onOpenChange={setDividendDialogOpen}
        mode={dividendMode}
        selectedHoldingId={selectedHoldingId}
        setSelectedHoldingId={setSelectedHoldingId}
        divForm={divForm}
        setDivForm={setDivForm}
        allHoldings={allHoldings}
        safeSummary={safeSummary}
        onSave={handleDividendSave}
        onResetManual={handleResetManualDividend}
      />

      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={deleteInfo?.title || 'Confirm Delete'}
        message={deleteInfo?.message || ''}
        onConfirm={deleteInfo?.onConfirm || (async () => {})}
      />
    </div>
  );
}