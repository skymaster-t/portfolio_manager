// src/app/budget/components/CategoryManager.tsx
'use client';

import { useCategories } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, Edit, Plus, Search } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

interface CategoryManagerProps {
  onConfirmDelete: (title: string, message: string, onConfirm: () => Promise<void>) => void;
}

export function CategoryManager({ onConfirmDelete }: CategoryManagerProps) {
  const { data: categories = [], refetch } = useCategories();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'income',
  });
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('income');

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
        await axios.patch(`${API_BASE}/budget/categories/${editing.id}`, form);
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

  const handleDelete = (id: number, name: string) => {
    onConfirmDelete(
      'Delete Category',
      `Are you sure you want to delete "${name}"? This will move associated items to "Other".`,
      async () => {
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
      }
    );
  };

  const customCategories = categories.filter((c: any) => c.is_custom);
  const filtered = customCategories
    .filter((c: any) => c.type === tab && c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Card className="shadow-lg rounded-xl overflow-hidden flex flex-col h-[520px]"> {/* ← Fixed height */}
      <CardHeader className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <CardTitle className="text-xl font-bold">Manage Categories</CardTitle>
          <Button size="sm" onClick={() => {
            setForm({ name: '', type: tab });
            setEditing(null);
            setOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" /> Add
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'income' | 'expense')} className="flex-1">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="income">Income</TabsTrigger>
              <TabsTrigger value="expense">Expense</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <div className="space-y-1.5">
            {filtered.map((cat: any) => (
              <div
                key={cat.id}
                className="flex items-center justify-between py-2.5 px-3 bg-muted/30 rounded-md border text-sm hover:bg-muted/50 transition-colors"
              >
                <span className="font-medium truncate max-w-[220px]">{cat.name}</span>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(cat)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(cat.id, cat.name)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10 italic">
                No custom {tab} categories yet
              </p>
            )}
          </div>
        </div>
      </CardContent>

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