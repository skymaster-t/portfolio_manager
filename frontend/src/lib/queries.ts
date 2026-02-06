// src/lib/queries.ts (new central file: shared React Query hooks & keys for all global/portfolio data – ensures single fetch + shared cache across pages)
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

// Consistent query keys (used across all pages)
export const queryKeys = {
  globalIntradayHistory: ['globalIntradayHistory'] as const,
  globalDailyHistory: ['globalDailyHistory'] as const,
  allHoldings: ['allHoldings'] as const,
  portfolioSummaries: ['portfolioSummaries'] as const,
};

// Shared fetchers
const fetchGlobalIntraday = () => axios.get(`${API_BASE}/portfolios/global-history`).then(res => res.data);
const fetchGlobalDaily = () => axios.get(`${API_BASE}/portfolios/global/history/daily`).then(res => res.data);
const fetchAllHoldings = () => axios.get(`${API_BASE}/holdings`).then(res => res.data);
const fetchPortfolioSummaries = () => axios.get(`${API_BASE}/portfolios/summary`).then(res => res.data);

// Common options for 5-minute background refresh
const commonOptions = {
  refetchInterval: 300000, // 5 minutes
  refetchIntervalInBackground: true,
  staleTime: 300000, // Consider fresh for 5 minutes
} as const;

// Shared hooks – use these in any page/component
export function useGlobalIntradayHistory(options?: UseQueryOptions<any[], Error>) {
  return useQuery({
    queryKey: queryKeys.globalIntradayHistory,
    queryFn: fetchGlobalIntraday,
    ...commonOptions,
    ...options,
  });
}

export function useGlobalDailyHistory(options?: UseQueryOptions<any[], Error>) {
  return useQuery({
    queryKey: queryKeys.globalDailyHistory,
    queryFn: fetchGlobalDaily,
    ...commonOptions,
    ...options,
  });
}

export function useAllHoldings(options?: UseQueryOptions<any[], Error>) {
  return useQuery({
    queryKey: queryKeys.allHoldings,
    queryFn: fetchAllHoldings,
    ...commonOptions,
    ...options,
  });
}

export function usePortfolioSummaries(options?: UseQueryOptions<any[], Error>) {
  return useQuery({
    queryKey: queryKeys.portfolioSummaries,
    queryFn: fetchPortfolioSummaries,
    ...commonOptions,
    ...options,
  });
}

export function useFxRate(options?: UseQueryOptions<number, Error>) {
  return useQuery({
    queryKey: ['fxRate'],
    queryFn: () => axios.get(`${API_BASE}/fx/current`).then(res => res.data.usdcad_rate as number),
    refetchInterval: 3600000, // Hourly refresh – FX rates don't fluctuate minute-to-minute
    refetchIntervalInBackground: true,
    staleTime: 3600000,
    initialData: 1.37, // Realistic fallback if fetch fails/initial load
    ...options,
  });
}