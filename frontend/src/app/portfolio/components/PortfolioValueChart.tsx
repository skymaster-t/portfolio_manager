// src/app/holdings/components/PortfolioValueChart.tsx (updated: intraday '1D' view with full 24h axis from 12:00 AM to 11:59 PM Toronto time, but NO line plotted beyond the last actual data point)
'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  ResponsiveContainer,
  LineChart,
  Line,
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
    if (history.length === 0) return { data: [], useTimeAxis: false, domain: undefined };

    // Parse UTC timestamps and sort chronologically (oldest → newest)
    const parsed = history
      .map((point) => {
        const iso = point.timestamp.endsWith('Z') ? point.timestamp : point.timestamp + 'Z';
        return {
          utcDate: new Date(iso),
          value: point.total_value,
        };
      })
      .sort((a, b) => a.utcDate.getTime() - b.utcDate.getTime());

    const isDayPeriod = period === 'day';

    // Filter for today (Toronto local date) when in 'day' mode
    let filtered = parsed;
    if (isDayPeriod) {
      const todayToronto = new Date().toLocaleDateString('en-CA', { timeZone: TORONTO_TZ });
      filtered = parsed.filter(
        (p) => p.utcDate.toLocaleDateString('en-CA', { timeZone: TORONTO_TZ }) === todayToronto
      );
    }
    // For other periods we currently use the full history (filtering/down-sampling can be added later)

    if (filtered.length === 0) return { data: [], useTimeAxis: false, domain: undefined };

    // Calculate full-day domain only for 'day' period (browser timezone assumed to match Toronto)
    let domain: [number, number] | undefined = undefined;
    if (isDayPeriod) {
      const nowLocal = new Date();
      const midnightLocal = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate(), 0, 0, 0, 0);
      const startMs = midnightLocal.getTime();
      const endMs = startMs + 24 * 60 * 60 * 1000 - 1000; // 23:59:59
      domain = [startMs, endMs];
    }

    // Build chart points
    const data = filtered.map((p) => {
      const tooltipLabel = isDayPeriod
        ? p.utcDate.toLocaleString('en-CA', {
            timeZone: TORONTO_TZ,
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : p.utcDate.toLocaleString('en-CA', {
            timeZone: TORONTO_TZ,
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });

      if (isDayPeriod) {
        return {
          time: p.utcDate.getTime(),
          value: p.value,
          tooltipLabel,
        };
      }

      const label = p.utcDate.toLocaleDateString('en-CA', {
        timeZone: TORONTO_TZ,
        month: 'short',
        day: 'numeric',
      });

      return {
        label,
        value: p.value,
        tooltipLabel,
      };
    });

    return { data, useTimeAxis: isDayPeriod, domain };
  }, [history, period]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.data.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          No data available for selected period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData.data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis
              dataKey={chartData.useTimeAxis ? 'time' : 'label'}
              type={chartData.useTimeAxis ? 'number' : 'category'}
              domain={chartData.domain}
              tickFormatter={
                chartData.useTimeAxis
                  ? (ms: number) =>
                      new Date(ms).toLocaleTimeString('en-CA', {
                        timeZone: TORONTO_TZ,
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                  : undefined
              }
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) =>
                new Intl.NumberFormat('en-CA', {
                  style: 'currency',
                  currency: 'CAD',
                  notation: 'compact',
                  maximumFractionDigits: 1,
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
                  return payload[0].payload.tooltipLabel;
                }
                return '';
              }}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={3}
              dot={false}
            />
          </LineChart>
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