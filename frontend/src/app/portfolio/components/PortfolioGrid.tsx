// src/app/portfolio/components/PortfolioGrid.tsx (updated: reorder POST uses correct backend path /portfolios/reorder via API_BASE – resolves 404; activeId state preserved for drag functionality)
'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

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
  onEditPortfolio: (portfolio: PortfolioSummary) => void;
  onDeletePortfolio: (portfolio: PortfolioSummary) => void;
  displayCurrency: 'CAD' | 'USD';
  exchangeRate: number;
}

export function PortfolioGrid({
  portfoliosWithData,
  selectedPortfolioId,
  onSelectPortfolio,
  onEditPortfolio,
  onDeletePortfolio,
  displayCurrency,
  exchangeRate,
}: Props) {
  const queryClient = useQueryClient();

  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = portfoliosWithData.findIndex((p) => p.id === active.id);
      const newIndex = portfoliosWithData.findIndex((p) => p.id === over.id);

      const newOrder = arrayMove(portfoliosWithData, oldIndex, newIndex);

      // Optimistic UI update
      queryClient.setQueryData(['portfolioSummaries'], newOrder);

      try {
        // POST to correct backend endpoint /portfolios/reorder (matches existing FastAPI route)
        await axios.post(`${API_BASE}/portfolios/reorder`, {
          order: newOrder.map((p) => p.id),
        });

        toast.success('Portfolio order updated');
      } catch (error) {
        toast.error('Failed to save order – changes reverted');
        queryClient.setQueryData(['portfolioSummaries'], portfoliosWithData);
      }
    }

    setActiveId(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={portfoliosWithData.map((p) => p.id)} strategy={rectSortingStrategy}>
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
            portfolio={portfoliosWithData.find((p) => p.id === activeId)!}
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