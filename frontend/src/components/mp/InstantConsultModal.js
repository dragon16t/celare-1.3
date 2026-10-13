import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Zap, Loader2, CheckCircle2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { mp } from '../../utils/mpApi';
import { openRazorpayCheckout } from '../../utils/razorpay';

const input = 'w-full rounded-xl border border-stone-200 px-4 py-3 text-sm';

const InstantConsultModal = ({ doctorId, onClose }) => {
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [stage, setStage] = useState('form'); // form | paying | waiting | ready | failed
  const [booking, setBooking] = useState(null);
  const [msg, setMsg] = useState('');
  const timer = useRef(null);
  const navigate = useNavigate();

  useEffect(() => () => clearInterval(timer.current), []);

  const poll = (bid, email) => {
    let tries = 0;
    timer.current = setInterval(async () => {
      tries += 1;
      try {
        const r = await mp.get(`/consultations/${bid}/room`, { params: { email } });
        if (['confirmed', 'in_progress'].includes(r.data.status)) {
          clearInterval(timer.current);
          setStage('ready');
        }
      } catch { /* still ringing */ }
      if (tries >= 36) {
        clearInterval(timer.current);
        setStage('failed');
        setMsg('No doctor picked up within 3 minutes. Your payment is safe — support will arrange the consult or a refund.');
      }
    }, 5000);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const r = await mp.post('/consultations/instant', { ...form, doctor_id: doctorId || null });
      const bk = r.data.booking;
      setBooking(bk);
      if (r.data.payments_configured && bk.razorpay_order_id) {
        setStage('paying');
        openRazorpayCheckout({
          orderId: bk.razorpay_order_id, amount: bk.fee, name: form.name, email: form.email, phone: form.phone,
          description: 'Instant dermatologist consultation',
          onSuccess: async (resp) => {
            try {
              await mp.post('/consultations/verify-payment', {
                booking_id: bk.booking_id, razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature,
              });
              setStage('waiting');
              poll(bk.booking_id, form.email.toLowerCase());
            } catch { toast.error('Payment verification failed — contact support'); setStage('failed'); }
          },
          onFailure: (m) => { toast.error(m); setStage('form'); },
        });
      } else {
        setStage('waiting');
        poll(bk.booking_id, form.email.toLowerCase());
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Instant consult unavailable');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" data-testid="instant-modal">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-stone-400" data-testid="instant-close"><X size={20} /></button>
        <p className="text-xs font-bold tracking-widest text-emerald-700 uppercase flex items-center gap-1.5"><Zap size={13} /> Instant consultation</p>
        {stage === 'form' && (
          <form onSubmit={submit} className="mt-3 space-y-3" data-testid="instant-form">
            <h2 className="text-xl font-extrabold text-stone-900">Connect with a dermatologist now</h2>
            <p className="text-xs text-stone-500">Pay securely, then we ring {doctorId ? 'this doctor' : 'every doctor online'} — the first to accept joins you on video.</p>
            <input required placeholder="Full name" data-testid="instant-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
            <input required type="email" placeholder="Email" data-testid="instant-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
            <input required placeholder="Mobile" data-testid="instant-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input} />
            <button data-testid="instant-submit" className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-full py-3.5 text-sm inline-flex items-center justify-center gap-2">
              <CreditCard size={15} /> Pay & connect to doctor
            </button>
          </form>
        )}
        {stage === 'paying' && (
          <div className="mt-4 text-center py-8" data-testid="instant-paying">
            <Loader2 size={36} className="mx-auto text-emerald-600 animate-spin" />
            <h2 className="text-lg font-extrabold text-stone-900 mt-3">Complete payment…</h2>
            <p className="text-xs text-stone-500 mt-1">Finish the secure Razorpay checkout to ring the doctor.</p>
          </div>
        )}
        {stage === 'waiting' && (
          <div className="mt-4 text-center py-6" data-testid="instant-waiting">
            <div className="relative w-16 h-16 mx-auto">
              <span className="animate-ping absolute inset-0 rounded-full bg-emerald-200" />
              <span className="relative w-16 h-16 rounded-full bg-emerald-700 text-white flex items-center justify-center"><Zap size={24} /></span>
            </div>
            <h2 className="text-lg font-extrabold text-stone-900 mt-3">Ringing online doctors…</h2>
            <p className="text-xs text-stone-500 mt-1">{msg || 'Payment done. The first doctor to accept connects with you instantly.'}</p>
            <p className="text-[11px] text-stone-400 mt-3">Booking {booking?.booking_id}</p>
          </div>
        )}
        {stage === 'ready' && (
          <div className="mt-4 text-center py-6" data-testid="instant-ready">
            <CheckCircle2 size={40} className="mx-auto text-emerald-600" />
            <h2 className="text-lg font-extrabold text-stone-900 mt-3">Doctor accepted!</h2>
            <button onClick={() => navigate(`/consult-room/${booking.booking_id}`)} data-testid="instant-join"
              className="mt-4 bg-emerald-700 text-white font-extrabold rounded-full px-8 py-3.5 text-sm">Join video room</button>
          </div>
        )}
        {stage === 'failed' && (
          <div className="mt-4 text-center py-6" data-testid="instant-failed">
            <h2 className="text-lg font-extrabold text-stone-900">Still waiting…</h2>
            <p className="text-xs text-stone-500 mt-2">{msg}</p>
            <button onClick={onClose} className="mt-4 border border-emerald-700 text-emerald-800 font-bold rounded-full px-6 py-3 text-sm">Schedule instead</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstantConsultModal;
