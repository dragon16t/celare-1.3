import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BadgeCheck, Video, Languages, ArrowRight, Zap, MapPin, MapPinOff } from 'lucide-react';
import { mp } from '../../utils/mpApi';
import InstantConsultModal from '../../components/mp/InstantConsultModal';
import SEOHead from '../../components/SEOHead';

export const CircleCategories = ({ module, active, onSelect }) => {
  const [cats, setCats] = useState([]);
  useEffect(() => {
    mp.get('/categories', { params: { module } }).then((r) => setCats(r.data)).catch(() => {});
  }, [module]);
  if (!cats.length) return null;
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-3xl mx-auto" data-testid={`circle-cats-${module}`}>
      {cats.slice(0, 8).map((c) => {
        const isAll = c.title === 'View All' || c.title === 'View All Services';
        const isActive = !isAll && active === c.title;
        return (
          <button key={c.cat_id} data-testid={`cat-${c.cat_id}`}
            onClick={() => onSelect(isAll ? '' : c.title)}
            className={`group relative aspect-square rounded-2xl overflow-hidden border-2 transition-all ${isActive ? 'border-emerald-600 ring-4 ring-emerald-100' : 'border-transparent hover:border-emerald-300'}`}>
            {c.image
              ? <img src={c.image} alt={c.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              : <span className="absolute inset-0 bg-emerald-50 flex items-center justify-center text-emerald-700 font-extrabold text-2xl">{c.title[0]}</span>}
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-emerald-950/80 via-emerald-950/25 to-transparent px-1.5 pb-1.5 pt-5">
              <span className="block text-white text-[9px] sm:text-[11px] font-bold leading-tight text-center drop-shadow">{c.title}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

const DoctorsPage = () => {
  const [searchParams] = useSearchParams();
  const [doctors, setDoctors] = useState([]);
  const [cat, setCat] = useState(searchParams.get('cat') || '');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [showInstant, setShowInstant] = useState(false);
  const [loc, setLoc] = useState(null);
  const [locState, setLocState] = useState('ask'); // ask | granted | denied

  useEffect(() => {
    mp.get('/config').then((r) => { setEnabled(r.data.dermatologist_enabled); setOnlineCount(r.data.online_doctors || 0); }).catch(() => {});
  }, []);

  const askLocation = () => {
    if (!navigator.geolocation) { setLocState('denied'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocState('granted'); },
      () => setLocState('denied'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  };

  useEffect(() => {
    if (locState !== 'granted' || !loc) return;
    setLoading(true);
    mp.get('/doctors', { params: { ...(cat ? { category: cat } : {}), lat: loc.lat, lng: loc.lng } })
      .then((r) => setDoctors(r.data)).catch(() => setDoctors([])).finally(() => setLoading(false));
  }, [cat, loc, locState]);

  if (!enabled) return (
    <div className="max-w-xl mx-auto px-6 py-24 text-center" data-testid="doctors-disabled">
      <h1 className="text-2xl font-extrabold text-stone-900">Dermatologist consultations are temporarily unavailable</h1>
      <p className="text-stone-500 mt-2">Please check back soon or contact support.</p>
    </div>
  );

  return (
    <div className="bg-white min-h-screen" data-testid="doctors-page">
      <SEOHead title="Consult a Dermatologist Online" canonicalPath="/doctors"
        description="Book verified dermatologists near you for secure video consultations with digital prescriptions — instant and scheduled appointments on Celesta Glow." />
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-8">
          <p className="text-xs font-bold tracking-[0.2em] text-emerald-700 uppercase">Verified specialists</p>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-stone-900 mt-2">Consult a Dermatologist</h1>
          <p className="text-stone-500 mt-3 max-w-xl mx-auto text-sm sm:text-base">Video consultations with registered dermatologists near you. Digital prescriptions delivered to your account.</p>
        </div>

        {locState !== 'granted' ? (
          <div className="max-w-md mx-auto bg-emerald-50/60 border border-emerald-100 rounded-3xl p-8 text-center" data-testid="location-gate">
            {locState === 'ask' ? (
              <>
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-700 text-white flex items-center justify-center mb-4"><MapPin size={24} /></div>
                <h2 className="text-lg font-extrabold text-stone-900">Enable location to continue</h2>
                <p className="text-sm text-stone-500 mt-2">We show dermatologists available near your location. Allow location access to see doctors, fees and instant availability.</p>
                <button onClick={askLocation} data-testid="enable-location-btn"
                  className="mt-5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-full px-8 py-3.5 text-sm">Share my location</button>
              </>
            ) : (
              <>
                <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-100 text-rose-500 flex items-center justify-center mb-4"><MapPinOff size={24} /></div>
                <h2 className="text-lg font-extrabold text-stone-900">Location permission is off</h2>
                <p className="text-sm text-stone-500 mt-2">Dermatologist discovery works only with location access. Please enable it in your browser settings and try again.</p>
                <button onClick={askLocation} data-testid="retry-location-btn"
                  className="mt-5 border border-emerald-700 text-emerald-800 font-extrabold rounded-full px-8 py-3 text-sm">Try again</button>
              </>
            )}
          </div>
        ) : (
          <>
            <CircleCategories module="doctor" active={cat} onSelect={setCat} />
            <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3.5 py-2" data-testid="online-doctors-count">
                <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>
                {onlineCount} online now
              </span>
              <button onClick={() => setShowInstant(true)} disabled={onlineCount === 0} data-testid="consult-now-btn"
                className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-xs font-extrabold rounded-full px-5 py-2.5">
                <Zap size={13} /> Consult now — instant
              </button>
            </div>
            {showInstant && <InstantConsultModal onClose={() => setShowInstant(false)} />}

            <div className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5" data-testid="doctor-list">
              {loading && <p className="col-span-full text-center text-stone-400 py-16">Finding dermatologists near you…</p>}
              {!loading && doctors.length === 0 && (
                <div className="col-span-full text-center py-16" data-testid="no-doctors-nearby">
                  <p className="text-5xl mb-3">😔</p>
                  <p className="text-lg font-extrabold text-stone-800">Sorry, we're not available at your location yet</p>
                  <p className="text-sm text-stone-500 mt-1">We're expanding fast — we'll be available soon!</p>
                </div>
              )}
              {doctors.map((d) => (
                <Link to={`/doctors/${d.doctor_id}`} key={d.doctor_id} data-testid={`doctor-card-${d.doctor_id}`}
                  className="group bg-white rounded-3xl border border-stone-200 p-3 sm:p-5 hover:border-emerald-400 hover:shadow-xl transition-all flex flex-col">
                  <div className="relative rounded-2xl overflow-hidden bg-stone-50 border border-stone-100 aspect-[3/4]">
                    {d.photo
                      ? <img src={d.photo} alt={d.name} className="w-full h-full object-cover object-top" />
                      : <div className="w-full h-full flex items-center justify-center text-emerald-700 text-4xl font-extrabold">{(d.name || 'D')[0]}</div>}
                    {d.online && (
                      <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[9px] font-extrabold text-white bg-emerald-600 rounded-full px-2 py-1" data-testid={`online-${d.doctor_id}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-white" /> ONLINE
                      </span>
                    )}
                    {d.distance_km != null && (
                      <span className="absolute bottom-2 right-2 text-[9px] font-bold text-stone-700 bg-white/90 rounded-full px-2 py-0.5">{d.distance_km} km</span>
                    )}
                  </div>
                  <div className="mt-3 flex-1">
                    <p className="font-extrabold text-stone-900 text-sm sm:text-base flex items-center gap-1.5 flex-wrap">
                      Dr. {d.name} <BadgeCheck size={15} className="text-emerald-600 shrink-0" data-testid="verified-badge" />
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(d.qualification || '').split(',').filter(Boolean).map((q) => (
                        <span key={q} className="text-[9px] sm:text-[10px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5" data-testid="qual-badge">{q.trim()}</span>
                      ))}
                    </div>
                    <p className="text-[11px] text-stone-500 mt-1.5">{d.experience_years ? `${d.experience_years}+ yrs experience` : ''}{d.languages?.length ? ` • ${d.languages.slice(0, 2).join(', ')}` : ''}</p>
                    <p className="text-[11px] text-stone-400 flex items-center gap-1 mt-0.5"><Video size={11} /> Video consultation</p>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-base sm:text-lg font-extrabold text-emerald-800">₹{d.fee}</p>
                    <span className="inline-flex items-center gap-1 bg-emerald-700 text-white text-[11px] sm:text-xs font-bold rounded-full px-3 sm:px-4 py-2 group-hover:bg-emerald-800">
                      Book <ArrowRight size={13} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-12 max-w-2xl mx-auto bg-gradient-to-br from-emerald-700 to-teal-800 rounded-3xl p-6 sm:p-8 text-white text-center" data-testid="doctor-join-section">
              <h2 className="text-xl font-extrabold">Are you a dermatologist?</h2>
              <p className="text-sm text-emerald-100 mt-1">Join Celesta Glow — set your own fees, consult from anywhere, get paid weekly.</p>
              <Link to="/pro" data-testid="apply-as-doctor-link" className="inline-block mt-4 bg-white text-emerald-900 font-extrabold rounded-full px-6 py-3 text-sm">Join as a Dermatologist</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DoctorsPage;
