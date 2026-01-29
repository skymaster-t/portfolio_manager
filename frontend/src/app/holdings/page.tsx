// src/app/holdings/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface Underlying {
  id: number;
  symbol: string;
}

interface Holding {
  id: number;
  symbol: string;
  type: 'stock' | 'etf';
  quantity: number;
  purchase_price: number;
  current_price?: number;
  all_time_change_percent?: number;
  market_value?: number;
  all_time_gain_loss?: number;
  daily_change?: number;
  daily_change_percent?: number;
  portfolio_id: number;
  underlyings?: Underlying[];
}

interface Portfolio {
  id: number;
  name: string;
  is_default: boolean;
}

const fetchHoldings = async (): Promise<Holding[]> => {
  const { data } = await axios.get('http://localhost:8000/holdings');
  return data;
};

const fetchPortfolios = async (): Promise<Portfolio[]> => {
  const { data } = await axios.get('http://localhost:8000/portfolios');
  return data;
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const OTHER_COLOR = '#94a3b8';

export default function Holdings() {
  const queryClient = useQueryClient();
  const [openHoldingForm, setOpenHoldingForm] = useState(false);
  const [openPortfolioForm, setOpenPortfolioForm] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<'CAD' | 'USD'>('CAD');
  const [exchangeRate, setExchangeRate] = useState<number>(1.37);

  // Portfolio form
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioDefault, setNewPortfolioDefault] = useState(false);

  // Holding form
  const [symbol, setSymbol] = useState('');
  const [type_, setType] = useState<'etf' | 'stock'>('etf');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [underlyingSymbol, setUnderlyingSymbol] = useState('');
  const [tempUnderlyings, setTempUnderlyings] = useState<Underlying[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);

  const { data: holdings = [], isLoading: holdingsLoading } = useQuery({
    queryKey: ['holdings'],
    queryFn: fetchHoldings,
    refetchInterval: 900000,
  });

  const { data: portfolios = [], isLoading: portfoliosLoading } = useQuery({
    queryKey: ['portfolios'],
    queryFn: fetchPortfolios,
  });

  // Set default portfolio on load
  useEffect(() => {
    if (portfolios.length > 0 && selectedPortfolioId === null) {
      const defaultPort = portfolios.find((p: Portfolio) => p.is_default);
      setSelectedPortfolioId(defaultPort ? defaultPort.id : portfolios[0]?.id || null);
    }
  }, [portfolios, selectedPortfolioId]);

  // Fetch exchange rate
  useEffect(() => {
    const fetchRate = async () => {
      try {
        const resp = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json');
        const data = await resp.json();
        setExchangeRate(data.usd.cad || 1.37);
      } catch {
        console.warn("Failed to fetch exchange rate, using fallback 1.37");
      }
    };
    fetchRate();
  }, []);

  const getPriceErrorMessage = (symbol: string) => {
    const upperSymbol = symbol.toUpperCase();
    if (upperSymbol.endsWith('.TO')) {
      return `Unable to fetch price for "${symbol}". No price data available at this time.`;
    } else {
      return `Unable to fetch price for "${symbol}". For Canadian/TSX symbols, try adding .TO (e.g., ${symbol}.TO).`;
    }
  };

  const addHoldingMutation = useMutation({
    mutationFn: (data: any) => axios.post('http://localhost:8000/holdings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      setOpenHoldingForm(false);
      resetHoldingForm();
      toast.success("Holding added successfully!");
    },
    onError: (error: any) => {
      const backendMessage = error.response?.data?.detail || "";
      if (backendMessage.includes("price") || backendMessage.includes("symbol") || backendMessage.includes("data")) {
        toast.error(getPriceErrorMessage(symbol));
      } else {
        toast.error(backendMessage || "Failed to add holding");
      }
    },
  });

  const updateHoldingMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => axios.put(`http://localhost:8000/holdings/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      setOpenHoldingForm(false);
      resetHoldingForm();
      toast.success("Holding updated successfully!");
    },
    onError: (error: any) => {
      const backendMessage = error.response?.data?.detail || "";
      if (backendMessage.includes("price") || backendMessage.includes("symbol") || backendMessage.includes("data")) {
        toast.error(getPriceErrorMessage(symbol));
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

  const addPortfolioMutation = useMutation({
    mutationFn: (data: any) => axios.post('http://localhost:8000/portfolios', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      setOpenPortfolioForm(false);
      setNewPortfolioName('');
      setNewPortfolioDefault(false);
      toast.success("Portfolio added successfully!");
    },
    onError: () => {
      toast.error("Failed to add portfolio");
    },
  });

  const resetHoldingForm = () => {
    setSymbol('');
    setType('etf');
    setQuantity('');
    setPurchasePrice('');
    setTempUnderlyings([]);
    setUnderlyingSymbol('');
    setSelectedHolding(null);
  };

  const openHoldingFormDialog = (holding?: Holding) => {
    if (holding) {
      setSelectedHolding(holding);
      setSymbol(holding.symbol);
      setType(holding.type);
      setQuantity(holding.quantity.toString());
      setPurchasePrice(holding.purchase_price.toString());
      setTempUnderlyings(holding.underlyings || []);
      setSelectedPortfolioId(holding.portfolio_id);
    } else {
      resetHoldingForm();
      const defaultPort = portfolios.find((p: Portfolio) => p.is_default);
      setSelectedPortfolioId(defaultPort ? defaultPort.id : portfolios[0]?.id || null);
    }
    setOpenHoldingForm(true);
  };

  const handleHoldingSubmit = () => {
    if (!symbol.trim() || !quantity || !purchasePrice || !selectedPortfolioId) {
      toast.error("Please fill all required fields");
      return;
    }

    const payload = {
      symbol: symbol.toUpperCase(),
      type: type_,
      quantity: parseFloat(quantity),
      purchase_price: parseFloat(purchasePrice),
      portfolio_id: selectedPortfolioId,
      underlyings: type_ === 'etf' ? tempUnderlyings.map(u => ({ symbol: u.symbol })) : [],
    };

    if (selectedHolding) {
      updateHoldingMutation.mutate({ id: selectedHolding.id, data: payload });
    } else {
      addHoldingMutation.mutate(payload);
    }
  };

  const handleAddPortfolio = () => {
    if (!newPortfolioName.trim()) {
      toast.error("Portfolio name is required");
      return;
    }
    if (portfolios.some((p: Portfolio) => p.name.toLowerCase() === newPortfolioName.toLowerCase())) {
      toast.error("Portfolio name must be unique");
      return;
    }
    addPortfolioMutation.mutate({
      name: newPortfolioName,
      is_default: newPortfolioDefault,
    });
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

  // Currency logic
  const getHoldingCurrency = (symbol: string): 'CAD' | 'USD' => {
    return symbol.toUpperCase().endsWith('.TO') ? 'CAD' : 'USD';
  };

  const convertValue = (value: number | undefined, fromCurrency: 'CAD' | 'USD'): number => {
    if (value === undefined || value === null) return 0;
    if (displayCurrency === fromCurrency) return value;
    return displayCurrency === 'CAD' ? value * exchangeRate : value / exchangeRate;
  };

  const formatCurrency = (value: number | undefined, fromCurrency: 'CAD' | 'USD') => {
    const converted = convertValue(value, fromCurrency);
    const formatted = converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return value === null || value === undefined ? '-' : `$${formatted}`;
  };

  const formatPercent = (percent: number | undefined) => {
    if (percent === undefined || percent === null) return '-';
    const formatted = percent.toFixed(2);
    return <span className={percent >= 0 ? 'text-green-600' : 'text-red-600'}>{formatted}%</span>;
  };

  // Portfolio summaries with "Other" grouping (threshold <8%)
  const portfolioSummaries = useMemo(() => {
    if (!holdings.length || !portfolios.length) return { summaries: [], grandTotal: 0 };

    const summaries = portfolios.map(p => {
      const pHoldings = holdings.filter((h: Holding) => h.portfolio_id === p.id);

      const individualData = pHoldings.map(h => {
        const holdingCurrency = getHoldingCurrency(h.symbol);
        const convertedValue = convertValue(h.market_value, holdingCurrency);
        return {
          name: h.symbol,
          value: convertedValue > 0 ? convertedValue : 0,
        };
      });

      const total = individualData.reduce((sum, item) => sum + item.value, 0);

      individualData.forEach(item => {
        item.percentage = total > 0 ? (item.value / total) * 100 : 0;
      });

      const sortedLegendData = [...individualData].sort((a, b) => b.value - a.value);

      const largeData = individualData.filter(item => item.percentage >= 8);
      const smallData = individualData.filter(item => item.percentage < 8);

      let chartData = [...largeData];

      if (smallData.length >= 2) {
        const otherValue = smallData.reduce((sum, item) => sum + item.value, 0);
        const otherPercentage = total > 0 ? (otherValue / total) * 100 : 0;
        chartData.push({
          name: 'Other',
          value: otherValue,
          percentage: otherPercentage,
        });
      }

      return {
        portfolio: p,
        chartData,
        legendData: sortedLegendData,
        total,
        holdingsCount: pHoldings.length,
      };
    }).filter(s => s.holdingsCount > 0);

    const grandTotal = summaries.reduce((sum, s) => sum + s.total, 0);

    return { summaries, grandTotal };
  }, [holdings, portfolios, displayCurrency, exchangeRate]);

  // Custom label: show for >=8% or "Other"
  const renderCustomLabel = (props: any) => {
    const { cx, cy, midAngle, outerRadius, percentage, name } = props;
    const RADIAN = Math.PI / 180;

    if (percentage < 8 && name !== 'Other') return null;

    const radius = outerRadius + 30;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <g>
        <line
          x1={cx + outerRadius * Math.cos(-midAngle * RADIAN)}
          y1={cy + outerRadius * Math.sin(-midAngle * RADIAN)}
          x2={x}
          y2={y}
          stroke="#1f2937"
          strokeWidth={2}
        />

        <rect
          x={x - 45}
          y={y - 12}
          width={90}
          height={24}
          rx={12}
          ry={12}
          fill="#1f2937"
          opacity={0.95}
        />

        <text
          x={x}
          y={y}
          fill="white"
          textAnchor="middle"
          dominantBaseline="central"
          className="text-[11px] font-bold font-sans"
        >
          {`${name} ${percentage.toFixed(1)}%`}
        </text>
      </g>
    );
  };

  return (
    <div className="space-y-8">
      {/* Currency Switcher */}
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">Holdings</h1>
        <div className="flex gap-2">
          <Button
            variant={displayCurrency === 'CAD' ? 'default' : 'outline'}
            size="icon"
            className="rounded-full w-12 h-12 text-2xl"
            onClick={() => setDisplayCurrency('CAD')}
          >
            🇨🇦
          </Button>
          <Button
            variant={displayCurrency === 'USD' ? 'default' : 'outline'}
            size="icon"
            className="rounded-full w-12 h-12 text-2xl"
            onClick={() => setDisplayCurrency('USD')}
          >
            🇺🇸
          </Button>
        </div>
      </div>

      {/* Grand Total */}
      <div className="text-center">
        <p className="text-2xl text-muted-foreground">Total Across All Portfolios</p>
        <p className="text-5xl font-bold font-sans">
          ${portfolioSummaries.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      {/* Portfolio Pies */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {portfolioSummaries.summaries.map(({ portfolio, chartData, legendData, total }) => (
          <Card key={portfolio.id}>
            <CardHeader className="relative">
              <CardTitle>{portfolio.name}</CardTitle>
              <div className="absolute top-4 right-6">
                <p className="text-2xl font-bold">${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={71}
                    paddingAngle={0}
                    dataKey="value"
                    label={renderCustomLabel}
                    labelLine={false}
                  >
                    {chartData.map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.name === 'Other' ? OTHER_COLOR : COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                </PieChart>
              </ResponsiveContainer>

              {/* Compact legend with rounded dark background */}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {legendData.map((entry: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center gap-1.5 bg-[#1f2937] text-white px-2 py-1 rounded-md text-xs font-medium"
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span>{entry.name} {entry.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Portfolio and Add Holding Buttons */}
      <div className="flex gap-4">
        <Dialog open={openPortfolioForm} onOpenChange={setOpenPortfolioForm}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Portfolio
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Portfolio</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div>
                <Label>Name</Label>
                <Input value={newPortfolioName} onChange={e => setNewPortfolioName(e.target.value)} placeholder="My Growth Portfolio" />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="default" checked={newPortfolioDefault} onCheckedChange={(checked) => setNewPortfolioDefault(checked as boolean)} />
                <Label htmlFor="default" className="text-sm font-medium cursor-pointer">
                  Set as default portfolio
                </Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setOpenPortfolioForm(false)}>Cancel</Button>
              <Button onClick={handleAddPortfolio}>Create Portfolio</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={openHoldingForm} onOpenChange={setOpenHoldingForm}>
          <DialogTrigger asChild>
            <Button onClick={() => openHoldingFormDialog()}>
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
                  <Label>Portfolio</Label>
                  <Select value={selectedPortfolioId?.toString()} onValueChange={(v) => setSelectedPortfolioId(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select portfolio" />
                    </SelectTrigger>
                    <SelectContent>
                      {portfolios.map((p: Portfolio) => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          {p.name} {p.is_default ? '(Default)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="100" />
                </div>
              </div>
              <div>
                <Label>Purchase Price</Label>
                <Input type="number" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="150.00" />
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
              <Button variant="outline" onClick={() => setOpenHoldingForm(false)}>Cancel</Button>
              <Button onClick={handleHoldingSubmit} disabled={addHoldingMutation.isPending || updateHoldingMutation.isPending}>
                {addHoldingMutation.isPending || updateHoldingMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {selectedHolding ? 'Update' : 'Add'} Holding
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Current Portfolios List */}
      {portfolios.length > 0 && (
        <div className="mt-6">
          <h2 className="text-2xl font-semibold mb-4">Current Portfolios</h2>
          <div className="flex flex-wrap gap-4">
            {portfolios.map((p: Portfolio) => (
              <Card key={p.id} className="p-4 min-w-48">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{p.name}</p>
                  {p.is_default && <Badge variant="secondary">Default</Badge>}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Holdings Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          {holdingsLoading || portfoliosLoading ? (
            <p>Loading...</p>
          ) : holdings.length === 0 ? (
            <p className="text-muted-foreground">No holdings added yet. Click "Add Holding" to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Portfolio</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Purchase Price</TableHead>
                  <TableHead>Current Price</TableHead>
                  <TableHead>Market Value</TableHead>
                  <TableHead>All Time Change %</TableHead>
                  <TableHead>All Time Gain/Loss</TableHead>
                  <TableHead>Daily Change %</TableHead>
                  <TableHead>Daily Gain/Loss</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdings.map((h) => {
                  const holdingCurrency = getHoldingCurrency(h.symbol);
                  const dailyGainLoss = h.daily_change !== undefined ? h.daily_change * h.quantity : undefined;
                  const portfolio = portfolios.find((p: Portfolio) => p.id === h.portfolio_id);
                  return (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{portfolio?.name || 'Unknown'}</TableCell>
                      <TableCell className="font-medium">{h.symbol}</TableCell>
                      <TableCell>
                        <Badge variant={h.type === 'etf' ? 'default' : 'secondary'}>{h.type.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>{h.quantity}</TableCell>
                      <TableCell>{formatCurrency(h.purchase_price, holdingCurrency)}</TableCell>
                      <TableCell>{formatCurrency(h.current_price, holdingCurrency)}</TableCell>
                      <TableCell>{formatCurrency(h.market_value, holdingCurrency)}</TableCell>
                      <TableCell>{formatPercent(h.all_time_change_percent)}</TableCell>
                      <TableCell className={h.all_time_gain_loss && h.all_time_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(h.all_time_gain_loss, holdingCurrency)}
                      </TableCell>
                      <TableCell>{formatPercent(h.daily_change_percent)}</TableCell>
                      <TableCell className={dailyGainLoss && dailyGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {dailyGainLoss !== undefined ? formatCurrency(dailyGainLoss, holdingCurrency) : '-'}
                      </TableCell>
                      <TableCell className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openHoldingFormDialog(h)}>
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
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}