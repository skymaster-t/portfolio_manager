// src/app/page.tsx  (Root landing page - redirects to Dashboard)
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
  return null;
}