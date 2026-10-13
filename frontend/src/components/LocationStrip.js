import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { MapPin, ChevronDown, Loader2, Search, X, Navigation as NavIcon, Truck, Star, Sparkles, Quote, CheckCircle2, Clock, Stethoscope } from 'lucide-react';
import { getSavedLocation, saveLocation, detectLocation, LOCATION_EVENT } from '../utils/userLocation';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STORAGE_KEY = 'cg_delivery_location';
const PROMPTED_KEY = 'cg_delivery_prompted_v1';

const loadStored = getSavedLocation;
const save = saveLocation;

/**
 * LocationStrip — sits directly below the fixed header, matching the reference
 *   screenshot: "Delivering to <Area>, <City>  |  Delivery available 30-45 mins  |  Change"
 * Auto-prompts the user to pick a location the first time they scroll on the page
 * (so we don't nag on landing, but still capture intent before checkout).
 */
export default function LocationStrip() {
  const [loc, setLoc] = useState(loadStored());
  const [open, setOpen] = useState(false);
  const scrollFiredRef = useRef(false);

  // Cross-component sync — if location updated elsewhere, re-hydrate.
  useEffect(() => {
    const onStorage = (e) => { if (!e.key || e.key === STORAGE_KEY) setLoc(loadStored()); };
    const onLocal = () => setLoc(loadStored());
    window.addEventListener('storage', onStorage);
    window.addEventListener(LOCATION_EVENT, onLocal);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(LOCATION_EVENT, onLocal); };
  }, []);

  // Auto-prompt: on the first scroll ever (per browser), if no location + not
  // yet prompted, pop the modal so we capture delivery area early.
  useEffect(() => {
    if (loc) return;                              // already have location
    if (localStorage.getItem(PROMPTED_KEY)) return; // already prompted once
    const onScroll = () => {
      if (scrollFiredRef.current) return;
      if (window.scrollY < 40) return;            // ignore stray micro-scrolls
      scrollFiredRef.current = true;
      try { localStorage.setItem(PROMPTED_KEY, '1'); } catch (_) { /* noop */ }
      setOpen(true);
      window.removeEventListener('scroll', onScroll);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loc]);

  const detect = async () => {
    try { const info = await detectLocation(); setLoc(info); setTimeout(() => setOpen(false), 700); return true; }
    catch (_) { return false; }
  };

  const primary = loc ? (loc.locality || loc.city || 'Set location') : 'Select delivery location';
  const secondary = loc ? [loc.district && loc.district !== loc.locality ? loc.district : null, loc.city && loc.city !== loc.locality ? loc.city : null].filter(Boolean).join(', ') : '';

  return (
    <>
      <div
        className="bg-white border-b border-gray-100 px-4 py-2 lg:px-6"
        data-testid="location-strip"
      >
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          {/* Left: address */}
          <button
            onClick={() => setOpen(true)}
            className="flex-1 min-w-0 flex items-center gap-2 text-left"
            data-testid="location-strip-open"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
              <MapPin size={16} className="text-emerald-700" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] tracking-wider text-gray-500 font-semibold uppercase">Delivering to</p>
              <p className="text-sm font-bold text-gray-900 truncate flex items-center gap-1">
                <span className="truncate">{primary}{secondary ? `, ${secondary}` : ''}</span>
                <ChevronDown size={14} className="text-gray-500 shrink-0" />
              </p>
            </div>
          </button>
          {/* Middle: delivery ETA (hidden on very small screens) */}
          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-gray-100 shrink-0">
            <Truck size={16} className="text-emerald-700" />
            <div className="leading-tight">
              <p className="text-[10px] tracking-wider text-gray-500 font-semibold uppercase">Delivery available</p>
              <p className="text-sm font-bold text-emerald-700">30–45 mins</p>
            </div>
          </div>
          {/* Right: change link */}
          <button
            onClick={() => setOpen(true)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-sm shrink-0"
            data-testid="location-strip-change"
          >
            Change
          </button>
        </div>
      </div>
      {open && (
        <LocationModal
          onClose={() => setOpen(false)}
          onDetect={detect}
          onSelect={(l) => { save(l); setLoc(l); setOpen(false); }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Rotating slogan + review carousel — shown inside the LocationModal so the
// user has something engaging to look at while we detect / search location.
// Content is baked in on purpose (fast, no API round-trip while modal loads).
// ---------------------------------------------------------------------------
const AD_SLIDES = [
  {
    kind: 'slogan',
    body: 'Celesta Glow products loved by 50,000+ customers',
    sub: 'Clinical-grade anti-aging • cruelty-free • dermatologist tested',
  },
  {
    kind: 'review',
    body: 'Fine lines faded in 3 weeks. Skin honestly looks a decade younger.',
    author: 'Priya · verified buyer',
    stars: 5,
    tag: 'Anti-Aging Serum',
  },
  {
    kind: 'review',
    body: 'Order landed in 45 mins. Genuinely quicker than my food delivery!',
    author: 'Aditi · Bengaluru',
    stars: 5,
    tag: 'Delivery',
  },
  {
    kind: 'review',
    body: 'Rich formula, no sticky finish. My Retinol night routine is set.',
    author: 'Rekha · Mumbai',
    stars: 5,
    tag: 'Age Reset Cream',
  },
  {
    kind: 'review',
    body: 'Packaging is premium and the ingredients list is finally transparent.',
    author: 'Sameera · Kochi',
    stars: 5,
    tag: 'Quality',
  },
];

function AdCarousel() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % AD_SLIDES.length), 3500);
    return () => clearInterval(t);
  }, []);
  const s = AD_SLIDES[i];
  return (
    <div className="mt-1 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-amber-50/40 border border-emerald-100" data-testid="location-modal-ads">
      <div key={i} className="p-4 min-h-[110px] flex flex-col justify-center animate-[fadeIn_.5s_ease-out]">
        {s.kind === 'slogan' ? (
          <div className="flex items-start gap-2">
            <Sparkles size={16} className="text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-[13px] font-black text-emerald-900 leading-snug">{s.body}</p>
              <p className="text-[11px] text-emerald-700/80 mt-1">{s.sub}</p>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-1 mb-1">
              {Array.from({ length: s.stars }).map((_, k) => <Star key={k} size={11} className="fill-amber-400 text-amber-400" />)}
              <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700">{s.tag}</span>
            </div>
            <div className="flex items-start gap-2">
              <Quote size={14} className="text-emerald-300 mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] italic text-gray-800 leading-snug">&ldquo;{s.body}&rdquo;</p>
                <p className="text-[11px] text-gray-500 mt-1">— {s.author}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-1 justify-center pb-2">
        {AD_SLIDES.map((_, k) => (
          <span key={k} className={`h-1 rounded-full transition-all ${k === i ? 'w-4 bg-emerald-600' : 'w-1.5 bg-emerald-200'}`} />
        ))}
      </div>
      <style>{`@keyframes fadeIn { from { opacity:0; transform: translateY(4px);} to { opacity:1; transform:translateY(0);} }`}</style>
    </div>
  );
}

const QUICK_AREAS = ['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Kochi'];

function LocationModal({ onClose, onDetect, onSelect }) {
  const [q, setQ] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [gps, setGps] = useState('idle');

  useEffect(() => {
    if (!q || q.length < 3) { setPredictions([]); return undefined; }
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await axios.get(`${API}/geo/autocomplete`, { params: { q } });
        setPredictions(r.data?.predictions || []);
      } catch (_) { setPredictions([]); }
      finally { setBusy(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const pick = async (p) => {
    setBusy(true);
    try {
      const r = await axios.get(`${API}/geo/place-details`, { params: { place_id: p.place_id } });
      if (r.data && r.data.lat) onSelect(r.data);
    } catch (_) { /* keep modal open */ }
    finally { setBusy(false); }
  };

  const useGps = async () => {
    setGps('busy');
    setGps((await onDetect()) ? 'done' : 'denied');
  };

  return (
    <div className="fixed inset-0 z-[60] bg-stone-950/60 backdrop-blur-sm flex items-end sm:items-start justify-center sm:p-8" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden animate-[slideUp_.35s_ease-out]" onClick={(e) => e.stopPropagation()} data-testid="location-modal">
        <div className="relative bg-emerald-800 text-white px-6 pt-6 pb-8 overflow-hidden">
          <span className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-emerald-600/40" />
          <span className="absolute right-10 -bottom-12 w-28 h-28 rounded-full bg-amber-300/20" />
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20" data-testid="location-modal-close"><X size={16} /></button>
          <p className="text-[10px] font-black tracking-[0.3em] uppercase text-amber-300">One tap. Everything near you.</p>
          <h3 className="relative text-2xl font-extrabold mt-1">Where should we glow?</h3>
          <div className="relative flex gap-3 mt-4 text-[11px] text-emerald-100">
            <span className="flex items-center gap-1"><Truck size={12} /> 30–45 min delivery</span>
            <span className="flex items-center gap-1"><Stethoscope size={12} /> Doctors nearby</span>
          </div>
        </div>
        <div className="p-5 -mt-4 bg-white rounded-t-3xl relative space-y-3">
          <button onClick={useGps} disabled={gps === 'busy'}
            className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-colors ${gps === 'done' ? 'border-emerald-500 bg-emerald-50' : 'border-emerald-100 hover:border-emerald-400 bg-white'}`}
            data-testid="detect-location-btn">
            <span className="relative w-11 h-11 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0">
              {gps === 'busy' ? <Loader2 size={18} className="animate-spin" /> : gps === 'done' ? <CheckCircle2 size={18} /> : <NavIcon size={18} />}
              {gps === 'idle' && <span className="absolute inset-0 rounded-full bg-emerald-500/40 animate-ping" />}
            </span>
            <span>
              <span className="block text-sm font-extrabold text-stone-900">{gps === 'done' ? 'Location saved' : gps === 'busy' ? 'Locating you…' : 'Use my current location'}</span>
              <span className="block text-[11px] text-stone-500">{gps === 'denied' ? 'Permission blocked — search your area below' : 'Most accurate • saved for every page'}</span>
            </span>
          </button>
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search area, landmark or pincode"
              className="w-full pl-10 pr-3 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
              data-testid="location-search-input" />
          </div>
          {!q && (
            <div className="flex flex-wrap gap-1.5" data-testid="quick-areas">
              {QUICK_AREAS.map((c) => (
                <button key={c} onClick={() => setQ(c)} className="text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-full px-3 py-1.5 transition-colors">{c}</button>
              ))}
            </div>
          )}
          {busy && <div className="text-center text-stone-400"><Loader2 size={16} className="animate-spin inline" /></div>}
          {predictions.length > 0 && (
            <div className="max-h-60 overflow-y-auto space-y-1 border border-stone-100 rounded-2xl p-1" data-testid="location-predictions">
              {predictions.map((p) => (
                <button key={p.place_id} onClick={() => pick(p)} className="w-full flex gap-2.5 text-left px-3 py-2.5 rounded-xl hover:bg-emerald-50 text-sm">
                  <MapPin size={15} className="text-emerald-600 mt-0.5 shrink-0" />
                  <span><span className="block font-semibold text-stone-900 text-sm">{p.main_text || p.description}</span>
                  <span className="block text-xs text-stone-500">{p.secondary_text}</span></span>
                </button>
              ))}
            </div>
          )}
          <AdCarousel />
          <p className="text-[10px] text-stone-400 text-center flex items-center justify-center gap-1"><Clock size={10} /> We remember this — change it anytime from the top bar.</p>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>
    </div>
  );
}
