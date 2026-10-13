import React, { useEffect, useState } from 'react';
import { mp } from '../../utils/mpApi';

export default function EarningHint({ price }) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    if (!price || Number(price) <= 0) { setInfo(null); return undefined; }
    const t = setTimeout(() => mp.get('/provider/pricing', { params: { base: Number(price) } })
      .then((r) => setInfo(r.data)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [price]);
  if (!info) return null;
  return (
    <span className="block text-[11px] text-emerald-700 font-semibold mt-1 normal-case" data-testid="earning-hint">
      You earn ₹{info.you_earn} per booking (after {info.commission_pct}% Celesta commission)
    </span>
  );
}
