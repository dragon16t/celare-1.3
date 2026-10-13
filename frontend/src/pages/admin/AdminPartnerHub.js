import React, { useEffect, useState } from 'react';
import { Users, CalendarDays, LayoutGrid, Star, LifeBuoy, Settings, Package, IndianRupee } from 'lucide-react';
import AdminMpCRM from './AdminMpCRM';
import AdminMpBookings from './AdminMpBookings';
import AdminSupport from './AdminSupport';
import AdminServices from './AdminServices';
import MpCategories from '../../components/admin/MpCategories';
import MpSettings from '../../components/admin/MpSettings';
import MpReviews from '../../components/admin/MpReviews';
import { mp, adminHdr } from '../../utils/mpApi';

const PlatformWallet = () => {
  const [w, setW] = useState(null);
  useEffect(() => { mp.get('/admin/platform-wallet', adminHdr()).then((r) => setW(r.data)).catch(() => {}); }, []);
  if (!w) return <div className="text-stone-400 text-sm p-4">Loading…</div>;
  return (
    <div className="space-y-4" data-testid="platform-wallet">
      <div className="bg-gradient-to-br from-emerald-700 to-teal-800 text-white rounded-3xl p-6">
        <p className="text-xs uppercase tracking-widest opacity-80">Celesta Glow platform earnings</p>
        <p className="text-4xl font-extrabold mt-1">₹{w.balance.toFixed(2)}</p>
        <p className="text-[11px] opacity-70 mt-1">Commissions + customer platform fees from completed bookings.</p>
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 p-4">
        <p className="font-bold text-stone-800 text-sm mb-2">Ledger</p>
        {w.ledger.length === 0 && <p className="text-xs text-stone-400">No earnings yet — entries appear after OTP-verified completions.</p>}
        {w.ledger.map((l) => (
          <div key={l.entry_id} className="flex justify-between text-xs py-2 border-b border-stone-50 last:border-0">
            <span className="text-stone-600">{l.ref}{l.booking_id ? ` • ${l.booking_id}` : ''}<span className="block text-[10px] text-stone-400">{new Date(l.at).toLocaleString('en-IN')}</span></span>
            <span className={`font-extrabold ${l.type === 'credit' ? 'text-emerald-700' : 'text-rose-600'}`}>{l.type === 'credit' ? '+' : '−'}₹{l.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const tabs = [
  ['partners', 'Partners & Applications', Users],
  ['services', 'Service Catalogue', Package],
  ['bookings', 'Home Service Bookings', CalendarDays],
  ['categories', 'Categories & Images', LayoutGrid],
  ['reviews', 'Reviews', Star],
  ['earnings', 'Platform Earnings', IndianRupee],
  ['support', 'Support Tickets', LifeBuoy],
  ['settings', 'Settings', Settings],
];

const AdminPartnerHub = () => {
  const [tab, setTab] = useState('partners');
  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto" data-testid="admin-partner-hub">
      <h1 className="text-2xl font-extrabold text-stone-900">Service Partner Manager</h1>
      <p className="text-sm text-stone-500">Everything for the home services module — partners, catalogue, bookings, reviews, earnings, support and settings.</p>
      <div className="flex gap-2 overflow-x-auto pb-2 mt-5 mb-6" data-testid="partner-hub-tabs">
        {tabs.map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} data-testid={`phub-${k}`}
            className={`px-4 py-2 rounded-full text-xs font-extrabold whitespace-nowrap inline-flex items-center gap-1.5 ${tab === k ? 'bg-emerald-700 text-white' : 'bg-white border border-stone-200 text-stone-600'}`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>
      {tab === 'partners' && <AdminMpCRM kind="partners" />}
      {tab === 'services' && <AdminServices />}
      {tab === 'bookings' && <AdminMpBookings fixedModule="home" />}
      {tab === 'categories' && <MpCategories module="service" />}
      {tab === 'reviews' && <MpReviews module="home" />}
      {tab === 'earnings' && <PlatformWallet />}
      {tab === 'support' && <AdminSupport userType="partner" />}
      {tab === 'settings' && <MpSettings module="service" />}
    </div>
  );
};

export default AdminPartnerHub;
