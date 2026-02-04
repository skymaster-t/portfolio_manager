// src/app/holdings/hooks/usePortfolioMutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';

export function usePortfolioMutations() {
  const queryClient = useQueryClient();

  const addHolding = useMutation({
    mutationFn: (payload: any) => axios.post('http://localhost:8000/holdings/', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      toast.success('Holding added successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to add holding');
    },
  });

  const updateHolding = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      axios.put(`http://localhost:8000/holdings/${id}`, data),  // ← ID in URL, data clean (no id in body)
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      toast.success('Holding updated successfully');
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail;
      const message = Array.isArray(detail) 
        ? detail.map((d: any) => d.msg).join(', ')
        : detail || 'Failed to update holding';
      toast.error(message);
    },
  });

  const deleteHolding = useMutation({
    mutationFn: (id: number) => axios.delete(`http://localhost:8000/holdings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      toast.success('Holding deleted');
    },
    onError: () => toast.error('Failed to delete holding'),
  });

  const createPortfolio = useMutation({
    mutationFn: (payload: any) => axios.post('http://localhost:8000/portfolios/', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      toast.success('Portfolio created');
    },
    onError: () => toast.error('Failed to create portfolio'),
  });

  const updatePortfolio = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      axios.put(`http://localhost:8000/portfolios/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      toast.success('Portfolio updated');
    },
    onError: () => toast.error('Failed to update portfolio'),
  });

  const deletePortfolio = useMutation({
    mutationFn: (id: number) => axios.delete(`http://localhost:8000/portfolios/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      toast.success('Portfolio deleted');
    },
    onError: () => toast.error('Failed to delete portfolio'),
  });

  return {
    addHolding,
    updateHolding,
    deleteHolding,
    createPortfolio,
    updatePortfolio,
    deletePortfolio,
  };
}