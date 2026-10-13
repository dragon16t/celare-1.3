import React, { useEffect, useState } from 'react';
import { Plus, ImagePlus, Star, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { mp, adminHdr, statusColor } from '../../utils/mpApi';

const input = 'w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm';
const empty = { name: '', category_title: '', category_id: '', short_desc: '', full_desc: '', includes: '', excludes: '',
  duration_min: 60, mode: 'home', price: 0, price_min: 0, price_max: 0, commission_pct: 20, tax_pct: 18,
  offer_eligible: true, cancellation_policy: '', prep: '', aftercare: '', warnings: '', patch_test: false, status: 'draft' };

const AdminServices = () => {
  const [services, setServices] = useState([]);
  const [cats, setCats] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = () => {
    mp.get('/admin/services', adminHdr()).then((r) => setServices(r.data)).catch(() => {});
    mp.get('/admin/categories', { ...adminHdr(), params: { module: 'service' } }).then((r) => setCats(r.data)).catch(() => {});
  };
  useEffect(load, []);

  const openNew = () => { setForm(empty); setEditing({ service_id: null }); };
  const openEdit = (s) => {
    setForm({ ...empty, ...s, includes: (s.includes || []).join('\n'), excludes: (s.excludes || []).join('\n'),
      price_min: s.price_range?.min || 0, price_max: s.price_range?.max || 0 });
    setEditing(s);
  };
  const save = async (publish = false) => {
    const payload = { ...form, includes: form.includes.split('\n').map((s) => s.trim()).filter(Boolean),
      excludes: form.excludes.split('\n').map((s) => s.trim()).filter(Boolean),
      duration_min: Number(form.duration_min), price: Number(form.price),
      commission_pct: Number(form.commission_pct), tax_pct: Number(form.tax_pct),
      price_range: { min: Number(form.price_min), max: Number(form.price_max) },
      status: publish ? 'active' : form.status };
    delete payload.price_min; delete payload.price_max;
    delete payload.images; delete payload.thumbnail; delete payload.service_id; delete payload.created_at; delete payload.updated_at;
    try {
      let sid = editing?.service_id;
      if (sid) await mp.put(`/admin/services/${sid}`, payload, adminHdr());
      else { const r = await mp.post('/admin/services', payload, adminHdr()); sid = r.data.service_id; }
      if (publish) await mp.post(`/admin/services/${sid}/status`, { status: 'active' }, adminHdr()).catch((e) => toast.error(e.response?.data?.detail));
      toast.success('Saved'); setEditing(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Save failed'); }
  };
  const setStatus = async (sid, status) => {
    try { await mp.post(`/admin/services/${sid}/status`, { status }, adminHdr()); toast.success(`Marked ${status}`); load(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };
  const uploadImg = async (sid, file) => {
    const fd = new FormData(); fd.append('file', file);
    try { await mp.post(`/admin/services/${sid}/images`, fd, adminHdr()); toast.success('Image added'); load(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Upload failed'); }
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto" data-testid="admin-services">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">Service Catalogue</h1>
          <p className="text-sm text-stone-500">Admin-controlled services. Partners can only offer services from this catalogue.</p>
        </div>
        <button onClick={openNew} data-testid="new-service" className="bg-emerald-700 text-white text-xs font-bold rounded-full px-5 py-2.5 inline-flex items-center gap-1"><Plus size={14} /> Create service</button>
      </div>
      <div className="mt-6 grid gap-4" data-testid="services-table">
        {services.map((s) => (
          <div key={s.service_id} className="bg-white rounded-2xl border border-stone-200 p-4 flex flex-wrap gap-4 items-center" data-testid={`svc-row-${s.service_id}`}>
            <div className="w-20 h-20 rounded-xl bg-stone-50 overflow-hidden shrink-0">
              {(s.thumbnail || s.images?.[0]) && <img src={s.thumbnail || s.images[0]} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="font-bold text-stone-900">{s.name}</p>
              <p className="text-xs text-stone-500">{s.service_id} • {s.category_title} • ₹{s.price} • {s.duration_min} min • {s.mode}</p>
              <span className={`inline-block mt-1 text-[11px] font-bold rounded-full px-2.5 py-0.5 ${statusColor(s.status)}`}>{s.status}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="border border-stone-300 text-xs font-bold rounded-full px-3.5 py-2 cursor-pointer inline-flex items-center gap-1" data-testid={`img-upload-${s.service_id}`}>
                <ImagePlus size={13} /> Image
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && uploadImg(s.service_id, e.target.files[0])} />
              </label>
              <button onClick={() => openEdit(s)} data-testid={`edit-${s.service_id}`} className="border border-stone-300 text-xs font-bold rounded-full px-3.5 py-2">Edit</button>
              {s.status !== 'active' && <button onClick={() => setStatus(s.service_id, 'active')} data-testid={`publish-${s.service_id}`} className="bg-emerald-700 text-white text-xs font-bold rounded-full px-3.5 py-2">Publish</button>}
              {s.status === 'active' && <button onClick={() => setStatus(s.service_id, 'inactive')} className="bg-amber-500 text-white text-xs font-bold rounded-full px-3.5 py-2">Disable</button>}
              {s.status !== 'archived' && <button onClick={() => setStatus(s.service_id, 'archived')} className="bg-stone-200 text-stone-600 text-xs font-bold rounded-full px-3.5 py-2">Archive</button>}
            </div>
          </div>
        ))}
        {services.length === 0 && <p className="text-sm text-stone-400 text-center py-10">No services yet — create the first one.</p>}
      </div>
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8 px-4" data-testid="service-editor">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-stone-900">{editing.service_id ? `Edit ${editing.name}` : 'Create service'}</h2>
              <button onClick={() => setEditing(null)}><X size={20} className="text-stone-400" /></button>
            </div>
            <input placeholder="Service name" data-testid="sf-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.category_id} onChange={(e) => { const c = cats.find((x) => x.cat_id === e.target.value); setForm({ ...form, category_id: e.target.value, category_title: c?.title || '' }); }} className={input}>
                <option value="">Category…</option>
                {cats.map((c) => <option key={c.cat_id} value={c.cat_id}>{c.title}</option>)}
              </select>
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className={input}>
                <option value="home">Home service</option><option value="instore">In-store</option><option value="both">Both</option>
              </select>
            </div>
            <textarea placeholder="Short description" rows={2} value={form.short_desc} onChange={(e) => setForm({ ...form, short_desc: e.target.value })} className={input} />
            <textarea placeholder="Full description (approved claims only — no guaranteed outcomes)" rows={3} value={form.full_desc} onChange={(e) => setForm({ ...form, full_desc: e.target.value })} className={input} />
            <textarea placeholder="What's included (one per line)" rows={2} value={form.includes} onChange={(e) => setForm({ ...form, includes: e.target.value })} className={input} />
            <textarea placeholder="What's excluded (one per line)" rows={2} value={form.excludes} onChange={(e) => setForm({ ...form, excludes: e.target.value })} className={input} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="text-[11px] font-bold text-stone-500">Price ₹<input type="number" data-testid="sf-price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={`${input} mt-1`} /></label>
              <label className="text-[11px] font-bold text-stone-500">Min ₹<input type="number" value={form.price_min} onChange={(e) => setForm({ ...form, price_min: e.target.value })} className={`${input} mt-1`} /></label>
              <label className="text-[11px] font-bold text-stone-500">Max ₹<input type="number" value={form.price_max} onChange={(e) => setForm({ ...form, price_max: e.target.value })} className={`${input} mt-1`} /></label>
              <label className="text-[11px] font-bold text-stone-500">Duration min<input type="number" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} className={`${input} mt-1`} /></label>
              <label className="text-[11px] font-bold text-stone-500">Commission %<input type="number" value={form.commission_pct} onChange={(e) => setForm({ ...form, commission_pct: e.target.value })} className={`${input} mt-1`} /></label>
              <label className="text-[11px] font-bold text-stone-500">Tax %<input type="number" value={form.tax_pct} onChange={(e) => setForm({ ...form, tax_pct: e.target.value })} className={`${input} mt-1`} /></label>
              <label className="text-[11px] font-bold text-stone-500 flex items-center gap-2 pt-4"><input type="checkbox" checked={form.patch_test} onChange={(e) => setForm({ ...form, patch_test: e.target.checked })} className="accent-emerald-700" /> Patch test</label>
              <label className="text-[11px] font-bold text-stone-500 flex items-center gap-2 pt-4"><input type="checkbox" checked={form.offer_eligible} onChange={(e) => setForm({ ...form, offer_eligible: e.target.checked })} className="accent-emerald-700" /> Offer eligible</label>
            </div>
            <textarea placeholder="Customer preparation instructions" rows={2} value={form.prep} onChange={(e) => setForm({ ...form, prep: e.target.value })} className={input} />
            <textarea placeholder="Aftercare instructions" rows={2} value={form.aftercare} onChange={(e) => setForm({ ...form, aftercare: e.target.value })} className={input} />
            <textarea placeholder="Safety warnings / contraindications" rows={2} value={form.warnings} onChange={(e) => setForm({ ...form, warnings: e.target.value })} className={input} />
            <input placeholder="Cancellation policy" value={form.cancellation_policy} onChange={(e) => setForm({ ...form, cancellation_policy: e.target.value })} className={input} />
            {editing.service_id && editing.images?.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {editing.images.map((img) => (
                  <div key={img} className="relative">
                    <img src={img} alt="" className="w-20 h-20 rounded-xl object-cover border" />
                    <button onClick={async () => { await mp.post(`/admin/services/${editing.service_id}/thumbnail`, { url: img }, adminHdr()); toast.success('Thumbnail set'); load(); }}
                      className="absolute -top-2 -left-2 bg-white rounded-full p-1 shadow" title="Set thumbnail"><Star size={12} className="text-amber-500" /></button>
                    <button onClick={async () => { await mp.delete(`/admin/services/${editing.service_id}/images`, { ...adminHdr(), params: { url: img } }); load(); }}
                      className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow" title="Remove"><Trash2 size={12} className="text-rose-500" /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => save(false)} data-testid="sf-save" className="flex-1 border border-emerald-700 text-emerald-800 font-bold rounded-full py-3 text-sm">Save draft</button>
              <button onClick={() => save(true)} data-testid="sf-publish" className="flex-1 bg-emerald-700 text-white font-bold rounded-full py-3 text-sm">Save & publish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminServices;
