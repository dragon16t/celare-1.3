import React, { useState } from 'react';
import { Users, CalendarDays, LayoutGrid, Star, LifeBuoy, Settings } from 'lucide-react';
import AdminMpCRM from './AdminMpCRM';
import AdminMpBookings from './AdminMpBookings';
import AdminSupport from './AdminSupport';
import MpCategories from '../../components/admin/MpCategories';
import MpSettings from '../../components/admin/MpSettings';
import MpReviews from '../../components/admin/MpReviews';

const tabs = [
  ['doctors', 'Doctors & Applications', Users],
  ['bookings', 'Consultation Bookings', CalendarDays],
  ['categories', 'Categories & Images', LayoutGrid],
  ['reviews', 'Reviews', Star],
  ['support', 'Support Tickets', LifeBuoy],
  ['settings', 'Settings', Settings],
];

const AdminDoctorHub = () => {
  const [tab, setTab] = useState('doctors');
  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto" data-testid="admin-doctor-hub">
      <h1 className="text-2xl font-extrabold text-stone-900">Dermatologist Manager</h1>
      <p className="text-sm text-stone-500">Everything for the consultation module — applications, bookings, categories, reviews, support and settings.</p>
      <div className="flex gap-2 overflow-x-auto pb-2 mt-5 mb-6" data-testid="doctor-hub-tabs">
        {tabs.map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} data-testid={`dhub-${k}`}
            className={`px-4 py-2 rounded-full text-xs font-extrabold whitespace-nowrap inline-flex items-center gap-1.5 ${tab === k ? 'bg-emerald-700 text-white' : 'bg-white border border-stone-200 text-stone-600'}`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>
      {tab === 'doctors' && <AdminMpCRM kind="doctors" />}
      {tab === 'bookings' && <AdminMpBookings fixedModule="consultation" />}
      {tab === 'categories' && <MpCategories module="doctor" />}
      {tab === 'reviews' && <MpReviews module="consultation" />}
      {tab === 'support' && <AdminSupport userType="doctor" />}
      {tab === 'settings' && <MpSettings module="doctor" />}
    </div>
  );
};

export default AdminDoctorHub;
