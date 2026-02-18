// src/app/budget/components/DividendDialog.tsx
'use client';

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DividendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'edit';
  selectedHoldingId: number | null;
  setSelectedHoldingId: (id: number | null) => void;
  divForm: { annual_per_share: string };
  setDivForm: React.Dispatch<React.SetStateAction<{ annual_per_share: string }>>;
  allHoldings: any[];
  safeSummary: any;
  onSave: () => Promise<void>;
  onResetManual?: (holdingId: number) => void;   // ← new optional callback
}

export function DividendDialog({
  open,
  onOpenChange,
  mode,
  selectedHoldingId,
  setSelectedHoldingId,
  divForm,
  setDivForm,
  allHoldings,
  safeSummary,
  onSave,
  onResetManual,
}: DividendDialogProps) {
  const isManual = mode === 'edit' && 
    safeSummary?.dividend_breakdown?.find((i: any) => i.holding_id === selectedHoldingId)?.is_manual;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'add' ? 'Add Manual Dividend' : 'Edit Manual Dividend'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {mode === 'add' && (
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

          {mode === 'edit' && selectedHoldingId && (
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {safeSummary.dividend_breakdown.find((i: any) => i.holding_id === selectedHoldingId)?.symbol}
              </p>
              {isManual && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive/90 border-destructive/30 hover:border-destructive/50"
                  onClick={() => {
                    if (selectedHoldingId && onResetManual) {
                      onResetManual(selectedHoldingId);
                      onOpenChange(false);
                    }
                  }}
                >
                  Reset to Auto
                </Button>
              )}
            </div>
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
            Manual values will no longer be auto-updated. Leave blank to revert to Yahoo Finance / FMP data.
          </p>
        </div>

        <DialogFooter className="mt-8 pt-6 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={mode === 'add' && !selectedHoldingId}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}