// src/app/portfolio/page.tsx (updated: added displayCurrency state + passed to PortfolioHeader for CAD/USD toggle; shared queries preserved)
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

import { PortfolioHeader } from './components/PortfolioHeader';
import { PortfolioValueChart } from './components/PortfolioValueChart';
import { PortfolioGrid } from './components/PortfolioGrid';
import { HoldingFormDialog } from './components/HoldingFormDialog';
import { PortfolioFormDialog } from './components/PortfolioFormDialog';
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog';
import { usePortfolioMutations } from './hooks/usePortfolioMutations';
import { useGlobalIntradayHistory, usePortfolioSummaries, useAllHoldings, useFxRate } from '@/lib/queries';

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

export default function PortfolioPage() {
  const queryClient = useQueryClient();

  
  // Currency toggle state – placed here at page level for easy sharing
  const [displayCurrency, setDisplayCurrency] = useState<'CAD' | 'USD'>('CAD');

  // Real-time USDCAD rate (1 USD = X CAD)
  const { data: exchangeRate = 1.37 } = useFxRate(); // Fallback realistic rate

  const [openPortfolioForm, setOpenPortfolioForm] = useState(false);
  const [openHoldingForm, setOpenHoldingForm] = useState(false);
  const [openPortfolioDelete, setOpenPortfolioDelete] = useState(false);
  const [openHoldingDelete, setOpenHoldingDelete] = useState(false);
  const [selectedPortfolio, setSelectedPortfolio] = useState<PortfolioSummary | null>(null);
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);

  // Shared queries – consistent cache/updates with dashboard
  const { data: globalHistory = [], isLoading: globalLoading } = useGlobalIntradayHistory();
  const latestGlobal = globalHistory.length > 0 ? globalHistory[0] : null;

  const { data: portfoliosSummaries = [], isLoading: summariesLoading } = usePortfolioSummaries();
  const { data: allHoldings = [], isLoading: holdingsLoading } = useAllHoldings();

  const { createPortfolio, updatePortfolio, deletePortfolio, createHolding, updateHolding, deleteHolding } = usePortfolioMutations();

  const isLoading = globalLoading || summariesLoading || holdingsLoading;

  // Last updated timer
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const { dataUpdatedAt: globalUpdatedAt } = useGlobalIntradayHistory();

  const lastUpdatedRelative = useMemo(() => {
    if (globalUpdatedAt === 0) return 'Loading...';
    return formatDistanceToNow(globalUpdatedAt, { addSuffix: true });
  }, [globalUpdatedAt, currentTime]);

  // Header uses combined global values + currency state
  const headerProps = {
    totalValue: latestGlobal?.total_value || 0,
    gainLoss: latestGlobal?.all_time_gain || 0,
    dailyChange: latestGlobal?.daily_change || 0,
    dailyPercent: latestGlobal?.daily_percent || 0,
    allTimePercent: latestGlobal?.all_time_percent || 0,
    marketValue: latestGlobal?.total_value || 0,
    displayCurrency,
    setDisplayCurrency,
    exchangeRate,
    isLoading,
    lastUpdated: lastUpdatedRelative,
  };

  return (
    <div className="container mx-auto space-y-12">
      <PortfolioHeader {...headerProps} />

      <PortfolioValueChart />

      <PortfolioGrid
        portfoliosWithData={portfoliosSummaries}
        selectedPortfolioId={selectedPortfolio?.id || null}
        onSelectPortfolio={(id) => {
          const port = portfoliosSummaries.find((p: PortfolioSummary) => p.id === id);
          setSelectedPortfolio(port || null);
        }}
        onEditPortfolio={(port) => {
          setSelectedPortfolio(port);
          setOpenPortfolioForm(true);
        }}
        onDeletePortfolio={(port) => {
          setSelectedPortfolio(port);
          setOpenPortfolioDelete(true);
        }}
        displayCurrency={displayCurrency}
        exchangeRate={exchangeRate}
      />

      {/* Portfolio Form Dialog */}
      <PortfolioFormDialog
        open={openPortfolioForm}
        onOpenChange={setOpenPortfolioForm}
        portfolio={selectedPortfolio}
        onSubmit={(data) => {
          if (selectedPortfolio) {
            updatePortfolio.mutate({ id: selectedPortfolio.id, ...data });
          } else {
            createPortfolio.mutate(data);
          }
          setOpenPortfolioForm(false);
          setSelectedPortfolio(null);
        }}
      />

      {/* Holding Form Dialog */}
      <HoldingFormDialog
        open={openHoldingForm}
        onOpenChange={setOpenHoldingForm}
        holding={selectedHolding}
        portfolios={portfoliosSummaries}
        onSubmit={(data) => {
          if (selectedHolding) {
            updateHolding.mutate({ id: selectedHolding.id, ...data });
          } else {
            createHolding.mutate(data);
          }
          setOpenHoldingForm(false);
          setSelectedHolding(null);
        }}
      />

      {/* Delete Holding Confirm */}
      <DeleteConfirmDialog
        open={openHoldingDelete}
        onOpenChange={setOpenHoldingDelete}
        title="Delete Holding"
        message={
          selectedHolding && (
            <p className="text-lg">
              Are you sure you want to delete <strong>{selectedHolding.symbol}</strong>?
            </p>
          )
        }
        onConfirm={() => selectedHolding && deleteHolding.mutate(selectedHolding.id)}
        isPending={deleteHolding.isPending}
      />

      {/* Delete Portfolio Confirm */}
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
              {allHoldings.filter((h: Holding) => h.portfolio_id === selectedPortfolio.id).length > 0 ? (
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