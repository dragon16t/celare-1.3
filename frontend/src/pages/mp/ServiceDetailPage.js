import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle2, ShieldCheck, AlertTriangle, MapPin, CreditCard, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { mp } from '../../utils/mpApi';
import { openRazorpayCheckout } from '../../utils/razorpay';
import SEOHead from '../../components/SEOHead';
import { PriceTag, DiscountBadge } from '../../components/mp/PriceTag';
import { getSavedLocation } from '../../utils/userLocation';

const SLOTS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

const ServiceDetailPage = () => {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [svc, setSvc] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [mode, setMode] = useState('scheduled');
  const [payMethod, setPayMethod] = useState('online');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slot, setSlot] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', city: '', pincode: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [pro, setPro] = useState('');

  useEffect(() => {
    mp.get(`/services/${serviceId}`).then((r) => setSvc(r.data)).catch(() => setSvc(false));
    mp.get('/config').then((r) => setCfg(r.data)).catch(() => {});
    const loc = getSavedLocation();
    if (loc?.lat != null) {
      setForm((f) => ({ ...f, lat: loc.lat, lng: loc.lng, city: f.city || loc.city || '', pincode: f.pincode || loc.pincode || '',
        address: f.address || loc.formatted || '' }));
    }
  }, [serviceId]);

  if (svc === null) return <div className="py-24 text-center text-stone-400">Loading…</div>;
  if (svc === false) return <div className="py-24 text-center" data-testid="service-not-found">Service not available. <Link to="/services" className="text-emerald-700 underline">Back</Link></div>;

  const chosen = (svc.partners || []).find((p) => p.partner_id === pro);
  const total = chosen ? chosen.price : svc.price;
  const mrp = chosen ? chosen.mrp : svc.mrp;
  const discount = chosen ? chosen.discount_pct : svc.discount_pct;

  const finish = (data, paid) => setResult({ ...data, paid });

  const book = async (e) => {
    e.preventDefault();
    if (mode === 'scheduled' && !slot) return toast.error('Pick a time slot');
    setBusy(true);
    try {
      const payload = {
        service_id: serviceId, payment_method: payMethod, ...form, ...(pro ? { partner_id: pro } : {}),
        ...(mode === 'instant' ? { instant: true } : { date, slot }),
      };
      const r = await mp.post('/home/book', payload);
      const bk = r.data.booking;
      if (payMethod === 'online' && r.data.payments_configured && bk.razorpay_order_id) {
        openRazorpayCheckout({
          orderId: bk.razorpay_order_id, amount: bk.total_amount, name: form.name, email: form.email, phone: form.phone,
          description: bk.service_name,
          onSuccess: async (resp) => {
            try {
              await mp.post('/home/verify-payment', {
                booking_id: bk.booking_id, razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature,
              });
              finish(r.data, true);
            } catch { toast.error('Payment verification failed — contact support'); }
          },
          onFailure: (m) => { toast.error(m); setBusy(false); },
        });
        return;
      }
      toast.success(payMethod === 'online' ? 'Booking confirmed' : 'Booking confirmed — pay after the service');
      finish(r.data, false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Booking failed');
    } finally { setBusy(false); }
  };

  if (result) {
    const bk = result.booking;
    return (
      <div className="max-w-lg mx-auto px-6 py-20 text-center" data-testid="home-booked">
        <CheckCircle2 size={56} className="mx-auto text-emerald-600" />
        <h1 className="text-2xl font-extrabold text-stone-900 mt-4">{result.paid ? 'Paid — booking confirmed' : bk.payment_method === 'pay_after_service' ? 'Booking confirmed — pay after service' : 'Booking request sent'}</h1>
        <p className="text-stone-500 mt-2 text-sm">{result.paid ? 'Partners are being notified now.' : (result.message || '')}</p>
        <div className="mt-6 bg-emerald-50 border border-emerald-100 rounded-2xl p-5 text-left text-sm space-y-1.5">
          <p><b>Booking ID:</b> {bk.booking_id}</p>
          <p><b>Service:</b> {bk.service_name}</p>
          <p><b>When:</b> {bk.date} • {bk.slot}</p>
          <p><b>Amount:</b> ₹{bk.total_amount || bk.price} {bk.payment_method === 'pay_after_service' ? '(pay after service)' : ''}</p>
        </div>
        <div className="flex gap-3 justify-center mt-6">
          <button onClick={() => navigate(`/track/${bk.booking_id}`)} data-testid="goto-tracking" className="bg-emerald-700 text-white font-bold rounded-full px-6 py-3 text-sm">Track Booking</button>
          <button onClick={() => navigate('/my/bookings')} className="border border-emerald-700 text-emerald-800 font-bold rounded-full px-6 py-3 text-sm">My Bookings</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen" data-testid="service-detail-page">
      <SEOHead title={`${svc.name} — Home Service`} canonicalPath={`/services/${serviceId}`} description={svc.short_desc} />
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-8 overflow-x-hidden">
        <Link to="/services" className="text-sm text-stone-500 flex items-center gap-1 mb-6"><ArrowLeft size={15} /> All services</Link>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="min-w-0">
            <div className="rounded-3xl overflow-hidden bg-stone-50 aspect-[4/3]">
              {(svc.thumbnail || svc.images?.[0])
                ? <img src={svc.thumbnail || svc.images[0]} alt={svc.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full" />}
            </div>
            {svc.images?.length > 1 && (
              <div className="grid grid-cols-3 gap-2 mt-3" data-testid="service-image-row">
                {svc.images.slice(0, 3).map((img) => <img key={img} src={img} alt="" className="w-full aspect-square rounded-xl object-cover border border-stone-100" />)}
              </div>
            )}
            <div className="mt-6 space-y-4 text-sm">
              {svc.full_desc && <div><h3 className="font-extrabold text-stone-900 mb-1">About this service</h3><p className="text-stone-600 leading-relaxed">{svc.full_desc}</p></div>}
              {svc.includes?.length > 0 && <div><h3 className="font-extrabold text-stone-900 mb-1">Included</h3><ul className="space-y-1">{svc.includes.map((i) => <li key={i} className="flex gap-2 text-stone-600"><CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />{i}</li>)}</ul></div>}
              {svc.excludes?.length > 0 && <div><h3 className="font-extrabold text-stone-900 mb-1">Not included</h3><ul className="space-y-1">{svc.excludes.map((i) => <li key={i} className="text-stone-500">— {i}</li>)}</ul></div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-stone-50 rounded-xl p-3"><p className="text-[11px] text-stone-400 font-bold uppercase">Duration</p><p className="font-bold text-stone-800 flex items-center gap-1"><Clock size={14} /> {svc.duration_min} min</p></div>
                <div className="bg-stone-50 rounded-xl p-3"><p className="text-[11px] text-stone-400 font-bold uppercase">Mode</p><p className="font-bold text-stone-800 flex items-center gap-1"><MapPin size={14} /> {svc.mode === 'home' ? 'At your home' : svc.mode}</p></div>
              </div>
              {svc.patch_test && <p className="flex gap-2 items-start bg-amber-50 border border-amber-100 text-amber-800 rounded-xl p-3 text-xs"><AlertTriangle size={15} className="shrink-0 mt-0.5" /> A patch test is recommended 24 hours before this service.</p>}
              {svc.prep && <div><h3 className="font-extrabold text-stone-900 mb-1">How to prepare</h3><p className="text-stone-600">{svc.prep}</p></div>}
              {svc.aftercare && <div><h3 className="font-extrabold text-stone-900 mb-1">Aftercare</h3><p className="text-stone-600">{svc.aftercare}</p></div>}
              {svc.warnings && <p className="flex gap-2 items-start bg-rose-50 border border-rose-100 text-rose-700 rounded-xl p-3 text-xs"><ShieldCheck size={15} className="shrink-0 mt-0.5" /> {svc.warnings}</p>}
              {svc.cancellation_policy && <p className="text-xs text-stone-400">Cancellation: {svc.cancellation_policy}</p>}
            </div>
          </div>
          <div className="min-w-0">
            <div className="sticky top-6 bg-white rounded-3xl border border-stone-200 p-5 sm:p-6" data-testid="booking-panel">
              <p className="text-[10px] font-bold tracking-wider text-emerald-700 uppercase">{svc.category_title}</p>
              <h1 className="text-2xl font-extrabold text-stone-900 mt-1">{svc.name}</h1>
              <div className="mt-3 bg-gradient-to-r from-amber-50 to-emerald-50 border border-amber-100 rounded-2xl p-3.5 flex items-center justify-between" data-testid="service-price-box">
                <div>
                  <PriceTag price={total} mrp={mrp} size="lg" />
                  {mrp > total && <p className="text-[11px] font-bold text-emerald-700">You save ₹{mrp - total} · all inclusive</p>}
                </div>
                <DiscountBadge pct={discount} />
              </div>
              {svc.partners?.length > 0 && (
                <div className="mt-3" data-testid="pro-picker">
                  <p className="text-[11px] font-bold text-stone-500 uppercase mb-1.5">Choose your professional</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {[{ partner_id: '', name: 'Fastest available', price: svc.price }, ...svc.partners].map((p) => (
                      <button type="button" key={p.partner_id || 'any'} onClick={() => setPro(p.partner_id)} data-testid={`pro-${p.partner_id || 'any'}`}
                        className={`shrink-0 rounded-xl border px-3 py-2 text-left ${pro === p.partner_id ? 'border-emerald-600 bg-emerald-50' : 'border-stone-200'}`}>
                        <span className="block text-xs font-extrabold text-stone-800">{p.name}</span>
                        <span className="block text-[11px] text-emerald-700 font-bold">₹{p.price}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <form onSubmit={book} className="mt-4 space-y-3" data-testid="home-book-form">
                <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-full" data-testid="booking-mode-toggle">
                  {[['instant', 'Book now'], ['scheduled', 'Schedule']].map(([m, label]) => (
                    <button type="button" key={m} data-testid={`mode-${m}`} onClick={() => setMode(m)}
                      className={`rounded-full py-2 text-xs font-extrabold transition-colors ${mode === m ? 'bg-emerald-700 text-white shadow' : 'text-stone-500'}`}>{label}</button>
                  ))}
                </div>
                {mode === 'instant' && (
                  <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl p-2.5" data-testid="instant-hint">
                    Goes to pros who are <b>online right now</b> — first to accept is on the way.
                  </p>
                )}
                {mode === 'scheduled' && (
                <>
                <input type="date" required min={new Date().toISOString().slice(0, 10)} value={date} data-testid="home-book-date"
                  onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm" />
                <div className="grid grid-cols-3 gap-2" data-testid="home-slot-grid">
                  {SLOTS.map((s) => (
                    <button type="button" key={s} data-testid={`home-slot-${s}`} onClick={() => setSlot(s)}
                      className={`rounded-xl border px-2 py-2 text-xs font-bold ${slot === s ? 'bg-emerald-700 text-white border-emerald-700' : 'border-stone-200 text-stone-700'}`}>{s}</button>
                  ))}
                </div>
                </>
                )}
                <input required placeholder="Full name" data-testid="home-book-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm" />
                <input required type="email" placeholder="Email" data-testid="home-book-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm" />
                <input required placeholder="Mobile" data-testid="home-book-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm" />
                <textarea required placeholder="Full address for the home visit" data-testid="home-book-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm" />
                <div className="flex gap-2">
                  <input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-1/2 rounded-xl border border-stone-200 px-4 py-3 text-sm" />
                  <input placeholder="PIN code" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} className="w-1/2 rounded-xl border border-stone-200 px-4 py-3 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2" data-testid="payment-method">
                  <button type="button" onClick={() => setPayMethod('online')} data-testid="pay-online"
                    className={`rounded-xl border p-3 text-left ${payMethod === 'online' ? 'border-emerald-600 bg-emerald-50' : 'border-stone-200'}`}>
                    <CreditCard size={16} className="text-emerald-700 mb-1" />
                    <p className="text-xs font-extrabold text-stone-800">Pay online</p>
                    <p className="text-[10px] text-stone-400">Razorpay • UPI, cards</p>
                  </button>
                  <button type="button" onClick={() => setPayMethod('pay_after_service')} data-testid="pay-after"
                    className={`rounded-xl border p-3 text-left ${payMethod === 'pay_after_service' ? 'border-emerald-600 bg-emerald-50' : 'border-stone-200'}`}>
                    <Banknote size={16} className="text-emerald-700 mb-1" />
                    <p className="text-xs font-extrabold text-stone-800">Pay after service</p>
                    <p className="text-[10px] text-stone-400">Cash / UPI to partner</p>
                  </button>
                </div>
                <button disabled={busy || (mode === 'scheduled' && !slot)} data-testid="home-book-submit"
                  className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-extrabold rounded-full py-3.5 text-sm">
                  {busy ? 'Processing…' : payMethod === 'online' ? `Pay ₹${total} & book` : `Confirm booking — pay ₹${total} after service`}
                </button>
                <p className="text-[11px] text-stone-400 text-center">Verified pros · live tracking · OTP-secured completion</p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceDetailPage;
