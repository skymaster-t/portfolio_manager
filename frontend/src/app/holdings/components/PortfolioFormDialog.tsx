// src/app/holdings/components/PortfolioFormDialog.tsx
'use client';

import { useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface Portfolio {
  id?: number;
  name: string;
  is_default: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPortfolio: Portfolio | null;
  onSubmit: (payload: any) => void;
  isPending: boolean;
  onOpenDeleteConfirm: () => void;
}

export function PortfolioFormDialog({
  open,
  onOpenChange,
  selectedPortfolio,
  onSubmit,
  isPending,
  onOpenDeleteConfirm,
}: Props) {
  const [name, setName] = useState(selectedPortfolio?.name || '');
  const [isDefault, setIsDefault] = useState(selectedPortfolio?.is_default || false);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Portfolio name is required');
      return;
    }

    const payload = selectedPortfolio
      ? { id: selectedPortfolio.id, data: { name: trimmed, is_default: isDefault } }
      : { name: trimmed, is_default: isDefault };

    onSubmit(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl shadow-2xl bg-card">
        <DialogHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-2xl -m-6 mb-6 p-6">
          <DialogTitle className="text-3xl font-bold">
            {selectedPortfolio ? 'Edit' : 'Create'} Portfolio
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-8">
          <div className="space-y-2">
            <Label htmlFor="portfolio-name" className="text-base font-medium">
              Portfolio Name
            </Label>
            <Input
              id="portfolio-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Growth Portfolio"
              className="text-lg"
            />
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox
              id="default"
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(!!checked)}
            />
            <Label htmlFor="default" className="text-base font-medium cursor-pointer">
              Set as default portfolio
            </Label>
          </div>
        </div>

        <DialogFooter className="mt-8 pt-6 border-t border-border">
          {selectedPortfolio && (
            <Button variant="destructive" onClick={onOpenDeleteConfirm}>
              Delete Portfolio
            </Button>
          )}

          <div className="flex gap-3 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              Save Portfolio
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}