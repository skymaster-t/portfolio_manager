'use client';

import { useEffect, useRef, useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useAllHoldings } from '@/lib/queries';

interface Underlying {
  symbol: string;
  allocation_percent: number | null;
  current_price: number | null;
  daily_change: number | null;
  daily_change_percent: number | null;
}

interface Holding {
  id: number;
  symbol: string;
  current_price: number | null;
  daily_change: number | null;
  daily_change_percent: number | null;
  underlying_details?: Underlying[];
}

export function HoldingsTicker() {
  const { data: holdings = [], isLoading } = useAllHoldings();
  const trackRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(0);
  const animationIdRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  // Flatten main + underlyings – memoized for stable reference
  const tickerItems = useMemo(() => {
    const items: {
      symbol: string;
      price: number | null;
      change: number | null;
      percent: number | null;
      isUnderlying: boolean;
    }[] = [];

    holdings.forEach((h) => {
      items.push({
        symbol: h.symbol,
        price: h.current_price,
        change: h.daily_change,
        percent: h.daily_change_percent,
        isUnderlying: false,
      });

      (h.underlying_details || []).forEach((u) => {
        items.push({
          symbol: u.symbol,
          price: u.current_price,
          change: u.daily_change,
          percent: u.daily_change_percent,
          isUnderlying: true,
        });
      });
    });

    return items;
  }, [holdings]);

  // Duplicate for seamless loop
  const duplicatedItems = [...tickerItems, ...tickerItems];

  // Speed
  const speed = 40;

  // Animation – persists position, pauses on hover
  useEffect(() => {
    if (!trackRef.current || tickerItems.length === 0) return;

    const animate = () => {
      if (!pausedRef.current) {
        positionRef.current -= speed / 60; // ~60fps

        if (trackRef.current) {
          trackRef.current.style.transform = `translateX(${positionRef.current}px)`;

          // Seamless reset
          const halfWidth = trackRef.current.scrollWidth / 2;
          if (Math.abs(positionRef.current) >= halfWidth) {
            positionRef.current += halfWidth;
          }
        }
      }

      animationIdRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
    };
  }, [tickerItems.length]);

  if (isLoading || holdings.length === 0) {
    return (
      <div className="bg-muted py-2 text-center text-muted-foreground text-xs">
        {isLoading ? 'Loading holdings...' : 'No holdings to display'}
      </div>
    );
  }

  return (
    <div
      className="bg-background border-y py-2 overflow-hidden"
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
    >
      <div className="flex items-center">
        <div ref={trackRef} className="flex items-center gap-4">
          {duplicatedItems.map((item, index) => {
            const isPositive = (item.change || 0) >= 0;
            const changeAbs = item.change !== null ? Math.abs(item.change) : null;

            return (
              <div
                key={index}
                className={`flex flex-col items-center justify-center rounded-lg px-3 py-1.5 min-w-[160px] shadow-sm ${
                  isPositive ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                {/* Symbol + Price */}
                <div className="flex items-center gap-2">
                  <span
                    className={`font-black uppercase tracking-wider ${
                      item.isUnderlying ? 'text-xs opacity-80' : 'text-sm'
                    }`}
                  >
                    {item.symbol}
                  </span>

                  <span className="font-bold text-sm">
                    {item.price !== null
                      ? new Intl.NumberFormat('en-CA', {
                          style: 'currency',
                          currency: 'CAD',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(item.price)
                      : '-'}
                  </span>
                </div>

                {/* Gain/Loss below – single line */}
                <div className="mt-1 flex items-center gap-1 text-xs whitespace-nowrap">
                  {isPositive ? (
                    <ArrowUpRight className="h-3 w-3 text-green-600" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-600" />
                  )}
                  <span className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {changeAbs !== null
                      ? new Intl.NumberFormat('en-CA', {
                          style: 'currency',
                          currency: 'CAD',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(changeAbs)
                      : '-'}
                    {' '}
                    ({item.percent !== null
                      ? `${isPositive ? '+' : ''}${item.percent.toFixed(2)}%`
                      : '-'}
                    )
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}