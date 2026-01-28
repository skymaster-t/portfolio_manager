import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Analysis() {
  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">Analysis & Insights</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Advanced financial analysis, tax estimates, budgeting tools, net worth trends, and AI-powered insights using CrewAI agents.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}