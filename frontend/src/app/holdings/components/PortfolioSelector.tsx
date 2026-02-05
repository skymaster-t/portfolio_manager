// frontend/src/app/holdings/components/PortfolioSelector.tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Portfolio {
  id: number;
  name: string;
  isDefault: boolean;
}

interface Props {
  portfolios: Portfolio[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export default function PortfolioSelector({ portfolios, selectedId, onSelect }: Props) {
  if (portfolios.length === 0) return null;

  return (
    <Select value={selectedId?.toString()} onValueChange={(v) => onSelect(Number(v))}>
      <SelectTrigger className="w-full sm:w-64">
        <SelectValue placeholder="Select portfolio" />
      </SelectTrigger>
      <SelectContent>
        {portfolios.map((p) => (
          <SelectItem key={p.id} value={p.id.toString()}>
            {p.name} {p.isDefault && '(Default)'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}