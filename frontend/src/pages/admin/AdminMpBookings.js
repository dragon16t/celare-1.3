import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { mp, adminHdr, statusColor, fmtStatus } from '../../utils/mpApi';

const input = 'rounded-xl border border-stone-200 px-3 py-2 text-xs';

const AdminMpBookings = ({ fixedModule }) => {
  const [module, setModule] = useState(fixedModule || 'consultation');
  const [data, setData] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [f, setF] = useState({ status: '', booking_id: '', customer: '', provider: '', date_from: '', date_to: '' });

  const load = () => {
    mp.get('/admin/bookings', { ...adminHdr(), params: { module, page, per_page: 15, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) } })
      .then((r) => setData(r.data)).catch(() => toast.error('Failed to load'));
  };
  useEffect(load, [module, page]); // eslint-disable-line

  const act = async (bid, action) => {
    const reason = action === 'cancel' ? (window.prompt('Cancellation reason:') || '') : '';
    try { await mp.post(`/admin/bookings/${module}/${bid}/action`, { action, reason }, adminHdr()); toast.success('Done'); load(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const pages = Math.max(1, Math.ceil(data.total / 15));

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto" data-testid="admin-mp-bookings">
      <h1 className="text-2xl font-extrabold text-stone-900">Marketplace Bookings</h1>
      {!fixedModule && (
      <div className="flex gap-2 mt-5">
        {[['consultation', 'Consultations'], ['home', 'Home services']].map(([m, label]) => (
          <button key={m} onClick={() => { setModule(m); setPage(1); }} data-testid={`mod-${m}`}
            className={`text-xs font-extrabold rounded-full px-4 py-2 ${module === m ? 'bg-emerald-700 text-white' : 'bg-white border border-stone-200'}`}>{label}</button>
        ))}
      </div>
      )}
      <div className="flex flex-wrap gap-2 mt-4" data-testid="booking-filters">
        <input placeholder="Booking ID" value={f.booking_id} onChange={(e) => setF({ ...f, booking_id: e.target.value })} className={input} />
        <input placeholder="Customer email" value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} className={input} />
        <input placeholder={module === 'consultation' ? 'Doctor ID' : 'Partner ID'} value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} className={input} />
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={input}>
          <option value="">Any status</option>
          {(module === 'consultation' ? ['pending_payment', 'confirmed', 'in_progress', 'completion_pending', 'completed', 'cancelled']
            : ['pending_assignment', 'assigned', 'en_route', 'arrived', 'in_service', 'completion_pending', 'completed', 'cancelled']).map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
        </select>
        <input type="date" value={f.date_from} onChange={(e) => setF({ ...f, date_from: e.target.value })} className={input} />
        <input type="date" value={f.date_to} onChange={(e) => setF({ ...f, date_to: e.target.value })} className={input} />
        <button onClick={() => { setPage(1); load(); }} data-testid="apply-filters" className="bg-emerald-700 text-white text-xs font-bold rounded-full px-4">Apply</button>
      </div>
      <div className="mt-4 bg-white rounded-2xl border border-stone-200 overflow-x-auto" data-testid="bookings-table">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-stone-400 border-b border-stone-100">
            <th className="p-3">Booking</th><th className="p-3">Customer</th><th className="p-3">{module === 'consultation' ? 'Doctor' : 'Service / Partner'}</th>
            <th className="p-3">When</th><th className="p-3">Amount</th><th className="p-3">Payment</th><th className="p-3">Status</th><th className="p-3">Actions</th>
          </tr></thead>
          <tbody>
            {data.items.map((b) => (
              <tr key={b.booking_id} className="border-b border-stone-50" data-testid={`bk-${b.booking_id}`}>
                <td className="p-3 font-semibold text-stone-800">{b.booking_id}</td>
                <td className="p-3">{b.customer?.name}<span className="block text-[10px] text-stone-400">{b.customer?.email}</span></td>
                <td className="p-3">{module === 'consultation' ? b.doctor_name : <>{b.service_name}<span className="block text-[10px] text-stone-400">{b.partner_name || 'unassigned'}</span></>}</td>
                <td className="p-3">{b.date} {b.slot}</td>
                <td className="p-3 font-bold">₹{b.fee ?? b.price}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 font-bold ${b.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{b.payment_status}</span></td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 font-bold ${statusColor(b.status)}`}>{fmtStatus(b.status)}</span></td>
                <td className="p-3">
                  <div className="flex gap-1.5 flex-wrap">
                    {b.payment_status !== 'paid' && b.status !== 'cancelled' && <button onClick={() => act(b.booking_id, 'mark_paid')} data-testid={`paid-${b.booking_id}`} className="bg-emerald-700 text-white font-bold rounded-full px-2.5 py-1">Mark paid</button>}
                    {b.status === 'pending_assignment' && module === 'home' && <button onClick={() => act(b.booking_id, 'rebroadcast')} className="border border-stone-300 font-bold rounded-full px-2.5 py-1">Re-broadcast</button>}
                    {!['cancelled', 'completed'].includes(b.status) && <button onClick={() => act(b.booking_id, 'cancel')} className="border border-rose-400 text-rose-700 font-bold rounded-full px-2.5 py-1">Cancel</button>}
                  </div>
                </td>
              </tr>
            ))}
            {data.items.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-stone-400">No bookings match.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-4 text-xs">
        <span className="text-stone-500">{data.total} booking(s) • page {page} of {pages}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} data-testid="prev-page" className="border border-stone-300 rounded-full px-4 py-1.5 font-bold disabled:opacity-40">Prev</button>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} data-testid="next-page" className="border border-stone-300 rounded-full px-4 py-1.5 font-bold disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
};

export default AdminMpBookings;
