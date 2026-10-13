import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Stethoscope, Sparkles, ArrowLeft, ArrowRight, CheckCircle2, Camera, Clock, BadgeCheck, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { mp, WEEK_DAYS, statusColor, fmtStatus } from '../../utils/mpApi';

const input = 'w-full rounded-xl border border-stone-200 px-4 py-3 text-sm focus:outline-none focus:border-emerald-500';
const Field = ({ label, children }) => (
  <label className="block"><span className="text-xs font-bold text-stone-600 uppercase tracking-wide">{label}</span><div className="mt-1">{children}</div></label>
);

const ProviderApp = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState('landing'); // landing | register | otp | apply | photo | status | login | loginOtp
  const [role, setRole] = useState(null);
  const [reg, setReg] = useState({ name: '', mobile: '', email: '' });
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState(null);
  const [catalogue, setCatalogue] = useState([]);
  const [busy, setBusy] = useState(false);
  const hdr = () => ({ headers: { Authorization: `Bearer ${token || localStorage.getItem(`mp_${role}_token`) || ''}` } });

  const [docForm, setDocForm] = useState({ address: '', city: '', state: '', pincode: '', languages: '',
    qualification: '', institution: '', graduation_year: '', specialisation: '', experience_years: 0,
    bio: '', registration_number: '', issuing_authority: '', fee: 999, duration_min: 20, followup_policy: '' });
  const [slots, setSlots] = useState({});
  const [prtForm, setPrtForm] = useState({ business_name: '', applicant_type: 'individual', address: '',
    city: '', state: '', pincode: '', coverage_area: '', qualifications: '', account_holder: '',
    bank_account: '', ifsc: '', upi: '' });
  const [selected, setSelected] = useState({});

  useEffect(() => { mp.get('/services').then((r) => setCatalogue(r.data)).catch(() => {}); }, []);

  const loadStatus = async (tkn, r) => {
    try {
      const res = await mp.get('/provider/status', { headers: { Authorization: `Bearer ${tkn}` } });
      setStatus(res.data);
      if (res.data.application) setMode('status');
      else setMode('apply');
    } catch { toast.error('Session expired — log in again'); setMode('landing'); }
  };

  // ---------- register + email OTP ----------
  const sendRegister = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await mp.post('/provider/register', { role, ...reg });
      if (r.data.dev_otp) toast.info(`Dev code (email not configured): ${r.data.dev_otp}`);
      else toast.success('Code sent to your email');
      setMode('otp');
    } catch (err) {
      if (err.response?.status === 409) { toast.error(err.response.data.detail); setMode('login'); }
      else toast.error(err.response?.data?.detail || 'Failed');
    } finally { setBusy(false); }
  };
  const verifyEmail = async () => {
    setBusy(true);
    try {
      const r = await mp.post('/provider/verify-email', { role, email: reg.email, otp });
      setToken(r.data.token);
      localStorage.setItem(`mp_${role}_token`, r.data.token);
      toast.success('Email verified');
      loadStatus(r.data.token, role);
    } catch (err) { toast.error(err.response?.data?.detail || 'Incorrect code'); }
    finally { setBusy(false); }
  };

  // ---------- login (approved providers) ----------
  const [loginEmail, setLoginEmail] = useState('');
  const sendLogin = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await mp.post('/auth/send-otp', { email: loginEmail, role });
      if (r.data.dev_otp) toast.info(`Dev code: ${r.data.dev_otp}`);
      else toast.success('Code sent');
      setMode('loginOtp');
    } catch (err) { toast.error(err.response?.data?.detail || 'No account for this email'); }
    finally { setBusy(false); }
  };
  const verifyLogin = async () => {
    setBusy(true);
    try {
      const r = await mp.post('/auth/verify-otp', { email: loginEmail, role, otp });
      localStorage.setItem(`mp_${role}_token`, r.data.token);
      setToken(r.data.token);
      loadStatus(r.data.token, role);
    } catch (err) { toast.error(err.response?.data?.detail || 'Incorrect code'); }
    finally { setBusy(false); }
  };

  // ---------- application ----------
  const submitApplication = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = role === 'doctor'
        ? { ...docForm, mobile: reg.mobile, experience_years: Number(docForm.experience_years) || 0,
            fee: Number(docForm.fee) || 0, duration_min: Number(docForm.duration_min) || 20,
            languages: docForm.languages.split(',').map((s) => s.trim()).filter(Boolean), weekly_slots: slots }
        : { ...prtForm, mobile: reg.mobile, services: Object.values(selected) };
      if (role === 'partner' && !payload.services.length) { toast.error('Select at least one service'); setBusy(false); return; }
      await mp.post('/provider/apply', payload, hdr());
      toast.success('Application submitted');
      setMode('photo');
    } catch (err) { toast.error(err.response?.data?.detail || 'Submission failed'); }
    finally { setBusy(false); }
  };

  // ---------- photo ----------
  const [photoUrl, setPhotoUrl] = useState('');
  const uploadPhoto = async (file) => {
    const fd = new FormData(); fd.append('file', file);
    try {
      const r = await mp.post(role === 'doctor' ? '/doctor/photo' : '/partner/photo', fd, hdr());
      setPhotoUrl(role === 'doctor' ? r.data.photo?.original_url : r.data.url);
      if (role === 'doctor') await mp.post('/doctor/photo/choose', { use: 'original' }, hdr()).catch(() => {});
      toast.success('Photo uploaded — admin will review it');
    } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed'); }
  };

  const RoleCard = ({ r, Icon, title, desc, next = 'register' }) => (
    <button onClick={() => { setRole(r); setMode(next); }} data-testid={`pro-pick-${r}-${next}`}
      className="group bg-white rounded-3xl border border-stone-200 p-6 text-left hover:border-emerald-500 hover:shadow-xl transition-all">
      <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white flex items-center justify-center mb-4"><Icon size={22} /></div>
      <p className="font-extrabold text-stone-900">{title}</p>
      <p className="text-xs text-stone-500 mt-1">{desc}</p>
      <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-bold mt-3">Start <ArrowRight size={13} /></span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 to-white" data-testid="provider-app">
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="text-lg font-extrabold tracking-widest text-stone-900">CELESTA<span className="text-emerald-700"> GLOW</span></Link>
          <span className="text-[10px] font-bold bg-emerald-700 text-white rounded-full px-3 py-1 uppercase tracking-wider">Partner App</span>
        </div>

        {mode === 'landing' && (
          <div data-testid="pro-landing">
            <h1 className="text-2xl font-extrabold text-stone-900">Grow with Celesta Glow</h1>
            <p className="text-sm text-stone-500 mt-1 mb-6">Register, get verified, and start receiving bookings.</p>
            <div className="space-y-3">
              <RoleCard r="doctor" Icon={Stethoscope} title="Register as Dermatologist" desc="Video consultations, digital prescriptions, instant consults." />
              <RoleCard r="partner" Icon={Sparkles} title="Register as Service Partner" desc="Home beauty & wellness bookings with live tracking." />
            </div>
            <button onClick={() => setMode('loginPick')} data-testid="pro-goto-login"
              className="w-full mt-6 text-center text-sm text-emerald-700 font-bold underline">Already registered? Log in</button>
          </div>
        )}

        {mode === 'loginPick' && (
          <div data-testid="pro-login-pick">
            <button onClick={() => setMode('landing')} className="text-xs text-stone-400 flex items-center gap-1 mb-4"><ArrowLeft size={13} /> Back</button>
            <h2 className="text-xl font-extrabold text-stone-900 mb-4">Log in as</h2>
            <div className="space-y-3">
              <RoleCard r="doctor" Icon={Stethoscope} title="Dermatologist" desc="Approved doctors log in here." next="login" />
              <RoleCard r="partner" Icon={Sparkles} title="Service Partner" desc="Approved partners log in here." next="login" />
            </div>
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={sendLogin} className="bg-white rounded-3xl border border-stone-200 p-6" data-testid="pro-login-form">
            <button type="button" onClick={() => setMode('landing')} className="text-xs text-stone-400 flex items-center gap-1 mb-4"><ArrowLeft size={13} /> Back</button>
            <h2 className="text-xl font-extrabold text-stone-900">{role === 'doctor' ? 'Dermatologist' : 'Partner'} login</h2>
            <p className="text-xs text-stone-500 mt-1 mb-4">Only approved accounts can log in. You'll get an OTP on your registered email.</p>
            <Field label="Registered email"><input required type="email" data-testid="pro-login-email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className={input} /></Field>
            <button disabled={busy} data-testid="pro-login-send" className="w-full mt-4 bg-emerald-700 text-white font-extrabold rounded-full py-3.5 text-sm">Send login code</button>
          </form>
        )}

        {mode === 'loginOtp' && (
          <div className="bg-white rounded-3xl border border-stone-200 p-6" data-testid="pro-login-otp">
            <h2 className="text-xl font-extrabold text-stone-900">Enter login code</h2>
            <p className="text-xs text-stone-500 mt-1 mb-4">Sent to {loginEmail}</p>
            <input data-testid="pro-login-otp-input" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code"
              className={`${input} text-center tracking-[0.4em] font-bold`} />
            <button onClick={verifyLogin} disabled={busy} data-testid="pro-login-verify" className="w-full mt-4 bg-emerald-700 text-white font-extrabold rounded-full py-3.5 text-sm">Verify & log in</button>
          </div>
        )}

        {mode === 'register' && role && (
          <form onSubmit={sendRegister} className="bg-white rounded-3xl border border-stone-200 p-6 space-y-4" data-testid="pro-register-form">
            <button type="button" onClick={() => setMode('landing')} className="text-xs text-stone-400 flex items-center gap-1"><ArrowLeft size={13} /> Back</button>
            <div>
              <h2 className="text-xl font-extrabold text-stone-900">Register as {role === 'doctor' ? 'Dermatologist' : 'Service Partner'}</h2>
              <p className="text-xs text-stone-500 mt-1">Step 1 of 4 — your basic details</p>
            </div>
            <Field label="Full name"><input required data-testid="pro-name" value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} className={input} /></Field>
            <Field label="Mobile number"><input required data-testid="pro-mobile" value={reg.mobile} onChange={(e) => setReg({ ...reg, mobile: e.target.value })} className={input} /></Field>
            <Field label="Email"><input required type="email" data-testid="pro-email" value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} className={input} /></Field>
            <button disabled={busy} data-testid="pro-register-next" className="w-full bg-emerald-700 text-white font-extrabold rounded-full py-3.5 text-sm">Continue — send verification code</button>
          </form>
        )}

        {mode === 'otp' && (
          <div className="bg-white rounded-3xl border border-stone-200 p-6" data-testid="pro-otp-step">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4"><Mail className="text-emerald-700" size={22} /></div>
            <h2 className="text-xl font-extrabold text-stone-900">Verify your email</h2>
            <p className="text-xs text-stone-500 mt-1">Step 2 of 4 — enter the 6-digit code sent to <b>{reg.email}</b></p>
            <input data-testid="pro-otp-input" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="••••••"
              className={`${input} mt-4 text-center tracking-[0.5em] font-extrabold text-lg`} />
            <button onClick={verifyEmail} disabled={busy} data-testid="pro-otp-verify" className="w-full mt-4 bg-emerald-700 text-white font-extrabold rounded-full py-3.5 text-sm">Verify email</button>
            <div className="flex items-center justify-between mt-4 text-xs">
              <button onClick={() => setMode('register')} data-testid="pro-edit-email" className="text-emerald-700 font-bold underline">Wrong email? Edit it</button>
              <button onClick={sendRegister} className="text-stone-500 font-semibold">Resend code</button>
            </div>
          </div>
        )}

        {mode === 'apply' && role === 'doctor' && (
          <form onSubmit={submitApplication} className="bg-white rounded-3xl border border-stone-200 p-6 space-y-4" data-testid="pro-doc-apply">
            <div><h2 className="text-xl font-extrabold text-stone-900">Dermatologist application</h2><p className="text-xs text-stone-500 mt-1">Step 3 of 4 — professional details. Email verified <BadgeCheck size={13} className="inline text-emerald-600" /></p></div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Qualification"><input required data-testid="pro-doc-qual" placeholder="MBBS, MD (Derm)" value={docForm.qualification} onChange={(e) => setDocForm({ ...docForm, qualification: e.target.value })} className={input} /></Field>
              <Field label="Experience (yrs)"><input type="number" min="0" value={docForm.experience_years} onChange={(e) => setDocForm({ ...docForm, experience_years: e.target.value })} className={input} /></Field>
            </div>
            <Field label="Medical registration number"><input required data-testid="pro-doc-reg" value={docForm.registration_number} onChange={(e) => setDocForm({ ...docForm, registration_number: e.target.value })} className={input} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Issuing authority"><input value={docForm.issuing_authority} onChange={(e) => setDocForm({ ...docForm, issuing_authority: e.target.value })} className={input} /></Field>
              <Field label="Specialisation"><input value={docForm.specialisation} onChange={(e) => setDocForm({ ...docForm, specialisation: e.target.value })} className={input} /></Field>
              <Field label="Consultation fee (₹)"><input type="number" min="0" value={docForm.fee} onChange={(e) => setDocForm({ ...docForm, fee: e.target.value })} className={input} /></Field>
              <Field label="Duration (min)"><input type="number" min="10" value={docForm.duration_min} onChange={(e) => setDocForm({ ...docForm, duration_min: e.target.value })} className={input} /></Field>
            </div>
            <Field label="Languages (comma separated)"><input placeholder="English, Hindi" value={docForm.languages} onChange={(e) => setDocForm({ ...docForm, languages: e.target.value })} className={input} /></Field>
            <Field label="Short bio"><textarea rows={2} value={docForm.bio} onChange={(e) => setDocForm({ ...docForm, bio: e.target.value })} className={input} /></Field>
            <div>
              <p className="text-xs font-bold text-stone-600 uppercase tracking-wide mb-2">Weekly availability</p>
              {WEEK_DAYS.map(([key, label]) => (
                <div key={key} className="flex items-center gap-2 mb-1.5">
                  <span className="w-9 text-[11px] font-bold text-stone-500">{label}</span>
                  <input placeholder="10:00, 17:00 (blank = off)" className={`${input} !py-2 text-xs`} value={(slots[key] || []).join(', ')}
                    onChange={(e) => setSlots({ ...slots, [key]: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                </div>
              ))}
            </div>
            <button disabled={busy} data-testid="pro-doc-submit" className="w-full bg-emerald-700 text-white font-extrabold rounded-full py-3.5 text-sm">Submit application</button>
          </form>
        )}

        {mode === 'apply' && role === 'partner' && (
          <form onSubmit={submitApplication} className="bg-white rounded-3xl border border-stone-200 p-6 space-y-4" data-testid="pro-prt-apply">
            <div><h2 className="text-xl font-extrabold text-stone-900">Partner application</h2><p className="text-xs text-stone-500 mt-1">Step 3 of 4 — business & services. Email verified <BadgeCheck size={13} className="inline text-emerald-600" /></p></div>
            <Field label="Business / professional name"><input value={prtForm.business_name} onChange={(e) => setPrtForm({ ...prtForm, business_name: e.target.value })} className={input} /></Field>
            <Field label="Full address"><input required data-testid="pro-prt-address" value={prtForm.address} onChange={(e) => setPrtForm({ ...prtForm, address: e.target.value })} className={input} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="City"><input required value={prtForm.city} onChange={(e) => setPrtForm({ ...prtForm, city: e.target.value })} className={input} /></Field>
              <Field label="State"><input required value={prtForm.state} onChange={(e) => setPrtForm({ ...prtForm, state: e.target.value })} className={input} /></Field>
              <Field label="PIN"><input required value={prtForm.pincode} onChange={(e) => setPrtForm({ ...prtForm, pincode: e.target.value })} className={input} /></Field>
            </div>
            <div>
              <p className="text-xs font-bold text-stone-600 uppercase tracking-wide mb-2">Services you offer *</p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1" data-testid="pro-service-picker">
                {catalogue.map((svc) => {
                  const sel = selected[svc.service_id];
                  return (
                    <div key={svc.service_id} className={`rounded-xl border p-3 ${sel ? 'border-emerald-500 bg-emerald-50/50' : 'border-stone-200'}`}>
                      <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-stone-800">
                        <input type="checkbox" checked={!!sel} className="accent-emerald-700"
                          onChange={() => { const n = { ...selected }; if (n[svc.service_id]) delete n[svc.service_id]; else n[svc.service_id] = { service_id: svc.service_id, price: svc.price, mode: 'home', coverage: '' }; setSelected(n); }} />
                        {svc.name} <span className="text-[11px] font-normal text-stone-400">₹{svc.price}{svc.price_range?.max ? ` (₹${svc.price_range.min}–${svc.price_range.max})` : ''}</span>
                      </label>
                      {sel && (
                        <input type="number" className={`${input} mt-2 !py-2 text-xs`} value={sel.price} placeholder="Your price"
                          min={svc.price_range?.min || 0} max={svc.price_range?.max || undefined}
                          onChange={(e) => setSelected({ ...selected, [svc.service_id]: { ...sel, price: Number(e.target.value) } })} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Account holder"><input value={prtForm.account_holder} onChange={(e) => setPrtForm({ ...prtForm, account_holder: e.target.value })} className={input} /></Field>
              <Field label="IFSC"><input value={prtForm.ifsc} onChange={(e) => setPrtForm({ ...prtForm, ifsc: e.target.value })} className={input} /></Field>
            </div>
            <Field label="Bank account"><input value={prtForm.bank_account} onChange={(e) => setPrtForm({ ...prtForm, bank_account: e.target.value })} className={input} /></Field>
            <button disabled={busy} data-testid="pro-prt-submit" className="w-full bg-emerald-700 text-white font-extrabold rounded-full py-3.5 text-sm">Submit application</button>
          </form>
        )}

        {mode === 'photo' && (
          <div className="bg-white rounded-3xl border border-stone-200 p-6" data-testid="pro-photo-step">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4"><Camera className="text-emerald-700" size={22} /></div>
            <h2 className="text-xl font-extrabold text-stone-900">Profile photo verification</h2>
            <p className="text-xs text-stone-500 mt-1">Step 4 of 4 — upload a clear, real photo of yourself.{role === 'doctor' ? ' Our AI can standardise it to a white background from your dashboard after approval.' : ''}</p>
            {photoUrl && <img src={photoUrl} alt="uploaded" className="w-28 h-36 object-cover rounded-xl border mt-4" data-testid="pro-photo-preview" />}
            <label className="block mt-4 border-2 border-dashed border-emerald-300 rounded-2xl p-6 text-center cursor-pointer text-sm font-bold text-emerald-700" data-testid="pro-photo-upload">
              Tap to upload photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && uploadPhoto(e.target.files[0])} />
            </label>
            <button onClick={() => loadStatus(token || localStorage.getItem(`mp_${role}_token`), role)} data-testid="pro-photo-done"
              className="w-full mt-4 bg-emerald-700 text-white font-extrabold rounded-full py-3.5 text-sm">
              {photoUrl ? 'Finish' : 'Skip for now'}
            </button>
          </div>
        )}

        {mode === 'status' && status && (
          <div className="bg-white rounded-3xl border border-stone-200 p-6 text-center" data-testid="pro-status">
            {status.approved
              ? <CheckCircle2 size={48} className="mx-auto text-emerald-600" />
              : <Clock size={48} className="mx-auto text-amber-500" />}
            <h2 className="text-xl font-extrabold text-stone-900 mt-4">
              {status.approved ? 'You are approved!' : 'Application under review'}
            </h2>
            {status.application && (
              <div className="mt-4 bg-stone-50 rounded-2xl p-4 text-left text-sm space-y-1.5">
                <p><b>Application ID:</b> {status.application.id}</p>
                <p><b>Status:</b> <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${statusColor(status.application.status)}`}>{fmtStatus(status.application.status)}</span></p>
                {status.application.decisions?.length > 0 && <p className="text-xs text-stone-500">Last update: {status.application.decisions[status.application.decisions.length - 1].action} {status.application.decisions[status.application.decisions.length - 1].reason ? `— ${status.application.decisions[status.application.decisions.length - 1].reason}` : ''}</p>}
              </div>
            )}
            {!status.approved && <p className="text-xs text-stone-500 mt-4">Our team reviews every application. You can log in to your dashboard once approved — we'll email you.</p>}
            {status.approved && (
              <button onClick={() => navigate(status.dashboard)} data-testid="pro-open-dashboard"
                className="w-full mt-5 bg-emerald-700 text-white font-extrabold rounded-full py-3.5 text-sm">Open my dashboard</button>
            )}
            <button onClick={() => setMode('landing')} className="mt-3 text-xs text-stone-400 underline">Back to start</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderApp;
