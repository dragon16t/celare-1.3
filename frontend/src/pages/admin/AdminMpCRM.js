import React, { useEffect, useState } from 'react';
import { BadgeCheck, Ban, RefreshCcw, Info, X, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { mp, adminHdr, statusColor, fmtStatus } from '../../utils/mpApi';

const tabBtn = (a) => `px-4 py-2 rounded-full text-xs font-extrabold ${a ? 'bg-emerald-700 text-white' : 'bg-white border border-stone-200 text-stone-600'}`;

const Row = ({ label, value }) => value ? (
  <div className="flex justify-between gap-4 text-xs py-1.5 border-b border-stone-50">
    <span className="text-stone-400 font-semibold shrink-0">{label}</span>
    <span className="text-stone-800 font-semibold text-right break-all">{value}</span>
  </div>
) : null;

const AdminMpCRM = ({ kind }) => {
  const isDoctor = kind === 'doctors';
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');
  const [withdrawals, setWithdrawals] = useState([]);
  const [detail, setDetail] = useState(null);

  const load = () => {
    mp.get(`/admin/${kind}`, { ...adminHdr(), params: filter ? { status: filter } : {} })
      .then((r) => setItems(r.data)).catch(() => toast.error('Failed to load'));
    mp.get('/admin/withdrawals', adminHdr()).then((r) => setWithdrawals(r.data.filter((w) => w.owner_type === kind.slice(0, -1)))).catch(() => {});
  };
  useEffect(load, [kind, filter]); // eslint-disable-line

  const review = async (id, action) => {
    const reason = action === 'approve' ? '' : (window.prompt('Reason (recorded in the audit log):') || '');
    if (action !== 'approve' && reason === null) return;
    try { await mp.post(`/admin/${kind}/${id}/review`, { action, reason }, adminHdr()); toast.success(`Marked ${action}`); setDetail(null); load(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };
  const svcDecision = async (pid, sid, decision) => {
    try { await mp.post(`/admin/partners/${pid}/services/${sid}/decision`, { decision }, adminHdr()); toast.success(decision); load(); }
    catch { toast.error('Failed'); }
  };
  const processWdr = async (wid, action) => {
    const reference = action === 'paid' ? (window.prompt('Payout reference / UTR:') || '') : '';
    try { await mp.post(`/admin/withdrawals/${wid}/process`, { action, reference }, adminHdr()); toast.success(action); load(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };
  const uploadPhoto = async (id, file) => {
    const fd = new FormData(); fd.append('file', file);
    try {
      await mp.post(`/admin/${kind}/${id}/photo`, fd, adminHdr());
      toast.success('Photo replaced'); load();
      const fresh = await mp.get(`/admin/${kind}`, adminHdr());
      const x = fresh.data.find((i) => (isDoctor ? i.doctor_id : i.partner_id) === id);
      if (x) setDetail(x);
    } catch (e) { toast.error(e.response?.data?.detail || 'Upload failed'); }
  };

  const editFee = async (id, current) => {
    const v = Number(window.prompt('New consultation fee set by doctor (₹) — customer price is calculated automatically:', current || ''));
    if (!v) return;
    try { await mp.put(`/admin/doctors/${id}/fee`, { fee: v }, adminHdr()); toast.success('Fee updated'); setDetail(null); load(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };
  const editSvcPrice = async (pid, sid, current) => {
    const v = Number(window.prompt('New partner price (₹):', current || ''));
    if (!v) return;
    try { await mp.put(`/admin/partners/${pid}/services/${sid}/price`, { price: v }, adminHdr()); toast.success('Price updated'); setDetail(null); load(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };
  const name = (x) => isDoctor ? x.personal?.name : (x.applicant?.business_name || x.applicant?.name);
  const sub = (x) => isDoctor
    ? `${x.professional?.qualification || ''} • Reg: ${x.professional?.registration_number || '—'} • ₹${x.consultation?.fee}`
    : `${x.location?.city || ''} ${x.location?.pincode || ''} • ${(x.services || []).length} service(s)`;
  const idOf = (x) => isDoctor ? x.doctor_id : x.partner_id;
  const photoOf = (x) => (x.photo?.chosen || x.photo?.original_url || '');

  return (
    <div data-testid={`admin-${kind}-crm`}>
      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'pending', 'approved', 'info_requested', 'rejected', 'suspended'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} data-testid={`filter-${s || 'all'}`} className={tabBtn(filter === s)}>{s ? fmtStatus(s) : 'All'}</button>
        ))}
      </div>
      <div className="grid gap-3" data-testid="crm-list">
        {items.map((x) => (
          <div key={idOf(x)} className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center gap-4" data-testid={`crm-row-${idOf(x)}`}>
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-stone-50 border border-stone-100 shrink-0">
              {photoOf(x) ? <img src={photoOf(x)} alt="" className="w-full h-full object-cover object-top" />
                : <span className="w-full h-full flex items-center justify-center text-emerald-700 font-extrabold text-lg">{(name(x) || '?')[0]}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-stone-900 flex items-center gap-2 truncate">{name(x)} {x.application_status === 'approved' && <BadgeCheck size={15} className="text-emerald-600 shrink-0" />}</p>
              <p className="text-xs text-stone-500 truncate">{idOf(x)} • {sub(x)}</p>
              <p className="text-xs text-stone-700 font-semibold truncate" data-testid={`crm-contact-${idOf(x)}`}>
                {(isDoctor ? x.personal?.mobile : x.applicant?.mobile) || '—'} • {(isDoctor ? x.personal?.email : x.applicant?.email) || '—'}
              </p>
            </div>
            <span className={`hidden sm:inline-block text-[11px] font-bold rounded-full px-2.5 py-1 ${statusColor(x.application_status)}`}>{fmtStatus(x.application_status)}</span>
            <button onClick={() => setDetail(x)} data-testid={`detail-${idOf(x)}`}
              className="bg-emerald-700 text-white text-xs font-bold rounded-full px-4 py-2 shrink-0">View & decide</button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-stone-400 text-center py-10">No {isDoctor ? 'doctors' : 'partners'} in this view.</p>}
      </div>

      <div className="mt-8 bg-white rounded-2xl border border-stone-200 p-5" data-testid="crm-withdrawals">
        <p className="font-bold text-stone-900 text-sm">Withdrawal requests</p>
        {withdrawals.length === 0 && <p className="text-xs text-stone-400 mt-2">None.</p>}
        {withdrawals.map((w) => (
          <div key={w.withdrawal_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 border-b border-stone-50 last:border-0 text-xs">
            <span className="text-stone-700 font-semibold">{w.withdrawal_id} • {w.owner_id} • ₹{w.amount}</span>
            {w.status === 'pending' ? (
              <span className="flex gap-2">
                <button onClick={() => processWdr(w.withdrawal_id, 'paid')} data-testid={`wdr-paid-${w.withdrawal_id}`} className="bg-emerald-700 text-white font-bold rounded-full px-3 py-1.5">Mark paid</button>
                <button onClick={() => processWdr(w.withdrawal_id, 'rejected')} className="border border-rose-400 text-rose-700 font-bold rounded-full px-3 py-1.5">Reject & refund</button>
              </span>
            ) : <span className={`font-bold rounded-full px-2 py-0.5 ${statusColor(w.status)}`}>{w.status}</span>}
          </div>
        ))}
      </div>

      {detail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4" data-testid="crm-detail-modal">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-stone-50 border">
                  {photoOf(detail) ? <img src={photoOf(detail)} alt="" className="w-full h-full object-cover object-top" />
                    : <span className="w-full h-full flex items-center justify-center text-emerald-700 font-extrabold text-xl">{(name(detail) || '?')[0]}</span>}
                </div>
                <div>
                  <p className="font-extrabold text-stone-900">{name(detail)}</p>
                  <span className={`text-[11px] font-bold rounded-full px-2.5 py-0.5 ${statusColor(detail.application_status)}`}>{fmtStatus(detail.application_status)}</span>
                </div>
              </div>
              <button onClick={() => setDetail(null)}><X size={20} className="text-stone-400" /></button>
            </div>
            <label className="inline-flex items-center gap-1.5 border border-stone-300 text-xs font-bold rounded-full px-4 py-2 cursor-pointer mb-4" data-testid="detail-photo-upload">
              <ImagePlus size={13} /> Replace photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && uploadPhoto(idOf(detail), e.target.files[0])} />
            </label>
            <div className="max-h-72 overflow-y-auto pr-1">
              {isDoctor ? (
                <>
                  <Row label="Application ID" value={detail.doctor_id} />
                  <Row label="Email" value={detail.personal?.email} />
                  <Row label="Mobile" value={detail.personal?.mobile} />
                  <Row label="City" value={`${detail.personal?.city || ''} ${detail.personal?.state || ''} ${detail.personal?.pincode || ''}`} />
                  <Row label="Qualification" value={detail.professional?.qualification} />
                  <Row label="Institution" value={detail.professional?.institution} />
                  <Row label="Specialisation" value={detail.professional?.specialisation} />
                  <Row label="Experience" value={detail.professional?.experience_years != null ? `${detail.professional.experience_years} yrs` : ''} />
                  <Row label="Registration no." value={detail.professional?.registration_number} />
                  <Row label="Authority" value={detail.professional?.issuing_authority} />
                  <Row label="Fee" value={detail.consultation?.fee != null ? `₹${detail.consultation.fee} / ${detail.consultation?.duration_min || 20} min` : ''} />
                  <button onClick={() => editFee(detail.doctor_id, detail.consultation?.fee)} data-testid="edit-doctor-fee" className="mb-2 text-xs font-bold text-emerald-700 underline">Edit fee</button>
                  <Row label="Languages" value={(detail.consultation?.languages || []).join(', ')} />
                  <Row label="Bio" value={detail.professional?.bio} />
                </>
              ) : (
                <>
                  <Row label="Application ID" value={detail.partner_id} />
                  <Row label="Applicant" value={detail.applicant?.name} />
                  <Row label="Email" value={detail.applicant?.email} />
                  <Row label="Mobile" value={detail.applicant?.mobile} />
                  <Row label="Type" value={detail.applicant?.applicant_type} />
                  <Row label="Address" value={`${detail.location?.address || ''}, ${detail.location?.city || ''} ${detail.location?.pincode || ''}`} />
                  <Row label="Coverage" value={detail.location?.coverage_area} />
                  <Row label="Qualifications" value={detail.applicant?.qualifications} />
                  <Row label="Bank" value={detail.payout?.account_holder ? `${detail.payout.account_holder} • ${detail.payout.ifsc || ''}` : ''} />
                </>
              )}
              {!isDoctor && (detail.services || []).length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-extrabold text-stone-700 mb-1.5">Requested services</p>
                  {detail.services.map((s) => (
                    <div key={s.service_id} className="flex items-center justify-between text-xs py-1.5 border-b border-stone-50">
                      <span className="text-stone-700 font-semibold">{s.service_name} <span className="text-stone-400">• ₹{s.price} • {s.mode}</span>
                        <button onClick={() => editSvcPrice(detail.partner_id, s.service_id, s.price)} data-testid={`edit-svc-price-${s.service_id}`} className="ml-2 text-emerald-700 underline">edit</button></span>
                      {s.approval_status === 'pending' ? (
                        <span className="flex gap-2">
                          <button onClick={() => svcDecision(detail.partner_id, s.service_id, 'approved')} className="text-emerald-700 font-bold">Approve</button>
                          <button onClick={() => svcDecision(detail.partner_id, s.service_id, 'rejected')} className="text-rose-600 font-bold">Reject</button>
                        </span>
                      ) : <span className={`font-bold ${s.approval_status === 'approved' ? 'text-emerald-700' : 'text-rose-600'}`}>{s.approval_status}</span>}
                    </div>
                  ))}
                </div>
              )}
              {(detail.decisions || []).length > 0 && (
                <p className="text-[10px] text-stone-400 mt-3 flex items-center gap-1"><Info size={11} /> Last decision: {detail.decisions[detail.decisions.length - 1].action} — {detail.decisions[detail.decisions.length - 1].reason || 'no reason'} ({new Date(detail.decisions[detail.decisions.length - 1].at).toLocaleString('en-IN')})</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-stone-100">
              {detail.application_status !== 'approved' && (
                <button onClick={() => review(idOf(detail), 'approve')} data-testid="detail-approve"
                  className="flex-1 bg-emerald-700 text-white text-xs font-extrabold rounded-full px-4 py-3 inline-flex items-center justify-center gap-1.5"><BadgeCheck size={14} /> Approve</button>
              )}
              {['pending', 'info_requested'].includes(detail.application_status) && (
                <button onClick={() => review(idOf(detail), 'request_info')} className="flex-1 border border-blue-400 text-blue-700 text-xs font-bold rounded-full px-4 py-3">Request info</button>
              )}
              {['pending', 'info_requested'].includes(detail.application_status) && (
                <button onClick={() => review(idOf(detail), 'reject')} data-testid="detail-reject"
                  className="flex-1 border border-rose-400 text-rose-700 text-xs font-bold rounded-full px-4 py-3"><Ban size={12} className="inline" /> Reject</button>
              )}
              {detail.application_status === 'approved' && (
                <button onClick={() => review(idOf(detail), 'suspend')} className="flex-1 border border-amber-500 text-amber-700 text-xs font-bold rounded-full px-4 py-3">Suspend</button>
              )}
              {detail.application_status === 'suspended' && (
                <button onClick={() => review(idOf(detail), 'reactivate')} className="flex-1 border border-emerald-500 text-emerald-700 text-xs font-bold rounded-full px-4 py-3 inline-flex items-center justify-center gap-1"><RefreshCcw size={12} /> Reactivate</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMpCRM;
