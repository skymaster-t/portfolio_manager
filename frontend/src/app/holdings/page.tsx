// src/app/holdings/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Trash2, Edit, Loader2, GripVertical, Briefcase, TrendingUp } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';

import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  const [openPortfolioDialog, setOpenPortfolioDialog] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openPortfolioDeleteConfirm, setOpenPortfolioDeleteConfirm] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<'CAD' | 'USD'>('CAD');
  const [exchangeRate, setExchangeRate] = useState<number>(1.37);

  // Portfolio dialog state (add/edit)
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [portfolioName, setPortfolioName] = useState('');
  const [portfolioDefault, setPortfolioDefault] = useState(false);

  // Holding form
  const [symbol, setSymbol] = useState('');
  const [type_, setType] = useState<'etf' | 'stock'>('etf');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [underlyingSymbol, setUnderlyingSymbol] = useState('');
  const [tempUnderlyings, setTempUnderlyings] = useState<Underlying[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);

  // Persistent draggable order
  const [order, setOrder] = useState<number[]>([]);

  // Active dragged pie for overlay
  const [activePieId, setActivePieId] = useState<number | null>(null);

  const { data: holdings = [], isLoading: holdingsLoading } = useQuery({
    queryKey: ['holdings'],
    queryFn: fetchHoldings,
    refetchInterval: 900000,
  });

  const { data: portfolios = [], isLoading: portfoliosLoading } = useQuery({
    queryKey: ['portfolios'],
    queryFn: fetchPortfolios,
  });

  // Load saved order from localStorage ONLY on the client after mount (fixes SSR error)
  useEffect(() => {
    if (typeof window === 'undefined') return; // safety guard (though 'use client' already ensures client)

    const saved = localStorage.getItem('portfolioOrder');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every((id: any) => typeof id === 'number')) {
          setOrder(parsed);
        }
      } catch (e) {
        console.warn('Invalid portfolioOrder in localStorage', e);
      }
    }
  }, []);

  // Sync order with current portfolios: preserve custom order, append new portfolios, remove deleted
  useEffect(() => {
    if (portfolios.length === 0) return;

    const currentIds = new Set(portfolios.map(p => p.id));

    // Preserve existing valid order
    let newOrder = order.filter(id => currentIds.has(id));

    // If nothing preserved (e.g. first visit or all portfolios recreated), fall back to server order
    if (newOrder.length === 0) {
      newOrder = portfolios.map(p => p.id);
    }

    // Append any new portfolios at the end
    portfolios.forEach(p => {
      if (!newOrder.includes(p.id)) {
        newOrder.push(p.id);
      }
    });

    if (newOrder.join(',') !== order.join(',')) {
      setOrder(newOrder);
      localStorage.setItem('portfolioOrder', JSON.stringify(newOrder));
    }
  }, [portfolios, order]);

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActivePieId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrder((current) => {
        const oldIndex = current.indexOf(active.id as number);
        const newIndex = current.indexOf(over.id as number);
        const newItems = arrayMove(current, oldIndex, newIndex);
        localStorage.setItem('portfolioOrder', JSON.stringify(newItems));
        return newItems;
      });
    }
    setActivePieId(null);
  };

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
      setSelectedHolding(null);
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
      setOpenPortfolioDialog(false);
      resetPortfolioForm();
      toast.success("Portfolio added successfully!");
    },
    onError: () => {
      toast.error("Failed to add portfolio");
    },
  });

  const updatePortfolioMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => axios.put(`http://localhost:8000/portfolios/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      setOpenPortfolioDialog(false);
      resetPortfolioForm();
      toast.success("Portfolio updated successfully!");
    },
    onError: () => {
      toast.error("Failed to update portfolio");
    },
  });

  const deletePortfolioMutation = useMutation({
    mutationFn: (id: number) => axios.delete(`http://localhost:8000/portfolios/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      setOpenPortfolioDialog(false);
      setOpenPortfolioDeleteConfirm(false);
      resetPortfolioForm();
      toast.success("Portfolio deleted successfully!");
    },
    onError: () => {
      toast.error("Failed to delete portfolio");
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

  const resetPortfolioForm = () => {
    setSelectedPortfolio(null);
    setPortfolioName('');
    setPortfolioDefault(false);
  };

  const openHoldingFormDialog = (holding?: Holding) => {
    if (portfolios.length === 0) {
      toast.error("Please create a portfolio first before adding holdings");
      return;
    }

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

  const handleOpenPortfolioDialog = (portfolio?: Portfolio) => {
    if (portfolio) {
      setSelectedPortfolio(portfolio);
      setPortfolioName(portfolio.name);
      setPortfolioDefault(portfolio.is_default);
    } else {
      resetPortfolioForm();
    }
    setOpenPortfolioDialog(true);
  };

  const handleDeleteClick = (holding: Holding) => {
    setSelectedHolding(holding);
    setOpenDelete(true);
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

  const handlePortfolioSubmit = () => {
    if (!portfolioName.trim()) {
      toast.error("Portfolio name is required");
      return;
    }

    const nameExists = portfolios.some(
      (p) => p.name.toLowerCase() === portfolioName.toLowerCase() && p.id !== selectedPortfolio?.id
    );
    if (nameExists) {
      toast.error("Portfolio name must be unique");
      return;
    }

    const payload = {
      name: portfolioName,
      is_default: portfolioDefault,
    };

    if (selectedPortfolio) {
      updatePortfolioMutation.mutate({ id: selectedPortfolio.id, data: payload });
    } else {
      addPortfolioMutation.mutate(payload);
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

      largeData.sort((a, b) => b.value - a.value);

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

  const SortablePieCard = ({ portfolioId, summary }: { portfolioId: number; summary: any }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: portfolioId });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.8 : 1,
    };

    return (
      <div ref={setNodeRef} style={style} className="h-full">
        <Card className="h-full flex flex-col relative">
          <div className="absolute top-2 left-2 z-10 cursor-grab active:cursor-grabbing select-none" {...attributes} {...listeners}>
            <GripVertical className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardHeader className="pb-4">
            <CardTitle className="pl-10 text-xl">{summary.portfolio.name}</CardTitle>
            <div className="absolute top-4 right-6">
              <p className="text-xl font-bold">${summary.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </CardHeader>
          <CardContent className="flex-1 pt-0">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={summary.chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={0}
                  dataKey="value"
                  label={renderCustomLabel}
                  labelLine={false}
                >
                  {summary.chartData.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.name === 'Other' ? OTHER_COLOR : COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
              </PieChart>
            </ResponsiveContainer>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {summary.legendData.map((entry: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center gap-1.5 bg-[#1f2937] text-white px-3 py-1.5 rounded-md text-sm font-medium"
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span>{entry.name} {entry.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const activePieSummary = activePieId ? portfolioSummaries.summaries.find(s => s.portfolio.id === activePieId) : null;

  return (
    <div className="space-y-8">
      {/* Title and Currency Switcher */}
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

      {/* Circular Add Buttons with Tooltips */}
      <div className="flex gap-6 justify-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="rounded-full w-16 h-16 shadow-lg"
                onClick={() => handleOpenPortfolioDialog()}
              >
                <Briefcase className="h-8 w-8" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add Portfolio</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="rounded-full w-16 h-16 shadow-lg"
                disabled={portfolios.length === 0}
                onClick={() => openHoldingFormDialog()}
              >
                <TrendingUp className="h-8 w-8" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{portfolios.length === 0 ? 'Create a portfolio first to add holdings' : 'Add Holding'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Grand Total */}
      <div className="text-center">
        <p className="text-2xl text-muted-foreground">Total Across All Portfolios</p>
        <p className="text-5xl font-bold font-sans">
          ${portfolioSummaries.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      {/* Draggable Pie Charts */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {order.map(portfolioId => {
              const summary = portfolioSummaries.summaries.find(s => s.portfolio.id === portfolioId);
              if (!summary) return null;
              return <SortablePieCard key={portfolioId} portfolioId={portfolioId} summary={summary} />;
            })}
          </div>
        </SortableContext>

        <DragOverlay>
          {activePieSummary ? (
            <div className="shadow-2xl bg-card border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-4">
                <GripVertical className="h-6 w-6 text-muted-foreground" />
                <h3 className="text-xl font-semibold">{activePieSummary.portfolio.name}</h3>
              </div>
              <p className="text-xl font-bold mb-4">${activePieSummary.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <ResponsiveContainer width={240} height={240}>
                <PieChart>
                  <Pie
                    data={activePieSummary.chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={0}
                    dataKey="value"
                    label={renderCustomLabel}
                    labelLine={false}
                  >
                    {activePieSummary.chartData.map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.name === 'Other' ? OTHER_COLOR : COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Current Portfolios - same persisted order */}
      {portfolios.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-semibold mb-4">Current Portfolios</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {order.map(portfolioId => {
              const p = portfolios.find(p => p.id === portfolioId);
              if (!p) return null;
              return (
                <Button
                  key={p.id}
                  variant="outline"
                  className="h-auto p-4 text-left hover:shadow-lg hover:border-primary transition-all"
                  onClick={() => handleOpenPortfolioDialog(p)}
                >
                  <div className="flex flex-col">
                    <p className="text-base font-semibold">{p.name}</p>
                    {p.is_default && <Badge variant="secondary" className="mt-2 w-fit">Default</Badge>}
                  </div>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Holdings Table */}
      <div className="mt-16">
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
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteClick(h)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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

      {/* ==================== ADD / EDIT HOLDING DIALOG ==================== */}
      <Dialog open={openHoldingForm} onOpenChange={setOpenHoldingForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedHolding ? 'Edit Holding' : 'Add Holding'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="portfolio" className="md:text-right">
                Portfolio
              </Label>
              <Select
                value={selectedPortfolioId?.toString()}
                onValueChange={(v) => setSelectedPortfolioId(Number(v))}
              >
                <SelectTrigger id="portfolio" className="col-span-1 md:col-span-3">
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

            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="symbol" className="md:text-right">
                Symbol
              </Label>
              <Input
                id="symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="col-span-1 md:col-span-3"
                placeholder="e.g. VOO or VOO.TO"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="md:text-right">
                Type
              </Label>
              <Select value={type_} onValueChange={(v) => setType(v as 'etf' | 'stock')}>
                <SelectTrigger id="type" className="col-span-1 md:col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="etf">ETF</SelectItem>
                  <SelectItem value="stock">Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="md:text-right">
                Quantity
              </Label>
              <Input
                id="quantity"
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="col-span-1 md:col-span-3"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="purchasePrice" className="md:text-right">
                Purchase Price
              </Label>
              <Input
                id="purchasePrice"
                type="number"
                step="any"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="col-span-1 md:col-span-3"
              />
            </div>

            {type_ === 'etf' && (
              <div className="space-y-3">
                <Label>Underlying Symbols (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    value={underlyingSymbol}
                    onChange={(e) => setUnderlyingSymbol(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUnderlying())}
                    placeholder="e.g. AAPL"
                  />
                  <Button type="button" onClick={addUnderlying}>
                    Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {tempUnderlyings.map((u) => (
                    <Badge key={u.id} variant="secondary" className="pr-1">
                      {u.symbol}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-2 h-4 w-4 p-0"
                        onClick={() => removeUnderlying(u.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenHoldingForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleHoldingSubmit}
              disabled={addHoldingMutation.isPending || updateHoldingMutation.isPending}
            >
              {(addHoldingMutation.isPending || updateHoldingMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== ADD / EDIT PORTFOLIO DIALOG ==================== */}
      <Dialog open={openPortfolioDialog} onOpenChange={setOpenPortfolioDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPortfolio ? 'Edit Portfolio' : 'Add Portfolio'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="portfolio-name" className="md:text-right">
                Name
              </Label>
              <Input
                id="portfolio-name"
                value={portfolioName}
                onChange={(e) => setPortfolioName(e.target.value)}
                className="col-span-1 md:col-span-3"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="default" className="md:text-right">
                Default
              </Label>
              <div className="flex items-center h-10 col-span-1 md:col-span-3">
                <Checkbox
                  id="default"
                  checked={portfolioDefault}
                  onCheckedChange={(checked) => setPortfolioDefault(!!checked)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            {selectedPortfolio && (
              <Button
                variant="destructive"
                onClick={() => setOpenPortfolioDeleteConfirm(true)}
              >
                Delete Portfolio
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setOpenPortfolioDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handlePortfolioSubmit}>
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== PORTFOLIO DELETE CONFIRMATION ==================== */}
      <Dialog open={openPortfolioDeleteConfirm} onOpenChange={setOpenPortfolioDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Portfolio</DialogTitle>
          </DialogHeader>

          {selectedPortfolio && (
            <>
              <p>Are you sure you want to delete "<strong>{selectedPortfolio.name}</strong>"?</p>
              {(() => {
                const count = holdings.filter(h => h.portfolio_id === selectedPortfolio.id).length;
                return count > 0 ? (
                  <p className="text-red-600 mt-4 font-medium">
                    This will <strong>permanently delete</strong> the portfolio and all <strong>{count}</strong> holdings it contains.
                    This cannot be undone.
                  </p>
                ) : (
                  <p className="text-muted-foreground mt-4">This portfolio currently has no holdings.</p>
                );
              })()}
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenPortfolioDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletePortfolioMutation.mutate(selectedPortfolio!.id)}
              disabled={deletePortfolioMutation.isPending}
            >
              {deletePortfolioMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Portfolio'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Holding Confirmation */}
      <Dialog open={openDelete} onOpenChange={setOpenDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Holding</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete {selectedHolding?.symbol}? This cannot be undone.</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpenDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              if (selectedHolding) {
                deleteMutation.mutate(selectedHolding.id);
              }
            }}>
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}