import React, { useEffect, useState } from 'react';
import { Plus, ImagePlus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { mp, partnerHdr, statusColor, fmtStatus } from '../../utils/mpApi';
import EarningHint from './EarningHint';

const inp = 'rounded-xl border border-stone-200 px-3 py-2 text-xs';

const MyServiceRow = ({ s, onSaved }) => {
  const [price, setPrice] = useState(s.price);
  const save = async () => {
    try { await mp.put(`/partner/services/${s.service_id}/price`, { price: Number(price) }, partnerHdr()); toast.success('Price updated'); onSaved(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };
  return (
    <div className="py-2.5 border-b border-stone-50 last:border-0" data-testid={`my-svc-${s.service_id}`}>
      <div className="flex flex-wrap justify-between items-center gap-2 text-xs">
        <span className="text-stone-800 font-semibold">{s.service_name}{s.custom && <span className="ml-1 text-[10px] text-violet-700">• custom</span>}</span>
        <span className="flex items-center gap-2">
          ₹<input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={`${inp} w-24`} data-testid={`my-svc-price-${s.service_id}`} />
          <button onClick={save} className="text-emerald-700" aria-label="Save price" data-testid={`my-svc-save-${s.service_id}`}><Save size={15} /></button>
          <span className={`font-bold rounded-full px-2 py-0.5 ${statusColor(s.approval_status)}`}>{fmtStatus(s.approval_status)}</span>
        </span>
      </div>
      <EarningHint price={price} />
    </div>
  );
};

const CatalogueRow = ({ c, onDone }) => {
  const [price, setPrice] = useState(c.price);
  const add = async () => {
    try { await mp.post('/partner/services/request', { service_id: c.service_id, price: Number(price) }, partnerHdr()); toast.success('Added — awaiting approval'); onDone(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };
  return (
    <div className="flex flex-wrap justify-between items-center gap-2 text-xs py-2 border-b border-stone-50 last:border-0">
      <span className="text-stone-700">{c.name}</span>
      <span className="flex items-center gap-2">₹<input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={`${inp} w-24`} data-testid={`cat-price-${c.service_id}`} />
        <button onClick={add} data-testid={`req-svc-${c.service_id}`} className="bg-emerald-700 text-white font-bold rounded-full px-3 py-1.5">Add</button></span>
    </div>
  );
};

const CustomForm = ({ onDone }) => {
  const [cats, setCats] = useState([]);
  const [f, setF] = useState({ name: '', category_id: '', short_desc: '', duration_min: 60, price: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { mp.get('/categories', { params: { module: 'service' } }).then((r) => setCats(r.data)).catch(() => {}); }, []);
  const submit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Add a photo of the service');
    setBusy(true);
    try {
      const r = await mp.post('/partner/services/custom', { ...f, price: Number(f.price), duration_min: Number(f.duration_min) }, partnerHdr());
      const fd = new FormData(); fd.append('file', file);
      await mp.post(`/partner/services/${r.data.service_id}/image`, fd, partnerHdr());
      toast.success('Sent for admin approval');
      setF({ name: '', category_id: '', short_desc: '', duration_min: 60, price: '' }); setFile(null); onDone();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="grid sm:grid-cols-2 gap-2" data-testid="custom-service-form">
      <input required placeholder="Service name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inp} data-testid="custom-name" />
      <select value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })} className={inp} data-testid="custom-category">
        <option value="">Category</option>
        {cats.filter((c) => !c.title.startsWith('View All')).map((c) => <option key={c.cat_id} value={c.cat_id}>{c.title}</option>)}
      </select>
      <input required type="number" placeholder="Your price ₹" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} className={inp} data-testid="custom-price" />
      <input type="number" placeholder="Duration (min)" value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: e.target.value })} className={inp} />
      <textarea placeholder="What is included?" value={f.short_desc} onChange={(e) => setF({ ...f, short_desc: e.target.value })} className={`${inp} sm:col-span-2`} rows={2} data-testid="custom-desc" />
      <label className="sm:col-span-2 flex items-center gap-2 text-xs font-bold text-emerald-800 border border-dashed border-emerald-300 rounded-xl px-3 py-2.5 cursor-pointer">
        <ImagePlus size={15} /> {file ? file.name : 'Add service photo'}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files[0])} data-testid="custom-image" />
      </label>
      <div className="sm:col-span-2"><EarningHint price={f.price} /></div>
      <button disabled={busy} className="sm:col-span-2 bg-emerald-700 text-white text-xs font-extrabold rounded-full py-2.5 disabled:opacity-50" data-testid="custom-submit">{busy ? 'Submitting…' : 'Submit for approval'}</button>
    </form>
  );
};

export default function PartnerServicesPanel({ services, reload }) {
  const [showCustom, setShowCustom] = useState(false);
  const mineIds = new Set(services.mine.map((m) => m.service_id));
  return (
    <div className="space-y-5" data-testid="partner-services">
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <p className="font-bold text-stone-800 text-sm mb-1">My services & prices</p>
        <p className="text-[11px] text-stone-400 mb-2">You set the price. Celesta keeps {services.commission_pct}% commission.</p>
        {services.mine.length === 0 && <p className="text-xs text-stone-400">Add a service below to start.</p>}
        {services.mine.map((s) => <MyServiceRow key={s.service_id} s={s} onSaved={reload} />)}
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-stone-800 text-sm">Create your own service</p>
          <button onClick={() => setShowCustom(!showCustom)} data-testid="toggle-custom-form" className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><Plus size={14} /> {showCustom ? 'Close' : 'New service'}</button>
        </div>
        {showCustom && <CustomForm onDone={() => { setShowCustom(false); reload(); }} />}
        {(services.custom || []).map((c) => (
          <div key={c.service_id} className="flex justify-between items-center text-xs py-2 border-b border-stone-50 last:border-0 gap-2">
            <span className="flex items-center gap-2 text-stone-700">{c.thumbnail && <img src={c.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover" />}{c.name}</span>
            <span className={`font-bold rounded-full px-2 py-0.5 ${statusColor(c.status === 'active' ? 'approved' : c.status)}`}>{c.status === 'active' ? 'live' : fmtStatus(c.status)}</span>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <p className="font-bold text-stone-800 text-sm mb-3">Add from Celesta catalogue</p>
        {services.catalogue.filter((c) => !mineIds.has(c.service_id)).map((c) => <CatalogueRow key={c.service_id} c={c} onDone={reload} />)}
      </div>
    </div>
  );
}
