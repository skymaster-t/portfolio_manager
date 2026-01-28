import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Holdings() {
  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">Holdings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            List of your stocks, ETFs, and other assets with current values, cost basis, gains/losses, and transaction history.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}