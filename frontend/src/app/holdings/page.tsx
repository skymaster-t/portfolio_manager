// src/app/holdings/page.tsx (updated: automatic silent data refresh every 5 minutes + manual refresh with toast)
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

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

interface PortfolioSummary {
  id: number;
  name: string;
  isDefault: boolean;
  totalValue: number;
  gainLoss: number;
  dailyChange: number;
  dailyPercent: number;
  allTimePercent: number;
  pieData: { name: string; value: number }[];
}

const fetchPortfoliosSummaries = async (): Promise<PortfolioSummary[]> => {
  const { data } = await axios.get('http://localhost:8000/portfolios/summaries');
  return data;
};

export default function Holdings() {
  const queryClient = useQueryClient();

  const {
    data: portfoliosSummaries = [],
    isLoading: summariesLoading,
  } = useQuery({
    queryKey: ['portfoliosSummaries'],
    queryFn: fetchPortfoliosSummaries,
  });

  const {
    data: allHoldings = [],
    isLoading: allHoldingsLoading,
  } = useQuery({
    queryKey: ['allHoldings'],
    queryFn: async () => {
      const { data } = await axios.get('http://localhost:8000/holdings');
      return data;
    },
  });

  const { data: fxRate = 1.37 } = useQuery({
    queryKey: ['fxRate'],
    queryFn: async () => {
      const { data } = await axios.get('http://localhost:8000/fx/current');
      return data.usdcad_rate;
    },
    staleTime: 5 * 60 * 1000,
  });

  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);

  const selectedHoldings = useMemo(
    () => (selectedPortfolioId ? allHoldings.filter((h: Holding) => h.portfolio_id === selectedPortfolioId) : []),
    [allHoldings, selectedPortfolioId]
  );

  const [displayCurrency, setDisplayCurrency] = useState<'CAD' | 'USD'>('CAD');

  const isLoading = summariesLoading || allHoldingsLoading;

  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [selectedPortfolio, setSelectedPortfolio] = useState<PortfolioSummary | null>(null);

  const [openHoldingForm, setOpenHoldingForm] = useState(false);
  const [openPortfolioForm, setOpenPortfolioForm] = useState(false);
  const [openHoldingDelete, setOpenHoldingDelete] = useState(false);
  const [openPortfolioDelete, setOpenPortfolioDelete] = useState(false);

  // Expandable underlying holdings state
  const [expandedHoldings, setExpandedHoldings] = useState<Set<number>>(new Set());

  const handleToggleExpand = (id: number) => {
    setExpandedHoldings((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Refresh button loading & last refresh timestamp
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every minute for live relative formatting
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const getRelativeTime = (): string => {
    if (!lastRefreshTime) return 'not yet';

    const diffMs = currentTime - lastRefreshTime.getTime();
    if (diffMs < 60000) return 'just now';

    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }

    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  };

  useEffect(() => {
    if (portfoliosSummaries.length > 0 && selectedPortfolioId === null) {
      const defaultPort = portfoliosSummaries.find(p => p.isDefault) || portfoliosSummaries[0];
      setSelectedPortfolioId(defaultPort.id);
    }
  }, [portfoliosSummaries, selectedPortfolioId]);

  const combinedSummary = useMemo(() => {
    if (portfoliosSummaries.length === 0) return null;
    const total = portfoliosSummaries.reduce((sum, p) => sum + p.totalValue, 0);
    const daily = portfoliosSummaries.reduce((sum, p) => sum + p.dailyChange, 0);
    const gain = portfoliosSummaries.reduce((sum, p) => sum + p.gainLoss, 0);
    const dailyPercent = total > 0 ? (daily / (total - daily) * 100) : 0;
    const allTimePercent = total > 0 ? (gain / (total - gain) * 100) : 0;
    return {
      totalValue: total,
      gainLoss: gain,
      dailyChange: daily,
      dailyPercent,
      allTimePercent,
    };
  }, [portfoliosSummaries]);

  const selectedSummary = portfoliosSummaries.find(p => p.id === selectedPortfolioId);

  const {
    createPortfolio,
    updatePortfolio,
    deletePortfolio,
    addHolding,
    updateHolding,
    deleteHolding,
  } = usePortfolioMutations(queryClient);

  // Manual refresh (with toast feedback)
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['portfoliosSummaries'] }),
        queryClient.refetchQueries({ queryKey: ['allHoldings'] }),
        queryClient.refetchQueries({ queryKey: ['fxRate'] }),
      ]);

      setLastRefreshTime(new Date());
      toast.success('Data refreshed');
    } catch (error) {
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Silent automatic refresh every 5 minutes
  const silentRefresh = async () => {
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['portfoliosSummaries'], type: 'inactive' }),
        queryClient.refetchQueries({ queryKey: ['allHoldings'], type: 'inactive' }),
        queryClient.refetchQueries({ queryKey: ['fxRate'], type: 'inactive' }),
      ]);
      setLastRefreshTime(new Date());
    } catch {
      // Silent fail – no toast on auto refresh
    }
  };

  // Auto-refresh every 5 minutes (300000 ms)
  useEffect(() => {
    const interval = setInterval(silentRefresh, 300000);
    return () => clearInterval(interval);
  }, []);

  // Shared success handler for holding add/edit
  const onHoldingSuccess = () => {
    setOpenHoldingForm(false);
    setSelectedHolding(null);
    queryClient.invalidateQueries({ queryKey: ['allHoldings'] });
    queryClient.invalidateQueries({ queryKey: ['portfoliosSummaries'] });
  };

  const plainPortfolios = portfoliosSummaries.map(p => ({ id: p.id, name: p.name }));

  return (
    <div className="container mx-auto p-6 space-y-12">
      <PortfolioHeader
        totalValue={combinedSummary?.totalValue || 0}
        gainLoss={combinedSummary?.gainLoss || 0}
        dailyChange={combinedSummary?.dailyChange || 0}
        dailyPercent={combinedSummary?.dailyPercent || 0}
        allTimePercent={combinedSummary?.allTimePercent || 0}
        marketValue={combinedSummary?.totalValue || 0}
        displayCurrency={displayCurrency}
        setDisplayCurrency={setDisplayCurrency}
        exchangeRate={fxRate}
        isLoading={isLoading}
        onAddPortfolio={() => {
          setSelectedPortfolio(null);
          setOpenPortfolioForm(true);
        }}
        onAddHolding={() => {
          setSelectedHolding(null);
          setOpenHoldingForm(true);
        }}
        hasSelectedPortfolio={!!selectedPortfolioId}
      />

      <PortfolioGrid
        portfoliosWithData={portfoliosSummaries}
        selectedPortfolioId={selectedPortfolioId}
        onSelectPortfolio={setSelectedPortfolioId}
        onEditPortfolio={p => {
          setSelectedPortfolio(p);
          setOpenPortfolioForm(true);
        }}
        onDeletePortfolio={p => {
          setSelectedPortfolio(p);
          setOpenPortfolioDelete(true);
        }}
        activeId={null}
        setActiveId={() => {}}
        displayCurrency={displayCurrency}
        exchangeRate={fxRate}
        onCreateFirstPortfolio={() => {
          setSelectedPortfolio(null);
          setOpenPortfolioForm(true);
        }}
        isLoading={isLoading}
      />

      <div className="flex justify-end items-center gap-6">
        <span className="text-sm text-muted-foreground">
          {isRefreshing ? 'Refreshing data...' : `Last refreshed: ${getRelativeTime()}`}
        </span>
        <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
          {isRefreshing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Data
            </>
          )}
        </Button>
      </div>

      {selectedPortfolioId && selectedSummary && (
        <HoldingsTable
          holdings={selectedHoldings}
          portfolioName={selectedSummary.name}
          expandedHoldings={expandedHoldings}
          onToggleExpand={handleToggleExpand}
          onEditHolding={h => {
            setSelectedHolding(h);
            setOpenHoldingForm(true);
          }}
          onDeleteHolding={h => {
            setSelectedHolding(h);
            setOpenHoldingDelete(true);
          }}
          displayCurrency={displayCurrency}
          exchangeRate={fxRate}
          isLoading={isLoading}
        />
      )}

      {/* Holding Form – closes & refreshes on success */}
      <HoldingFormDialog
        open={openHoldingForm}
        onOpenChange={setOpenHoldingForm}
        selectedHolding={selectedHolding}
        portfolios={plainPortfolios}
        defaultPortfolioId={selectedPortfolioId}
        onSubmit={payload => {
          if (selectedHolding) {
            updateHolding.mutate(
              { id: selectedHolding.id, data: payload },
              { onSuccess: onHoldingSuccess }
            );
          } else {
            addHolding.mutate(payload, { onSuccess: onHoldingSuccess });
          }
        }}
        isPending={addHolding.isPending || updateHolding.isPending}
      />

      <PortfolioFormDialog
        open={openPortfolioForm}
        onOpenChange={setOpenPortfolioForm}
        selectedPortfolio={selectedPortfolio ? { id: selectedPortfolio.id, name: selectedPortfolio.name, is_default: selectedPortfolio.isDefault } : null}
        onSubmit={(payload) => {
          if (selectedPortfolio?.id) {
            updatePortfolio.mutate(
              { id: selectedPortfolio.id, data: payload },
              {
                onSuccess: () => {
                  setOpenPortfolioForm(false);
                  setSelectedPortfolio(null);
                  queryClient.invalidateQueries({ queryKey: ['portfoliosSummaries'] });
                },
              }
            );
          } else {
            createPortfolio.mutate(payload, {
              onSuccess: () => {
                setOpenPortfolioForm(false);
                queryClient.invalidateQueries({ queryKey: ['portfoliosSummaries'] });
              },
            });
          }
        }}
        isPending={createPortfolio.isPending || updatePortfolio.isPending}
        onOpenDeleteConfirm={() => setOpenPortfolioDelete(true)}
      />

      {/* Holding Delete – closes & refreshes on success */}
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
        onConfirm={() =>
          selectedHolding &&
          deleteHolding.mutate(selectedHolding.id, {
            onSuccess: () => {
              setOpenHoldingDelete(false);
              setSelectedHolding(null);
              queryClient.invalidateQueries({ queryKey: ['allHoldings'] });
              queryClient.invalidateQueries({ queryKey: ['portfoliosSummaries'] });
            },
          })
        }
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
              {allHoldings.filter(h => h.portfolio_id === selectedPortfolio.id).length > 0 ? (
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