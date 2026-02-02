import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';

export function usePortfolioMutations() {
  const queryClient = useQueryClient();

  const addHolding = useMutation({
    mutationFn: (data: any) => axios.post('http://localhost:8000/holdings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      toast.success('Holding added');
    },
    onError: () => toast.error('Failed to add holding'),
  });

  const updateHolding = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      axios.put(`http://localhost:8000/holdings/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      toast.success('Holding updated');
    },
    onError: () => toast.error('Failed to update holding'),
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
    mutationFn: (data: any) => axios.post('http://localhost:8000/portfolios', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      toast.success('Portfolio created');
    },
  });

  const updatePortfolio = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      axios.put(`http://localhost:8000/portfolios/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      toast.success('Portfolio updated');
    },
  });

  const deletePortfolio = useMutation({
    mutationFn: (id: number) => axios.delete(`http://localhost:8000/portfolios/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      toast.success('Portfolio deleted');
    },
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