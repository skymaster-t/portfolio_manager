// src/app/dashboard/page.tsx (updated layout: Intraday + Primary Holdings Table side-by-side; Long-Term + Recent Performance side-by-side below – responsive grid, clean hierarchy)
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
import { SectorAllocationCard } from './components/SectorAllocationCard'; 
import { 
  useGlobalIntradayHistory, 
  useGlobalDailyHistory, 
  useFxRate, 
  useGlobalSectorAllocation,
  usePortfolioSummaries
} from '@/lib/queries';

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
  }, [lastUpdatedAt, currentTime]);

  const isLoading = dailyLoading || globalLoading;
  
  const {
    data: sectorResponse,
    isLoading: sectorLoading,
    isError: sectorIsError,
    error: sectorError,
  } = useGlobalSectorAllocation()

  const {
    data: portfolioSummaries = [],
    isLoading: summariesLoading,
  } = usePortfolioSummaries();

  // Enhanced debug logging (keeps previous useEffect if you have it)
  useEffect(() => {
    if (sectorIsError) {
      console.error('Sector Allocation API Error:', sectorError);
    }
  }, [sectorIsError, sectorError]);

  const sectorDataArray = sectorResponse?.sectorData ?? [];
  const sectorTotalValue = sectorResponse?.totalValue ?? 0;

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
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-10 md:space-y-12">
      {/* === Global Portfolio Overview Header === */}
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

      {/* === Individual Portfolio Summary Cards – stretches to full width === */}
      {portfolioSummaries && portfolioSummaries.length > 0 && (
        <div
          className="
            grid
            gap-5
            grid-cols-1
            sm:grid-cols-2
            lg:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]
          "
        >
          {portfolioSummaries.map((summary) => {
            const isPositiveDaily   = summary.dailyPercent >= 0;
            const isPositiveAllTime = summary.allTimePercent >= 0;

            // Currency conversion
            const totalValueConverted =
              displayCurrency === 'USD'
                ? summary.totalValue / exchangeRate
                : summary.totalValue;

            const dailyChangeConverted =
              displayCurrency === 'USD'
                ? summary.dailyChange / exchangeRate
                : summary.dailyChange;

            const gainLossConverted =
              displayCurrency === 'USD'
                ? summary.gainLoss / exchangeRate
                : summary.gainLoss;

            return (
              <Card
                key={summary.id}
                className="
                  flex flex-col
                  h-full
                  overflow-hidden
                  border border-border/60
                  shadow-sm hover:shadow transition-shadow duration-200
                "
              >
                <CardHeader className="bg-muted/30 pb-3 pt-4">
                  <CardTitle className="text-lg font-semibold tracking-tight truncate">
                    {summary.name}
                  </CardTitle>
                </CardHeader>

                <CardContent className="flex-1 pt-5 pb-6 px-6 space-y-5 text-sm">
                  {/* Total Value – moved to top & made dominant */}
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground font-medium">Total Value</div>
                    <div className="text-3xl sm:text-4xl font-black tabular-nums tracking-tight text-foreground">
                      {new Intl.NumberFormat('en-CA', {
                        style: 'currency',
                        currency: displayCurrency,
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(totalValueConverted)}
                    </div>
                  </div>

                  {/* Today's Return */}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Today's Return</span>
                    <div className="text-right">
                      <span className={`font-semibold tabular-nums ${isPositiveDaily ? 'text-green-600' : 'text-red-600'}`}>
                        {dailyChangeConverted >= 0 ? '+' : ''}
                        {new Intl.NumberFormat('en-CA', { style: 'currency', currency: displayCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(dailyChangeConverted)}
                      </span>
                      <span className={`ml-2.5 font-medium ${isPositiveDaily ? 'text-green-600' : 'text-red-600'}`}>
                        ({isPositiveDaily ? '+' : ''}{summary.dailyPercent.toFixed(2)}%)
                      </span>
                    </div>
                  </div>

                  {/* All-Time Return */}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">All-Time Return</span>
                    <div className="text-right">
                      <span className={`font-semibold tabular-nums ${isPositiveAllTime ? 'text-green-600' : 'text-red-600'}`}>
                        {gainLossConverted >= 0 ? '+' : ''}
                        {new Intl.NumberFormat('en-CA', { style: 'currency', currency: displayCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(gainLossConverted)}
                      </span>
                      <span className={`ml-2.5 font-medium ${isPositiveAllTime ? 'text-green-600' : 'text-red-600'}`}>
                        ({isPositiveAllTime ? '+' : ''}{summary.allTimePercent.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                </CardContent>
                
              </Card>
            );
          })}
        </div>
      )}  
  
      {/* === Intraday Chart + Primary Holdings Table === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-8">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Intraday Portfolio Value</CardTitle>
            <CardDescription>Real-time updates (market hours)</CardDescription>
          </CardHeader>
          <CardContent>
            <PortfolioValueChart noCard hidePeriodSelector />
          </CardContent>
        </Card>
  
        <PrimaryHoldingsTable />
      </div>
  
      {/* === Long-Term Chart + Recent Performance + Sector Allocation === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-8">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Long-Term Portfolio Value</CardTitle>
            <CardDescription>Daily closing values</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {dailyLoading ? (
              <Skeleton className="h-[400px] w-full rounded-lg" />
            ) : chartData.length === 0 ? (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                No data for selected period
              </div>
            ) : (
              <HistoryChart data={chartData} />
            )}
  
            <div className="pt-2">
              <PeriodSelector currentPeriod={period} onChange={setPeriod} />
            </div>
          </CardContent>
        </Card>
  
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Daily Performance</CardTitle>
            <CardDescription>Last 20 trading days</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyLoading ? (
              <Skeleton className="h-96 w-full rounded-lg" />
            ) : tableData.length === 0 ? (
              <div className="h-96 flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            ) : (
              <HistoryTable data={tableData} />
            )}
          </CardContent>
        </Card>
  
        <div className="col-span-full">
          <SectorAllocationCard
            data={sectorDataArray}
            totalValue={sectorTotalValue}
            isLoading={sectorLoading}
            isError={sectorIsError}
            errorMessage="Network error – backend unreachable"
            displayCurrency={displayCurrency}
            exchangeRate={exchangeRate}
          />
        </div>
      </div>
    </div>
  );
}