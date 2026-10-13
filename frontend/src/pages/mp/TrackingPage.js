import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, RefreshCw, PhoneCall, LifeBuoy, Star } from 'lucide-react';
import { toast } from 'sonner';
import { mp, customerHdr, statusColor, fmtStatus } from '../../utils/mpApi';

const MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const ReviewBox = ({ booking, email, onDone }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  if (done) return <p className="text-sm text-emerald-700 font-bold text-center" data-testid="review-thanks">Thanks for your review!</p>;
  const submit = async () => {
    try {
      await mp.post('/reviews', { booking_id: booking.booking_id, module: 'home', rating, comment, email });
      setDone(true); onDone?.();
    } catch (e) { toast.error(e.response?.data?.detail || 'Could not submit review'); }
  };
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5" data-testid="review-box">
      <p className="font-bold text-stone-900 text-sm mb-2">Rate this service</p>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} onClick={() => setRating(s)} data-testid={`star-${s}`}>
            <Star size={26} className={s <= rating ? 'text-amber-400' : 'text-stone-200'} fill={s <= rating ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      <textarea rows={2} placeholder="How was your experience? (optional)" value={comment} data-testid="review-comment"
        onChange={(e) => setComment(e.target.value)} className="w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm" />
      <button onClick={submit} data-testid="review-submit" className="mt-3 bg-emerald-700 text-white text-xs font-extrabold rounded-full px-6 py-2.5">Submit review</button>
    </div>
  );
};

const TrackingPage = () => {
  const { bookingId } = useParams();
  const [t, setT] = useState(null);
  const [err, setErr] = useState('');
  const timer = useRef(null);

  const load = () => {
    mp.get(`/bookings/${bookingId}/tracking`, customerHdr())
      .then((r) => { setT(r.data); setErr(''); })
      .catch((e) => setErr(e.response?.data?.detail || 'Could not load tracking'));
  };
  useEffect(() => {
    load();
    timer.current = setInterval(load, 10000);
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  if (err) return <div className="py-24 text-center text-stone-500" data-testid="tracking-error">{err}</div>;
  if (!t) return <div className="py-24 text-center text-stone-400">Loading…</div>;

  const hasLoc = t.lat != null && t.lng != null;
  const mapSrc = MAPS_KEY && hasLoc
    ? `https://www.google.com/maps/embed/v1/place?key=${MAPS_KEY}&q=${t.lat},${t.lng}&zoom=15`
    : (hasLoc ? `https://www.openstreetmap.org/export/embed.html?bbox=${t.lng - 0.01}%2C${t.lat - 0.01}%2C${t.lng + 0.01}%2C${t.lat + 0.01}&layer=mapnik&marker=${t.lat}%2C${t.lng}` : '');

  return (
    <div className="bg-stone-50 min-h-screen" data-testid="tracking-page">
      <div className="max-w-2xl mx-auto px-3 sm:px-6 py-8 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-stone-900 truncate">{t.service_name}</h1>
            <p className="text-xs text-stone-500">{t.booking_id} • {t.date} • {t.slot}</p>
          </div>
          <span className={`text-xs font-bold rounded-full px-3 py-1.5 shrink-0 ${statusColor(t.status)}`} data-testid="tracking-status">{fmtStatus(t.status)}</span>
        </div>
        {t.partner_name && (
          <div className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-extrabold shrink-0">{(t.partner_name || 'P')[0]}</div>
            <div className="min-w-0">
              <p className="font-bold text-stone-900 text-sm truncate">{t.partner_name}</p>
              <p className="text-[11px] text-stone-500">Verified service partner</p>
            </div>
          </div>
        )}
        {t.tracking_active && hasLoc ? (
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden" data-testid="live-map">
            <iframe title="Partner location" width="100%" height="320" frameBorder="0" src={mapSrc} />
            <div className="p-3 flex items-center justify-between text-xs gap-2">
              <span className="flex items-center gap-1.5 text-emerald-700 font-bold"><MapPin size={13} /> Live location</span>
              <span className="text-stone-400 text-right">Updated {t.last_update ? new Date(t.last_update).toLocaleTimeString('en-IN') : '—'}{t.eta_minutes ? ` • ETA ~${t.eta_minutes} min` : ''}</span>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 text-center" data-testid="tracking-unavailable">
            <RefreshCw size={22} className="mx-auto text-stone-300" />
            <p className="font-bold text-stone-700 mt-2 text-sm">
              {t.status === 'pending_payment' && 'Complete payment to confirm this booking.'}
              {t.status === 'pending_assignment' && 'Waiting for a partner to accept your booking…'}
              {t.status === 'assigned' && 'Partner assigned. Live tracking starts when they begin the journey.'}
              {t.status === 'en_route' && 'Live location is temporarily unavailable.'}
              {['arrived', 'in_service'].includes(t.status) && 'Your partner is at your location — service in progress.'}
              {t.status === 'completion_pending' && 'Service done — share the completion code sent to your email.'}
              {t.status === 'completed' && 'Service completed. Thank you!'}
              {t.status === 'cancelled' && 'This booking was cancelled.'}
            </p>
            {hasLoc && t.last_update && (
              <p className="text-[11px] text-stone-400 mt-2" data-testid="last-known">Last known location: {new Date(t.last_update).toLocaleString('en-IN')}{t.stale ? ' (not live)' : ''}</p>
            )}
          </div>
        )}
        {t.status === 'completed' && <ReviewBox booking={t} email={t.customer_email || ''} />}
        <div className="flex gap-3">
          <Link to="/support" data-testid="tracking-support" className="flex-1 inline-flex items-center justify-center gap-2 border border-stone-300 rounded-full py-3 text-sm font-bold text-stone-700">
            <LifeBuoy size={15} /> Contact Support
          </Link>
          <a href="tel:+918000000000" className="flex-1 inline-flex items-center justify-center gap-2 border border-stone-300 rounded-full py-3 text-sm font-bold text-stone-700">
            <PhoneCall size={15} /> Helpline
          </a>
        </div>
        <p className="text-[11px] text-stone-400 text-center">Location is shared by your partner only while travelling to you and stops when the service begins.</p>
      </div>
    </div>
  );
};

export default TrackingPage;
