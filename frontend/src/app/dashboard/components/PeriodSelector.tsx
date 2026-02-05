// src/app/dashboard/components/PeriodSelector.tsx (new reusable component)
'use client';

import { Button } from '@/components/ui/button';

type Period = '1W' | '1M' | '3M' | 'YTD' | '1Y' | '2Y' | '3Y' | 'All';

const periodLabels: Record<Period, string> = {
  '1W': '1W',
  '1M': '1M',
  '3M': '3M',
  'YTD': 'YTD',
  '1Y': '1Y',
  '2Y': '2Y',
  '3Y': '3Y',
  'All': 'All',
};

interface Props {
  currentPeriod: Period;
  onChange: (period: Period) => void;
}

export function PeriodSelector({ currentPeriod, onChange }: Props) {
  return (
    <div className="flex flex-wrap justify-center gap-2 mt-6">
      {(Object.keys(periodLabels) as Period[]).map((p) => (
        <Button
          key={p}
          variant={currentPeriod === p ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(p)}
        >
          {periodLabels[p]}
        </Button>
      ))}
    </div>
  );
}