// src/app/holdings/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { PortfolioHeader } from './components/PortfolioHeader';
import { PortfolioGrid } from './components/PortfolioGrid';
import { HoldingsTable } from './components/HoldingsTable';
import { HoldingFormDialog } from './components/HoldingFormDialog';
import { PortfolioFormDialog } from './components/PortfolioFormDialog';
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog';
import { usePortfolioMutations } from './hooks/usePortfolioMutations';

interface Holding {
  id: number;
  symbol: string;
  type: 'stock' | 'etf';
  quantity: number;
  purchase_price: number;
  current_price?: number;
  market_value?: number;
  daily_change?: number;
  daily_change_percent?: number;
  all_time_gain_loss?: number;
  portfolio_id: number;
  underlyings?: { id: number; symbol: string; allocation_percent?: number }[];
  underlying_details?: any[];
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

export default function Holdings() {
  const queryClient = useQueryClient();

  const [displayCurrency, setDisplayCurrency] = useState<'CAD' | 'USD'>('CAD');
  const [exchangeRate, setExchangeRate] = useState(1.37);

  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);

  const [openHoldingForm, setOpenHoldingForm] = useState(false);
  const [openPortfolioForm, setOpenPortfolioForm] = useState(false);
  const [openHoldingDelete, setOpenHoldingDelete] = useState(false);
  const [openPortfolioDelete, setOpenPortfolioDelete] = useState(false);

  const [activeId, setActiveId] = useState<number | null>(null);
  const [expandedHoldings, setExpandedHoldings] = useState<Set<number>>(new Set());

  const {
    data: holdings = [],
    isLoading: holdingsLoading,
  } = useQuery({ queryKey: ['holdings'], queryFn: fetchHoldings, refetchInterval: 900000 });

  const {
    data: portfolios = [],
    isLoading: portfoliosLoading,
  } = useQuery({ queryKey: ['portfolios'], queryFn: fetchPortfolios });

  const {
    addHolding,
    updateHolding,
    deleteHolding,
    createPortfolio,
    updatePortfolio,
    deletePortfolio,
  } = usePortfolioMutations();

  // Exchange rate
  useEffect(() => {
    const fetchRate = async () => {
      try {
        const resp = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
        const data = await resp.json();
        setExchangeRate(data.usd.cad);
      } catch {
        setExchangeRate(1.37);
      }
    };
    fetchRate();
    const interval = setInterval(fetchRate, 3600000);
    return () => clearInterval(interval);
  }, []);

  // Default portfolio selection
  useEffect(() => {
    if (portfolios.length > 0 && selectedPortfolioId === null) {
      const defaultPort = portfolios.find((p) => p.is_default);
      setSelectedPortfolioId(defaultPort ? defaultPort.id : portfolios[0].id);
    }
  }, [portfolios, selectedPortfolioId]);

  // Close dialogs on success
  useEffect(() => {
    if (deleteHolding.isSuccess) {
      setOpenHoldingDelete(false);
    }
  }, [deleteHolding.isSuccess]);

  useEffect(() => {
    if (deletePortfolio.isSuccess) {
      setOpenPortfolioDelete(false);
    }
  }, [deletePortfolio.isSuccess]);

  useEffect(() => {
    if (addHolding.isSuccess || updateHolding.isSuccess) {
      setOpenHoldingForm(false);
    }
  }, [addHolding.isSuccess, updateHolding.isSuccess]);

  // Compute default portfolio ID for holding form pre-select
  const defaultPortfolioId = useMemo(() => {
    const def = portfolios.find(p => p.is_default);
    return def ? def.id : portfolios[0]?.id || null;
  }, [portfolios]);

  // Open add holding – clears form and uses default portfolio
  const openAddHolding = () => {
    if (portfolios.length === 0) {
      toast.error('Create a portfolio first');
      return;
    }
    setSelectedHolding(null);
    setOpenHoldingForm(true);
  };

  // Calculations
  const { totalMarketValue, totalCostBasis, totalGainLoss, totalDailyChange } = useMemo(() => {
    let market = 0;
    let cost = 0;
    let daily = 0;

    holdings.forEach((h) => {
      market += h.market_value || 0;
      cost += h.quantity * h.purchase_price;
      daily += (h.daily_change || 0) * h.quantity;
    });

    return {
      totalMarketValue: market,
      totalCostBasis: cost,
      totalGainLoss: market - cost,
      totalDailyChange: daily,
    };
  }, [holdings]);

  // portfoliosWithData – uses server-ordered portfolios directly
  const portfoliosWithData = useMemo(() => {
    return portfolios.map((port) => {
      const portHoldings = holdings.filter((h) => h.portfolio_id === port.id);
      const totalValue = portHoldings.reduce((s, h) => s + (h.market_value || 0), 0);
      const totalCost = portHoldings.reduce((s, h) => s + h.quantity * h.purchase_price, 0);
      const gainLoss = totalValue - totalCost;
      const allTimePercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

      let pie = portHoldings
        .map((h) => ({ name: h.symbol, value: h.market_value || 0 }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value);

      if (pie.length > 8) {
        const top = pie.slice(0, 8);
        const other = pie.slice(8).reduce((s, d) => s + d.value, 0);
        pie = [...top, { name: 'Other', value: other }];
      }

      return { 
        ...port, 
        totalValue, 
        gainLoss, 
        allTimePercent,
        pieData: pie 
      };
    });
  }, [portfolios, holdings]);

  const selectedPortfolioHoldings = useMemo(
    () => holdings.filter((h) => h.portfolio_id === selectedPortfolioId),
    [holdings, selectedPortfolioId]
  );

  const selectedPortfolioName = portfolios.find((p) => p.id === selectedPortfolioId)?.name || '';

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: displayCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [displayCurrency]
  );

  const percentFormatter = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  const toggleExpand = (id: number) => {
    setExpandedHoldings((prev) => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  if (holdingsLoading || portfoliosLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <PortfolioHeader
        totalValue={totalMarketValue}
        gainLoss={totalGainLoss}
        dailyChange={totalDailyChange}
        costBasis={totalCostBasis}
        marketValue={totalMarketValue}
        currencyFormatter={currencyFormatter}
        percentFormatter={percentFormatter}
        displayCurrency={displayCurrency}
        setDisplayCurrency={setDisplayCurrency}
        exchangeRate={exchangeRate}
        isLoading={holdingsLoading}
        onAddPortfolio={() => {
          setSelectedPortfolio(null);
          setOpenPortfolioForm(true);
        }}
        onAddHolding={openAddHolding}
        hasSelectedPortfolio={portfolios.length > 0}
      />

      <PortfolioGrid
        portfoliosWithData={portfoliosWithData}
        selectedPortfolioId={selectedPortfolioId}
        onSelectPortfolio={setSelectedPortfolioId}
        onEditPortfolio={(p) => {
          setSelectedPortfolio(p);
          setOpenPortfolioForm(true);
        }}
        onDeletePortfolio={(p) => {
          setSelectedPortfolio(p);
          setOpenPortfolioDelete(true);
        }}
        activeId={activeId}
        setActiveId={setActiveId}
        currencyFormatter={currencyFormatter}
        displayCurrency={displayCurrency}
        exchangeRate={exchangeRate}
        onCreateFirstPortfolio={() => {
          setSelectedPortfolio(null);
          setOpenPortfolioForm(true);
        }}
        onReorder={async (newOrder: number[]) => {
          try {
            await axios.post('http://localhost:8000/portfolios/reorder', { order: newOrder });
            queryClient.invalidateQueries({ queryKey: ['portfolios'] });
          } catch (err) {
            toast.error('Failed to save order');
          }
        }}
      />

      {selectedPortfolioId && (
        <HoldingsTable
          holdings={selectedPortfolioHoldings}
          portfolioName={selectedPortfolioName}
          expandedHoldings={expandedHoldings}
          onToggleExpand={toggleExpand}
          onEditHolding={(h) => {
            setSelectedHolding(h);
            setOpenHoldingForm(true);
          }}
          onDeleteHolding={(h) => {
            setSelectedHolding(h);
            setOpenHoldingDelete(true);
          }}
          currencyFormatter={currencyFormatter}
          displayCurrency={displayCurrency}
          exchangeRate={exchangeRate}
        />
      )}

      <HoldingFormDialog
        open={openHoldingForm}
        onOpenChange={setOpenHoldingForm}
        selectedHolding={selectedHolding}
        portfolios={portfolios}
        defaultPortfolioId={defaultPortfolioId}
        onSubmit={(payload) =>
          selectedHolding
            ? updateHolding.mutate(payload)
            : addHolding.mutate(payload)
        }
        isPending={addHolding.isPending || updateHolding.isPending}
      />

      <PortfolioFormDialog
        open={openPortfolioForm}
        onOpenChange={setOpenPortfolioForm}
        selectedPortfolio={selectedPortfolio}
        onSubmit={(payload) =>
          selectedPortfolio
            ? updatePortfolio.mutate({ id: selectedPortfolio.id, data: payload })
            : createPortfolio.mutate(payload)
        }
        isPending={createPortfolio.isPending || updatePortfolio.isPending}
        onOpenDeleteConfirm={() => setOpenPortfolioDelete(true)}
      />

      <DeleteConfirmDialog
        open={openHoldingDelete}
        onOpenChange={setOpenHoldingDelete}
        title="Delete Holding"
        message={
          <p className="text-lg">
            Are you sure you want to delete <strong>{selectedHolding?.symbol}</strong>?
            <br />
            <span className="text-destructive mt-4 font-medium">This action cannot be undone.</span>
          </p>
        }
        onConfirm={() => selectedHolding && deleteHolding.mutate(selectedHolding.id)}
        isPending={deleteHolding.isPending}
      />

      <DeleteConfirmDialog
        open={openPortfolioDelete}
        onOpenChange={setOpenPortfolioDelete}
        title="Delete Portfolio"
        message={
          selectedPortfolio && (
            <>
              <p className="text-lg mb-4">
                Are you sure you want to delete "<strong>{selectedPortfolio.name}</strong>"?
              </p>
              {holdings.filter((h) => h.portfolio_id === selectedPortfolio.id).length > 0 ? (
                <p className="text-destructive font-medium">
                  This will <strong>permanently delete</strong> the portfolio and all its holdings.
                </p>
              ) : (
                <p className="text-muted-foreground">This portfolio has no holdings.</p>
              )}
            </>
          )
        }
        onConfirm={() => selectedPortfolio && deletePortfolio.mutate(selectedPortfolio.id)}
        isPending={deletePortfolio.isPending}
      />
    </div>
  );
}