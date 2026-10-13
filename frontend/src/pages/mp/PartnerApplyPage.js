import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { mp } from '../../utils/mpApi';

const input = 'w-full rounded-xl border border-stone-200 px-4 py-3 text-sm focus:outline-none focus:border-emerald-500';
const Field = ({ label, children }) => (
  <label className="block"><span className="text-xs font-bold text-stone-600 uppercase tracking-wide">{label}</span><div className="mt-1">{children}</div></label>
);

const PartnerApplyPage = () => {
  const [f, setF] = useState({ name: '', mobile: '', email: '', business_name: '', applicant_type: 'individual',
    address: '', city: '', state: '', pincode: '', coverage_area: '', qualifications: '',
    account_holder: '', bank_account: '', ifsc: '', upi: '' });
  const [catalogue, setCatalogue] = useState([]);
  const [selected, setSelected] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { mp.get('/services').then((r) => setCatalogue(r.data)).catch(() => {}); }, []);

  const toggle = (svc) => {
    const next = { ...selected };
    if (next[svc.service_id]) delete next[svc.service_id];
    else next[svc.service_id] = { service_id: svc.service_id, price: svc.price, mode: svc.mode || 'home', coverage: '' };
    setSelected(next);
  };

  const submit = async (e) => {
    e.preventDefault();
    const services = Object.values(selected);
    if (!services.length) return toast.error('Select at least one service you offer');
    setBusy(true);
    try {
      const r = await mp.post('/partners/apply', { ...f, services });
      setDone(r.data);
    } catch (err) { toast.error(err.response?.data?.detail || 'Submission failed'); }
    finally { setBusy(false); }
  };

  if (done) return (
    <div className="max-w-md mx-auto px-6 py-20 text-center" data-testid="partner-applied">
      <CheckCircle2 size={52} className="mx-auto text-emerald-600" />
      <h1 className="text-2xl font-extrabold mt-4">Application submitted</h1>
      <p className="text-stone-500 text-sm mt-2">Application ID: <b>{done.application_id}</b>. We'll verify your details and notify you by email.</p>
      <Link to="/services" className="inline-block mt-6 text-emerald-700 font-bold underline">Back to services</Link>
    </div>
  );

  return (
    <div className="bg-stone-50 min-h-screen" data-testid="partner-apply-page">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">Service Partner Application</h1>
        <p className="text-sm text-stone-500 mt-1">Offer services from the official Celesta Glow catalogue. You'll get booking requests in your partner dashboard.</p>
        <form onSubmit={submit} className="mt-8 space-y-6" data-testid="partner-apply-form">
          <div className="bg-white rounded-3xl border border-stone-200 p-6 space-y-4">
            <h2 className="font-extrabold text-stone-800">Applicant details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Full name"><input required data-testid="pa-name" className={input} value={f.name} onChange={set('name')} /></Field>
              <Field label="Mobile"><input required className={input} value={f.mobile} onChange={set('mobile')} /></Field>
              <Field label="Email"><input required type="email" data-testid="pa-email" className={input} value={f.email} onChange={set('email')} /></Field>
              <Field label="Business / professional name"><input className={input} value={f.business_name} onChange={set('business_name')} /></Field>
              <Field label="Applicant type">
                <select className={input} value={f.applicant_type} onChange={set('applicant_type')}>
                  <option value="individual">Individual professional</option>
                  <option value="salon">Salon / studio</option>
                  <option value="business">Registered business</option>
                </select>
              </Field>
              <Field label="Qualifications"><input className={input} placeholder="Certified beautician, 5 yrs" value={f.qualifications} onChange={set('qualifications')} /></Field>
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-stone-200 p-6 space-y-4">
            <h2 className="font-extrabold text-stone-800">Location & coverage</h2>
            <Field label="Full address"><input required className={input} value={f.address} onChange={set('address')} /></Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="City"><input required className={input} value={f.city} onChange={set('city')} /></Field>
              <Field label="State"><input required className={input} value={f.state} onChange={set('state')} /></Field>
              <Field label="PIN code"><input required className={input} value={f.pincode} onChange={set('pincode')} /></Field>
            </div>
            <Field label="Service coverage area"><input className={input} placeholder="Areas / PIN codes you serve" value={f.coverage_area} onChange={set('coverage_area')} /></Field>
          </div>
          <div className="bg-white rounded-3xl border border-stone-200 p-6 space-y-4">
            <h2 className="font-extrabold text-stone-800">Select services you offer <span className="text-rose-500">*</span></h2>
            <p className="text-xs text-stone-500">Only services from the admin-approved catalogue can be offered. Prices must stay within the permitted range.</p>
            <div className="space-y-3" data-testid="partner-service-picker">
              {catalogue.map((svc) => {
                const sel = selected[svc.service_id];
                return (
                  <div key={svc.service_id} className={`rounded-2xl border p-4 ${sel ? 'border-emerald-500 bg-emerald-50/50' : 'border-stone-200'}`}>
                    <label className="flex items-start gap-3 cursor-pointer" data-testid={`pick-${svc.service_id}`}>
                      <input type="checkbox" checked={!!sel} onChange={() => toggle(svc)} className="mt-1 w-4 h-4 accent-emerald-700" />
                      <span className="flex-1">
                        <span className="font-bold text-stone-900 text-sm">{svc.name}</span>
                        <span className="block text-xs text-stone-500">{svc.category_title} • default ₹{svc.price}
                          {svc.price_range?.max ? ` • range ₹${svc.price_range.min}–₹${svc.price_range.max}` : ''} • {svc.duration_min} min</span>
                      </span>
                    </label>
                    {sel && (
                      <div className="grid grid-cols-3 gap-3 mt-3 pl-7">
                        <Field label="Your price (₹)">
                          <input type="number" min={svc.price_range?.min || 0} max={svc.price_range?.max || undefined}
                            value={sel.price} data-testid={`price-${svc.service_id}`}
                            onChange={(e) => setSelected({ ...selected, [svc.service_id]: { ...sel, price: Number(e.target.value) } })} className={input} />
                        </Field>
                        <Field label="Mode">
                          <select value={sel.mode} onChange={(e) => setSelected({ ...selected, [svc.service_id]: { ...sel, mode: e.target.value } })} className={input}>
                            <option value="home">Home</option><option value="instore">In-store</option><option value="both">Both</option>
                          </select>
                        </Field>
                        <Field label="Coverage">
                          <input value={sel.coverage} onChange={(e) => setSelected({ ...selected, [svc.service_id]: { ...sel, coverage: e.target.value } })} className={input} placeholder="Areas served" />
                        </Field>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-stone-200 p-6 space-y-4">
            <h2 className="font-extrabold text-stone-800">Payout details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Account holder"><input className={input} value={f.account_holder} onChange={set('account_holder')} /></Field>
              <Field label="Bank account number"><input className={input} value={f.bank_account} onChange={set('bank_account')} /></Field>
              <Field label="IFSC"><input className={input} value={f.ifsc} onChange={set('ifsc')} /></Field>
              <Field label="UPI (optional)"><input className={input} value={f.upi} onChange={set('upi')} /></Field>
            </div>
          </div>
          <button disabled={busy} data-testid="partner-apply-submit"
            className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-extrabold rounded-full py-4 text-sm">
            {busy ? 'Submitting…' : 'Submit application'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PartnerApplyPage;
