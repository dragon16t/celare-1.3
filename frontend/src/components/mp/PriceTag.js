import React from 'react';
import { BadgePercent } from 'lucide-react';

export const DiscountBadge = ({ pct, className = '' }) => (pct > 0 ? (
  <span className={`inline-flex items-center gap-1 bg-gradient-to-r from-amber-400 to-yellow-500 text-stone-900 text-[9px] sm:text-[10px] font-black rounded-full px-2 py-0.5 shadow-sm ${className}`} data-testid="discount-badge">
    <BadgePercent size={11} /> {pct}% OFF
  </span>
) : null);

export const PriceTag = ({ price, mrp, size = 'md' }) => {
  const big = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm sm:text-base' : 'text-base sm:text-lg';
  return (
    <span className="inline-flex items-baseline gap-1.5 flex-wrap" data-testid="price-tag">
      <span className={`${big} font-extrabold text-emerald-800`}>₹{price}</span>
      {mrp > price && <span className="text-[11px] sm:text-xs text-stone-400 line-through">₹{mrp}</span>}
    </span>
  );
};
