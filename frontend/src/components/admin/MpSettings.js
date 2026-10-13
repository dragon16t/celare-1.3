import React, { useEffect, useState } from 'react';
import { ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { mp, adminHdr } from '../../utils/mpApi';

const MpSettings = ({ module }) => {
  const [cfg, setCfg] = useState(null);
  const key = module === 'doctor' ? 'dermatologist_enabled' : 'home_services_enabled';
  const load = () => mp.get('/admin/config', adminHdr()).then((r) => setCfg(r.data)).catch(() => {});
  useEffect(load, []);

  if (!cfg) return <div className="text-stone-400 text-sm p-4">Loading…</div>;

  const save = async (patch) => {
    try { await mp.put('/admin/config', patch, adminHdr()); toast.success('Saved'); load(); }
    catch { toast.error('Save failed'); }
  };

  return (
    <div className="space-y-4" data-testid={`settings-${module}`}>
      <div className="bg-white rounded-2xl border border-stone-200 p-5 flex items-center justify-between">
        <div>
          <p className="font-bold text-stone-900">{module === 'doctor' ? 'Dermatologist Consultation' : 'Home Beauty & Wellness'} module</p>
          <p className="text-xs text-stone-500">{cfg[key] ? 'Live — customers can browse and book' : 'Off — homepage section hidden, new bookings blocked, records preserved'}</p>
        </div>
        <button onClick={() => save({ [key]: !cfg[key] })} data-testid="module-switch" className={cfg[key] ? 'text-emerald-600' : 'text-stone-300'}>
          {cfg[key] ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <p className="font-bold text-stone-900 text-sm mb-3">Money settings (one-click adjust)</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-xs font-bold text-stone-600 uppercase">Platform commission % (consultations)
            <div className="flex gap-2 mt-1">
              <input type="number" step="0.5" min="0" max="60" defaultValue={cfg.platform_commission_pct} id="comm-input"
                className="rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm w-28" />
              <button onClick={() => save({ platform_commission_pct: Number(document.getElementById('comm-input').value) })}
                data-testid="save-commission" className="bg-emerald-700 text-white text-xs font-bold rounded-full px-4">Save</button>
            </div>
          </label>
          <label className="text-xs font-bold text-stone-600 uppercase">Customer platform fee % (home services)
            <div className="flex gap-2 mt-1">
              <input type="number" step="0.5" min="0" max="40" defaultValue={cfg.customer_fee_pct} id="fee-input"
                className="rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm w-28" />
              <button onClick={() => save({ customer_fee_pct: Number(document.getElementById('fee-input').value) })}
                data-testid="save-fee" className="bg-emerald-700 text-white text-xs font-bold rounded-full px-4">Save</button>
            </div>
            <span className="block text-[11px] text-stone-400 mt-1 font-normal normal-case">Added on top of the listed price at checkout; booked to the platform wallet as "Celesta commission". Partners always receive their full listed price.</span>
          </label>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <p className="font-bold text-stone-900 text-sm">Integrations</p>
        <p className="text-xs text-stone-500 mt-1">Payments (Razorpay): <b className={cfg.payments_configured ? 'text-emerald-700' : 'text-amber-700'}>{cfg.payments_configured ? 'Configured' : 'NOT configured'}</b></p>
        <p className="text-xs text-stone-500 mt-1">AI photo processing: <b className={cfg.ai_photo_configured ? 'text-emerald-700' : 'text-amber-700'}>{cfg.ai_photo_configured ? 'Configured' : 'NOT configured'}</b></p>
        <p className="text-xs text-stone-500 mt-1">Online now: <b className="text-emerald-700">{cfg.online_doctors ?? 0} doctor(s) • {cfg.online_partners ?? 0} partner(s)</b></p>
      </div>
    </div>
  );
};

export default MpSettings;
