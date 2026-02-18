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
  fxRate: ['fxRate'] as const,
  globalSectorAllocation: ['globalSectorAllocation'] as const,
  budgetSummary: ['budget', 'summary'] as const,
  budgetItems: ['budget', 'items'] as const,
};

// Shared fetchers
const fetchGlobalIntraday = () => axios.get(`${API_BASE}/portfolios/global-history`).then(res => res.data);
const fetchGlobalDaily = () => axios.get(`${API_BASE}/portfolios/global/history/daily`).then(res => res.data);
const fetchAllHoldings = () => axios.get(`${API_BASE}/holdings`).then(res => res.data);
const fetchPortfolioSummaries = () => axios.get(`${API_BASE}/portfolios/summary`).then(res => res.data);

// Common options for 5-minute background refresh
const commonOptions = {
  refetchInterval: 60000, // 60 seconds
  refetchIntervalInBackground: true,
  staleTime: 60000, //  60 seconds
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
    queryKey: queryKeys.fxRate,
    queryFn: () => axios.get(`${API_BASE}/fx/current`).then(res => res.data.usdcad_rate as number),
    refetchInterval: 3600000,
    refetchIntervalInBackground: true,
    staleTime: 3600000,
    initialData: 1.37,
    ...options,
  });
}

export function useGlobalSectorAllocation(options?: UseQueryOptions<any, Error>) {
  return useQuery({
    queryKey: queryKeys.globalSectorAllocation,
    queryFn: () => axios.get(`${API_BASE}/portfolios/global-sector-allocation`).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    ...commonOptions,
    ...options,
  });
}

// Budget hooks – identical style to dashboard hooks (axios + API_BASE + commonOptions)
export function useBudgetSummary(options?: UseQueryOptions<any, Error>) {
  return useQuery({
    queryKey: queryKeys.budgetSummary,
    queryFn: () => axios.get(`${API_BASE}/budget/summary`).then(res => res.data),
    ...commonOptions,
    ...options,
  });
}

export function useBudgetItems(options?: UseQueryOptions<any[], Error>) {
  return useQuery({
    queryKey: queryKeys.budgetItems,
    queryFn: () => axios.get(`${API_BASE}/budget/items`).then(res => res.data),
    ...commonOptions,
    ...options,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => axios.get(`${API_BASE}/budget/categories`).then(res => res.data),
    ...commonOptions,
  });
}

export function useTransactions() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: () => axios.get(`${API_BASE}/transactions`).then(res => res.data),
    staleTime: 1000 * 60 * 60 * 24,  // 24 hours – transactions don't change real-time
    ...commonOptions,
  });
}

export function useTransactionSummary() {
  return useQuery({
    queryKey: ['transactionSummary'],
    queryFn: () => axios.get(`${API_BASE}/transactions/summary`).then(res => res.data),
    staleTime: 1000 * 60 * 60 * 24,
    ...commonOptions,
  });
}
