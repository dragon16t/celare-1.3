import React, { useEffect, useState } from 'react';
import { ToggleLeft, ToggleRight, Percent } from 'lucide-react';
import { toast } from 'sonner';
import { mp, adminHdr } from '../../utils/mpApi';

const FIELDS = [
  ['platform_commission_pct', 'Commission cut from provider %', 'Deducted from the price doctors / partners set.'],
  ['customer_fee_pct', 'Customer markup %', 'Added on top and baked into the price customers see (never shown as a fee).'],
  ['display_markup_pct', 'Display MRP uplift %', 'Struck-through "MRP" shown above the selling price to create the discount.'],
];

const Preview = ({ p }) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-xs" data-testid="pricing-preview">
    {[['Provider lists', p.base], ['Customer pays', p.price], ['Shown MRP', `${p.mrp} (${p.discount_pct}% off)`], ['Provider earns', p.provider_earning]].map(([k, v]) => (
      <div key={k} className="bg-stone-50 rounded-xl p-2.5"><p className="text-stone-400 font-bold uppercase text-[10px]">{k}</p><p className="font-extrabold text-stone-800">₹{v}</p></div>
    ))}
    <div className="col-span-2 sm:col-span-4 bg-emerald-50 rounded-xl p-2.5 text-emerald-800 font-bold">Platform earns ₹{p.platform_earning} per ₹{p.base} booking</div>
  </div>
);

const MpSettings = ({ module }) => {
  const [cfg, setCfg] = useState(null);
  const [draft, setDraft] = useState({});
  const [preview, setPreview] = useState(null);
  const key = module === 'doctor' ? 'dermatologist_enabled' : 'home_services_enabled';
  const load = () => {
    mp.get('/admin/config', adminHdr()).then((r) => { setCfg(r.data); setDraft({}); }).catch(() => {});
    mp.get('/admin/pricing-preview', { ...adminHdr(), params: { base: 1000 } }).then((r) => setPreview(r.data)).catch(() => {});
  };
  useEffect(load, []);

  if (!cfg) return <div className="text-stone-400 text-sm p-4">Loading…</div>;

  const save = async (patch) => {
    try { await mp.put('/admin/config', patch, adminHdr()); toast.success('Saved — applies to all doctors & partners'); load(); }
    catch { toast.error('Save failed'); }
  };

  return (
    <div className="space-y-4" data-testid={`settings-${module}`}>
      <div className="bg-white rounded-2xl border border-stone-200 p-5 flex items-center justify-between">
        <div>
          <p className="font-bold text-stone-900">{module === 'doctor' ? 'Dermatologist Consultation' : 'Home Beauty & Wellness'} module</p>
          <p className="text-xs text-stone-500">{cfg[key] ? 'Live — customers can browse and book' : 'Off — hidden, new bookings blocked'}</p>
        </div>
        <button onClick={() => save({ [key]: !cfg[key] })} data-testid="module-switch" className={cfg[key] ? 'text-emerald-600' : 'text-stone-300'}>
          {cfg[key] ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 p-5" data-testid="pricing-settings">
        <p className="font-bold text-stone-900 text-sm mb-1 flex items-center gap-1.5"><Percent size={15} /> Universal pricing & commission</p>
        <p className="text-[11px] text-stone-400 mb-3">Applies to every doctor and service partner. Platform earnings adjust automatically.</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {FIELDS.map(([k, label, hint]) => (
            <label key={k} className="text-xs font-bold text-stone-600 uppercase">{label}
              <input type="number" step="0.5" min="0" max="90" value={draft[k] ?? cfg[k] ?? ''} data-testid={`input-${k}`}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm" />
              <span className="block text-[10px] text-stone-400 mt-1 font-normal normal-case">{hint}</span>
            </label>
          ))}
        </div>
        <button onClick={() => save(Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Number(v)])))} disabled={!Object.keys(draft).length}
          data-testid="save-pricing" className="mt-4 bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-full px-5 py-2.5">Save percentages</button>
        {preview && <Preview p={preview} />}
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <p className="font-bold text-stone-900 text-sm">Integrations</p>
        <p className="text-xs text-stone-500 mt-1">Payments (Razorpay): <b className={cfg.payments_configured ? 'text-emerald-700' : 'text-amber-700'}>{cfg.payments_configured ? 'Configured' : 'NOT configured'}</b></p>
        <p className="text-xs text-stone-500 mt-1">AI photo processing: <b className={cfg.ai_photo_configured ? 'text-emerald-700' : 'text-amber-700'}>{cfg.ai_photo_configured ? 'Configured' : 'NOT configured'}</b></p>
      </div>
    </div>
  );
};

export default MpSettings;
