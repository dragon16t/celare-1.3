import React, { useEffect, useState } from 'react';
import { ImagePlus, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { mp, adminHdr, statusColor, fmtStatus } from '../../utils/mpApi';

const Card = ({ s, reload }) => {
  const [price, setPrice] = useState(s.price);
  const [name, setName] = useState(s.name);
  const decide = async (decision) => {
    const reason = decision === 'rejected' ? (window.prompt('Reason for rejection:') || '') : '';
    try { await mp.post(`/admin/custom-services/${s.service_id}/decision`, { decision, reason }, adminHdr()); toast.success(decision); reload(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };
  const saveEdits = async () => {
    try {
      await mp.put(`/admin/services/${s.service_id}`, { ...s, name, price: Number(price), status: s.status }, adminHdr());
      await mp.put(`/admin/partners/${s.created_by}/services/${s.service_id}/price`, { price: Number(price) }, adminHdr());
      toast.success('Saved'); reload();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };
  const upload = async (file) => {
    const fd = new FormData(); fd.append('file', file);
    try { await mp.post(`/admin/services/${s.service_id}/images`, fd, adminHdr()); toast.success('Image added'); reload(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Upload failed'); }
  };
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4 flex flex-col sm:flex-row gap-4" data-testid={`custom-svc-${s.service_id}`}>
      <div className="w-full sm:w-32 aspect-square rounded-xl overflow-hidden bg-stone-50 shrink-0">
        {s.thumbnail ? <img src={s.thumbnail} alt={s.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-stone-300"><ImagePlus /></div>}
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="font-bold text-stone-900 text-sm border-b border-transparent focus:border-stone-300 outline-none flex-1 min-w-0" data-testid={`custom-svc-name-${s.service_id}`} />
          <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${statusColor(s.status === 'pending_review' ? 'pending' : s.status)}`}>{fmtStatus(s.status)}</span>
        </div>
        <p className="text-xs text-stone-500">By {s.created_by_name} • {s.category_title || 'No category'} • {s.duration_min} min</p>
        <p className="text-xs text-stone-600 line-clamp-2">{s.short_desc}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          ₹<input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-24 rounded-lg border border-stone-200 px-2 py-1.5" data-testid={`custom-svc-price-${s.service_id}`} />
          <button onClick={saveEdits} className="border border-stone-300 font-bold rounded-full px-3 py-1.5" data-testid={`custom-svc-save-${s.service_id}`}>Save edits</button>
          <label className="border border-stone-300 font-bold rounded-full px-3 py-1.5 cursor-pointer inline-flex items-center gap-1"><ImagePlus size={12} /> Image
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && upload(e.target.files[0])} /></label>
          {s.status !== 'active' && <button onClick={() => decide('approved')} className="bg-emerald-700 text-white font-bold rounded-full px-3 py-1.5 inline-flex items-center gap-1" data-testid={`custom-svc-approve-${s.service_id}`}><Check size={12} /> Approve & go live</button>}
          {s.status !== 'rejected' && <button onClick={() => decide('rejected')} className="border border-rose-400 text-rose-700 font-bold rounded-full px-3 py-1.5 inline-flex items-center gap-1" data-testid={`custom-svc-reject-${s.service_id}`}><X size={12} /> Reject</button>}
        </div>
      </div>
    </div>
  );
};

export default function MpCustomServices() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('pending_review');
  const load = () => mp.get('/admin/custom-services', { ...adminHdr(), params: filter ? { status: filter } : {} })
    .then((r) => setItems(r.data)).catch(() => setItems([]));
  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div data-testid="admin-custom-services">
      <div className="flex gap-2 mb-4 flex-wrap">
        {[['pending_review', 'Awaiting review'], ['active', 'Live'], ['rejected', 'Rejected'], ['', 'All']].map(([k, l]) => (
          <button key={k || 'all'} onClick={() => setFilter(k)} data-testid={`custom-filter-${k || 'all'}`}
            className={`px-4 py-2 rounded-full text-xs font-extrabold ${filter === k ? 'bg-emerald-700 text-white' : 'bg-white border border-stone-200 text-stone-600'}`}>{l}</button>
        ))}
      </div>
      <div className="space-y-3">
        {items.length === 0 && <p className="text-sm text-stone-400 text-center py-10">Nothing here.</p>}
        {items.map((s) => <Card key={s.service_id} s={s} reload={load} />)}
      </div>
    </div>
  );
}
