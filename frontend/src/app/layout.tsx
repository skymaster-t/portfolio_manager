// src/app/layout.tsx
import './globals.css';
import Providers from '@/components/Providers';
import Header from '@/components/Header';

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
        </Providers>
      </body>
    </html>
  );
}