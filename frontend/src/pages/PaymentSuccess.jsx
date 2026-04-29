import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'failed'
  const [message, setMessage] = useState('');

  useEffect(() => {
    const data = searchParams.get('data');
    if (!data) {
      setStatus('failed');
      setMessage('Invalid payment callback (Missing data payload).');
      return;
    }

    const verifyCallback = async () => {
      try {
        const res = await api.post('/payments/esewa/verify', { data });
        setStatus('success');
        setMessage(res.data.message || 'Payment verified securely!');
      } catch (err) {
        setStatus('failed');
        setMessage(err.response?.data?.message || 'Verification failed. This transaction may have expired or tampered.');
      }
    };

    verifyCallback();
  }, [searchParams]);

  return (
    <div className="animate-fade-in" style={{ maxWidth: '500px', margin: '10vh auto', padding: '2rem', textAlign: 'center' }}>
       {status === 'verifying' && (
         <div className="glass-panel" style={{ padding: '3rem' }}>
           <Loader className="spin" size={60} color="var(--accent-primary)" style={{ margin: '0 auto 1.5rem', display: 'block' }} />
           <h2 style={{ color: 'var(--text-primary)' }}>Authenticating Transaction</h2>
           <p style={{ color: 'var(--text-secondary)' }}>Verifying secure eSewa tunnel, please don't close this window...</p>
         </div>
       )}
       {status === 'success' && (
         <div className="glass-panel" style={{ padding: '3rem', border: '1px solid #10b981', background: 'rgba(16, 185, 129, 0.05)' }}>
           <CheckCircle size={80} color="#10b981" style={{ margin: '0 auto 1.5rem', display: 'block' }} />
           <h2 style={{ color: '#10b981', marginBottom: '1rem' }}>Payment Successful!</h2>
           <p style={{ color: 'var(--text-secondary)' }}>{message}</p>
           <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>A strict digital receipt has been natively captured in your Ledger.</p>
           <button className="btn-primary" style={{ marginTop: '2rem', width: '100%' }} onClick={() => navigate('/my-bookings')}>Return to Dashboard</button>
         </div>
       )}
       {status === 'failed' && (
         <div className="glass-panel" style={{ padding: '3rem', border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.05)' }}>
           <XCircle size={80} color="#ef4444" style={{ margin: '0 auto 1.5rem', display: 'block' }} />
           <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>Transaction Failed</h2>
           <p style={{ color: 'var(--text-secondary)' }}>{message}</p>
           <button className="btn-secondary" style={{ marginTop: '2rem', width: '100%' }} onClick={() => navigate('/my-bookings')}>Return to Dashboard</button>
         </div>
       )}
    </div>
  );
}
