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
import { PortfolioHeader } from '../portfolio/components/PortfolioHeader';
import { PrimaryHoldingsTable } from './components/PrimaryHoldingsTable';
import { TopMovers } from './components/TopMovers';
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

  const [displayCurrency, setDisplayCurrency] = useState<'CAD' | 'USD'>('CAD');
  const { data: exchangeRate = 1.37 } = useFxRate();

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
  }, [lastUpdatedAt]);

  const isOverallLoading = dailyLoading || globalLoading;

  const { chartData, tableData } = useMemo(() => {
    if (rawDailyHistory.length === 0) return { chartData: [], tableData: [] };

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
      default:
        startDate = null;
        break;
    }

    const filtered = startDate
      ? rawDailyHistory.filter((d) => new Date(d.timestamp) >= startDate)
      : rawDailyHistory;

    // Explicitly sort for chart: oldest → newest (chronological order for line chart)
    const sortedForChart = [...filtered].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const chartPoints = sortedForChart.map((d) => ({
      label: format(parseISO(d.timestamp), 'MMM d'),
      tooltipLabel: format(parseISO(d.timestamp), 'MMM d, yyyy'),
      value: d.total_value,
      daily_change: d.daily_change,
      daily_percent: d.daily_percent,
      all_time_percent: d.all_time_percent,
    }));

    // Explicitly sort for table: newest → oldest (most recent on top)
    const sortedForTable = [...rawDailyHistory].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const recentTable = sortedForTable.slice(0, 20).map((d) => ({
      tooltipLabel: format(parseISO(d.timestamp), 'MMM d, yyyy'),
      value: d.total_value,
      daily_change: d.daily_change,
      daily_percent: d.daily_percent,
      all_time_percent: d.all_time_percent,
    }));

    return { chartData: chartPoints, tableData: recentTable };
  }, [rawDailyHistory, period]);

  return (
    <div className="space-y-8 pb-12">
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
        isLoading={isOverallLoading}
        lastUpdated={lastUpdatedRelative}
      />

      {/* Live Holdings Ticker */}
      <Card>
        <HoldingsTicker />
      </Card>

      {/* Main Row: Left = Intraday (increased height) + Top Movers | Right = Primary Holdings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
        {/* Left stacked column */}
        <div className="flex flex-col gap-8">
          {/* Intraday – ~10% taller, strictly contained */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Intraday Portfolio Value</CardTitle>
              <CardDescription>Real-time updates (8 AM – 5 PM market window)</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-hidden">
              {/* Increased ~10% (mobile: 320px → 352px, desktop: 480px → 528px) */}
              <div className="h-88 md:h-[528px] w-full">
                <PortfolioValueChart noCard hidePeriodSelector />
              </div>
            </CardContent>
          </Card>

          {/* Top Movers – automatically fills remaining space */}
          <div className="flex-1 min-h-0">
            <TopMovers />
          </div>
        </div>

        {/* Right – Primary Holdings Table */}
        <PrimaryHoldingsTable />
      </div>

      {/* Long-Term + Recent Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
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
    </div>
  );
}