// src/app/budget/components/CategoryManager.tsx
'use client';

import { useCategories } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, Edit } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export function CategoryManager() {
  const { data: categories = [], refetch } = useCategories();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'income',
  });

  const handleEdit = (cat: any) => {
    setForm({ name: cat.name, type: cat.type });
    setEditing(cat);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }

    try {
      if (editing) {
        await axios.put(`${API_BASE}/budget/categories/${editing.id}`, form);
        toast.success('Category updated');
      } else {
        await axios.post(`${API_BASE}/budget/categories`, form);
        toast.success('Category added');
      }

      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ['transactionSummary'] }),
      ]);
      setOpen(false);
      setEditing(null);
    } catch (err: any) {
      toast.error(`Failed: ${err.response?.data?.detail || 'Unknown error'}`);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${API_BASE}/budget/categories/${id}`);
      toast.success('Category deleted');

      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ['transactionSummary'] }),
      ]);
    } catch (err: any) {
      toast.error(`Failed: ${err.response?.data?.detail || 'Unknown error'}`);
    }
  };

  const customCategories = categories.filter((c: any) => c.is_custom);
  const incomeCustom = customCategories.filter((c: any) => c.type === 'income');
  const expenseCustom = customCategories.filter((c: any) => c.type === 'expense');

  return (
    <Card className="flex flex-col" style={{ maxHeight: '420px' }}> {/* ← Card max height – adjust as needed */}
      <CardHeader className="py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Manage Categories</CardTitle>
          <Button size="sm" onClick={() => {
            setForm({ name: '', type: 'income' });
            setEditing(null);
            setOpen(true);
          }}>
            + Add Category
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
        {/* Scrollable categories area */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 pt-1">
          <div className="grid grid-cols-2 gap-6 min-h-full">
            {/* Income Column */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold sticky top-0 bg-card z-10 pb-1 border-b">
                Income Categories
              </h4>
              <div className="space-y-1.5">
                {incomeCustom.map((cat: any) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-md border text-sm hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium truncate max-w-[160px]">{cat.name}</span>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(cat)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(cat.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {incomeCustom.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6 italic">
                    No custom income categories yet
                  </p>
                )}
              </div>
            </div>

            {/* Expense Column */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold sticky top-0 bg-card z-10 pb-1 border-b">
                Expense Categories
              </h4>
              <div className="space-y-1.5">
                {expenseCustom.map((cat: any) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-md border text-sm hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium truncate max-w-[160px]">{cat.name}</span>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(cat)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(cat.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {expenseCustom.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6 italic">
                    No custom expense categories yet
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Dialog remains unchanged */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Add'} Category</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}