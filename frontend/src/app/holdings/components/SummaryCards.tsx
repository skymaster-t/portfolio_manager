// frontend/src/app/holdings/components/SummaryCards.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const formatCAD = (val: number) => val.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
const formatPercent = (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;

interface Props {
  summary: {
    totalValue: number;
    dailyChange: number;
    dailyPercent: number;
    gainLoss: number;
    allTimePercent: number;
  };
}

export default function SummaryCards({ summary }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Total Value</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatCAD(summary.totalValue)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Today's Change</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-2xl font-bold ${summary.dailyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCAD(summary.dailyChange)} ({formatPercent(summary.dailyPercent)})
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Unrealized Gain/Loss</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-2xl font-bold ${summary.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCAD(summary.gainLoss)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Total Return</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-2xl font-bold ${summary.allTimePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatPercent(summary.allTimePercent)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}