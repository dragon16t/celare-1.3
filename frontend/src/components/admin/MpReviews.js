import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { mp, adminHdr } from '../../utils/mpApi';

const MpReviews = ({ module }) => {
  const [reviews, setReviews] = useState([]);
  useEffect(() => {
    mp.get('/admin/reviews', { ...adminHdr(), params: { module } }).then((r) => setReviews(r.data)).catch(() => {});
  }, [module]);
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5" data-testid={`reviews-${module}`}>
      <p className="font-bold text-stone-900 text-sm mb-3">Customer reviews ({reviews.length})</p>
      {reviews.length === 0 && <p className="text-xs text-stone-400">No reviews yet — customers can review completed bookings.</p>}
      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.review_id} className="border border-stone-100 rounded-xl p-3.5" data-testid={`review-${r.review_id}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-stone-800">{r.customer_name} <span className="font-normal text-stone-400">on</span> {r.service_name}</p>
              <span className="flex items-center gap-0.5 text-amber-500">
                {Array.from({ length: 5 }, (_, i) => <Star key={i} size={13} fill={i < r.rating ? 'currentColor' : 'none'} className={i < r.rating ? '' : 'text-stone-200'} />)}
              </span>
            </div>
            {r.comment && <p className="text-xs text-stone-600 mt-1">{r.comment}</p>}
            <p className="text-[10px] text-stone-400 mt-1">{r.booking_id} • {r.target_name} • {new Date(r.at).toLocaleString('en-IN')}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MpReviews;
