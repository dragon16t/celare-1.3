import React, { useEffect, useRef, useState } from 'react';
import { Wallet, Inbox, CalendarDays, Sparkles, Bell, Navigation, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { mp, partnerHdr, statusColor, fmtStatus } from '../../utils/mpApi';
import { MpLogin } from './DoctorPortalPage';
import PresenceToggle from '../../components/mp/PresenceToggle';

const input = 'w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm';
const tabBtn = (active) => `px-4 py-2.5 rounded-full text-xs font-extrabold whitespace-nowrap ${active ? 'bg-emerald-700 text-white' : 'bg-white border border-stone-200 text-stone-600'}`;

const PartnerPortalPage = () => {
  const [me, setMe] = useState(null);
  const [err, setErr] = useState(false);
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [otpMap, setOtpMap] = useState({});
  const watchRef = useRef(null);
  const prevReqCount = useRef(0);
  useEffect(() => {
    if (requests.length > prevReqCount.current) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 880; g.gain.setValueAtTime(0.15, ctx.currentTime);
        o.start(); o.stop(ctx.currentTime + 0.6);
      } catch { /* blocked until gesture */ }
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Celesta Glow — new booking request', { body: 'First to accept gets the booking.' });
      }
    }
    prevReqCount.current = requests.length;
  }, [requests]);
  useEffect(() => { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }, []);


  const loadAll = () => {
    mp.get('/partner/requests', partnerHdr()).then((r) => setRequests(r.data)).catch(() => {});
    mp.get('/partner/bookings', partnerHdr()).then((r) => setBookings(r.data)).catch(() => {});
    mp.get('/partner/services', partnerHdr()).then((r) => setServices(r.data)).catch(() => {});
    mp.get('/partner/wallet', partnerHdr()).then((r) => setWallet(r.data)).catch(() => {});
    mp.get('/partner/notifications', partnerHdr()).then((r) => setNotifs(r.data)).catch(() => {});
  };
  const loadMe = () => mp.get('/auth/me', partnerHdr()).then((r) => { setMe(r.data); setErr(false); loadAll(); }).catch(() => setErr(true));
  useEffect(() => { loadMe(); const t = setInterval(loadAll, 15000); return () => clearInterval(t); /* eslint-disable-next-line */ }, []);

  const stopWatch = () => { if (watchRef.current != null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; } };
  useEffect(() => stopWatch, []);

  if (err) return <div className="px-4 py-10 bg-stone-50 min-h-screen"><MpLogin role="partner" onLogin={loadMe} /></div>;
  if (!me) return <div className="py-24 text-center text-stone-400">Loading…</div>;
  const profile = me.profile || {};

  const act = async (bid, action, body = {}) => {
    try { const r = await mp.post(`/partner/bookings/${bid}/${action}`, body, partnerHdr()); toast.success('Done'); loadAll(); return r.data; }
    catch (e) { toast.error(e.response?.data?.detail || 'Action failed'); throw e; }
  };
  const respond = async (bid, action) => {
    try { await mp.post(`/partner/requests/${bid}/${action}`, {}, partnerHdr()); toast.success(action === 'accept' ? 'Booking assigned to you!' : 'Declined'); loadAll(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Action failed'); }
  };
  const confirmArrival = async (bid) => {
    const send = (coords, force) => act(bid, 'arrived', { ...coords, force });
    if (!navigator.geolocation) { await send({}, true); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try { await send({ lat: pos.coords.latitude, lng: pos.coords.longitude }, false); }
        catch (e) {
          if (window.confirm(`${e.response?.data?.detail || 'Location mismatch'}\n\nConfirm arrival anyway?`)) await send({}, true);
        }
      },
      async () => { if (window.confirm('Location unavailable. Confirm arrival anyway?')) await send({}, true); },
      { enableHighAccuracy: true, timeout: 10000 });
  };

  const startJourney = async (bid) => {
    await act(bid, 'start-journey');
    if (navigator.geolocation) {
      stopWatch();
      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => mp.post(`/partner/bookings/${bid}/location`, { lat: pos.coords.latitude, lng: pos.coords.longitude }, partnerHdr()).catch(() => {}),
        () => toast.error('Location permission is required for live tracking'),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
      toast.success('Live location sharing started');
    }
  };
  const togglePause = async () => {
    try { await mp.put('/partner/profile', { paused: !profile.paused }, partnerHdr()); loadMe(); }
    catch { toast.error('Failed'); }
  };
  const withdraw = async () => {
    const amt = Number(prompt('Amount to withdraw (₹):'));
    if (!amt) return;
    try { await mp.post('/partner/withdraw', { amount: amt }, partnerHdr()); toast.success('Withdrawal requested'); loadAll(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };
  const requestService = async (sid) => {
    try { await mp.post('/partner/services/request', { service_id: sid }, partnerHdr()); toast.success('Requested — pending admin approval'); loadAll(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const active = bookings.filter((b) => ['assigned', 'en_route', 'arrived', 'in_service', 'completion_pending'].includes(b.status));

  return (
    <div className="bg-stone-50 min-h-screen" data-testid="partner-portal">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-extrabold text-stone-900">{profile.applicant?.business_name || me.name}</h1>
          <button onClick={() => { localStorage.removeItem('mp_partner_token'); setErr(true); }} className="text-xs text-stone-400 underline">Log out</button>
        </div>
        <p className="text-xs text-stone-500 mb-4">{me.ref_id} • {fmtStatus(profile.application_status)}
          {profile.paused && <span className="ml-2 text-amber-700 font-bold">• paused</span>}</p>
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <PresenceToggle role="partner" />
          <button onClick={togglePause} data-testid="pause-toggle"
            className={`text-xs font-bold rounded-full px-4 py-2 border ${profile.paused ? 'border-emerald-600 text-emerald-700' : 'border-amber-500 text-amber-700'}`}>
            {profile.paused ? 'Resume receiving bookings' : 'Pause my availability'}
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6" data-testid="partner-tabs">
          {[['requests', `New Requests${requests.length ? ` (${requests.length})` : ''}`, Inbox], ['active', 'Active', Navigation],
            ['bookings', 'All Bookings', CalendarDays], ['services', 'Services', Sparkles], ['wallet', 'Wallet', Wallet], ['notifications', 'Notifications', Bell]].map(([k, label, Icon]) => (
            <button key={k} data-testid={`tab-${k}`} onClick={() => setTab(k)} className={tabBtn(tab === k)}><span className="flex items-center gap-1.5"><Icon size={13} />{label}</span></button>
          ))}
        </div>

        {tab === 'requests' && (
          <div className="space-y-3" data-testid="partner-requests">
            {requests.length === 0 && <p className="text-sm text-stone-400 text-center py-10">No pending requests. New bookings appear here in real time.</p>}
            {requests.map((o) => (
              <div key={o.booking_id} className="bg-white rounded-2xl border border-amber-200 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-stone-900">{o.booking?.service_name}</p>
                    <p className="text-xs text-stone-500">{o.booking_id} • {o.booking?.date} • {o.booking?.slot} • {o.booking?.customer?.area || o.booking?.customer?.city || o.booking?.customer?.pincode}</p>
                    <p className="text-xs text-emerald-700 font-bold mt-1">Expected earnings: ₹{o.expected_earnings}</p>
                    <p className="text-[10px] text-amber-600">Respond by {new Date(o.expires_at).toLocaleTimeString('en-IN')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => respond(o.booking_id, 'accept')} data-testid={`accept-${o.booking_id}`} className="bg-emerald-700 text-white text-xs font-bold rounded-full px-5 py-2.5">Accept</button>
                    <button onClick={() => respond(o.booking_id, 'decline')} data-testid={`decline-${o.booking_id}`} className="border border-stone-300 text-xs font-bold rounded-full px-5 py-2.5">Decline</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'active' && (
          <div className="space-y-3" data-testid="partner-active">
            {active.length === 0 && <p className="text-sm text-stone-400 text-center py-10">No active bookings.</p>}
            {active.map((b) => (
              <div key={b.booking_id} className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-stone-900">{b.service_name}</p>
                    <p className="text-xs text-stone-500">{b.booking_id} • {b.date} • {b.slot}</p>
                    <p className="text-xs text-stone-600 mt-1 flex items-start gap-1"><MapPin size={12} className="mt-0.5 shrink-0" /> {b.customer?.address}{b.customer?.pincode ? `, ${b.customer.pincode}` : ''}</p>
                    <p className="text-xs text-stone-500 mt-1">{b.customer?.name} • {b.customer?.phone}</p>
                  </div>
                  <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${statusColor(b.status)}`}>{fmtStatus(b.status)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {b.customer?.lat && (
                    <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${b.customer.lat},${b.customer.lng}`}
                      className="border border-stone-300 text-xs font-bold rounded-full px-4 py-2 inline-flex items-center gap-1"><Navigation size={12} /> Navigate</a>
                  )}
                  {b.status === 'assigned' && <button onClick={() => startJourney(b.booking_id)} data-testid={`journey-${b.booking_id}`} className="bg-sky-600 text-white text-xs font-bold rounded-full px-4 py-2">Start journey (live tracking)</button>}
                  {b.status === 'en_route' && <button onClick={() => confirmArrival(b.booking_id)} data-testid={`arrived-${b.booking_id}`} className="bg-sky-600 text-white text-xs font-bold rounded-full px-4 py-2">Arrived at location</button>}
                  {['arrived', 'en_route', 'assigned'].includes(b.status) && <button onClick={() => { stopWatch(); act(b.booking_id, 'start-service'); }} data-testid={`start-service-${b.booking_id}`} className="bg-indigo-600 text-white text-xs font-bold rounded-full px-4 py-2">Start service</button>}
                  {b.status === 'in_service' && <button onClick={() => act(b.booking_id, 'request-completion')} data-testid={`complete-${b.booking_id}`} className="bg-violet-600 text-white text-xs font-bold rounded-full px-4 py-2">Complete — email OTP to customer</button>}
                  {b.payment_method === 'pay_after_service' && ['in_service', 'completion_pending'].includes(b.status) && b.payment_status !== 'paid_cash' && (
                    <button onClick={() => act(b.booking_id, 'cash-collected')} data-testid={`cash-${b.booking_id}`} className="bg-emerald-700 text-white text-xs font-bold rounded-full px-4 py-2">Cash collected (₹{b.total_amount || b.price})</button>
                  )}
                  {b.status === 'completion_pending' && (
                    <span className="flex items-center gap-2">
                      <input placeholder="Customer OTP" value={otpMap[b.booking_id] || ''} data-testid={`potp-${b.booking_id}`}
                        onChange={(e) => setOtpMap({ ...otpMap, [b.booking_id]: e.target.value })}
                        className="w-32 rounded-full border border-stone-300 px-3 py-1.5 text-xs text-center" />
                      <button onClick={() => act(b.booking_id, 'verify', { otp: otpMap[b.booking_id] || '' })} data-testid={`pverify-${b.booking_id}`} className="bg-emerald-700 text-white text-xs font-bold rounded-full px-4 py-2">Verify & finish</button>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'bookings' && (
          <div className="space-y-3" data-testid="partner-all-bookings">
            {bookings.length === 0 && <p className="text-sm text-stone-400 text-center py-10">No bookings yet.</p>}
            {bookings.map((b) => (
              <div key={b.booking_id} className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-stone-900 text-sm">{b.service_name}</p>
                  <p className="text-xs text-stone-500">{b.booking_id} • {b.date} • ₹{b.price}</p>
                </div>
                <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${statusColor(b.status)}`}>{fmtStatus(b.status)}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'services' && services && (
          <div className="space-y-5" data-testid="partner-services">
            <div className="bg-white rounded-2xl border border-stone-200 p-5">
              <p className="font-bold text-stone-800 text-sm mb-3">My services</p>
              {services.mine.length === 0 && <p className="text-xs text-stone-400">None approved yet.</p>}
              {services.mine.map((s) => (
                <div key={s.service_id} className="flex justify-between items-center text-xs py-2 border-b border-stone-50 last:border-0">
                  <span className="text-stone-700 font-semibold">{s.service_name} <span className="text-stone-400">• ₹{s.price} • {s.mode}</span></span>
                  <span className={`font-bold rounded-full px-2 py-0.5 ${statusColor(s.approval_status)}`}>{s.approval_status}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-stone-200 p-5">
              <p className="font-bold text-stone-800 text-sm mb-3">Add from catalogue</p>
              {services.catalogue.filter((c) => !services.mine.find((m) => m.service_id === c.service_id)).map((c) => (
                <div key={c.service_id} className="flex justify-between items-center text-xs py-2 border-b border-stone-50 last:border-0">
                  <span className="text-stone-700">{c.name} <span className="text-stone-400">• ₹{c.price}{c.price_range?.max ? ` (₹${c.price_range.min}–${c.price_range.max})` : ''}</span></span>
                  <button onClick={() => requestService(c.service_id)} data-testid={`req-svc-${c.service_id}`} className="text-emerald-700 font-bold underline">Request</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'wallet' && wallet && (
          <div className="space-y-4" data-testid="partner-wallet">
            <div className="bg-gradient-to-br from-emerald-700 to-teal-800 text-white rounded-3xl p-6">
              <p className="text-xs uppercase tracking-widest opacity-80">Available balance</p>
              <p className="text-4xl font-extrabold mt-1">₹{wallet.balance.toFixed(2)}</p>
              <button onClick={withdraw} data-testid="partner-withdraw" className="mt-4 bg-white text-emerald-900 text-xs font-extrabold rounded-full px-5 py-2.5">Request withdrawal</button>
            </div>
            <div className="bg-white rounded-2xl border border-stone-200 p-4">
              <p className="font-bold text-stone-800 text-sm mb-2">Ledger</p>
              {wallet.ledger.length === 0 && <p className="text-xs text-stone-400">Earnings appear here after OTP-verified completions.</p>}
              {wallet.ledger.map((l) => (
                <div key={l.entry_id} className="flex justify-between text-xs py-2 border-b border-stone-50 last:border-0">
                  <span className="text-stone-600">{l.ref}{l.booking_id ? ` • ${l.booking_id}` : ''}<span className="block text-[10px] text-stone-400">{new Date(l.at).toLocaleString('en-IN')}</span></span>
                  <span className={`font-extrabold ${l.type === 'credit' ? 'text-emerald-700' : 'text-rose-600'}`}>{l.type === 'credit' ? '+' : '−'}₹{l.amount}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-stone-200 p-4">
              <p className="font-bold text-stone-800 text-sm mb-2">Withdrawals</p>
              {wallet.withdrawals.length === 0 && <p className="text-xs text-stone-400">None yet.</p>}
              {wallet.withdrawals.map((w) => (
                <div key={w.withdrawal_id} className="flex justify-between text-xs py-2 border-b border-stone-50 last:border-0">
                  <span className="text-stone-600">{w.withdrawal_id}</span>
                  <span className="font-bold">₹{w.amount} <span className={`ml-1 ${statusColor(w.status)} rounded-full px-2 py-0.5`}>{w.status}</span></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'notifications' && (
          <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-50" data-testid="partner-notifs">
            {notifs.length === 0 && <p className="text-xs text-stone-400 p-4">No notifications.</p>}
            {notifs.map((n) => (
              <div key={n.notif_id} className="p-4">
                <p className="text-sm font-bold text-stone-800">{n.title}</p>
                <p className="text-xs text-stone-500">{n.body}</p>
                <p className="text-[10px] text-stone-300 mt-1">{new Date(n.at).toLocaleString('en-IN')}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PartnerPortalPage;
