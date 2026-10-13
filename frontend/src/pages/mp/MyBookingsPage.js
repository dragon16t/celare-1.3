import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, FileText, Download, Clock } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { mp, customerHdr, statusColor, fmtStatus } from '../../utils/mpApi';

const BASE = process.env.REACT_APP_BACKEND_URL;

const CustomerLogin = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [stage, setStage] = useState('email');
  const send = async () => {
    try { await axios.post(`${BASE}/api/auth/send-otp`, { email }); setStage('otp'); toast.success('Code sent to your email'); }
    catch { toast.error('Could not send code'); }
  };
  const verify = async () => {
    try {
      const r = await axios.post(`${BASE}/api/auth/verify-otp`, { email, otp });
      localStorage.setItem('cg_auth_token', r.data.token);
      onLogin();
    } catch { toast.error('Incorrect code'); }
  };
  return (
    <div className="max-w-sm mx-auto mt-16 bg-white border border-stone-200 rounded-3xl p-8" data-testid="customer-login">
      <h2 className="text-xl font-extrabold text-stone-900">Log in to view bookings</h2>
      <p className="text-sm text-stone-500 mt-1">Use the email you booked with.</p>
      {stage === 'email' ? (
        <>
          <input type="email" data-testid="login-email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-5 rounded-xl border border-stone-200 px-4 py-3 text-sm" />
          <button onClick={send} data-testid="login-send-otp" className="w-full mt-3 bg-emerald-700 text-white font-bold rounded-full py-3 text-sm">Send login code</button>
        </>
      ) : (
        <>
          <input data-testid="login-otp" placeholder="6-digit code" value={otp} onChange={(e) => setOtp(e.target.value)}
            className="w-full mt-5 rounded-xl border border-stone-200 px-4 py-3 text-sm tracking-[0.4em] text-center font-bold" />
          <button onClick={verify} data-testid="login-verify" className="w-full mt-3 bg-emerald-700 text-white font-bold rounded-full py-3 text-sm">Verify & log in</button>
        </>
      )}
    </div>
  );
};

const openRx = async (rx) => {
  try {
    const r = await mp.get(`/prescriptions/${rx.prescription_id}/pdf`, { ...customerHdr(), responseType: 'blob' });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a');
    a.href = url; a.download = `prescription-${rx.prescription_id}.pdf`; a.click();
  } catch { toast.error('Could not download prescription'); }
};

const ConsultRow = ({ b, rx }) => {
  const paid = b.payment_status === 'paid';
  const live = paid && ['confirmed', 'in_progress', 'completion_pending'].includes(b.status);
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5" data-testid={`consult-${b.booking_id}`}>
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <p className="font-bold text-stone-900">Dr. {b.doctor_name || 'Assigning…'}</p>
          <p className="text-xs text-stone-500">{b.date} • {b.slot} • ₹{b.fee} • {b.booking_id}</p>
          <span className={`inline-block mt-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 ${statusColor(paid ? b.status : 'pending_payment')}`}>{paid ? fmtStatus(b.status) : 'awaiting payment'}</span>
        </div>
        {live && (
          <Link to={`/consult-room/${b.booking_id}`} data-testid={`join-room-${b.booking_id}`}
            className="inline-flex items-center gap-1.5 bg-emerald-700 text-white text-xs font-bold rounded-full px-4 py-2.5">
            <Phone size={14} /> Call doctor
          </Link>
        )}
        {!paid && <span className="text-[11px] text-amber-700 font-bold flex items-center gap-1"><Clock size={12} /> Prepaid — confirms after payment</span>}
      </div>
      {b.status === 'completed' && (
        <div className="mt-3 border-t border-stone-100 pt-3 text-xs" data-testid={`consult-summary-${b.booking_id}`}>
          {rx ? (
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-extrabold text-stone-800">Doctor's notes</p>
                <p className="text-stone-600 mt-0.5">{rx.assessment || '—'}</p>
                {rx.medications?.length > 0 && <p className="text-stone-500 mt-1">Rx: {rx.medications.map((m) => m.name).join(', ')}</p>}
              </div>
              <button onClick={() => openRx(rx)} data-testid={`rx-pdf-${rx.prescription_id}`}
                className="inline-flex items-center gap-1.5 bg-emerald-700 text-white font-bold rounded-full px-4 py-2"><Download size={13} /> Download</button>
            </div>
          ) : <p className="text-stone-400">Your prescription will appear here shortly.</p>}
        </div>
      )}
    </div>
  );
};

const MyBookingsPage = () => {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const load = () => {
    mp.get('/my/bookings', customerHdr()).then((r) => { setData(r.data); setErr(false); })
      .catch(() => setErr(true));
  };
  useEffect(load, []);
  if (err) return <div className="px-4 py-10"><CustomerLogin onLogin={load} /></div>;
  if (!data) return <div className="py-24 text-center text-stone-400">Loading…</div>;

  return (
    <div className="bg-stone-50 min-h-screen" data-testid="my-bookings-page">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-8 space-y-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">My Bookings</h1>
        <section>
          <h2 className="font-extrabold text-stone-800 mb-3">Dermatologist consultations</h2>
          {data.consultations.length === 0 && <p className="text-sm text-stone-400">No consultations yet. <Link to="/doctors" className="text-emerald-700 underline">Find a dermatologist</Link></p>}
          <div className="space-y-3" data-testid="my-consultations">
            {data.consultations.map((b) => (
              <ConsultRow key={b.booking_id} b={b} rx={data.prescriptions.find((r) => r.booking_id === b.booking_id)} />
            ))}
          </div>
        </section>
        <section>
          <h2 className="font-extrabold text-stone-800 mb-3">Home services</h2>
          {data.home_bookings.length === 0 && <p className="text-sm text-stone-400">No home services yet. <Link to="/services" className="text-emerald-700 underline">Explore services</Link></p>}
          <div className="space-y-3" data-testid="my-home-bookings">
            {data.home_bookings.map((b) => (
              <div key={b.booking_id} className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <p className="font-bold text-stone-900">{b.service_name}</p>
                  <p className="text-xs text-stone-500">{b.booking_id} • {b.date} • {b.slot} • ₹{b.total_amount || b.price}{b.payment_method === 'pay_after_service' ? ' (pay after service)' : ''} • {b.payment_status === 'paid' || b.payment_status === 'paid_cash' ? 'Paid' : 'Unpaid'}</p>
                  {b.partner_name && <p className="text-xs text-stone-500">Partner: {b.partner_name}</p>}
                  <span className={`inline-block mt-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 ${statusColor(b.status)}`}>{fmtStatus(b.status)}</span>
                  {b.status === 'completion_pending' && <p className="text-[11px] text-violet-700 font-bold mt-1">Check your email for the completion code</p>}
                </div>
                <Link to={`/track/${b.booking_id}`} data-testid={`track-${b.booking_id}`}
                  className="inline-flex items-center gap-1.5 border border-emerald-700 text-emerald-800 text-xs font-bold rounded-full px-4 py-2.5">
                  <MapPin size={14} /> Track
                </Link>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="font-extrabold text-stone-800 mb-3 flex items-center gap-2"><FileText size={18} /> Prescriptions</h2>
          {data.prescriptions.length === 0 && <p className="text-sm text-stone-400">Finalised prescriptions from your consultations appear here.</p>}
          <div className="space-y-3" data-testid="my-prescriptions">
            {data.prescriptions.map((rx) => (
              <div key={rx.prescription_id} className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-stone-900 text-sm">Dr. {rx.doctor_name}</p>
                  <p className="text-xs text-stone-500">{rx.prescription_id} • {rx.date}</p>
                </div>
                <a href={`${BASE}/api/mp/prescriptions/${rx.prescription_id}/pdf`} target="_blank" rel="noreferrer"
                  onClick={(e) => { e.preventDefault(); openRx(rx); }}
                  data-testid={`rx-list-pdf-${rx.prescription_id}`}
                  className="inline-flex items-center gap-1.5 bg-emerald-700 text-white text-xs font-bold rounded-full px-4 py-2.5">
                  <Download size={14} /> PDF
                </a>
              </div>
            ))}
          </div>
        </section>
        <p className="text-center text-sm text-stone-500">Need help with a booking? <Link to="/support" className="text-emerald-700 font-bold underline">Contact support</Link></p>
      </div>
    </div>
  );
};

export default MyBookingsPage;
