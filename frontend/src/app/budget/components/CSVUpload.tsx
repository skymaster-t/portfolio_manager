// src/app/budget/components/CSVUpload.tsx (updated or new – add account select)
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

interface Props {
  accounts: any[];  // NEW: Receive accounts from parent
}

export function CSVUpload({ accounts }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);  // NEW
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleUpload = async () => {
    if (!file) return toast.error('Select a CSV file');

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await axios.post(
        `${API_BASE}/transactions/upload?account_id=${accountId || ''}`,  // NEW: Pass account_id
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      toast.success(`Uploaded: ${data.new} new, ${data.duplicates} duplicates, ${data.categorized} categorized`);
      setOpen(false);
      // Refetch transactions/queryClient.invalidateQueries(['transactions']);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Upload CSV</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Transactions CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>CSV File</Label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full border rounded p-2"
            />
          </div>
          <div>  {/* NEW: Account select */}
            <Label>Assign Account (optional)</Label>
            <Select value={accountId || ''} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="No account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc: any) => (
                  <SelectItem key={acc.id} value={acc.id.toString()}>
                    {acc.name} ({acc.type || 'custom'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleUpload} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}