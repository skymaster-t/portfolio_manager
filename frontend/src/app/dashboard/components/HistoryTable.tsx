// src/app/dashboard/components/HistoryTable.tsx (unchanged – reusable table)
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface TablePoint {
  tooltipLabel: string;
  value: number;
  daily_change: number;
  daily_percent: number;
  all_time_percent: number;
}

interface Props {
  data: TablePoint[];
}

export function HistoryTable({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        No data for selected period
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Total Value</TableHead>
            <TableHead className="text-right">Daily Change</TableHead>
            <TableHead className="text-right">Daily %</TableHead>
            <TableHead className="text-right">All Time Return %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((p) => (
            <TableRow key={p.tooltipLabel}>
              <TableCell>{p.tooltipLabel}</TableCell>
              <TableCell className="text-right font-medium">
                {new Intl.NumberFormat('en-CA', {
                  style: 'currency',
                  currency: 'CAD',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(p.value)}
              </TableCell>
              <TableCell className={`text-right ${p.daily_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {p.daily_change >= 0 ? '+' : ''}{' '}
                {new Intl.NumberFormat('en-CA', {
                  style: 'currency',
                  currency: 'CAD',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(p.daily_change)}
              </TableCell>
              <TableCell className={`text-right ${p.daily_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(p.daily_percent >= 0 ? '+' : '') + p.daily_percent.toFixed(2)}%
              </TableCell>
              <TableCell className={`text-right ${p.all_time_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(p.all_time_percent >= 0 ? '+' : '') + p.all_time_percent.toFixed(2)}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}