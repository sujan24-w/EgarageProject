import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';

export default function PaymentFailure() {
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in" style={{ maxWidth: '500px', margin: '10vh auto', padding: '2rem', textAlign: 'center' }}>
       <div className="glass-panel" style={{ padding: '3rem', border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.05)' }}>
         <XCircle size={80} color="#ef4444" style={{ margin: '0 auto 1.5rem', display: 'block' }} />
         <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>Transaction Cancelled</h2>
         <p style={{ color: 'var(--text-secondary)' }}>You cancelled the eSewa transaction, or it failed to process.</p>
         <button className="btn-secondary" style={{ marginTop: '2rem', width: '100%' }} onClick={() => navigate('/my-bookings')}>Return to Dashboard</button>
       </div>
    </div>
  );
}
