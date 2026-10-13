import React, { useEffect, useState } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { mp, adminHdr } from '../../utils/mpApi';

const input = 'rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm';

const AdminMarketplace = () => {
  const [cfg, setCfg] = useState(null);
  const [cats, setCats] = useState([]);
  const [newCat, setNewCat] = useState({ module: 'doctor', title: '', order: 0 });
  const [module, setModule] = useState('doctor');

  const load = () => {
    mp.get('/admin/config', adminHdr()).then((r) => setCfg(r.data)).catch((e) => toast.error(e.response?.data?.detail || 'Auth failed'));
    mp.get('/admin/categories', { ...adminHdr() }).then((r) => setCats(r.data)).catch(() => {});
  };
  useEffect(load, []);

  if (!cfg) return <div className="p-8 text-stone-400">Loading…</div>;

  const toggle = async (key) => {
    try { await mp.put('/admin/config', { [key]: !cfg[key] }, adminHdr()); load(); toast.success('Updated'); }
    catch { toast.error('Failed'); }
  };
  const addCat = async () => {
    if (!newCat.title) return;
    try { await mp.post('/admin/categories', { ...newCat, order: Number(newCat.order) || 0 }, adminHdr()); setNewCat({ ...newCat, title: '' }); load(); toast.success('Category added'); }
    catch { toast.error('Failed'); }
  };
  const toggleCat = async (c) => {
    await mp.put(`/admin/categories/${c.cat_id}`, { ...c, active: !c.active }, adminHdr()); load();
  };
  const delCat = async (c) => {
    if (!window.confirm(`Delete category "${c.title}"?`)) return;
    await mp.delete(`/admin/categories/${c.cat_id}`, adminHdr()); load();
  };
  const uploadCatImage = async (c, file) => {
    const fd = new FormData(); fd.append('file', file);
    try { await mp.post(`/admin/categories/${c.cat_id}/image`, fd, adminHdr()); toast.success('Image updated'); load(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Upload failed'); }
  };

  const shown = cats.filter((c) => c.module === module);

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto" data-testid="admin-marketplace">
      <h1 className="text-2xl font-extrabold text-stone-900">Marketplace Modules</h1>
      <p className="text-sm text-stone-500 mt-1">Independent switches for the two service modules. Turning one off hides its homepage section and blocks new bookings — existing records are preserved.</p>
      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        {[['dermatologist_enabled', 'Dermatologist Consultation'], ['home_services_enabled', 'Home Beauty & Wellness']].map(([key, label]) => (
          <div key={key} className="bg-white rounded-2xl border border-stone-200 p-5 flex items-center justify-between" data-testid={`toggle-${key}`}>
            <div>
              <p className="font-bold text-stone-900">{label}</p>
              <p className="text-xs text-stone-500">{cfg[key] ? 'Live — customers can browse and book' : 'Off — hidden from customers'}</p>
            </div>
            <button onClick={() => toggle(key)} data-testid={`switch-${key}`} className={cfg[key] ? 'text-emerald-600' : 'text-stone-300'}>
              {cfg[key] ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
            </button>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 p-5 mt-4">
        <p className="font-bold text-stone-900 text-sm">Platform status</p>
        <p className="text-xs text-stone-500 mt-1">Payments (Razorpay): <b className={cfg.payments_configured ? 'text-emerald-700' : 'text-amber-700'}>{cfg.payments_configured ? 'Configured' : 'NOT configured — bookings are created as pending payment'}</b></p>
        <p className="text-xs text-stone-500 mt-1">AI photo processing: <b className={cfg.ai_photo_configured ? 'text-emerald-700' : 'text-amber-700'}>{cfg.ai_photo_configured ? 'Configured' : 'NOT configured'}</b></p>
        <p className="text-xs text-stone-500 mt-1">Online now: <b className="text-emerald-700">{cfg.online_doctors ?? 0} dermatologist(s) • {cfg.online_partners ?? 0} partner(s)</b></p>
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 p-5 mt-4" data-testid="admin-categories">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="font-bold text-stone-900 text-sm">Discovery categories</p>
            <p className="text-[11px] text-stone-400">These appear as square tiles on the homepage and discovery pages. Upload an image for each.</p>
          </div>
          <div className="flex gap-2">
            {[['doctor', 'Dermatologist'], ['service', 'Home services']].map(([m, label]) => (
              <button key={m} onClick={() => setModule(m)} data-testid={`catmod-${m}`}
                className={`text-xs font-bold rounded-full px-4 py-2 ${module === m ? 'bg-emerald-700 text-white' : 'border border-stone-200'}`}>{label}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <input placeholder="New category title" value={newCat.title} data-testid="new-cat-title"
            onChange={(e) => setNewCat({ ...newCat, title: e.target.value, module })} className={`${input} flex-1`} />
          <input placeholder="Order" type="number" value={newCat.order} onChange={(e) => setNewCat({ ...newCat, order: e.target.value })} className={`${input} w-20`} />
          <button onClick={addCat} data-testid="add-cat" className="bg-emerald-700 text-white text-xs font-bold rounded-full px-4 inline-flex items-center gap-1"><Plus size={14} /> Add</button>
        </div>
        <div className="mt-4 divide-y divide-stone-50">
          {shown.map((c) => (
            <div key={c.cat_id} className="py-3 flex items-center gap-3" data-testid={`cat-row-${c.cat_id}`}>
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-emerald-50 border border-stone-100 shrink-0">
                {c.image ? <img src={c.image} alt={c.title} className="w-full h-full object-cover" />
                  : <span className="w-full h-full flex items-center justify-center text-emerald-700 font-extrabold">{c.title[0]}</span>}
              </div>
              <span className={`flex-1 text-sm ${c.active ? 'text-stone-800 font-semibold' : 'text-stone-400 line-through'}`}>{c.order}. {c.title}</span>
              <label className="border border-stone-300 text-xs font-bold rounded-full px-3 py-1.5 cursor-pointer inline-flex items-center gap-1 shrink-0" data-testid={`cat-img-${c.cat_id}`}>
                <ImagePlus size={13} /> Image
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && uploadCatImage(c, e.target.files[0])} />
              </label>
              <button onClick={() => toggleCat(c)} data-testid={`cat-toggle-${c.cat_id}`} className="text-xs text-emerald-700 font-bold shrink-0">{c.active ? 'Disable' : 'Enable'}</button>
              <button onClick={() => delCat(c)} data-testid={`cat-del-${c.cat_id}`} className="text-rose-500 shrink-0"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminMarketplace;
