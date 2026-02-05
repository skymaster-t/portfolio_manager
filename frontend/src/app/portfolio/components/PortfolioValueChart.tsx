// src/app/holdings/components/PortfolioValueChart.tsx (updated: clean line chart – no area fill)
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
      const todayToronto = new Date().toLocaleDateString('en-CA', { timeZone: TORONTO_TZ });
      filtered = parsed.filter((p) => p.utcDate.toLocaleDateString('en-CA', { timeZone: TORONTO_TZ }) === todayToronto);
    } else {
      // For all other periods, use the full history (or add more filters later if needed)
      filtered = parsed;
    }

    // Format for chart
    return filtered.map((p) => {
      let label: string;
      let tooltipLabel: string;

      if (period === 'day') {
        label = p.utcDate.toLocaleTimeString('en-CA', {
          timeZone: TORONTO_TZ,
          hour: 'numeric',
          minute: '2-digit',
        });
        tooltipLabel = p.utcDate.toLocaleString('en-CA', {
          timeZone: TORONTO_TZ,
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
      } else {
        label = p.utcDate.toLocaleDateString('en-CA', {
          timeZone: TORONTO_TZ,
          month: 'short',
          day: 'numeric',
        });
        tooltipLabel = p.utcDate.toLocaleString('en-CA', {
          timeZone: TORONTO_TZ,
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      }

      return {
        label,
        tooltipLabel,
        value: p.value,
      };
    });
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

  if (chartData.length === 0) {
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
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis
              dataKey="label"
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
                  return `Time: ${payload[0].payload.tooltipLabel}`;
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