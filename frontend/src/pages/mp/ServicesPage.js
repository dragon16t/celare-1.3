import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Clock, Home, ArrowRight } from 'lucide-react';
import { mp } from '../../utils/mpApi';
import SEOHead from '../../components/SEOHead';
import { CircleCategories } from './DoctorsPage';

const ServicesPage = () => {
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState([]);
  const [cat, setCat] = useState(searchParams.get('cat') || '');
  const [cats, setCats] = useState([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mp.get('/config').then((r) => setEnabled(r.data.home_services_enabled)).catch(() => {});
    mp.get('/categories', { params: { module: 'service' } }).then((r) => setCats(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    setLoading(true);
    const catObj = cats.find((c) => c.title === cat);
    mp.get('/services', { params: catObj ? { category_id: catObj.cat_id } : {} })
      .then((r) => setServices(r.data)).catch(() => setServices([])).finally(() => setLoading(false));
  }, [cat, cats]);

  if (!enabled) return (
    <div className="max-w-xl mx-auto px-6 py-24 text-center" data-testid="services-disabled">
      <h1 className="text-2xl font-extrabold text-stone-900">Home services are temporarily unavailable</h1>
      <p className="text-stone-500 mt-2">Please check back soon or contact support.</p>
    </div>
  );

  return (
    <div className="bg-white min-h-screen" data-testid="services-page">
      <SEOHead title="Home Beauty & Wellness Services" canonicalPath="/services"
        description="Book verified beauty and wellness professionals at home — facials, hair spa, colouring and more with live partner tracking on Celesta Glow." />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-8">
          <p className="text-xs font-bold tracking-[0.2em] text-emerald-700 uppercase">At your doorstep</p>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-stone-900 mt-2">Home Beauty & Wellness</h1>
          <p className="text-stone-500 mt-3 max-w-xl mx-auto text-sm sm:text-base">Verified professionals, transparent pricing, live tracking while your expert is on the way.</p>
        </div>
        <CircleCategories module="service" active={cat} onSelect={setCat} />
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="service-list">
          {loading && <p className="col-span-full text-center text-stone-400 py-16">Loading services…</p>}
          {!loading && services.length === 0 && (
            <div className="col-span-full text-center py-16" data-testid="no-services-nearby">
              <p className="text-5xl mb-3">😔</p>
              <p className="text-lg font-extrabold text-stone-800">Sorry, we're not available at your location yet</p>
              <p className="text-sm text-stone-500 mt-1">We're expanding fast — we'll be available soon!</p>
            </div>
          )}
          {services.map((s) => (
            <Link to={`/services/${s.service_id}`} key={s.service_id} data-testid={`service-card-${s.service_id}`}
              className="group bg-white rounded-3xl border border-stone-200 overflow-hidden hover:border-emerald-400 hover:shadow-xl transition-all">
              <div className="aspect-[4/3] bg-stone-50 overflow-hidden">
                {(s.thumbnail || s.images?.[0])
                  ? <img src={s.thumbnail || s.images[0]} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  : <div className="w-full h-full flex items-center justify-center text-emerald-200"><Home size={48} /></div>}
              </div>
              <div className="p-5">
                <p className="text-[10px] font-bold tracking-wider text-emerald-700 uppercase">{s.category_title}</p>
                <h3 className="font-extrabold text-stone-900 mt-1 leading-snug">{s.name}</h3>
                <p className="text-xs text-stone-500 mt-1.5 line-clamp-2">{s.short_desc}</p>
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <p className="text-lg font-extrabold text-emerald-800">₹{s.from_price || s.price}</p>
                    <p className="text-[11px] text-stone-400 flex items-center gap-1"><Clock size={11} /> {s.duration_min} min{s.partner_count ? ` • ${s.partner_count} partner${s.partner_count > 1 ? 's' : ''}` : ''}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 bg-emerald-700 text-white text-xs font-bold rounded-full px-3.5 py-2">Book <ArrowRight size={13} /></span>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <p className="text-center mt-10 text-sm text-stone-500">
          Beauty professional? <Link to="/pro" className="text-emerald-700 font-bold underline">Join as a service partner</Link>
        </p>
      </div>
    </div>
  );
};

export default ServicesPage;
