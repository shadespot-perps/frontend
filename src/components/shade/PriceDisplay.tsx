import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

interface PriceDisplayProps {
  price: number;
  decimals?: number;
  prefix?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-3xl font-bold',
};

export function PriceDisplay({ price, decimals = 2, prefix = '$', className, size = 'md' }: PriceDisplayProps) {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prevPrice = useRef(price);

  useEffect(() => {
    if (price > prevPrice.current) setFlash('up');
    else if (price < prevPrice.current) setFlash('down');
    prevPrice.current = price;

    const t = setTimeout(() => setFlash(null), 600);
    return () => clearTimeout(t);
  }, [price]);

  return (
    <span className={cn(
      'font-mono tabular-nums transition-colors',
      sizes[size],
      flash === 'up' && 'price-up',
      flash === 'down' && 'price-down',
      className
    )}>
      {price > 0
        ? `${prefix}${price.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
        : '—'}
    </span>
  );
}
