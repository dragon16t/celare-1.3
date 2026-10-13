import React, { useState } from 'react';
import { Info, X } from 'lucide-react';
import { statusColor } from '../../utils/mpApi';

const Breakdown = ({ wallet, onClose }) => (
  <div className="bg-white text-stone-800 rounded-2xl p-4 mt-4 text-xs space-y-1.5" data-testid="wallet-breakdown">
    <div className="flex justify-between items-center mb-1">
      <p className="font-extrabold text-sm">How your balance is calculated</p>
      <button onClick={onClose} aria-label="Close" data-testid="wallet-breakdown-close"><X size={14} /></button>
    </div>
    <p className="flex justify-between"><span>Total listed price of completed bookings</span><b>₹{wallet.total_listed ?? 0}</b></p>
    <p className="flex justify-between text-rose-600"><span>Celesta commission ({wallet.commission_pct}%)</span><b>−₹{wallet.total_commission ?? 0}</b></p>
    <p className="flex justify-between border-t border-stone-100 pt-1.5"><span>Total earned</span><b className="text-emerald-700">₹{wallet.total_earned ?? 0}</b></p>
    <p className="text-[10px] text-stone-400">Balance = total earned − withdrawals. Withdrawals have no extra deductions.</p>
  </div>
);

const LedgerRow = ({ l }) => {
  const m = l.meta || {};
  const sign = l.type === 'credit' ? '+' : l.type === 'debit' ? '−' : '';
  return (
    <div className="py-2.5 border-b border-stone-50 last:border-0 text-xs" data-testid={`ledger-${l.entry_id}`}>
      <div className="flex justify-between">
        <span className="text-stone-700 font-semibold">{l.ref === 'settlement' ? 'Booking earning' : l.ref}{l.booking_id ? ` • ${l.booking_id}` : ''}</span>
        <span className={`font-extrabold ${l.type === 'credit' ? 'text-emerald-700' : l.type === 'debit' ? 'text-rose-600' : 'text-stone-500'}`}>{sign}₹{l.amount}</span>
      </div>
      {m.listed_price != null && (
        <p className="text-[10px] text-stone-500 mt-0.5">Listed ₹{m.listed_price} − commission {m.commission_pct}% (₹{m.commission}) = ₹{m.you_earn}{m.note ? ` • ${m.note}` : ''}</p>
      )}
      <p className="text-[10px] text-stone-400">{new Date(l.at).toLocaleString('en-IN')}</p>
    </div>
  );
};

export default function WalletPanel({ wallet, onWithdraw, testid }) {
  const [info, setInfo] = useState(false);
  return (
    <div className="space-y-4" data-testid={testid}>
      <div className="bg-gradient-to-br from-emerald-700 to-teal-800 text-white rounded-3xl p-6">
        <p className="text-xs uppercase tracking-widest opacity-80 flex items-center gap-1.5">Available balance
          <button onClick={() => setInfo(!info)} aria-label="Balance info" data-testid="wallet-info-btn" className="opacity-90 hover:opacity-100"><Info size={14} /></button>
        </p>
        <p className="text-4xl font-extrabold mt-1" data-testid="wallet-balance">₹{Number(wallet.balance || 0).toFixed(2)}</p>
        <p className="text-[11px] opacity-80 mt-1">Already after {wallet.commission_pct}% Celesta commission</p>
        <button onClick={onWithdraw} data-testid="wallet-withdraw" className="mt-4 bg-white text-emerald-900 text-xs font-extrabold rounded-full px-5 py-2.5">Request withdrawal</button>
        {info && <Breakdown wallet={wallet} onClose={() => setInfo(false)} />}
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 p-4">
        <p className="font-bold text-stone-800 text-sm mb-2">Transactions</p>
        {wallet.ledger.length === 0 && <p className="text-xs text-stone-400">Earnings appear here after each completed booking.</p>}
        {wallet.ledger.map((l) => <LedgerRow key={l.entry_id} l={l} />)}
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 p-4">
        <p className="font-bold text-stone-800 text-sm mb-2">Withdrawals</p>
        {wallet.withdrawals.length === 0 && <p className="text-xs text-stone-400">None yet.</p>}
        {wallet.withdrawals.map((w) => (
          <div key={w.withdrawal_id} className="flex justify-between text-xs py-2 border-b border-stone-50 last:border-0">
            <span className="text-stone-600">{w.withdrawal_id}</span>
            <span className="font-bold">₹{w.amount} <span className={`ml-1 ${statusColor(w.status)} rounded-full px-2 py-0.5`}>{w.status}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
