'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';  // ← Added for spinner

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export function CSVUpload() {
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setUploading(true);
    const form = new FormData();
    form.append('file', file);

    try {
      const res = await axios.post(`${API_BASE}/transactions/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Uploaded! ${res.data.processed} transactions processed, ${res.data.new} new, ${res.data.skipped} skipped`);

      // Immediate refetch
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['transactionSummary'] }),
      ]);
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || 'Unknown error';
      toast.error(`Upload failed: ${message}`);
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Bank Transactions (CSV)</CardTitle>
      </CardHeader>
      <CardContent>
        {uploading ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-sm text-muted-foreground">Uploading and categorizing...</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".csv"
                onChange={handleUpload}
                disabled={uploading}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
              />
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Upload your checking account CSV. AI will automatically categorize transactions.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}