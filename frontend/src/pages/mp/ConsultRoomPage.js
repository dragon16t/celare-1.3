import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Video, VideoOff, LifeBuoy } from 'lucide-react';
import { toast } from 'sonner';
import { mp, customerHdr, doctorHdr } from '../../utils/mpApi';

const ConsultRoomPage = () => {
  const { bookingId } = useParams();
  const [room, setRoom] = useState(null);
  const [err, setErr] = useState('');
  const [joined, setJoined] = useState(false);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);

  const hdr = localStorage.getItem('mp_doctor_token') ? doctorHdr() : customerHdr();
  const load = () => mp.get(`/consultations/${bookingId}/room`, hdr)
    .then((r) => setRoom(r.data)).catch((e) => setErr(e.response?.data?.detail || 'Cannot open this room'));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [bookingId]);

  if (err) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6" data-testid="room-error">
      <div className="text-center">
        <VideoOff size={40} className="mx-auto text-stone-300" />
        <p className="mt-3 text-stone-600 font-semibold">{err}</p>
        <Link to="/my/bookings" className="text-emerald-700 underline text-sm">My bookings</Link>
      </div>
    </div>
  );
  if (!room) return <div className="py-24 text-center text-stone-400">Preparing room…</div>;

  const requestCompletion = async () => {
    setBusy(true);
    try { await mp.post(`/doctor/bookings/${bookingId}/request-completion`, {}, doctorHdr()); toast.success('Completion code emailed to the customer'); load(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true);
    try { await mp.post(`/doctor/bookings/${bookingId}/verify`, { otp }, doctorHdr()); toast.success('Consultation verified & completed'); load(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Verification failed'); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-stone-900 text-white" data-testid="consult-room">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-stone-400">{room.booking_id} • {room.date} • {room.slot}</p>
            <h1 className="text-lg font-extrabold">Consultation with Dr. {room.doctor_name}</h1>
          </div>
          <span className="text-[11px] font-bold bg-emerald-500/20 text-emerald-300 rounded-full px-3 py-1.5">{room.status.replace(/_/g, ' ')}</span>
        </div>
        {!joined ? (
          <div className="bg-stone-800 rounded-3xl p-10 text-center" data-testid="waiting-room">
            <Video size={44} className="mx-auto text-emerald-400" />
            <h2 className="text-xl font-extrabold mt-4">Waiting room</h2>
            <p className="text-sm text-stone-400 mt-2 max-w-md mx-auto">You are joining as the <b>{room.role}</b>. Only the booked customer and doctor can enter this room. Allow camera and microphone when prompted.</p>
            <button onClick={() => setJoined(true)} data-testid="join-call"
              className="mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-full px-8 py-3.5">Join video consultation</button>
            <p className="mt-4 text-[11px] text-stone-500">Connection issues? <Link to="/support" className="underline">Contact support</Link> — refresh to reconnect.</p>
          </div>
        ) : (
          <div className="rounded-3xl overflow-hidden border border-stone-700" data-testid="jitsi-frame">
            <iframe title="Video consultation" width="100%" height="560" allow="camera; microphone; fullscreen; display-capture"
              src={`https://${room.domain}/${room.room}#config.prejoinPageEnabled=false`} />
          </div>
        )}
        {room.role === 'doctor' && (
          <div className="bg-stone-800 rounded-2xl p-5" data-testid="doctor-completion-panel">
            <p className="font-bold text-sm">Complete the consultation</p>
            <p className="text-xs text-stone-400 mt-1">When finished, email a completion code to the customer, then enter it here to verify completion and release your earnings.</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={requestCompletion} disabled={busy} data-testid="doctor-request-otp"
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-full px-4 py-2.5">Email completion code to customer</button>
              <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter code" data-testid="doctor-otp-input"
                className="bg-stone-900 border border-stone-600 rounded-full px-4 py-2 text-sm w-36 text-center tracking-widest" />
              <button onClick={verify} disabled={busy || !otp} data-testid="doctor-verify-otp"
                className="bg-white text-stone-900 text-xs font-extrabold rounded-full px-4 py-2.5">Verify & complete</button>
            </div>
          </div>
        )}
        {room.role === 'customer' && room.status === 'completion_pending' && (
          <p className="text-center text-sm text-violet-300" data-testid="customer-otp-hint">Your doctor has requested completion — the verification code was sent to your email.</p>
        )}
        <div className="flex justify-center">
          <Link to="/support" className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-white"><LifeBuoy size={13} /> Report a problem</Link>
        </div>
      </div>
    </div>
  );
};

export default ConsultRoomPage;
