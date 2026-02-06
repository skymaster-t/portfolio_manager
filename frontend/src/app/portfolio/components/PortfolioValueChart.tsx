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
import { useGlobalIntradayHistory } from '@/lib/queries';

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
  } = useGlobalIntradayHistory();

  const chartData = useMemo(() => {
    if (history.length === 0) return { data: [], useTimeAxis: false, xDomain: undefined, yDomain: undefined, ticks: undefined, isFallback: false };

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

    // Filter for today (Toronto local date)
    let todayFiltered = parsed;
    if (isDayPeriod) {
      const todayToronto = new Date().toLocaleDateString('en-CA', { timeZone: TORONTO_TZ });
      todayFiltered = parsed.filter(
        (p) => p.utcDate.toLocaleDateString('en-CA', { timeZone: TORONTO_TZ }) === todayToronto
      );
    }

    let data: any[] = [];
    let useTimeAxis = false;
    let xDomain: [number, number] | undefined = undefined;
    let ticks: number[] | undefined = undefined;
    let isFallback = false;

    if (isDayPeriod) {
      // Fixed intraday window: 08:00 AM – 5:00 PM Toronto time
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const day = today.getDate();

      const midnightMs = new Date(year, month, day, 0, 0, 0, 0).getTime();
      const hourMs = 60 * 60 * 1000;

      const startMs = midnightMs + 8 * hourMs;   // 08:00
      const endMs = midnightMs + 17 * hourMs;   // 17:00

      xDomain = [startMs, endMs];

      // Hourly ticks 08:00 – 17:00
      ticks = [];
      for (let h = 8; h <= 17; h++) {
        ticks.push(midnightMs + h * hourMs);
      }

      // Clip to window
      const clipped = todayFiltered.filter((p) => {
        const t = p.utcDate.getTime();
        return t >= startMs && t <= endMs;
      });

      if (clipped.length > 0) {
        // Normal intraday mode
        useTimeAxis = true;

        const realData = clipped.map((p) => ({
          time: p.utcDate.getTime(),
          value: p.value,
          tooltipLabel: p.utcDate.toLocaleString('en-CA', {
            timeZone: TORONTO_TZ,
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          }),
        }));

        // Add carried-forward point at 08:00 if first real point is later
        data = realData;
        const firstTime = realData[0].time;
        if (firstTime > startMs) {
          const carriedTooltip = new Date(startMs).toLocaleString('en-CA', {
            timeZone: TORONTO_TZ,
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          }) + ' (carried forward)';

          data = [
            {
              time: startMs,
              value: realData[0].value,
              tooltipLabel: carriedTooltip,
            },
            ...realData,
          ];
        }
      } else {
        // Fallback: no intraday data in window → show last 3 historical snapshots
        isFallback = true;
        const fallbackPoints = parsed.slice(-3);

        if (fallbackPoints.length === 0) {
          return { data: [], useTimeAxis: false, xDomain: undefined, yDomain: undefined, ticks: undefined, isFallback: false };
        }

        data = fallbackPoints.map((p) => ({
          label: p.utcDate.toLocaleString('en-CA', {
            timeZone: TORONTO_TZ,
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          }),
          value: p.value,
          tooltipLabel: p.utcDate.toLocaleString('en-CA', {
            timeZone: TORONTO_TZ,
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          }),
        }));

        // No time axis, no domain/ticks for fallback
        useTimeAxis = false;
        xDomain = undefined;
        ticks = undefined;
      }
    } else {
      // Non-'day' periods: use full history with categorical date labels
      data = parsed.map((p) => ({
        label: p.utcDate.toLocaleDateString('en-CA', {
          timeZone: TORONTO_TZ,
          month: 'short',
          day: 'numeric',
        }),
        value: p.value,
        tooltipLabel: p.utcDate.toLocaleString('en-CA', {
          timeZone: TORONTO_TZ,
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      }));
    }

    // Y-axis ±10% padding (use the values that will actually be plotted)
    const plotValues = data.length > 0 ? data.map((d: any) => 'value' in d ? d.value : d.value) : [];
    if (plotValues.length === 0) {
      return { data: [], useTimeAxis: false, xDomain: undefined, yDomain: undefined, ticks: undefined, isFallback: false };
    }

    const dataMin = Math.min(...plotValues);
    const dataMax = Math.max(...plotValues);

    let yLower = dataMin;
    let yUpper = dataMax;

    if (dataMin === dataMax) {
      yLower = dataMin * 0.9;
      yUpper = dataMin * 1.1;
    } else {
      const range = dataMax - dataMin;
      const padding = range * 0.1;
      yLower = dataMin - padding;
      yUpper = dataMax + padding;
    }

    const yDomain: [number, number] = [yLower, yUpper];

    return {
      data,
      useTimeAxis,
      xDomain,
      yDomain,
      ticks,
      isFallback,
    };
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
        {chartData.isFallback && (
          <p className="text-center text-muted-foreground mb-4">
            No intraday data available today. Showing the most recent 3 historical snapshots.
          </p>
        )}

        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData.data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis
              dataKey={chartData.useTimeAxis ? 'time' : 'label'}
              type={chartData.useTimeAxis ? 'number' : 'category'}
              domain={chartData.xDomain}
              ticks={chartData.ticks}
              tickFormatter={
                chartData.useTimeAxis
                  ? (ms: number) =>
                      new Date(ms).toLocaleTimeString('en-CA', {
                        timeZone: TORONTO_TZ,
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })
                  : undefined
              }
              tick={{ fontSize: 12 }}
            />
            <YAxis
              domain={chartData.yDomain}
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