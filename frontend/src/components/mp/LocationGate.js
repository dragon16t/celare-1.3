import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, Loader2, ShieldCheck, Search } from 'lucide-react';
import { getSavedLocation, detectLocation, LOCATION_EVENT } from '../../utils/userLocation';

// Returns the shared saved location and keeps it in sync with the header picker.
export function useSharedLocation() {
  const [loc, setLoc] = useState(getSavedLocation());
  useEffect(() => {
    const on = () => setLoc(getSavedLocation());
    window.addEventListener(LOCATION_EVENT, on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener(LOCATION_EVENT, on); window.removeEventListener('storage', on); };
  }, []);
  return loc && loc.lat != null ? loc : null;
}

export default function LocationGate({ title, subtitle }) {
  const [state, setState] = useState('idle');
  const go = async () => {
    setState('busy');
    try { await detectLocation(); setState('done'); } catch (_) { setState('denied'); }
  };
  const openPicker = () => document.querySelector('[data-testid="location-strip-change"]')?.click();
  return (
    <div className="relative max-w-md mx-auto overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-b from-emerald-50 to-white p-8 text-center" data-testid="location-gate">
      <div className="relative mx-auto w-28 h-28 mb-5">
        <span className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
        <span className="absolute inset-3 rounded-full bg-emerald-400/25 animate-pulse" />
        <span className="absolute inset-7 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-xl shadow-emerald-700/30">
          <MapPin size={26} />
        </span>
      </div>
      <h2 className="text-xl font-extrabold text-stone-900">{title}</h2>
      <p className="text-sm text-stone-500 mt-2">{subtitle}</p>
      <button onClick={go} disabled={state === 'busy'} data-testid="enable-location-btn"
        className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-full px-8 py-3.5 text-sm transition-transform active:scale-95">
        {state === 'busy' ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
        {state === 'busy' ? 'Finding you…' : 'Use my current location'}
      </button>
      <button onClick={openPicker} data-testid="search-location-btn"
        className="mt-3 w-full inline-flex items-center justify-center gap-2 border border-emerald-200 text-emerald-800 font-bold rounded-full px-8 py-3 text-sm hover:bg-emerald-50">
        <Search size={15} /> Search my area instead
      </button>
      {state === 'denied' && <p className="text-xs text-rose-600 mt-3" data-testid="location-denied">Location is blocked — search your area instead.</p>}
      <p className="text-[11px] text-stone-400 mt-4 flex items-center justify-center gap-1"><ShieldCheck size={12} /> Saved once, used everywhere. Change anytime from the top bar.</p>
    </div>
  );
}
