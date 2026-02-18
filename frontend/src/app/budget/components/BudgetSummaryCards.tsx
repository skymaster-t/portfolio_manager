// src/app/budget/components/BudgetSummaryCards.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

interface BudgetSummaryCardsProps {
  summary: any;
}

export function BudgetSummaryCards({ summary }: BudgetSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Net Surplus</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-2xl font-bold ${summary.net_surplus_monthly >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(summary.net_surplus_monthly)} / mo
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(summary.total_income_monthly)} / mo
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(summary.total_expenses_monthly)} / mo
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Expected Dividends</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-indigo-600">
            {formatCurrency(summary.expected_dividend_income_monthly_cad)} / mo
          </p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(summary.expected_dividend_income_annual_cad)} / yr
          </p>
        </CardContent>
      </Card>
    </div>
  );
}