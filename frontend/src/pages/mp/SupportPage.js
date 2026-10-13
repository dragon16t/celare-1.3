import React, { useEffect, useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import { toast } from 'sonner';
import { mp, statusColor, fmtStatus } from '../../utils/mpApi';

const input = 'w-full rounded-xl border border-stone-200 px-4 py-3 text-sm';

const SupportPage = () => {
  const [cats, setCats] = useState([]);
  const [f, setF] = useState({ category: '', subject: '', description: '', booking_id: '', email: '', name: '' });
  const [tickets, setTickets] = useState([]);
  const [reply, setReply] = useState({});
  useEffect(() => { mp.get('/support/categories').then((r) => setCats(r.data)).catch(() => {}); }, []);
  const load = () => { if (f.email) mp.get('/support', { params: { email: f.email } }).then((r) => setTickets(r.data)).catch(() => {}); };

  const submit = async (e) => {
    e.preventDefault();
    try { const r = await mp.post('/support', f); toast.success(`Ticket ${r.data.ticket_id} created`); setF({ ...f, subject: '', description: '', booking_id: '' }); load(); }
    catch (err2) { toast.error(err2.response?.data?.detail || 'Failed'); }
  };
  const sendReply = async (tid) => {
    try { await mp.post(`/support/${tid}/reply`, { message: reply[tid] || '', by: 'user' }); setReply({ ...reply, [tid]: '' }); toast.success('Reply added'); load(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div className="bg-stone-50 min-h-screen" data-testid="support-page">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 flex items-center gap-2"><LifeBuoy className="text-emerald-700" /> Customer Support</h1>
        <p className="text-sm text-stone-500 mt-1">For bookings, consultations, tracking, payments and account help.</p>
        <form onSubmit={submit} className="mt-6 bg-white rounded-3xl border border-stone-200 p-6 space-y-4" data-testid="support-form">
          <div className="grid sm:grid-cols-2 gap-4">
            <input required placeholder="Your name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={input} data-testid="sup-name" />
            <input required type="email" placeholder="Email" value={f.email} data-testid="sup-email" onChange={(e) => setF({ ...f, email: e.target.value })} onBlur={load} className={input} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <select required value={f.category} data-testid="sup-category" onChange={(e) => setF({ ...f, category: e.target.value })} className={input}>
              <option value="">Select category…</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input placeholder="Booking ID (optional)" value={f.booking_id} onChange={(e) => setF({ ...f, booking_id: e.target.value })} className={input} />
          </div>
          <input required placeholder="Subject" value={f.subject} data-testid="sup-subject" onChange={(e) => setF({ ...f, subject: e.target.value })} className={input} />
          <textarea required rows={4} placeholder="Describe the issue…" value={f.description} data-testid="sup-desc" onChange={(e) => setF({ ...f, description: e.target.value })} className={input} />
          <button data-testid="sup-submit" className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-full px-8 py-3 text-sm">Raise ticket</button>
        </form>
        {tickets.length > 0 && (
          <div className="mt-8 space-y-3" data-testid="my-tickets">
            <h2 className="font-extrabold text-stone-800">My tickets</h2>
            {tickets.map((t) => (
              <div key={t.ticket_id} className="bg-white rounded-2xl border border-stone-200 p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-stone-900 text-sm">{t.subject}</p>
                  <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${statusColor(t.status)}`}>{fmtStatus(t.status)}</span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">{t.ticket_id} • {t.category} • {new Date(t.created_at).toLocaleString('en-IN')}</p>
                <p className="text-sm text-stone-600 mt-2">{t.description}</p>
                {t.responses?.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
                    {t.responses.map((r, i) => (
                      <div key={i} className={`text-xs rounded-xl p-3 ${r.by === 'support' ? 'bg-emerald-50 text-emerald-900' : 'bg-stone-50 text-stone-700'}`}>
                        <b>{r.by === 'support' ? 'Support' : 'You'}:</b> {r.message}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <input placeholder="Write a reply…" value={reply[t.ticket_id] || ''} data-testid={`reply-${t.ticket_id}`}
                    onChange={(e) => setReply({ ...reply, [t.ticket_id]: e.target.value })} className={`${input} !py-2 text-xs`} />
                  <button onClick={() => sendReply(t.ticket_id)} data-testid={`reply-send-${t.ticket_id}`} className="bg-emerald-700 text-white text-xs font-bold rounded-full px-4">Send</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportPage;
