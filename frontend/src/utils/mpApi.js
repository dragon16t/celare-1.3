import axios from 'axios';

const BASE = process.env.REACT_APP_BACKEND_URL;
export const mp = axios.create({ baseURL: `${BASE}/api/mp` });

const adminToken = () => sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken') || '';
export const adminHdr = () => ({ headers: { 'X-Admin-Token': adminToken() } });
export const doctorHdr = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('mp_doctor_token') || ''}` } });
export const partnerHdr = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('mp_partner_token') || ''}` } });
export const customerHdr = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('cg_auth_token') || ''}` } });

export const WEEK_DAYS = [
  ['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun'],
];

export const statusColor = (s) => ({
  pending: 'bg-amber-100 text-amber-800', pending_payment: 'bg-amber-100 text-amber-800',
  pending_assignment: 'bg-amber-100 text-amber-800', info_requested: 'bg-blue-100 text-blue-800',
  approved: 'bg-emerald-100 text-emerald-800', confirmed: 'bg-emerald-100 text-emerald-800',
  assigned: 'bg-emerald-100 text-emerald-800', active: 'bg-emerald-100 text-emerald-800',
  en_route: 'bg-sky-100 text-sky-800', arrived: 'bg-sky-100 text-sky-800',
  in_service: 'bg-indigo-100 text-indigo-800', in_progress: 'bg-indigo-100 text-indigo-800',
  completion_pending: 'bg-violet-100 text-violet-800', completed: 'bg-emerald-100 text-emerald-800',
  paid: 'bg-emerald-100 text-emerald-800', draft: 'bg-stone-100 text-stone-600',
  rejected: 'bg-rose-100 text-rose-800', cancelled: 'bg-rose-100 text-rose-800',
  suspended: 'bg-rose-100 text-rose-800', inactive: 'bg-stone-100 text-stone-600',
  archived: 'bg-stone-100 text-stone-600', open: 'bg-amber-100 text-amber-800',
}[s] || 'bg-stone-100 text-stone-700');

export const fmtStatus = (s) => (s || '').replace(/_/g, ' ');
