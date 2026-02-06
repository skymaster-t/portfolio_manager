// src/app/dashboard/page.tsx (updated: uses reusable PortfolioHeader from portfolio page – identical summary with currency toggle top-right & last updated bottom-right; fixed missing CardHeader import for HoldingsTicker card)
'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, parseISO, subDays, subMonths, subYears, startOfYear, formatDistanceToNow } from 'date-fns';
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
import { PortfolioValueChart } from '../portfolio/components/PortfolioValueChart';
import { HoldingsTicker } from './components/HoldingsTicker';
import { PortfolioHeader } from '../portfolio/components/PortfolioHeader'; // Reused exact header
import { useGlobalIntradayHistory, useGlobalDailyHistory, useFxRate } from '@/lib/queries';

interface DailyGlobalHistory {
  timestamp: string;
  total_value: number;
  daily_change: number;
  daily_percent: number;
  all_time_gain: number;
  all_time_percent: number;
}

type Period = '1W' | '1M' | '3M' | 'YTD' | '1Y' | '2Y' | '3Y' | 'All';

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('1M');

  // Currency toggle – shared with PortfolioHeader
  const [displayCurrency, setDisplayCurrency] = useState<'CAD' | 'USD'>('CAD');
  const { data: exchangeRate = 1.37 } = useFxRate();

  // Live clock + last updated relative time
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const {
    data: globalHistory = [],
    isLoading: globalLoading,
    dataUpdatedAt: globalUpdatedAt,
  } = useGlobalIntradayHistory();

  const {
    data: rawDailyHistory = [],
    isLoading: dailyLoading,
    dataUpdatedAt: dailyUpdatedAt,
  } = useGlobalDailyHistory();

  const latest = globalHistory.length > 0 ? globalHistory[0] : null;

  const lastUpdatedAt = Math.max(globalUpdatedAt || 0, dailyUpdatedAt || 0);

  const lastUpdatedRelative = useMemo(() => {
    if (lastUpdatedAt === 0) return 'Loading...';
    return formatDistanceToNow(lastUpdatedAt, { addSuffix: true });
  }, [lastUpdatedAt, currentTime]);

  const isLoading = dailyLoading || globalLoading;

  const { chartData, tableData } = useMemo(() => {
    if (rawDailyHistory.length === 0) return { chartData: [], tableData: [] };

    const now = new Date();

    let startDate: Date | null = null;
    switch (period) {
      case '1W': startDate = subDays(now, 7); break;
      case '1M': startDate = subMonths(now, 1); break;
      case '3M': startDate = subMonths(now, 3); break;
      case 'YTD': startDate = startOfYear(now); break;
      case '1Y': startDate = subYears(now, 1); break;
      case '2Y': startDate = subYears(now, 2); break;
      case '3Y': startDate = subYears(now, 3); break;
      case 'All': startDate = null; break;
    }

    const filtered = startDate
      ? rawDailyHistory.filter((p: DailyGlobalHistory) => parseISO(p.timestamp) >= startDate)
      : rawDailyHistory;

    const parsed = filtered.map((p: DailyGlobalHistory) => ({
      date: parseISO(p.timestamp),
      ...p,
    }));

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
  }, [rawDailyHistory, period]);

  return (
    <div className="container mx-auto py-8 space-y-12">
      {/* Reused PortfolioHeader – exact same as portfolio page */}
      <PortfolioHeader
        totalValue={latest?.total_value || 0}
        gainLoss={latest?.all_time_gain || 0}
        dailyChange={latest?.daily_change || 0}
        dailyPercent={latest?.daily_percent || 0}
        allTimePercent={latest?.all_time_percent || 0}
        marketValue={latest?.total_value || 0}
        displayCurrency={displayCurrency}
        setDisplayCurrency={setDisplayCurrency}
        exchangeRate={exchangeRate}
        isLoading={isLoading}
        lastUpdated={lastUpdatedRelative}
      />

      {/* Live Holdings Ticker Card */}
      <Card>
        <CardHeader>
          <CardTitle>Live Holdings Ticker</CardTitle>
          <CardDescription>Current prices and daily changes</CardDescription>
        </CardHeader>
        <CardContent className="py-0">
          <HoldingsTicker />
        </CardContent>
      </Card>

      {/* Charts Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Intraday Portfolio Value</CardTitle>
            <CardDescription>Real-time updates (8 AM – 5 PM market window)</CardDescription>
          </CardHeader>
          <CardContent>
            <PortfolioValueChart noCard hidePeriodSelector />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Long-Term Portfolio Value</CardTitle>
            <CardDescription>Daily closing values</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyLoading ? (
              <Skeleton className="h-[400px] w-full rounded-lg" />
            ) : chartData.length === 0 ? (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                No data for selected period
              </div>
            ) : (
              <HistoryChart data={chartData} />
            )}

            <PeriodSelector currentPeriod={period} onChange={setPeriod} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Daily Performance</CardTitle>
          <CardDescription>Last 20 trading days</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyLoading ? (
            <Skeleton className="h-96 w-full rounded-lg" />
          ) : tableData.length === 0 ? (
            <div className="flex h-96 items-center justify-center text-muted-foreground">
              No data available
            </div>
          ) : (
            <HistoryTable data={tableData} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}