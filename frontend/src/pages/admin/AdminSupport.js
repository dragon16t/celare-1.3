import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { mp, adminHdr, statusColor, fmtStatus } from '../../utils/mpApi';

const AdminSupport = ({ userType }) => {
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState('');
  const [reply, setReply] = useState({});

  const load = () => mp.get('/admin/support', { ...adminHdr(), params: { ...(filter ? { status: filter } : {}), ...(userType ? { user_type: userType } : {}) } })
    .then((r) => setTickets(r.data)).catch(() => toast.error('Failed'));
  useEffect(load, [filter, userType]); // eslint-disable-line

  const sendReply = async (t) => {
    try { await mp.post(`/admin/support/${t.ticket_id}/reply`, { message: reply[t.ticket_id] || '' }, adminHdr()); setReply({ ...reply, [t.ticket_id]: '' }); toast.success('Replied'); load(); }
    catch { toast.error('Failed'); }
  };
  const patch = async (t, updates) => {
    try { await mp.patch(`/admin/support/${t.ticket_id}`, updates, adminHdr()); load(); } catch { toast.error('Failed'); }
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto" data-testid="admin-support">
      <h1 className="text-2xl font-extrabold text-stone-900">Support Inbox</h1>
      <div className="flex gap-2 mt-4 flex-wrap">
        {['', 'open', 'in_progress', 'resolved', 'closed'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} data-testid={`sfilter-${s || 'all'}`}
            className={`text-xs font-bold rounded-full px-4 py-2 ${filter === s ? 'bg-emerald-700 text-white' : 'bg-white border border-stone-200'}`}>{s ? fmtStatus(s) : 'All'}</button>
        ))}
      </div>
      <div className="mt-5 space-y-3" data-testid="ticket-list">
        {tickets.map((t) => (
          <div key={t.ticket_id} className="bg-white rounded-2xl border border-stone-200 p-5" data-testid={`ticket-${t.ticket_id}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-stone-900 text-sm">{t.subject}</p>
                <p className="text-xs text-stone-500">{t.ticket_id} • {t.category} • {t.user_type} • {t.email}{t.booking_id ? ` • ${t.booking_id}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <select value={t.priority} onChange={(e) => patch(t, { priority: e.target.value })} className="text-xs border border-stone-200 rounded-full px-2 py-1">
                  {['low', 'normal', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${statusColor(t.status)}`}>{fmtStatus(t.status)}</span>
              </div>
            </div>
            <p className="text-sm text-stone-600 mt-2">{t.description}</p>
            {t.responses?.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-stone-100 pt-3">
                {t.responses.map((r, i) => (
                  <p key={i} className={`text-xs rounded-xl p-2.5 ${r.by === 'support' ? 'bg-emerald-50' : 'bg-stone-50'}`}><b>{r.by}:</b> {r.message}</p>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              <input placeholder="Reply…" value={reply[t.ticket_id] || ''} data-testid={`areply-${t.ticket_id}`}
                onChange={(e) => setReply({ ...reply, [t.ticket_id]: e.target.value })}
                className="flex-1 min-w-[200px] rounded-full border border-stone-200 px-4 py-2 text-xs" />
              <button onClick={() => sendReply(t)} data-testid={`areply-send-${t.ticket_id}`} className="bg-emerald-700 text-white text-xs font-bold rounded-full px-4">Reply</button>
              <button onClick={() => patch(t, { status: 'resolved' })} className="border border-emerald-600 text-emerald-700 text-xs font-bold rounded-full px-4">Resolve</button>
              <button onClick={() => patch(t, { status: 'closed' })} className="border border-stone-300 text-stone-500 text-xs font-bold rounded-full px-4">Close</button>
            </div>
          </div>
        ))}
        {tickets.length === 0 && <p className="text-sm text-stone-400 text-center py-10">No tickets in this view.</p>}
      </div>
    </div>
  );
};

export default AdminSupport;
