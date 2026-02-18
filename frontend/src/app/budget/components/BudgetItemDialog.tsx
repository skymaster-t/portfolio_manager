// src/app/budget/components/BudgetItemDialog.tsx
'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

interface BudgetItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: any | null;
  currentType: 'income' | 'expense';
  setCurrentType: (type: 'income' | 'expense') => void;
  form: {
    name: string;
    amount_monthly: string;
    category_id: string;
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      amount_monthly: string;
      category_id: string;
    }>
  >;
  categories: any[];
  incomeCategories: any[];
  expenseCategories: any[];
  onSave: () => Promise<void>;
}

export function BudgetItemDialog({
  open,
  onOpenChange,
  editingItem,
  currentType,
  setCurrentType,
  form,
  setForm,
  categories,
  incomeCategories,
  expenseCategories,
  onSave,
}: BudgetItemDialogProps) {
  const queryClient = useQueryClient();

  const [showNewCategoryDialog, setShowNewCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required');
      return;
    }

    setCreating(true);

    try {
      const response = await axios.post(`${API_BASE}/budget/categories`, {
        name: newCategoryName.trim(),
        type: currentType,
      });

      const newCategory = response.data;

      // Refresh categories list
      await queryClient.invalidateQueries({ queryKey: ['categories'] });

      // Auto-select the newly created category
      setForm((prev) => ({
        ...prev,
        category_id: newCategory.id.toString(),
      }));

      toast.success(`Category "${newCategory.name}" created`);
      setShowNewCategoryDialog(false);
      setNewCategoryName('');
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || 'Failed to create category'
      );
    } finally {
      setCreating(false);
    }
  };

  const availableCategories =
    currentType === 'income' ? incomeCategories : expenseCategories;

  return (
    <>
      {/* ── Main Budget Item Dialog ─────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit' : 'Add'}{' '}
              {currentType === 'income' ? 'Income' : 'Expense'} Item
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Type switcher */}
            <div className="grid gap-2">
              <Label>Type</Label>
              <div className="flex gap-3">
                <Button
                  variant={currentType === 'income' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => {
                    setCurrentType('income');
                    // Clear category if it doesn't match new type
                    if (form.category_id) {
                      const cat = categories.find(
                        (c: any) => c.id.toString() === form.category_id
                      );
                      if (cat?.type !== 'income') {
                        setForm((prev) => ({ ...prev, category_id: '' }));
                      }
                    }
                  }}
                >
                  Income
                </Button>
                <Button
                  variant={currentType === 'expense' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => {
                    setCurrentType('expense');
                    if (form.category_id) {
                      const cat = categories.find(
                        (c: any) => c.id.toString() === form.category_id
                      );
                      if (cat?.type !== 'expense') {
                        setForm((prev) => ({ ...prev, category_id: '' }));
                      }
                    }
                  }}
                >
                  Expense
                </Button>
              </div>
            </div>

            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={
                  currentType === 'income'
                    ? 'Salary, Freelance, Dividends…'
                    : 'Rent, Groceries, Subscriptions…'
                }
              />
            </div>

            {/* Category + quick create */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="category">
                  Category <span className="text-red-500">*</span>
                </Label>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs underline"
                  onClick={() => setShowNewCategoryDialog(true)}
                >
                  + New Category
                </Button>
              </div>

              <Select
                value={form.category_id}
                onValueChange={(value) =>
                  setForm({ ...form, category_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                      {cat.is_custom && (
                        <span className="text-xs text-muted-foreground ml-1.5">
                          (custom)
                        </span>
                      )}
                    </SelectItem>
                  ))}

                  {availableCategories.length === 0 && (
                    <SelectItem value="no-categories" disabled>
                      No {currentType} categories yet — create one above
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="grid gap-2">
              <Label htmlFor="amount">
                Monthly Amount <span className="text-red-500">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={form.amount_monthly}
                onChange={(e) =>
                  setForm({ ...form, amount_monthly: e.target.value })
                }
                placeholder="4200.00"
              />
            </div>
          </div>

          <DialogFooter className="mt-6 pt-6 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={onSave}
              disabled={
                !form.name.trim() ||
                !form.category_id ||
                !form.amount_monthly ||
                Number.isNaN(parseFloat(form.amount_monthly))
              }
            >
              {editingItem ? 'Update Item' : 'Create Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Nested: Quick Create Category ──────────────────────────────── */}
      <Dialog
        open={showNewCategoryDialog}
        onOpenChange={setShowNewCategoryDialog}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              New {currentType === 'income' ? 'Income' : 'Expense'} Category
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-category-name">Category Name</Label>
              <Input
                id="new-category-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={
                  currentType === 'income' ? 'Bonus, Side Income…' : 'Travel, Dining…'
                }
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewCategoryDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCategory}
              disabled={creating || !newCategoryName.trim()}
            >
              {creating ? 'Creating…' : 'Create Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}