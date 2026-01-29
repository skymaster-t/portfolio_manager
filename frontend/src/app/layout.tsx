import './globals.css';
import Providers from '@/components/Providers';
import Header from '@/components/Header';
import { Toaster } from '@/components/ui/toaster';

export const metadata = {
  title: 'Finance App',
  description: 'Personal Portfolio Manager',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background">
        <Providers>
          <Header />
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}