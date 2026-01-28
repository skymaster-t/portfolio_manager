import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Portfolio() {
  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">Portfolio Overview</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Detailed portfolio breakdown, asset allocation, performance charts, and more will appear here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}