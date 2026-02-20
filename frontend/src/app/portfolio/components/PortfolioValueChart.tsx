// src/app/portfolio/components/PortfolioValueChart.tsx
'use client';

import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useGlobalIntradayHistory } from '@/lib/queries';
import {
  parseISO,
  format,
  subDays,
  subMonths,
  subYears,
  startOfYear,
} from 'date-fns';

interface HistoryPoint {
  timestamp: string;
  total_value: number;
}

type Period = 'day' | 'week' | 'month' | '3m' | 'year' | '2y' | '3y' | 'ytd' | 'all';

const TORONTO_TZ = 'America/Toronto';

export function PortfolioValueChart() {
  const [period, setPeriod] = useState<Period>('day');

  const {
    data: history = [],
    isLoading,
  } = useGlobalIntradayHistory();

  const chartData = useMemo(() => {
    if (history.length === 0) {
      return {
        data: [],
        useTimeAxis: false,
        xDomain: undefined,
        yDomain: undefined,
        ticks: undefined,
        isFallback: false,
        latestValue: 0,
        dayKeys: [], // ← added here
      };
    }

    const parsed = history
      .map((point: HistoryPoint) => {
        const iso = point.timestamp.endsWith('Z') ? point.timestamp : point.timestamp + 'Z';
        return {
          utcDate: new Date(iso),
          value: point.total_value,
        };
      })
      .sort((a, b) => a.utcDate.getTime() - b.utcDate.getTime());

    // Helpers
    const getLocalDateTime = (utcDate: Date) => {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: TORONTO_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const parts = formatter.formatToParts(utcDate);
      const map: Record<string, string> = {};
      parts.forEach(({ type, value }) => (map[type] = value));
      return {
        year: map.year,
        month: map.month,
        day: map.day,
        hour: Number(map.hour),
        minute: Number(map.minute),
      };
    };

    const isTradingHour = (utcDate: Date) => {
      const local = getLocalDateTime(utcDate);
      const { hour, minute } = local;
      if (hour < 9 || hour > 16) return false;
      if (hour === 9 && minute < 30) return false;
      if (hour === 16 && minute > 0) return false;
      return true;
    };

    // Filter data based on selected period
    const now = new Date();
    let filtered = parsed;

    if (period === 'day') {
      const todayToronto = now.toLocaleDateString('en-CA', { timeZone: TORONTO_TZ });
      filtered = parsed.filter(
        (p) => p.utcDate.toLocaleDateString('en-CA', { timeZone: TORONTO_TZ }) === todayToronto
      );
    } else if (period === 'week') {
      filtered = parsed.filter((p) => p.utcDate >= subDays(now, 7));
    } else if (period === 'month') {
      filtered = parsed.filter((p) => p.utcDate >= subMonths(now, 1));
    } else if (period === '3m') {
      filtered = parsed.filter((p) => p.utcDate >= subMonths(now, 3));
    } else if (period === 'year') {
      filtered = parsed.filter((p) => p.utcDate >= subYears(now, 1));
    } else if (period === '2y') {
      filtered = parsed.filter((p) => p.utcDate >= subYears(now, 2));
    } else if (period === '3y') {
      filtered = parsed.filter((p) => p.utcDate >= subYears(now, 3));
    } else if (period === 'ytd') {
      filtered = parsed.filter((p) => p.utcDate >= startOfYear(now));
    } // 'all' → no filter

    // Downsampling & normalization for week/month
    let processed = filtered;
    let dayKeys: string[] = [];

    if (period === 'week' || period === 'month') {
      const byDay: Record<string, typeof parsed[0][]> = {};
      processed.forEach((p) => {
        if (!isTradingHour(p.utcDate)) return;
        const local = getLocalDateTime(p.utcDate);
        const dayKey = `${local.year}-${local.month}-${local.day}`;
        if (!byDay[dayKey]) byDay[dayKey] = [];
        byDay[dayKey].push(p);
      });

      dayKeys = Object.keys(byDay).sort();

      const sampled: (typeof parsed[0] & { x: number; dayKey: string; tooltipLabel: string })[] = [];
      dayKeys.forEach((day, dayIndex) => {
        let points = byDay[day].sort((a, b) => a.utcDate.getTime() - b.utcDate.getTime());
        const numPoints = points.length;
        if (numPoints === 0) return;

        if (numPoints <= 5) {
          points.forEach((p) => {
            const local = getLocalDateTime(p.utcDate);
            const intraDayFraction = ((local.hour + local.minute / 60) - 9.5) / 6.5;
            sampled.push({
              ...p,
              x: dayIndex + intraDayFraction,
              dayKey: day,
              tooltipLabel: p.utcDate.toLocaleString('en-CA', {
                timeZone: TORONTO_TZ,
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              }),
            });
          });
          return;
        }

        const step = Math.floor(numPoints / 4);
        for (let i = 0; i < numPoints; i += step) {
          const p = points[i];
          const local = getLocalDateTime(p.utcDate);
          const intraDayFraction = ((local.hour + local.minute / 60) - 9.5) / 6.5;
          sampled.push({
            ...p,
            x: dayIndex + intraDayFraction,
            dayKey: day,
            tooltipLabel: p.utcDate.toLocaleString('en-CA', {
              timeZone: TORONTO_TZ,
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            }),
          });
        }

        // Always include closing point
        const lastIdx = numPoints - 1;
        if (lastIdx % step !== 0) {
          const p = points[lastIdx];
          const local = getLocalDateTime(p.utcDate);
          const intraDayFraction = ((local.hour + local.minute / 60) - 9.5) / 6.5;
          sampled.push({
            ...p,
            x: dayIndex + intraDayFraction,
            dayKey: day,
            tooltipLabel: p.utcDate.toLocaleString('en-CA', {
              timeZone: TORONTO_TZ,
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            }),
          });
        }
      });

      processed = sampled;
    }

    // Prepare final chart data
    let data: any[] = [];
    let useTimeAxis = false;
    let xDomain: [number, number] | undefined = undefined;
    let ticks: number[] | undefined = undefined;
    let isFallback = false;

    if (period === 'day') {
      useTimeAxis = true;

      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const day = today.getDate();

      const midnightMs = new Date(year, month, day, 0, 0, 0, 0).getTime();
      const hourMs = 60 * 60 * 1000;

      const startMs = midnightMs + 8 * hourMs;
      const endMs = midnightMs + 17 * hourMs;

      xDomain = [startMs, endMs];

      ticks = [];
      for (let h = 8; h <= 17; h++) {
        ticks.push(midnightMs + h * hourMs);
      }

      const clipped = processed.filter((p) => {
        const t = p.utcDate.getTime();
        return t >= startMs && t <= endMs;
      });

      if (clipped.length > 0) {
        data = clipped.map((p) => ({
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

        if (data.length > 0 && data[0].time > startMs) {
          const carriedTooltip = new Date(startMs).toLocaleString('en-CA', {
            timeZone: TORONTO_TZ,
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          });
          data.unshift({
            time: startMs,
            value: data[0].value,
            tooltipLabel: carriedTooltip,
          });
          isFallback = true;
        }
      } else if (parsed.length > 0) {
        const lastPoint = parsed[parsed.length - 1];
        const carriedTooltip = new Date(startMs).toLocaleString('en-CA', {
          timeZone: TORONTO_TZ,
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
        data = [
          { time: startMs, value: lastPoint.value, tooltipLabel: carriedTooltip },
          { time: endMs, value: lastPoint.value, tooltipLabel: carriedTooltip },
        ];
        isFallback = true;
      }
    } else if (period === 'week' || period === 'month') {
      useTimeAxis = true;
      data = processed.map((p) => ({
        time: p.x,
        value: p.value,
        tooltipLabel: p.tooltipLabel,
      }));
      xDomain = [0, dayKeys.length];
      ticks = dayKeys.map((_, idx) => idx);
    } else {
      // Longer periods: daily closing values
      useTimeAxis = false;

      const dailyMap = new Map<string, { date: Date; value: number }>();

      filtered.forEach((p) => {
        const dateStr = format(p.utcDate, 'yyyy-MM-dd');
        const existing = dailyMap.get(dateStr);
        if (!existing || p.utcDate.getTime() > existing.date.getTime()) {
          dailyMap.set(dateStr, { date: p.utcDate, value: p.value });
        }
      });

      const dailyData = Array.from(dailyMap.values())
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map((entry) => ({
          label: format(entry.date, 'MMM d'),
          value: entry.value,
          tooltipLabel: format(entry.date, 'MMM d, yyyy'),
        }));

      data = dailyData;
    }

    // Y-domain with padding
    const values = data.map((d) => d.value).filter((v) => v != null);
    const minVal = values.length > 0 ? Math.min(...values) : 0;
    const maxVal = values.length > 0 ? Math.max(...values) : 0;
    const range = maxVal - minVal;
    const padding = range * 0.05 || 100;
    const yDomain: [number, number] = [minVal - padding, maxVal + padding];

    const latestValue = data.length > 0 ? data[data.length - 1].value : 0;

    return {
      data,
      useTimeAxis,
      xDomain,
      yDomain,
      ticks,
      isFallback,
      latestValue,
      dayKeys, // ← now returned so tickFormatter can access it
    };
  }, [history, period]);

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full rounded-lg" />;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={chartData.data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradientFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />

            <XAxis
              dataKey={chartData.useTimeAxis ? 'time' : 'label'}
              type={chartData.useTimeAxis ? 'number' : 'category'}
              domain={chartData.xDomain}
              ticks={chartData.ticks}
              tick={{ fontSize: 12 }}
              tickFormatter={(tick, index) => {
                if (chartData.useTimeAxis) {
                  if (period === 'day') {
                    const date = new Date(tick);
                    return date.toLocaleTimeString('en-CA', {
                      timeZone: TORONTO_TZ,
                      hour: 'numeric',
                      minute: '2-digit',
                    });
                  } else if (period === 'week' || period === 'month') {
                    const dayIndex = Math.floor(tick);
                    const dayKey = chartData.dayKeys?.[dayIndex];
                    return dayKey ? format(new Date(dayKey), 'MMM d') : '';
                  }
                }
                // Longer periods
                return chartData.data[index]?.label || '';
              }}
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

            <Area
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#gradientFill)"
            />

            {/* Current value marker */}
            {chartData.data.length > 0 && (
              <>
                <ReferenceLine
                  x={chartData.data[chartData.data.length - 1][chartData.useTimeAxis ? 'time' : 'label']}
                  stroke="#6366f1"
                  strokeDasharray="5 5"
                  strokeOpacity={0.6}
                />

                <circle
                  cx={chartData.data[chartData.data.length - 1][chartData.useTimeAxis ? 'time' : 'label']}
                  cy={chartData.data[chartData.data.length - 1].value}
                  r={8}
                  fill="#6366f1"
                  stroke="#fff"
                  strokeWidth={3}
                />

                <text
                  x={chartData.data[chartData.data.length - 1][chartData.useTimeAxis ? 'time' : 'label']}
                  y={chartData.data[chartData.data.length - 1].value - 15}
                  textAnchor="middle"
                  fill="#1f2937"
                  fontSize={14}
                  fontWeight="bold"
                >
                  {new Intl.NumberFormat('en-CA', {
                    style: 'currency',
                    currency: 'CAD',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(chartData.latestValue)}
                </text>
              </>
            )}
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
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
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