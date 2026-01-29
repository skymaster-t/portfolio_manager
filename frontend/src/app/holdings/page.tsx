'use client';

import { useState } from 'react';
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit, Plus, Loader2 } from 'lucide-react';

interface Underlying {
  id: number;
  symbol: string;
}

interface Holding {
  id: number;
  symbol: string;
  type: 'stock' | 'stock' | 'etf';
  quantity: number;
  purchase_price: number;
  current_price?: number;
  change_percent?: number;
  market_value?: number;
  gain_loss?: number;
  underlyings?: Underlying[];
}

const fetchHoldings = async (): Promise<Holding[]> => {
  const { data } = await axios.get('http://localhost:8000/holdings');
  return data;
};

export default function Holdings() {
  const queryClient = useQueryClient();
  const [openForm, setOpenForm] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);

  // Form state
  const [symbol, setSymbol] = useState('');
  const [type_, setType] = useState<'etf' | 'stock'>('etf');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');

  // Underlying state
  const [underlyingSymbol, setUnderlyingSymbol] = useState('');
  const [tempUnderlyings, setTempUnderlyings] = useState<Underlying[]>([]);

  const { data: holdings = [], isLoading } = useQuery({
    queryKey: ['holdings'],
    queryFn: fetchHoldings,
    refetchInterval: 900000, // 15 min
  });

  const getPriceErrorMessage = (symbol: string, backendMessage: string) => {
    const upperSymbol = symbol.toUpperCase();
    if (upperSymbol.endsWith('.TO')) {
      return `Unable to fetch price for "${symbol}". No price data available at this time.`;
    } else {
      return `Unable to fetch price for "${symbol}". For Canadian/TSX symbols, try adding .TO (e.g., ${symbol}.TO).`;
    }
  };

  const addMutation = useMutation({
    mutationFn: (data: any) => axios.post('http://localhost:8000/holdings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      setOpenForm(false);
      resetForm();
      toast.success("Holding added successfully!");
    },
    onError: (error: any) => {
      const backendMessage = error.response?.data?.detail || "";
      if (backendMessage.includes("price") || backendMessage.includes("symbol") || backendMessage.includes("data")) {
        toast.error(getPriceErrorMessage(symbol, backendMessage));
      } else {
        toast.error(backendMessage || "Failed to add holding");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => axios.put(`http://localhost:8000/holdings/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      setOpenForm(false);
      resetForm();
      toast.success("Holding updated successfully!");
    },
    onError: (error: any) => {
      const backendMessage = error.response?.data?.detail || "";
      if (backendMessage.includes("price") || backendMessage.includes("symbol") || backendMessage.includes("data")) {
        toast.error(getPriceErrorMessage(symbol, backendMessage));
      } else {
        toast.error(backendMessage || "Failed to update holding");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => axios.delete(`http://localhost:8000/holdings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      setOpenDelete(false);
      toast.success("Holding deleted successfully!");
    },
    onError: () => {
      toast.error("Failed to delete holding");
    },
  });

  const resetForm = () => {
    setSymbol('');
    setType('etf');
    setQuantity('');
    setPurchasePrice('');
    setTempUnderlyings([]);
    setUnderlyingSymbol('');
    setSelectedHolding(null);
  };

  const openFormDialog = (holding?: Holding) => {
    if (holding) {
      setSelectedHolding(holding);
      setSymbol(holding.symbol);
      setType(holding.type);
      setQuantity(holding.quantity.toString());
      setPurchasePrice(holding.purchase_price.toString());
      setTempUnderlyings(holding.underlyings || []);
    } else {
      resetForm();
    }
    setOpenForm(true);
  };

  const handleSubmit = () => {
    if (!symbol.trim() || !quantity || !purchasePrice) {
      toast.error("Please fill all required fields: Symbol, Quantity, and Purchase Price");
      return;
    }

    const payload = {
      symbol: symbol.toUpperCase(),
      type: type_,
      quantity: parseFloat(quantity),
      purchase_price: parseFloat(purchasePrice),
      underlyings: type_ === 'etf' ? tempUnderlyings.map(u => ({ symbol: u.symbol })) : [],
    };

    if (selectedHolding) {
      updateMutation.mutate({ id: selectedHolding.id, data: payload });
    } else {
      addMutation.mutate(payload);
    }
  };

  const addUnderlying = () => {
    if (underlyingSymbol.trim()) {
      setTempUnderlyings([...tempUnderlyings, { id: Date.now(), symbol: underlyingSymbol.toUpperCase() }]);
      setUnderlyingSymbol('');
    }
  };

  const removeUnderlying = (id: number) => {
    setTempUnderlyings(tempUnderlyings.filter(u => u.id !== id));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">Holdings</h1>
        <Dialog open={openForm} onOpenChange={setOpenForm}>
          <DialogTrigger asChild>
            <Button onClick={() => openFormDialog()}>
              <Plus className="mr-2 h-4 w-4" /> Add Holding
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedHolding ? 'Edit' : 'Add'} Holding</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Symbol</Label>
                  <Input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="AAPL or XIC.TO" />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={type_} onValueChange={(v: 'stock' | 'etf') => setType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="etf">ETF (default)</SelectItem>
                      <SelectItem value="stock">Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="100" />
                </div>
                <div>
                  <Label>Purchase Price</Label>
                  <Input type="number" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="150.00" />
                </div>
              </div>

              {type_ === 'etf' && (
                <div className="border-t pt-4">
                  <Label>Underlying Stocks</Label>
                  <div className="flex gap-2 mt-2">
                    <Input value={underlyingSymbol} onChange={e => setUnderlyingSymbol(e.target.value)} placeholder="MSFT" />
                    <Button onClick={addUnderlying} variant="outline">Add</Button>
                  </div>
                  <div className="mt-4 space-y-2">
                    {tempUnderlyings.map(u => (
                      <div key={u.id} className="flex items-center justify-between bg-muted p-2 rounded">
                        <span className="font-medium">{u.symbol}</span>
                        <Button size="sm" variant="ghost" onClick={() => removeUnderlying(u.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {tempUnderlyings.length === 0 && <p className="text-sm text-muted-foreground">No underlying stocks added yet.</p>}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenForm(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={addMutation.isPending || updateMutation.isPending}>
                {addMutation.isPending || updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {selectedHolding ? 'Update' : 'Add'} Holding
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading holdings...</p>
          ) : holdings.length === 0 ? (
            <p className="text-muted-foreground">No holdings added yet. Click "Add Holding" to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Purchase Price</TableHead>
                  <TableHead>Current Price</TableHead>
                  <TableHead>Market Value</TableHead>
                  <TableHead>Change %</TableHead>
                  <TableHead>Gain/Loss</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdings.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.symbol}</TableCell>
                    <TableCell>
                      <Badge variant={h.type === 'etf' ? 'default' : 'secondary'}>{h.type.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell>{h.quantity}</TableCell>
                    <TableCell>${h.purchase_price.toFixed(2)}</TableCell>
                    <TableCell>${h.current_price?.toFixed(2) ?? '-'}</TableCell>
                    <TableCell>${h.market_value?.toFixed(2) ?? '-'}</TableCell>
                    <TableCell className={h.change_percent && h.change_percent >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {h.change_percent ? `${h.change_percent.toFixed(2)}%` : '-'}
                    </TableCell>
                    <TableCell className={h.gain_loss && h.gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {h.gain_loss ? `$${h.gain_loss.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openFormDialog(h)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Dialog open={openDelete && selectedHolding?.id === h.id} onOpenChange={setOpenDelete}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={() => setSelectedHolding(h)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Delete Holding</DialogTitle>
                          </DialogHeader>
                          <p>Are you sure you want to delete {h.symbol}? This cannot be undone.</p>
                          <div className="flex justify-end gap-2 mt-4">
                            <Button variant="outline" onClick={() => setOpenDelete(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={() => deleteMutation.mutate(h.id)}>
                              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}