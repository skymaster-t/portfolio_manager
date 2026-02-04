'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';

interface GlobalHistory {
  timestamp: string;
  total_value: number;
  daily_change: number;
  daily_percent: number;
  all_time_gain: number;
  all_time_percent: number;
}

const fetchDailyGlobalHistory = async (): Promise<GlobalHistory[]> => {
  const { data } = await axios.get('http://localhost:8000/portfolios/global/history/daily');
  return data;
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD', // Change to 'USD' if preferred, or make dynamic later
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number) => {
  return `${value.toFixed(2)}%`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border bg-background p-4 shadow-sm">
        <p className="font-semibold">{format(parseISO(label), 'MMM d, yyyy')}</p>
        <p className="text-lg font-bold">{formatCurrency(data.total_value)}</p>
        <p className={data.daily_change >= 0 ? 'text-green-600' : 'text-red-600'}>
          {data.daily_change >= 0 ? <TrendingUp className="inline h-4 w-4" /> : <TrendingDown className="inline h-4 w-4" />}
          {' '}{formatCurrency(Math.abs(data.daily_change))} ({formatPercent(data.daily_percent)})
        </p>
        <p className="text-muted-foreground">
          All-time return: <span className={data.all_time_percent >= 0 ? 'text-green-600' : 'text-red-600'}>
            {formatPercent(data.all_time_percent)}
          </span>
        </p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { data: history = [], isLoading, isError } = useQuery({
    queryKey: ['dailyGlobalHistory'],
    queryFn: fetchDailyGlobalHistory,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 min (in case new EOD arrives)
  });

  const latest = history[history.length - 1];

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Portfolio Dashboard</h1>
          <p className="text-muted-foreground mt-2">Combined performance across all portfolios</p>
        </div>
        <Calendar className="h-8 w-8 text-muted-foreground" />
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
              <CardContent><Skeleton className="h-10 w-48" /></CardContent>
            </Card>
          ))}
        </div>
      ) : latest ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(latest.total_value)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                As of {format(parseISO(latest.timestamp), 'MMM d, yyyy')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Change</CardTitle>
              {latest.daily_change >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${latest.daily_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {latest.daily_change >= 0 ? '+' : ''}{formatCurrency(latest.daily_change)}
              </div>
              <p className={`text-xs ${latest.daily_percent >= 0 ? 'text-green-600' : 'text-red-600'} mt-1`}>
                {latest.daily_percent >= 0 ? '+' : ''}{formatPercent(latest.daily_percent)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">All-Time Return</CardTitle>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${latest.all_time_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {latest.all_time_percent >= 0 ? '+' : ''}{formatPercent(latest.all_time_percent)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total gain: {formatCurrency(latest.all_time_gain)}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Chart */}
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>Portfolio Value Over Time</CardTitle>
          <CardDescription>Daily end-of-day snapshots (one point per trading day)</CardDescription>
        </CardHeader>
        <CardContent className="h-96">
          {isLoading ? (
            <Skeleton className="h-full w-full rounded-lg" />
          ) : isError ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Error loading history data
            </div>
          ) : history.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <Calendar className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg">No daily history yet</p>
              <p className="text-sm mt-2">Data will appear after the first end-of-day snapshot</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value) => format(parseISO(value), 'MMM d')}
                />
                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="total_value"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}