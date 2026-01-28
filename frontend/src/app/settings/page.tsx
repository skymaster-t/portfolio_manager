import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Settings() {
  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            User preferences, account settings, data import/export, API keys, notifications, and theme options.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}