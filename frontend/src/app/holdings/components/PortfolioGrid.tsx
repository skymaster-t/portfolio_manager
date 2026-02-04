// src/app/holdings/components/PortfolioGrid.tsx (fixed – correct query invalidation for immediate reorder reflection)
'use client';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Briefcase, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import axios from 'axios';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { SortablePortfolioCard } from './SortablePortfolioCard';

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

interface Props {
  portfoliosWithData: PortfolioSummary[];
  selectedPortfolioId: number | null;
  onSelectPortfolio: (id: number) => void;
  onEditPortfolio: (p: PortfolioSummary) => void;
  onDeletePortfolio: (p: PortfolioSummary) => void;
  activeId: number | null;
  setActiveId: (id: number | null) => void;
  displayCurrency: 'CAD' | 'USD';
  exchangeRate: number;
  onCreateFirstPortfolio: () => void;
  isLoading: boolean;
}

export function PortfolioGrid({
  portfoliosWithData,
  selectedPortfolioId,
  onSelectPortfolio,
  onEditPortfolio,
  onDeletePortfolio,
  activeId,
  setActiveId,
  displayCurrency,
  exchangeRate,
  onCreateFirstPortfolio,
  isLoading,
}: Props) {
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as number);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = portfoliosWithData.findIndex(p => p.id === active.id);
      const newIndex = portfoliosWithData.findIndex(p => p.id === over.id);
      const newOrder = arrayMove(portfoliosWithData, oldIndex, newIndex).map(p => p.id);

      try {
        await axios.post('http://localhost:8000/portfolios/reorder', { order: newOrder });
        // Fixed: Invalidate the correct query key for immediate UI update
        await queryClient.invalidateQueries({ queryKey: ['portfoliosSummaries'] });
        toast.success('Portfolio order saved');
      } catch (err) {
        toast.error('Failed to save order');
        console.error(err);
      }
    }
    setActiveId(null);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
              <Skeleton className="h-64 w-full rounded-full" />
              <div className="space-y-3">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4" />
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {[...Array(5)].map((_, j) => (
                  <Skeleton key={j} className="h-8 w-24 rounded-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (portfoliosWithData.length === 0) {
    return (
      <Card className="text-center py-16">
        <CardContent>
          <Briefcase className="h-16 w-16 mx-auto text-muted-foreground mb-6" />
          <h2 className="text-2xl font-semibold mb-4">No portfolios yet</h2>
          <Button size="lg" onClick={onCreateFirstPortfolio}>
            <Plus className="h-5 w-5 mr-2" />
            Create Your First Portfolio
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={portfoliosWithData.map(p => p.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {portfoliosWithData.map((port) => (
            <SortablePortfolioCard
              key={port.id}
              portfolio={port}
              isSelected={selectedPortfolioId === port.id}
              onSelect={() => onSelectPortfolio(port.id)}
              onEdit={() => onEditPortfolio(port)}
              onDelete={() => onDeletePortfolio(port)}
              displayCurrency={displayCurrency}
              exchangeRate={exchangeRate}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeId ? (
          <SortablePortfolioCard
            portfolio={portfoliosWithData.find(p => p.id === activeId)!}
            isSelected={false}
            onSelect={() => {}}
            onEdit={() => {}}
            onDelete={() => {}}
            displayCurrency={displayCurrency}
            exchangeRate={exchangeRate}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}