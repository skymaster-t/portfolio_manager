// frontend/src/app/holdings/page.tsx (UPDATED – uses API_BASE env var for all fetches)
'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import PortfolioSelector from './components/PortfolioSelector';
import SummaryCards from './components/SummaryCards';
import AllocationPie from './components/AllocationPie';
import HoldingsTable from './components/HoldingsTable';
import { Card, CardContent } from '@/components/ui/card';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export default function HoldingsPage() {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);

  const {
    data: summaries = [],
    isLoading: summariesLoading,
    isError: summariesError,
  } = useQuery({
    queryKey: ['portfolios-summary'],
    queryFn: () => fetch(`${API_BASE}/portfolios/summary`).then(res => {
      if (!res.ok) throw new Error('Failed to fetch summaries');
      return res.json();
    }),
    refetchInterval: 300000, // 5 minutes
  });

  const {
    data: allHoldings = [],
    isLoading: holdingsLoading,
    isError: holdingsError,
  } = useQuery({
    queryKey: ['holdings'],
    queryFn: () => fetch(`${API_BASE}/holdings`).then(res => {
      if (!res.ok) throw new Error('Failed to fetch holdings');
      return res.json();
    }),
    refetchInterval: 300000,
  });

  const {
    data: fxData,
    isError: fxError,
  } = useQuery({
    queryKey: ['fx'],
    queryFn: () => fetch(`${API_BASE}/fx/current`).then(res => {
      if (!res.ok) throw new Error('Failed to fetch FX rate');
      return res.json();
    }),
    refetchInterval: 3600000, // 1 hour
  });

  const rate = fxData?.usdcad_rate || 1.37;

  useEffect(() => {
    if (summaries.length > 0 && selectedPortfolioId === null) {
      const defaultPort = summaries.find((p: any) => p.isDefault);
      setSelectedPortfolioId(defaultPort?.id ?? summaries[0]?.id);
    }
  }, [summaries, selectedPortfolioId]);

  if (summariesLoading || holdingsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8">
          <CardContent className="text-center">Loading portfolio data...</CardContent>
        </Card>
      </div>
    );
  }

  if (summariesError || holdingsError || fxError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <CardContent className="text-center space-y-4">
            <p className="text-lg font-medium text-red-600">Failed to load data</p>
            <p className="text-sm text-gray-600">
              Unable to reach the backend API. Check:
            </p>
            <ul className="text-sm text-gray-500 text-left space-y-1">
              <li>• FastAPI server running on port 8000</li>
              <li>• NEXT_PUBLIC_API_BASE in .env.local points to the correct URL</li>
              <li>• No network/firewall issues</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8">
          <CardContent className="text-center">
            <p className="text-lg font-medium">No portfolios found</p>
            <p className="text-sm text-gray-600 mt-2">Create a portfolio to get started.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            <HoldingsTable holdings={selectedHoldings} totalValue={selectedSummary?.totalValue || 0} rate={rate} />
          </div>
        </div>
      </div>
    </div>
  );
}