import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { mp, WEEK_DAYS } from '../../utils/mpApi';

const Field = ({ label, children }) => (
  <label className="block">
    <span className="text-xs font-bold text-stone-600 uppercase tracking-wide">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);
const input = 'w-full rounded-xl border border-stone-200 px-4 py-3 text-sm focus:outline-none focus:border-emerald-500';

const DoctorApplyPage = () => {
  const [f, setF] = useState({ name: '', mobile: '', email: '', address: '', city: '', state: '', pincode: '',
    languages: '', qualification: '', institution: '', graduation_year: '', postgrad: '', specialisation: '',
    experience_years: 0, bio: '', registration_number: '', issuing_authority: '', fee: 999, duration_min: 20,
    followup_policy: '', video_enabled: true });
  const [slots, setSlots] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...f, experience_years: Number(f.experience_years) || 0, fee: Number(f.fee) || 0,
        duration_min: Number(f.duration_min) || 20,
        languages: f.languages.split(',').map((s) => s.trim()).filter(Boolean), weekly_slots: slots };
      const r = await mp.post('/doctors/apply', payload);
      setDone(r.data);
    } catch (err) { toast.error(err.response?.data?.detail || 'Submission failed'); }
    finally { setBusy(false); }
  };

  if (done) return (
    <div className="max-w-md mx-auto px-6 py-20 text-center" data-testid="doctor-applied">
      <CheckCircle2 size={52} className="mx-auto text-emerald-600" />
      <h1 className="text-2xl font-extrabold mt-4">Application submitted</h1>
      <p className="text-stone-500 text-sm mt-2">Application ID: <b>{done.application_id}</b>. Our medical team reviews every application — you'll hear from us by email.</p>
      <Link to="/doctors" className="inline-block mt-6 text-emerald-700 font-bold underline">Back to dermatologists</Link>
    </div>
  );

  return (
    <div className="bg-stone-50 min-h-screen" data-testid="doctor-apply-page">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">Dermatologist Application</h1>
        <p className="text-sm text-stone-500 mt-1">Applications are verified against medical registration records before profiles go live.</p>
        <form onSubmit={submit} className="mt-8 bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 space-y-5" data-testid="doctor-apply-form">
          <h2 className="font-extrabold text-stone-800">Personal details</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full legal name"><input required data-testid="app-name" className={input} value={f.name} onChange={set('name')} /></Field>
            <Field label="Mobile"><input required data-testid="app-mobile" className={input} value={f.mobile} onChange={set('mobile')} /></Field>
            <Field label="Email"><input required type="email" data-testid="app-email" className={input} value={f.email} onChange={set('email')} /></Field>
            <Field label="Preferred languages (comma separated)"><input className={input} placeholder="English, Hindi" value={f.languages} onChange={set('languages')} /></Field>
          </div>
          <Field label="Address"><input className={input} value={f.address} onChange={set('address')} /></Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="City"><input className={input} value={f.city} onChange={set('city')} /></Field>
            <Field label="State"><input className={input} value={f.state} onChange={set('state')} /></Field>
            <Field label="PIN code"><input className={input} value={f.pincode} onChange={set('pincode')} /></Field>
          </div>
          <h2 className="font-extrabold text-stone-800 pt-2">Professional details</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Medical qualification"><input required data-testid="app-qualification" className={input} placeholder="MBBS, MD (Dermatology)" value={f.qualification} onChange={set('qualification')} /></Field>
            <Field label="Institution"><input className={input} value={f.institution} onChange={set('institution')} /></Field>
            <Field label="Graduation year"><input className={input} value={f.graduation_year} onChange={set('graduation_year')} /></Field>
            <Field label="Specialisation"><input className={input} placeholder="Clinical Dermatology" value={f.specialisation} onChange={set('specialisation')} /></Field>
            <Field label="Experience (years)"><input type="number" min="0" className={input} value={f.experience_years} onChange={set('experience_years')} /></Field>
            <Field label="Postgraduate qualifications"><input className={input} value={f.postgrad} onChange={set('postgrad')} /></Field>
          </div>
          <Field label="Professional bio"><textarea rows={3} className={input} value={f.bio} onChange={set('bio')} /></Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Medical registration number"><input required data-testid="app-reg-number" className={input} value={f.registration_number} onChange={set('registration_number')} /></Field>
            <Field label="Issuing authority"><input className={input} placeholder="State Medical Council" value={f.issuing_authority} onChange={set('issuing_authority')} /></Field>
          </div>
          <h2 className="font-extrabold text-stone-800 pt-2">Consultation settings</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Consultation fee (₹)"><input type="number" min="0" className={input} value={f.fee} onChange={set('fee')} /></Field>
            <Field label="Duration (minutes)"><input type="number" min="10" className={input} value={f.duration_min} onChange={set('duration_min')} /></Field>
          </div>
          <Field label="Follow-up policy"><input className={input} placeholder="One free follow-up within 7 days" value={f.followup_policy} onChange={set('followup_policy')} /></Field>
          <div>
            <p className="text-xs font-bold text-stone-600 uppercase tracking-wide mb-2">Weekly availability (slots like 10:00, 11:30)</p>
            <div className="space-y-2" data-testid="weekly-slots-editor">
              {WEEK_DAYS.map(([key, label]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-10 text-xs font-bold text-stone-500">{label}</span>
                  <input placeholder="e.g. 10:00, 11:00, 17:00 (blank = off)" className={input}
                    value={(slots[key] || []).join(', ')}
                    onChange={(e) => setSlots({ ...slots, [key]: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                </div>
              ))}
            </div>
          </div>
          <button disabled={busy} data-testid="doctor-apply-submit"
            className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-extrabold rounded-full py-4 text-sm">
            {busy ? 'Submitting…' : 'Submit application for verification'}
          </button>
          <p className="text-[11px] text-stone-400 text-center">You can add your profile photo (with AI white-background processing) from your dashboard after approval.</p>
        </form>
      </div>
    </div>
  );
};

export default DoctorApplyPage;
