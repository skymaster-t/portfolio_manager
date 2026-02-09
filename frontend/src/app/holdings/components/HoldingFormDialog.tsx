// src/app/holdings/components/HoldingFormDialog.tsx (updated: underlying list now scrollable after ~8 entries)
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
  }, [selectedHolding, defaultPortfolioId, open]);

  const addUnderlying = () => {
    setUnderlyings([...underlyings, { tempId: nextTempId++, symbol: '', allocation: '' }]);
  };

  const updateUnderlying = (tempId: number, field: 'symbol' | 'allocation', value: string) => {
    setUnderlyings(
      underlyings.map((u) =>
        u.tempId === tempId ? { ...u, [field]: value } : u
      )
    );
  };

  const removeUnderlying = (tempId: number) => {
    setUnderlyings(underlyings.filter((u) => u.tempId !== tempId));
  };

  const handleSubmit = () => {
    if (!symbol.trim() || !quantity || !purchasePrice || !portfolioId) {
      toast.error('Please fill in all required fields');
      return;
    }

    const payload: any = {
      symbol: symbol.trim().toUpperCase(),
      type,
      quantity: Number(quantity),
      purchase_price: Number(purchasePrice),
      portfolio_id: Number(portfolioId),
    };

    if (type === 'etf' && underlyings.length > 0) {
      payload.underlyings = underlyings
        .filter((u) => u.symbol.trim())
        .map((u) => ({
          symbol: u.symbol.trim().toUpperCase(),
          allocation_percent: u.allocation ? Number(u.allocation) : null,
        }));
    }

    onSubmit(payload);
  };

  const isEdit = !!selectedHolding;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl shadow-2xl bg-card">
        <DialogHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-2xl -m-6 mb-6 p-6">
          <DialogTitle className="text-3xl font-bold">
            {isEdit ? 'Edit Holding' : 'Add Holding'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-8">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="symbol" className="text-base font-medium">
                Symbol
              </Label>
              <Input
                id="symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="e.g. VOO"
                className="text-lg"
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type" className="text-base font-medium">
                Type
              </Label>
              <Select value={type} onValueChange={(v) => setType(v as 'stock' | 'etf')} disabled={isPending}>
                <SelectTrigger id="type" className="text-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="etf">ETF</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity" className="text-base font-medium">
                Quantity
              </Label>
              <Input
                id="quantity"
                type="number"
                step="0.000001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 10"
                className="text-lg"
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase-price" className="text-base font-medium">
                Purchase Price
              </Label>
              <Input
                id="purchase-price"
                type="number"
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="e.g. 450.00"
                className="text-lg"
                disabled={isPending}
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="portfolio" className="text-base font-medium">
                Portfolio
              </Label>
              <Select value={portfolioId} onValueChange={setPortfolioId} disabled={isPending}>
                <SelectTrigger id="portfolio" className="text-lg">
                  <SelectValue placeholder="Select a portfolio" />
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
          </div>

          {type === 'etf' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Underlyings</Label>
                <Button
                  size="sm"
                  onClick={addUnderlying}
                  disabled={isPending}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Underlying
                </Button>
              </div>
              {underlyings.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No underlyings added yet.</p>
              ) : (
                /* Scrollable container – shows ~8 entries before scrolling */
                <div className="max-h-96 overflow-y-auto rounded-lg border border-border bg-muted/30 p-4 space-y-4">
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
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
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