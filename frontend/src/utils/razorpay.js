const KEY_ID = process.env.REACT_APP_RAZORPAY_KEY_ID;

let loading = null;
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
  return loading;
}

export async function openRazorpayCheckout({ orderId, amount, name, email, phone, description, onSuccess, onFailure }) {
  const ok = await loadRazorpay();
  if (!ok || !KEY_ID) { onFailure?.('Payment gateway could not be loaded'); return; }
  const rzp = new window.Razorpay({
    key: KEY_ID,
    amount: Math.round(amount * 100),
    currency: 'INR',
    order_id: orderId,
    name: 'Celesta Glow',
    description,
    prefill: { name, email, contact: phone },
    theme: { color: '#047857' },
    handler: (resp) => onSuccess(resp),
    modal: { ondismiss: () => onFailure?.('Payment cancelled') },
  });
  rzp.on('payment.failed', (resp) => onFailure?.(resp.error?.description || 'Payment failed'));
  rzp.open();
}
