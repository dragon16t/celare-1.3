import React, { useEffect, useState } from 'react';
import { Plus, Trash2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { mp, adminHdr } from '../../utils/mpApi';

const input = 'rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm';

const MpCategories = ({ module }) => {
  const [cats, setCats] = useState([]);
  const [newCat, setNewCat] = useState({ title: '', order: 0 });
  const load = () => mp.get('/admin/categories', { ...adminHdr(), params: { module } })
    .then((r) => setCats(r.data.filter((c) => c.module === module))).catch(() => {});
  useEffect(load, [module]); // eslint-disable-line

  const addCat = async () => {
    if (!newCat.title) return;
    try { await mp.post('/admin/categories', { module, title: newCat.title, order: Number(newCat.order) || 0 }, adminHdr()); setNewCat({ title: '', order: 0 }); load(); toast.success('Category added'); }
    catch { toast.error('Failed'); }
  };
  const toggleCat = async (c) => { await mp.put(`/admin/categories/${c.cat_id}`, { ...c, active: !c.active }, adminHdr()); load(); };
  const delCat = async (c) => {
    if (!window.confirm(`Delete "${c.title}"?`)) return;
    await mp.delete(`/admin/categories/${c.cat_id}`, adminHdr()); load();
  };
  const uploadImg = async (c, file) => {
    const fd = new FormData(); fd.append('file', file);
    try { await mp.post(`/admin/categories/${c.cat_id}/image`, fd, adminHdr()); toast.success('Image updated'); load(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Upload failed'); }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5" data-testid={`categories-panel-${module}`}>
      <p className="font-bold text-stone-900 text-sm">Discovery category tiles</p>
      <p className="text-[11px] text-stone-400 mb-4">Shown as square tiles on the homepage and discovery pages.</p>
      <div className="flex gap-2 mb-4">
        <input placeholder="New category title" value={newCat.title} data-testid="mp-new-cat"
          onChange={(e) => setNewCat({ ...newCat, title: e.target.value })} className={`${input} flex-1`} />
        <input placeholder="Order" type="number" value={newCat.order} onChange={(e) => setNewCat({ ...newCat, order: e.target.value })} className={`${input} w-20`} />
        <button onClick={addCat} data-testid="mp-add-cat" className="bg-emerald-700 text-white text-xs font-bold rounded-full px-4 inline-flex items-center gap-1"><Plus size={14} /> Add</button>
      </div>
      <div className="divide-y divide-stone-50">
        {cats.map((c) => (
          <div key={c.cat_id} className="py-3 flex items-center gap-3" data-testid={`mp-cat-${c.cat_id}`}>
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-emerald-50 border border-stone-100 shrink-0">
              {c.image ? <img src={c.image} alt={c.title} className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-emerald-700 font-extrabold">{c.title[0]}</span>}
            </div>
            <span className={`flex-1 text-sm ${c.active ? 'text-stone-800 font-semibold' : 'text-stone-400 line-through'}`}>{c.order}. {c.title}</span>
            <label className="border border-stone-300 text-xs font-bold rounded-full px-3 py-1.5 cursor-pointer inline-flex items-center gap-1 shrink-0">
              <ImagePlus size={13} /> Image
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && uploadImg(c, e.target.files[0])} />
            </label>
            <button onClick={() => toggleCat(c)} className="text-xs text-emerald-700 font-bold shrink-0">{c.active ? 'Disable' : 'Enable'}</button>
            <button onClick={() => delCat(c)} className="text-rose-500 shrink-0"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MpCategories;
