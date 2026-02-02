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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface Holding {
  id?: number;
  symbol: string;
  type: 'stock' | 'etf';
  quantity: number;
  purchase_price: number;
  portfolio_id: number;
  underlyings?: { id: number; symbol: string; allocation_percent?: number }[];
}

interface Portfolio {
  id: number;
  name: string;
  is_default: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedHolding: Holding | null;
  portfolios: Portfolio[];
  defaultPortfolioId: number | null;
  onSubmit: (data: any) => void;
  isPending: boolean;
}

interface TempUnderlying {
  tempId: number;
  id?: number;
  symbol: string;
  allocation_percent: string;
}

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
  const [type, setType] = useState<'etf' | 'stock'>('etf');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [portfolioId, setPortfolioId] = useState<number | null>(null);
  const [tempUnderlyings, setTempUnderlyings] = useState<TempUnderlying[]>([]);

  // Full reset on open + mode switch
  useEffect(() => {
    if (!open) return;

    if (selectedHolding) {
      // Edit mode
      setSymbol(selectedHolding.symbol);
      setType(selectedHolding.type);
      setQuantity(selectedHolding.quantity.toString());
      setPurchasePrice(selectedHolding.purchase_price.toString());
      setPortfolioId(selectedHolding.portfolio_id);
      setTempUnderlyings(
        (selectedHolding.underlyings || []).map((u, i) => ({
          tempId: Date.now() + i,
          id: u.id,
          symbol: u.symbol,
          allocation_percent: u.allocation_percent?.toString() || '',
        }))
      );
    } else {
      // Add mode – clear all fields, pre-select default portfolio
      setSymbol('');
      setType('etf');
      setQuantity('');
      setPurchasePrice('');
      setPortfolioId(defaultPortfolioId);
      setTempUnderlyings([]);
    }
  }, [open, selectedHolding, defaultPortfolioId]);

  const addTempUnderlying = () => {
    setTempUnderlyings(prev => [...prev, { tempId: Date.now(), symbol: '', allocation_percent: '' }]);
  };

  const updateTempUnderlying = (tempId: number, field: 'symbol' | 'allocation_percent', value: string) => {
    setTempUnderlyings(prev =>
      prev.map(u => (u.tempId === tempId ? { ...u, [field]: value } : u))
    );
  };

  const removeTempUnderlying = (tempId: number) => {
    setTempUnderlyings(prev => prev.filter(u => u.tempId !== tempId));
  };

  const handleSubmit = () => {
    if (!portfolioId) {
      toast.error('Please select a portfolio');
      return;
    }

    const data = {
      symbol: symbol.toUpperCase(),
      type,
      quantity: parseFloat(quantity) || 0,
      purchase_price: parseFloat(purchasePrice) || 0,
      portfolio_id: portfolioId,
      underlyings: type === 'etf'
        ? tempUnderlyings.map(u => ({
            symbol: u.symbol.toUpperCase(),
            allocation_percent: u.allocation_percent ? parseFloat(u.allocation_percent) : null,
          }))
        : [],
    };

    if (!data.symbol || !data.quantity || !data.purchase_price) {
      toast.error('Please fill all required fields');
      return;
    }

    onSubmit(selectedHolding ? { id: selectedHolding.id, data } : data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl shadow-2xl bg-card">
        <DialogHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-2xl -m-6 mb-6 p-6">
          <DialogTitle className="text-3xl font-bold">
            {selectedHolding ? 'Edit' : 'Add'} Holding
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6">
          {/* Portfolio selector */}
          <div className="space-y-2">
            <Label>Portfolio <span className="text-destructive">*</span></Label>
            <Select value={portfolioId?.toString()} onValueChange={(v) => setPortfolioId(parseInt(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Select a portfolio" />
              </SelectTrigger>
              <SelectContent>
                {portfolios.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name} {p.is_default && '(Default)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Symbol <span className="text-destructive">*</span></Label>
              <Input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="e.g. AAPL" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v: 'etf' | 'stock') => setType(v)}>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantity <span className="text-destructive">*</span></Label>
              <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Average Cost / Purchase Price <span className="text-destructive">*</span></Label>
              <Input type="number" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} />
            </div>
          </div>

          {type === 'etf' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <Label className="text-lg font-semibold">Underlying Holdings (Allocation %)</Label>
                <Button onClick={addTempUnderlying} variant="secondary">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Underlying
                </Button>
              </div>

              {tempUnderlyings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No underlyings added yet</p>
              ) : (
                <div className="space-y-4">
                  {tempUnderlyings.map(u => (
                    <div key={u.tempId} className="flex gap-4 items-center p-4 rounded-lg border bg-muted/30">
                      <Input
                        placeholder="Symbol e.g. AAPL"
                        value={u.symbol}
                        onChange={e => updateTempUnderlying(u.tempId, 'symbol', e.target.value.toUpperCase())}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Allocation %"
                        value={u.allocation_percent}
                        onChange={e => updateTempUnderlying(u.tempId, 'allocation_percent', e.target.value)}
                        className="w-40"
                      />
                      <Button size="icon" variant="destructive" onClick={() => removeTempUnderlying(u.tempId)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex justify-end">
                    <p className="text-lg font-medium">
                      Total Allocation:{' '}
                      {tempUnderlyings
                        .reduce((s, u) => s + parseFloat(u.allocation_percent || '0'), 0)
                        .toFixed(2)}
                      %
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-8 pt-6 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Holding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}