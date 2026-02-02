// src/components/Header.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Settings, LogOut } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Portfolio', href: '/portfolio' },
  { name: 'Holdings', href: '/holdings' },
  { name: 'Market', href: '/market' },
  { name: 'Analysis', href: '/analysis' },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg">
      <div className="container mx-auto px-6 py-5 flex items-center justify-between">
        {/* Title – left aligned */}
        <Link 
          href="/holdings" 
          className="text-3xl font-bold font-sans tracking-tight hover:opacity-90 transition-opacity"
        >
          Portfolio Manager
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-10">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-xl font-semibold transition-opacity ${
                pathname === item.href 
                  ? 'opacity-100 font-bold' 
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        {/* User Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/20">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-white/20">
                  <User className="h-5 w-5 text-white" />
                </AvatarFallback>
              </Avatar>
              <span className="sr-only">Open user menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-2">
            {/* Mobile navigation */}
            <div className="block md:hidden">
              {navItems.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href} className="w-full">
                    {item.name}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </div>

            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex items-center gap-2 text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}