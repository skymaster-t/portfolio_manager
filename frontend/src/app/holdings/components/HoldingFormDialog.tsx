// src/app/holdings/components/HoldingFormDialog.tsx
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Portfolio {
  id: number;
  name: string;
}

interface Underlying {
  id?: number;
  symbol: string;
  allocation_percent?: number | null;
}

interface Holding {
  id?: number;
  symbol: string;
  type: 'stock' | 'etf';
  quantity: number;
  purchase_price: number;
  portfolio_id: number;
  underlyings?: Underlying[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedHolding: Holding | null;
  portfolios: Portfolio[];
  defaultPortfolioId: number | null;
  onSubmit: (payload: any) => void;
  isPending: boolean;
}

interface TempUnderlying {
  tempId: number;
  symbol: string;
  allocation: string;
}

let nextTempId = Date.now();

export function HoldingFormDialog({
  open,
  onOpenChange,
  selectedHolding,
  portfolios,
  defaultPortfolioId,
  onSubmit,
  isPending,
}: Props) {
  const [symbol, setSymbol] = useState('');
  const [type, setType] = useState<'stock' | 'etf'>('etf');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [portfolioId, setPortfolioId] = useState<string>('');
  const [underlyings, setUnderlyings] = useState<TempUnderlying[]>([]);
  const [detectedCurrency, setDetectedCurrency] = useState<'CAD' | 'USD'>('USD');

  useEffect(() => {
    if (selectedHolding) {
      setSymbol(selectedHolding.symbol);
      setType(selectedHolding.type);
      setQuantity(selectedHolding.quantity.toString());
      setPurchasePrice(selectedHolding.purchase_price.toString());
      setPortfolioId(selectedHolding.portfolio_id.toString());

      if (selectedHolding.type === 'etf' && selectedHolding.underlyings?.length) {
        setUnderlyings(
          selectedHolding.underlyings.map((u, index) => ({
            tempId: nextTempId + index,
            symbol: u.symbol,
            allocation: u.allocation_percent !== null && u.allocation_percent !== undefined
              ? u.allocation_percent.toString()
              : '',
          }))
        );
        nextTempId += selectedHolding.underlyings.length;
      } else {
        setUnderlyings([]);
      }
    } else {
      setSymbol('');
      setType('etf');
      setQuantity('');
      setPurchasePrice('');
      setPortfolioId(defaultPortfolioId?.toString() || '');
      setUnderlyings([]);
    }
  }, [selectedHolding, open, defaultPortfolioId]);

  const addUnderlying = () => {
    setUnderlyings([...underlyings, { tempId: nextTempId++, symbol: '', allocation: '' }]);
  };

  const removeUnderlying = (tempId: number) => {
    setUnderlyings(underlyings.filter((u) => u.tempId !== tempId));
  };

  const updateUnderlying = (tempId: number, field: 'symbol' | 'allocation', value: string) => {
    setUnderlyings(underlyings.map((u) => (u.tempId === tempId ? { ...u, [field]: value } : u)));
  };

  const handleTypeChange = (newType: 'stock' | 'etf') => {
    setType(newType);
    if (newType === 'stock') {
      setUnderlyings([]);
    }
  };

  const handleSubmit = () => {
    if (!symbol.trim()) {
      toast.error('Symbol is required');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Valid quantity (>0) is required');
      return;
    }

    const price = parseFloat(purchasePrice);
    if (isNaN(price) || price <= 0) {
      toast.error('Valid purchase price (>0) is required');
      return;
    }

    if (!portfolioId) {
      toast.error('Portfolio is required');
      return;
    }

    const payload: any = {
      symbol: symbol.trim().toUpperCase(),
      type,
      quantity: qty,
      purchase_price: price,
      portfolio_id: parseInt(portfolioId),
    };

    // ALWAYS include underlyings key – ensures old are deleted when switching to stock or clearing
    const validUnderlyings = type === 'etf'
      ? underlyings
          .filter((u) => u.symbol.trim())
          .map((u) => {
            const allocStr = u.allocation.trim();
            const alloc = allocStr === '' ? null : parseFloat(allocStr);
            return {
              symbol: u.symbol.trim().toUpperCase(),
              allocation_percent: alloc !== null && !isNaN(alloc) ? alloc : null,
            };
          })
      : [];

    payload.underlyings = validUnderlyings;

    onSubmit(payload);
  };

  const isEdit = !!selectedHolding;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-screen overflow-y-auto rounded-2xl shadow-2xl bg-card">
        <DialogHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-2xl -m-6 mb-6 p-6">
          <DialogTitle className="text-3xl font-bold">
            {isEdit ? 'Edit Holding' : 'Add Holding'}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-8">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="e.g. VOO"
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={handleTypeChange} disabled={isPending}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="etf">ETF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 100"
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>Purchase Price</Label>
              <Input
                type="number"
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="e.g. 450.00"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Portfolio</Label>
            <Select value={portfolioId} onValueChange={setPortfolioId} disabled={isPending}>
              <SelectTrigger>
                <SelectValue placeholder="Select portfolio" />
              </SelectTrigger>
              <SelectContent>
                {portfolios.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === 'etf' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Underlyings</Label>
                <Button size="sm" onClick={addUnderlying} disabled={isPending}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Underlying
                </Button>
              </div>
              {underlyings.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No underlyings added yet.</p>
              ) : (
                <div className="space-y-4">
                  {underlyings.map((u) => (
                    <div key={u.tempId} className="flex gap-4 items-end">
                      <div className="flex-1 space-y-2">
                        <Label>Symbol</Label>
                        <Input
                          value={u.symbol}
                          onChange={(e) => updateUnderlying(u.tempId, 'symbol', e.target.value)}
                          placeholder="e.g. AAPL"
                          disabled={isPending}
                        />
                      </div>
                      <div className="w-32 space-y-2">
                        <Label>Allocation %</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={u.allocation}
                          onChange={(e) => updateUnderlying(u.tempId, 'allocation', e.target.value)}
                          placeholder=""
                          disabled={isPending}
                        />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeUnderlying(u.tempId)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-8 pt-6 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Holding'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}