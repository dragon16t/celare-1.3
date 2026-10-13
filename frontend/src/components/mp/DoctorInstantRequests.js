import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { toast } from 'sonner';
import { mp, doctorHdr } from '../../utils/mpApi';

const DoctorInstantRequests = () => {
  const [offers, setOffers] = useState([]);
  const [now, setNow] = useState(Date.now());
  const navigate = useNavigate();

  const prevCount = React.useRef(0);
  const ring = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.setValueAtTime(0.15, ctx.currentTime);
      o.start(); o.stop(ctx.currentTime + 0.6);
    } catch { /* audio blocked until user gesture */ }
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Celesta Glow — instant consultation request', { body: 'A patient is waiting. Accept to connect.' });
    }
  };
  useEffect(() => { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }, []);
  const load = () => mp.get('/doctor/requests', doctorHdr()).then((r) => {
    if (r.data.length > prevCount.current) ring();
    prevCount.current = r.data.length;
    setOffers(r.data);
  }).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(() => { load(); setNow(Date.now()); }, 8000);
    return () => clearInterval(t);
  }, []);

  if (!offers.length) return null;

  const respond = async (bid, action) => {
    try {
      await mp.post(`/doctor/requests/${bid}/${action}`, {}, doctorHdr());
      if (action === 'accept') { toast.success('Consultation assigned to you'); navigate(`/consult-room/${bid}`); }
      else toast.success('Declined');
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Action failed'); load(); }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6" data-testid="doctor-instant-requests">
      <p className="font-extrabold text-amber-900 text-sm flex items-center gap-1.5 mb-3"><Zap size={15} /> Instant consultation requests</p>
      <div className="space-y-2">
        {offers.map((o) => {
          const secs = Math.max(0, Math.round((new Date(o.expires_at).getTime() - now) / 1000));
          return (
            <div key={o.booking_id} className="bg-white rounded-xl border border-amber-100 p-3.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-stone-900 text-sm">{o.booking?.customer?.name}</p>
                <p className="text-xs text-stone-500">{o.booking_id} • earn ₹{o.expected_earnings}</p>
                <p className="text-[10px] text-amber-600 font-bold">Expires in {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => respond(o.booking_id, 'accept')} data-testid={`instant-accept-${o.booking_id}`}
                  className="bg-emerald-700 text-white text-xs font-bold rounded-full px-4 py-2">Accept & join</button>
                <button onClick={() => respond(o.booking_id, 'decline')} data-testid={`instant-decline-${o.booking_id}`}
                  className="border border-stone-300 text-xs font-bold rounded-full px-4 py-2">Decline</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DoctorInstantRequests;
