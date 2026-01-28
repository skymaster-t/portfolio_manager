import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Market() {
  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">Market Data</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text Disadvantages-foreground">
            Real-time stock/ETF quotes, news, trends, watchlists, and market indices powered by FMP and cached prices.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}