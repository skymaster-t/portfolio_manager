// src/app/budget/page.tsx
'use client';

import { useState } from 'react';
import axios from 'axios';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useBudgetSummary, useBudgetItems, useAllHoldings, useCategories, useTransactionSummary } from '@/lib/queries';
import { formatCurrency } from '@/lib/utils';

import { CSVUpload } from './components/CSVUpload';
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

  // ── Delete confirmation (consistent style) ───────────────
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState<{
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const confirmDelete = (title: string, message: string, onConfirm: () => Promise<void>) => {
    setDeleteInfo({ title, message, onConfirm });
    setDeleteConfirmOpen(true);
  };

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
    setCurrentType(item.item_type as 'income' | 'expense');
  
    const categoryIdStr = item.category_id ? String(item.category_id) : '';
  
    setForm({
      name: item.name || '',
      amount_monthly: (item.amount_monthly ?? 0).toString(),
      category_id: categoryIdStr,
    });
  
    if (!categoryIdStr) {
      toast.warning(
        "This item has no category assigned. Please select one before saving.",
        { duration: 6000 }
      );
    }
  
    setEditingItem(item);
    setOpenItem(true);
  };

  const handleSaveItem = async () => {
    if (!form.name.trim() || !form.category_id || !form.amount_monthly || isNaN(parseFloat(form.amount_monthly))) {
      toast.error('Name, category, and valid amount required');
      return;
    }

    const payload = {
      item_type: currentType,
      name: form.name,
      amount_monthly: parseFloat(form.amount_monthly),
      category_id: parseInt(form.category_id),
    };

    try {
      if (editingItem) {
        await axios.put(`${API_BASE}/budget/items/${editingItem.id}`, payload);
        toast.success('Item updated');
      } else {
        await axios.post(`${API_BASE}/budget/items`, payload);
        toast.success('Item added');
      }
      refetchSummary();
      refetchItems();
      setOpenItem(false);
      setEditingItem(null);
    } catch (err: any) {
      toast.error(`Failed: ${err.response?.data?.detail || 'Unknown error'}`);
    }
  };

  const handleDelete = (id: number, name: string) => {
    confirmDelete(
      'Delete Budget Item',
      `Are you sure you want to delete "${name}"?`,
      async () => {
        await axios.delete(`${API_BASE}/budget/items/${id}`);
        refetchSummary();
        refetchItems();
      }
    );
  };

  const openDividendDialog = (mode: 'add' | 'edit', holdingId?: number) => {
    setDividendMode(mode);
    if (mode === 'edit' && holdingId) {
      setSelectedHoldingId(holdingId);
      const item = safeSummary.dividend_breakdown.find((i: any) => i.holding_id === holdingId);
      setDivForm({ annual_per_share: item?.dividend_annual_per_share?.toString() || '' });
    } else {
      setSelectedHoldingId(null);
      setDivForm({ annual_per_share: '' });
    }
    setDividendDialogOpen(true);
  };

  const handleDividendSave = async () => {
    if (!selectedHoldingId) return;

    const payload: any = {};
    if (divForm.annual_per_share.trim()) {
      payload.dividend_annual_per_share = parseFloat(divForm.annual_per_share);
    } else {
      payload.dividend_annual_per_share = null;
    }

    try {
      await axios.patch(`${API_BASE}/holdings/${selectedHoldingId}/dividend`, payload);
      toast.success('Dividend updated');
      refetchSummary();
      setDividendDialogOpen(false);
    } catch (err: any) {
      toast.error(`Failed: ${err.response?.data?.detail || 'Unknown error'}`);
    }
  };

  const handleResetManualDividend = (holdingId: number) => {
    confirmDelete(
      'Reset to Automatic Dividend',
      'This will remove the manual override and revert to the value automatically fetched from financial data providers.',
      async () => {
        try {
          await axios.patch(`${API_BASE}/holdings/${holdingId}/dividend`, {
            dividend_annual_per_share: null,
          });
          toast.success('Manual override removed – value reset to auto');
          refetchSummary();
        } catch (err: any) {
          toast.error(`Reset failed: ${err.response?.data?.detail || 'Unknown error'}`);
        }
      }
    );
  };

  const handleDeleteManualDividend = (holdingId: number, symbol: string) => {
    confirmDelete(
      'Reset Manual Dividend',
      `Remove manual override for ${symbol}? It will revert to automatic data from Yahoo Finance/FMP.`,
      async () => {
        try {
          await axios.patch(`${API_BASE}/holdings/${holdingId}/dividend`, {
            dividend_annual_per_share: null,
          });
          toast.success('Manual override removed');
          refetchSummary();
        } catch (err: any) {
          toast.error(
            `Failed: ${err.response?.data?.detail || 'Unknown error'}`
          );
        }
      }
    );
  };

  if (summaryLoading || itemsLoading) {
    return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
  }

  if (summaryError || itemsError) {
    return <div className="p-6 text-red-600">Error loading budget data</div>;
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <BudgetSummaryCards summary={safeSummary} />

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

      <div className="grid md:grid-cols-2 gap-8">
        <CategoryManager />
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <CategoryPieChart data={transactionSummary.income} title="Income Breakdown" type="income" />
        <CategoryPieChart data={transactionSummary.expense} title="Expense Breakdown" type="expense" />
      </div>

      <TransactionList />

      <DividendBreakdownCard
        summary={safeSummary}
        allHoldings={allHoldings}
        onOpenDividend={openDividendDialog}
        onDeleteManualDividend={handleDeleteManualDividend}
      />

      {/* Reusable dialogs */}
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