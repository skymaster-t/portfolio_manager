// src/app/holdings/components/PortfolioFormDialog.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface Portfolio {
  id?: number;
  name: string;
  is_default: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPortfolio: Portfolio | null;
  onSubmit: (payload: { name: string; is_default: boolean }) => void;
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
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Prefill when editing or reset when adding
  useEffect(() => {
    if (selectedPortfolio) {
      setName(selectedPortfolio.name);
      setIsDefault(selectedPortfolio.is_default);
    } else {
      setName('');
      setIsDefault(false);
    }
  }, [selectedPortfolio, open]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), is_default: isDefault });
  };

  const isEdit = !!selectedPortfolio;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl shadow-2xl bg-card">
        <DialogHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-2xl -m-6 mb-6 p-6">
          <DialogTitle className="text-3xl font-bold">
            {isEdit ? 'Edit Portfolio' : 'Add Portfolio'}
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
              disabled={isPending}
            />
          </div>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="default"
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(!!checked)}
              disabled={isPending}
            />
            <Label htmlFor="default" className="text-base font-medium cursor-pointer">
              Set as default portfolio
            </Label>
          </div>
        </div>
        <DialogFooter className="mt-8 pt-6 border-t border-border">
          {isEdit && (
            <Button variant="destructive" onClick={onOpenDeleteConfirm} disabled={isPending}>
              Delete Portfolio
            </Button>
          )}
          <div className="flex gap-3 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Portfolio'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}