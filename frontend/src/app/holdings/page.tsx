// src/app/holdings/page.tsx (fixed: added missing Skeleton import; preserved auto-default selection & shared queries – now renders correctly with table)
'use client';

import { useState, useEffect } from 'react';
import PortfolioSelector from './components/PortfolioSelector';
import SummaryCards from './components/SummaryCards';
import AllocationPie from './components/AllocationPie';
import HoldingsTable from './components/HoldingsTable';
import { Skeleton } from '@/components/ui/skeleton'; // ← Fixed: imported Skeleton
import { usePortfolioSummaries, useAllHoldings } from '@/lib/queries';

export default function HoldingsPage() {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);

  const {
    data: summaries = [],
    isLoading: summariesLoading,
  } = usePortfolioSummaries();

  const {
    data: allHoldings = [],
    isLoading: holdingsLoading,
  } = useAllHoldings();

  // Auto-select default portfolio (or first) when summaries load
  useEffect(() => {
    if (summaries.length > 0 && selectedPortfolioId === null) {
      const defaultPortfolio = summaries.find((p: any) => p.isDefault);
      const initialPortfolio = defaultPortfolio || summaries[0];
      setSelectedPortfolioId(initialPortfolio.id);
    }
  }, [summaries, selectedPortfolioId]);

  if (summariesLoading || holdingsLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="space-y-8">
          <Skeleton className="h-12 w-96" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            <Skeleton className="h-96" />
            <Skeleton className="h-96 lg:col-span-2" />
          </div>
        </div>
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="container mx-auto py-8 text-center">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold mb-4">No Portfolios Yet</h2>
          <p className="text-muted-foreground">Create a portfolio to get started.</p>
        </div>
      </div>
    );
  }

  // Selected portfolio summary & holdings
  const selectedSummary = summaries.find((p: any) => p.id === selectedPortfolioId) || summaries[0];
  const selectedHoldings = allHoldings.filter((h: any) => h.portfolio_id === selectedPortfolioId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold text-gray-900">Holdings</h1>
          <PortfolioSelector
            portfolios={summaries}
            selectedId={selectedPortfolioId}
            onSelect={setSelectedPortfolioId}
          />
        </div>

        <SummaryCards summary={selectedSummary} />
        <div className="grid lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-1">
            <AllocationPie pieData={selectedSummary?.pieData || []} />
          </div>
          <div className="lg:col-span-2">
            <HoldingsTable
              holdings={selectedHoldings}
              totalValue={selectedSummary?.totalValue || 0}
              rate={1}
            />
          </div>
        </div>
      </div>
    </div>
  );
}