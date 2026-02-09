// src/app/holdings/page.tsx (fixed: added proper FX rate fetching with fallback, passed correct rate to table)
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

import PortfolioSelector from './components/PortfolioSelector';
import SummaryCards from './components/SummaryCards';
import AllocationPie from './components/AllocationPie';
import HoldingsTable from './components/HoldingsTable';
import {PortfolioFormDialog} from './components/PortfolioFormDialog';
import {HoldingFormDialog} from './components/HoldingFormDialog';
import {DeleteConfirmDialog} from './components/DeleteConfirmDialog';

import { usePortfolioSummaries, useAllHoldings } from '@/lib/queries';

export default function HoldingsPage() {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);

  const [portfolioDialogOpen, setPortfolioDialogOpen] = useState(false);
  const [holdingFormOpen, setHoldingFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [currentHolding, setCurrentHolding] = useState<any | null>(null);
  const [holdingToDelete, setHoldingToDelete] = useState<any | null>(null);

  const [isSubmittingPortfolio, setIsSubmittingPortfolio] = useState(false);
  const [isSubmittingHolding, setIsSubmittingHolding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const queryClient = useQueryClient();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Fetch current USDCAD rate (same source used by backend summaries → perfect consistency)
  const { data: fxData } = useQuery({
    queryKey: ['fxRate'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/fx/current`);
      if (!res.ok) throw new Error('Failed to fetch FX rate');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes (rate doesn't change rapidly)
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });

  const fxRate = fxData?.usdcad_rate ?? 1.37; // Realistic fallback

  const {
    data: summaries = [],
    isLoading: summariesLoading,
  } = usePortfolioSummaries();

  const {
    data: allHoldings = [],
    isLoading: holdingsLoading,
  } = useAllHoldings();

  // Auto-select default portfolio
  useEffect(() => {
    if (summaries.length > 0 && selectedPortfolioId === null) {
      const defaultPortfolio = summaries.find((p: any) => p.isDefault);
      const initialPortfolio = defaultPortfolio || summaries[0];
      setSelectedPortfolioId(initialPortfolio.id);
    }
  }, [summaries, selectedPortfolioId]);

  const handleCreatePortfolio = async (payload: { name: string; is_default: boolean }) => {
    setIsSubmittingPortfolio(true);
    try {
      const response = await fetch(`${API_URL}/portfolios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create portfolio');
      }

      toast.success('Portfolio created successfully!');
      await queryClient.invalidateQueries();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create portfolio');
    } finally {
      setIsSubmittingPortfolio(false);
      setPortfolioDialogOpen(false);
    }
  };

  const handleHoldingSubmit = async (payload: any) => {
    setIsSubmittingHolding(true);
    const isEdit = !!currentHolding?.id;
    const method = isEdit ? 'PUT' : 'POST';
    const url = isEdit ? `${API_URL}/holdings/${currentHolding.id}` : `${API_URL}/holdings`;

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to ${isEdit ? 'update' : 'add'} holding`);
      }

      toast.success(`Holding ${isEdit ? 'updated' : 'added'} successfully!`);
      await queryClient.invalidateQueries();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${isEdit ? 'update' : 'add'} holding`);
    } finally {
      setIsSubmittingHolding(false);
      setHoldingFormOpen(false);
      setCurrentHolding(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!holdingToDelete?.id) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`${API_URL}/holdings/${holdingToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete holding');
      }

      toast.success('Holding deleted successfully!');
      await queryClient.invalidateQueries();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete holding');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setHoldingToDelete(null);
    }
  };

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

  const selectedSummary = summaries.find((p: any) => p.id === selectedPortfolioId) || summaries[0];
  const selectedHoldings = allHoldings.filter((h: any) => h.portfolio_id === selectedPortfolioId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-6">
          <h1 className="text-3xl font-bold text-gray-900">Holdings</h1>

          <div className="flex flex-wrap items-center gap-4">
            <PortfolioSelector
              portfolios={summaries}
              selectedId={selectedPortfolioId}
              onSelect={setSelectedPortfolioId}
            />

            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => setPortfolioDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Portfolio
            </Button>
          </div>
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
              rate={fxRate}
              onEdit={(holding) => {
                setCurrentHolding(holding);
                setHoldingFormOpen(true);
              }}
              onDelete={(holding) => {
                setHoldingToDelete(holding);
                setDeleteDialogOpen(true);
              }}
              onAdd={() => {
                setCurrentHolding(null);
                setHoldingFormOpen(true);
              }}
            />
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <PortfolioFormDialog
        open={portfolioDialogOpen}
        onOpenChange={setPortfolioDialogOpen}
        selectedPortfolio={null}
        onSubmit={handleCreatePortfolio}
        isPending={isSubmittingPortfolio}
        onOpenDeleteConfirm={() => {}}
      />

      <HoldingFormDialog
        open={holdingFormOpen}
        onOpenChange={setHoldingFormOpen}
        selectedHolding={currentHolding}
        portfolios={summaries}
        defaultPortfolioId={selectedPortfolioId}
        onSubmit={handleHoldingSubmit}
        isPending={isSubmittingHolding}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Holding"
        message={
          holdingToDelete ? (
            <>
              Are you sure you want to permanently delete{' '}
              <strong>{holdingToDelete.symbol}</strong> ({holdingToDelete.quantity}{' '}
              {holdingToDelete.quantity === 1 ? 'share' : 'shares'})?
              <br />
              <span className="text-sm text-muted-foreground">
                This action cannot be undone.
              </span>
            </>
          ) : null
        }
        onConfirm={handleDeleteConfirm}
        isPending={isDeleting}
      />
    </div>
  );
}