import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { mp, doctorHdr, partnerHdr } from '../../utils/mpApi';

const PresenceToggle = ({ role }) => {
  const hdr = role === 'doctor' ? doctorHdr : partnerHdr;
  const [online, setOnline] = useState(false);
  const timer = useRef(null);

  const setPresence = async (on) => {
    try {
      await mp.post(`/${role}/presence`, { online: on }, hdr());
      setOnline(on);
      toast.success(on ? 'You are online — instant requests enabled' : 'You are offline');
    } catch (e) { toast.error(e.response?.data?.detail || 'Could not update presence'); }
  };

  useEffect(() => {
    mp.get(`/${role}/profile`, hdr()).then((p) => setOnline(!!p.data.online)).catch(() => {});
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!online) return undefined;
    timer.current = setInterval(() => {
      mp.post(`/${role}/presence`, { online: true }, hdr()).catch(() => {});
    }, 60000);
    const off = () => { mp.post(`/${role}/presence`, { online: false }, hdr()).catch(() => {}); };
    window.addEventListener('beforeunload', off);
    return () => { clearInterval(timer.current); window.removeEventListener('beforeunload', off); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  return (
    <button onClick={() => setPresence(!online)} data-testid="presence-toggle"
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-extrabold border transition-colors ${online ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-stone-300 text-stone-500'}`}>
      <span className={`relative flex h-2.5 w-2.5`}>
        {online && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${online ? 'bg-white' : 'bg-stone-300'}`} />
      </span>
      {online ? 'Online — receiving instant requests' : 'Go online for instant bookings'}
    </button>
  );
};

export default PresenceToggle;
