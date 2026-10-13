import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { BadgeCheck, Video, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { mp } from '../../utils/mpApi';
import { openRazorpayCheckout } from '../../utils/razorpay';
import InstantConsultModal from '../../components/mp/InstantConsultModal';
import SEOHead from '../../components/SEOHead';
import { PriceTag, DiscountBadge } from '../../components/mp/PriceTag';
import { GoldBar } from './DoctorsPage';

const next7Days = () => Array.from({ length: 7 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() + i);
  return { iso: d.toISOString().slice(0, 10), day: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()],
           label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) };
});

const DoctorProfilePage = () => {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [date, setDate] = useState(next7Days()[0].iso);
  const [slot, setSlot] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [showInstant, setShowInstant] = useState(false);
  const days = useMemo(next7Days, []);

  useEffect(() => {
    mp.get(`/doctors/${doctorId}`).then((r) => setDoc(r.data)).catch(() => setDoc(false));
  }, [doctorId]);

  if (doc === null) return <div className="py-24 text-center text-stone-400">Loading…</div>;
  if (doc === false) return <div className="py-24 text-center" data-testid="doctor-not-found">Doctor not found. <Link to="/doctors" className="text-emerald-700 underline">Back</Link></div>;

  const dayKey = days.find((d) => d.iso === date)?.day;
  const allSlots = (doc.weekly_slots || {})[dayKey] || [];
  const taken = (doc.booked_slots || []).filter((b) => b.date === date).map((b) => b.slot);
  const availableNow = doc.online && !doc.engaged;

  const book = async (e) => {
    e.preventDefault();
    if (!slot) return toast.error('Pick a time slot');
    setBusy(true);
    try {
      const r = await mp.post('/consultations/book', { doctor_id: doctorId, date, slot, ...form });
      const bk = r.data.booking;
      if (r.data.payments_configured && bk.razorpay_order_id) {
        openRazorpayCheckout({
          orderId: bk.razorpay_order_id, amount: bk.fee, name: form.name, email: form.email, phone: form.phone,
          description: `Consultation — Dr. ${bk.doctor_name}`,
          onSuccess: async (resp) => {
            try {
              await mp.post('/consultations/verify-payment', {
                booking_id: bk.booking_id, razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature,
              });
              setResult({ ...r.data, booking: { ...bk, status: 'confirmed' }, paid: true });
            } catch { toast.error('Payment verification failed — contact support'); }
          },
          onFailure: (m) => { toast.error(m); setResult({ ...r.data, unpaid: true }); },
        });
      } else {
        setResult({ ...r.data, unpaid: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Booking failed');
    } finally { setBusy(false); }
  };

  if (result) return (
    <div className="max-w-lg mx-auto px-6 py-20 text-center" data-testid="consult-booked">
      <CheckCircle2 size={56} className="mx-auto text-emerald-600" />
      <h1 className="text-2xl font-extrabold text-stone-900 mt-4">{result.paid ? 'Paid — you are all set!' : 'Slot held — awaiting payment'}</h1>
      {!result.paid && <p className="text-amber-700 text-sm mt-2 font-semibold" data-testid="prepaid-note">Consultations are prepaid. Your booking confirms the moment payment is received.</p>}
      <div className="mt-6 bg-emerald-50 border border-emerald-100 rounded-2xl p-5 text-left text-sm space-y-1.5">
        <p><b>Booking ID:</b> {result.booking.booking_id}</p>
        <p><b>Doctor:</b> Dr. {result.booking.doctor_name}</p>
        <p><b>When:</b> {result.booking.date} • {result.booking.slot}</p>
        <p><b>Fee:</b> ₹{result.booking.fee}</p>
      </div>
      <div className="flex gap-3 justify-center mt-6">
        <button onClick={() => navigate('/my/bookings')} data-testid="goto-my-bookings" className="bg-emerald-700 text-white font-bold rounded-full px-6 py-3 text-sm">My Bookings</button>
        {result.paid && <button onClick={() => navigate(`/consult-room/${result.booking.booking_id}`)} data-testid="goto-room" className="border border-emerald-700 text-emerald-800 font-bold rounded-full px-6 py-3 text-sm">Call doctor</button>}
      </div>
    </div>
  );

  return (
    <div className="bg-white min-h-screen" data-testid="doctor-profile-page">
      <SEOHead title={`Dr. ${doc.name} — Online Dermatologist`} canonicalPath={`/doctors/${doctorId}`}
        description={`Book a secure video consultation with Dr. ${doc.name} (${doc.qualification || 'Dermatologist'}) on Celesta Glow.`} />
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-8 overflow-x-hidden">
        <Link to="/doctors" className="text-sm text-stone-500 flex items-center gap-1 mb-5"><ArrowLeft size={15} /> All dermatologists</Link>
        <div className="grid md:grid-cols-5 gap-6 md:gap-8">
          <div className="md:col-span-2">
            <div className="bg-white rounded-3xl border border-stone-200 p-5 sm:p-6">
              <div className="relative w-36 h-44 sm:w-40 sm:h-52 mx-auto rounded-2xl overflow-hidden bg-stone-50 border border-stone-100">
                {doc.photo ? <img src={doc.photo} alt={doc.name} className="w-full h-full object-cover object-top" />
                  : <div className="w-full h-full flex items-center justify-center text-emerald-700 text-6xl font-extrabold">{(doc.name || 'D')[0]}</div>}
                {doc.online && <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[9px] font-extrabold text-white bg-emerald-600 rounded-full px-2 py-1"><span className="h-1.5 w-1.5 rounded-full bg-white" /> ONLINE</span>}
              </div>
              <div className="text-center mt-4">
                <p className="text-xl font-extrabold text-stone-900 flex items-center justify-center gap-2">Dr. {doc.name} <BadgeCheck size={18} className="text-emerald-600" /></p>
                <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                  {(doc.qualification || '').split(',').filter(Boolean).map((q) => (
                    <span key={q} className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-1" data-testid="qual-badge">{q.trim()}</span>
                  ))}
                  {doc.experience_years ? <span className="text-[10px] font-extrabold text-stone-700 bg-stone-100 rounded-full px-2.5 py-1">{doc.experience_years}+ yrs</span> : null}
                </div>
                <div className="flex items-center justify-center gap-3 mt-3 text-xs text-stone-500">
                  <span className="flex items-center gap-1"><Video size={13} /> Video consult</span>
                  {doc.languages?.length > 0 && <span>{doc.languages.join(' / ')}</span>}
                </div>
              </div>
            </div>
            {doc.bio && <p className="text-sm text-stone-600 mt-4 leading-relaxed">{doc.bio}</p>}
          </div>
          <div className="md:col-span-3 min-w-0">
            {doc.online && (
              availableNow ? (
                <div className="mb-4"><GoldBar onlineCount={1} onClick={() => setShowInstant(true)} testid="profile-consult-now" /></div>
              ) : (
                <div className="w-full mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl py-3.5 px-4 text-xs font-bold flex items-center gap-2" data-testid="doctor-engaged">
                  <Clock size={15} /> In a consultation now (~30 min) — grab a slot below.
                </div>
              )
            )}
            {showInstant && <InstantConsultModal doctorId={doctorId} onClose={() => setShowInstant(false)} />}
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <h2 className="text-lg font-extrabold text-stone-900">Pick your slot</h2>
              <span className="flex items-center gap-2"><PriceTag price={doc.fee} mrp={doc.mrp} /><DiscountBadge pct={doc.discount_pct} /></span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" data-testid="date-picker">
              {days.map((d) => (
                <button key={d.iso} data-testid={`date-${d.iso}`} onClick={() => { setDate(d.iso); setSlot(''); }}
                  className={`shrink-0 rounded-xl border px-4 py-2.5 text-xs font-bold ${date === d.iso ? 'bg-emerald-700 text-white border-emerald-700' : 'border-stone-200 text-stone-600'}`}>
                  {d.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3" data-testid="slot-grid">
              {allSlots.length === 0 && <p className="col-span-full text-sm text-stone-400 py-4">No slots on this day — try another date.</p>}
              {allSlots.map((s) => {
                const isTaken = taken.includes(s);
                return (
                  <button key={s} disabled={isTaken} data-testid={`slot-${s}`} onClick={() => setSlot(s)}
                    className={`rounded-xl border px-2 py-2.5 text-xs font-bold ${isTaken ? 'bg-stone-100 text-stone-300 cursor-not-allowed line-through' : slot === s ? 'bg-emerald-700 text-white border-emerald-700' : 'border-stone-200 text-stone-700 hover:border-emerald-500'}`}>
                    {s}{isTaken ? ' • booked' : ''}
                  </button>
                );
              })}
            </div>
            <form onSubmit={book} className="mt-6 bg-stone-50 rounded-2xl p-4 sm:p-5 space-y-3" data-testid="consult-book-form">
              <p className="font-bold text-stone-800 text-sm">Your details</p>
              <input required data-testid="book-name" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm" />
              <input required type="email" data-testid="book-email" placeholder="Email (prescription & updates go here)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm" />
              <input required data-testid="book-phone" placeholder="Mobile number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm" />
              <button disabled={busy || !slot} data-testid="book-submit"
                className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-extrabold rounded-full py-3.5 text-sm">
                {busy ? 'Processing…' : slot ? `Pay ₹${doc.fee} & book — ${date} • ${slot}` : 'Select a slot to continue'}
              </button>
              <p className="text-[11px] text-stone-400 text-center">Prepaid & secure · private video call · e-prescription after the call</p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorProfilePage;
