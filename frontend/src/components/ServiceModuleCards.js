import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Stethoscope, Sparkles } from 'lucide-react';
import { mp } from '../utils/mpApi';

const SquareTile = ({ to, title, image, testid }) => (
  <Link to={to} data-testid={testid}
    className="group relative aspect-square rounded-2xl overflow-hidden border border-stone-100 bg-emerald-50 block">
    {image
      ? <img src={image} alt={title} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
      : <span className="absolute inset-0 flex items-center justify-center text-emerald-200"><Stethoscope size={40} strokeWidth={1.2} /></span>}
    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-emerald-950/80 via-emerald-950/30 to-transparent px-2 pb-2 pt-6">
      <span className="block text-white text-[10px] sm:text-xs font-bold leading-tight text-center drop-shadow">{title}</span>
    </span>
  </Link>
);

const ModuleSection = ({ module, title, subtitle, base, cats }) => (
  <section className="max-w-7xl mx-auto px-3 sm:px-6 pt-8 sm:pt-10" data-testid={`module-section-${module}`}>
    <div className="flex items-end justify-between mb-3 sm:mb-4 px-1 sm:px-0">
      <div>
        <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.35em] uppercase text-emerald-700 mb-1 flex items-center gap-2">
          {module === 'doctor' ? <Stethoscope size={12} /> : <Sparkles size={12} />} {subtitle}
        </p>
        <h2 className="text-xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">{title}</h2>
      </div>
      <Link to={base} data-testid={`module-viewall-${module}`}
        className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-emerald-700 hover:text-emerald-800">
        View all <ArrowRight size={14} />
      </Link>
    </div>
    <div className="grid grid-cols-4 gap-2 sm:gap-4" data-testid={`module-grid-${module}`}>
      {cats.slice(0, 8).map((c) => {
        const isAll = c.title === 'View All' || c.title === 'View All Services';
        return (
          <SquareTile key={c.cat_id}
            to={isAll ? base : `${base}?cat=${encodeURIComponent(c.title)}`}
            title={c.title} image={c.image}
            testid={`module-tile-${module}-${c.cat_id}`} />
        );
      })}
    </div>
  </section>
);

const ServiceModuleCards = () => {
  const [cfg, setCfg] = useState(null);
  const [doctorCats, setDoctorCats] = useState([]);
  const [serviceCats, setServiceCats] = useState([]);

  useEffect(() => {
    mp.get('/config').then((r) => setCfg(r.data)).catch(() => setCfg({ dermatologist_enabled: false, home_services_enabled: false }));
    mp.get('/categories', { params: { module: 'doctor' } }).then((r) => setDoctorCats(r.data)).catch(() => {});
    mp.get('/categories', { params: { module: 'service' } }).then((r) => setServiceCats(r.data)).catch(() => {});
  }, []);

  if (!cfg || (!cfg.dermatologist_enabled && !cfg.home_services_enabled)) return null;

  return (
    <div data-testid="service-modules-section">
      {cfg.dermatologist_enabled && doctorCats.length > 0 && (
        <ModuleSection module="doctor" title="Consult a Dermatologist" subtitle="Verified specialists online"
          base="/doctors" cats={doctorCats} />
      )}
      {cfg.home_services_enabled && serviceCats.length > 0 && (
        <ModuleSection module="service" title="Home Beauty & Wellness" subtitle="Professional care at home"
          base="/services" cats={serviceCats} />
      )}
    </div>
  );
};

export default ServiceModuleCards;
