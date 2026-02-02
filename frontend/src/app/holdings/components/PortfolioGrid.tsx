'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Briefcase, Plus } from 'lucide-react';
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

interface PortfolioWithData {
  id: number;
  name: string;
  is_default: boolean;
  totalValue: number;
  gainLoss: number;
  pieData: { name: string; value: number }[];
}

interface Props {
  portfoliosWithData: PortfolioWithData[];
  selectedPortfolioId: number | null;
  onSelectPortfolio: (id: number) => void;
  onEditPortfolio: (p: PortfolioWithData) => void;
  onDeletePortfolio: (p: PortfolioWithData) => void;
  order: number[];
  setOrder: (order: number[]) => void;
  activeId: number | null;
  setActiveId: (id: number | null) => void;
  currencyFormatter: Intl.NumberFormat;
  displayCurrency: 'CAD' | 'USD';
  exchangeRate: number;
  onCreateFirstPortfolio: () => void;
}

export function PortfolioGrid({
  portfoliosWithData,
  selectedPortfolioId,
  onSelectPortfolio,
  onEditPortfolio,
  onDeletePortfolio,
  order,
  setOrder,
  activeId,
  setActiveId,
  currencyFormatter,
  displayCurrency,
  exchangeRate,
  onCreateFirstPortfolio,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as number);
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrder((current) => {
        const oldIndex = current.indexOf(active.id as number);
        const newIndex = current.indexOf(over.id as number);
        const newOrder = arrayMove(current, oldIndex, newIndex);
        localStorage.setItem('portfolioOrder', JSON.stringify(newOrder));
        return newOrder;
      });
    }
    setActiveId(null);
  };

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
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {portfoliosWithData.map((port) => (
            <SortablePortfolioCard
              key={port.id}
              portfolio={port}
              isSelected={selectedPortfolioId === port.id}
              onSelect={() => onSelectPortfolio(port.id)}
              onEdit={() => onEditPortfolio(port)}
              onDelete={() => onDeletePortfolio(port)}
              currencyFormatter={currencyFormatter}
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
            currencyFormatter={currencyFormatter}
            displayCurrency={displayCurrency}
            exchangeRate={exchangeRate}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}