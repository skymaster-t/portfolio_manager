// src/app/dashboard/page.tsx (updated: uses new PeriodSelector component)
'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { format, parseISO, subDays, subMonths, subYears, startOfYear } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { HistoryChart } from './components/HistoryChart';
import { HistoryTable } from './components/HistoryTable';
import { PeriodSelector } from './components/PeriodSelector';

interface GlobalHistory {
  timestamp: string;
  total_value: number;
  daily_change: number;
  daily_percent: number;
  all_time_percent: number;
}

type Period = '1W' | '1M' | '3M' | 'YTD' | '1Y' | '2Y' | '3Y' | 'All';

const fetchDailyGlobalHistory = async (): Promise<GlobalHistory[]> => {
  const { data } = await axios.get('http://localhost:8000/portfolios/global/history/daily');
  return data;
};

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('1M');

  const {
    data: rawHistory = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['dailyGlobalHistory'],
    queryFn: fetchDailyGlobalHistory,
    refetchInterval: 300000,
    staleTime: 300000,
  });

  const { chartData, tableData } = useMemo(() => {
    if (rawHistory.length === 0) return { chartData: [], tableData: [] };

    const now = new Date();

    let startDate: Date | null = null;
    switch (period) {
      case '1W':
        startDate = subDays(now, 7);
        break;
      case '1M':
        startDate = subMonths(now, 1);
        break;
      case '3M':
        startDate = subMonths(now, 3);
        break;
      case 'YTD':
        startDate = startOfYear(now);
        break;
      case '1Y':
        startDate = subYears(now, 1);
        break;
      case '2Y':
        startDate = subYears(now, 2);
        break;
      case '3Y':
        startDate = subYears(now, 3);
        break;
      case 'All':
        startDate = null;
        break;
    }

    const parsed = rawHistory
      .map((point) => ({
        date: parseISO(point.timestamp),
        ...point,
      }))
      .filter((p) => !startDate || p.date >= startDate);

    const chart = parsed
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((p) => ({
        label: format(p.date, 'MMM d'),
        tooltipLabel: format(p.date, 'MMM d, yyyy'),
        value: p.total_value,
        daily_change: p.daily_change,
        daily_percent: p.daily_percent,
        all_time_percent: p.all_time_percent,
      }));

    const table = parsed
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 20)
      .map((p) => ({
        tooltipLabel: format(p.date, 'MMM d, yyyy'),
        value: p.total_value,
        daily_change: p.daily_change,
        daily_percent: p.daily_percent,
        all_time_percent: p.all_time_percent,
      }));

    return { chartData: chart, tableData: table };
  }, [rawHistory, period]);

  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_780px] gap-8">
        {/* Chart Card */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Portfolio Value Over Time</CardTitle>
            <CardDescription>Daily total value trend</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-96 w-full rounded-lg" />
            ) : chartData.length === 0 ? (
              <div className="flex h-96 items-center justify-center text-muted-foreground">
                No data for selected period
              </div>
            ) : (
              <HistoryChart data={chartData} />
            )}

            {/* Period selector now in its own component */}
            <PeriodSelector currentPeriod={period} onChange={setPeriod} />
          </CardContent>
        </Card>

        {/* Table Card */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Performance (Last 20 Days)</CardTitle>
            <CardDescription>Daily breakdown for selected period</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-96 w-full rounded-lg" />
            ) : tableData.length === 0 ? (
              <div className="flex h-96 items-center justify-center text-muted-foreground">
                No data for selected period
              </div>
            ) : (
              <div className="w-full">
                <HistoryTable data={tableData} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}