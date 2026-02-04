// src/app/holdings/components/PortfolioValueChart.tsx (updated: 1Day view domain fits data range exactly – no left blank space)
'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface HistoryPoint {
  timestamp: string; // UTC ISO string from backend
  total_value: number;
}

type Period = 'day' | 'week' | 'month' | '3m' | 'year' | '2y' | '3y' | 'ytd' | 'all';

const TORONTO_TZ = 'America/Toronto';

const fetchGlobalHistory = async (): Promise<HistoryPoint[]> => {
  const { data } = await axios.get('http://localhost:8000/portfolios/global-history');
  return data;
};

export function PortfolioValueChart() {
  const [period, setPeriod] = useState<Period>('day');

  const {
    data: history = [],
    isLoading,
  } = useQuery({
    queryKey: ['globalHistory'],
    queryFn: fetchGlobalHistory,
    refetchInterval: 300000,
    refetchIntervalInBackground: true,
    staleTime: 300000,
  });

  const chartData = useMemo(() => {
    if (history.length === 0) return [];

    // Parse UTC timestamps
    const parsed = history.map((point) => {
      const iso = point.timestamp.endsWith('Z') ? point.timestamp : point.timestamp + 'Z';
      return {
        utcDate: new Date(iso),
        value: point.total_value,
      };
    });

    let filtered = parsed;

    if (period === 'day') {
      // Strict: only points where Toronto local date == today
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: TORONTO_TZ });
      filtered = parsed.filter((p) =>
        p.utcDate.toLocaleDateString('en-CA', { timeZone: TORONTO_TZ }) === todayStr
      );
    } else {
      const now = new Date();
      let startDate: Date | null = null;

      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '3m':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        case '2y':
          startDate = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
          break;
        case '3y':
          startDate = new Date(now.getTime() - 1095 * 24 * 60 * 60 * 1000);
          break;
        case 'ytd':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        case 'all':
          startDate = null;
          break;
      }

      if (startDate) {
        filtered = parsed.filter((p) => p.utcDate >= startDate);
      }
    }

    const sorted = filtered.sort((a, b) => a.utcDate.getTime() - b.utcDate.getTime());

    const timeFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: TORONTO_TZ,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: TORONTO_TZ,
      month: 'short',
      day: 'numeric',
    });

    const fullFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: TORONTO_TZ,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return sorted.map((p) => ({
      timestampMs: p.utcDate.getTime(),
      value: p.value,
      label: period === 'day' ? timeFormatter.format(p.utcDate) : dateFormatter.format(p.utcDate),
      tooltipLabel: fullFormatter.format(p.utcDate),
    }));
  }, [history, period]);

  // 1Day domain: fit exactly to data range (first point to last/now) – no blank left
  const dayDomain = useMemo(() => {
    if (period !== 'day' || chartData.length === 0) return undefined;

    const times = chartData.map((d) => d.timestampMs);
    const min = Math.min(...times);
    const max = Math.max(...times, Date.now()); // Extend to now if last point is earlier

    // Add small padding (~5 minutes) for visual breathing room
    const padding = 5 * 60 * 1000;
    return [min - padding, max + padding];
  }, [chartData, period]);

  const formatTick = (unixMs: number) => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TORONTO_TZ,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(unixMs));
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-0 shadow-lg">
        <CardContent className="pt-6">
          <Skeleton className="h-80 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-0 shadow-lg">
        <CardContent className="pt-6">
          <p className="text-center py-20 text-muted-foreground">
            No history data yet – values will appear after the first update.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-0 shadow-lg">
      <CardContent className="pt-6 pb-4">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis
              dataKey={period === 'day' ? 'timestampMs' : 'label'}
              type={period === 'day' ? 'number' : 'category'}
              domain={period === 'day' ? dayDomain : 'auto'}
              tickFormatter={period === 'day' ? formatTick : undefined}
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
              angle={period === 'day' ? 0 : -45}
              textAnchor="end"
              height={period === 'day' ? 50 : 80}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) =>
                new Intl.NumberFormat('en-CA', {
                  style: 'currency',
                  currency: 'CAD',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(value)
              }
            />
            <Tooltip
              formatter={(value: number) =>
                new Intl.NumberFormat('en-CA', {
                  style: 'currency',
                  currency: 'CAD',
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(value)
              }
              labelFormatter={(_, payload) => {
                if (payload && payload.length > 0) {
                  return `Time: ${payload[0].payload.tooltipLabel}`;
                }
                return '';
              }}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 0.95)',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#valueGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>

        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {(['day', 'week', 'month', '3m', 'year', '2y', '3y', 'ytd', 'all'] as Period[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p)}
              className={
                period === p
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'hover:bg-indigo-50 hover:text-indigo-700'
              }
            >
              {p === 'day' ? '1D' : p === 'week' ? '1W' : p === 'month' ? '1M' : p === '3m' ? '3M' : p === 'year' ? '1Y' : p === '2y' ? '2Y' : p === '3y' ? '3Y' : p === 'ytd' ? 'YTD' : 'All'}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}