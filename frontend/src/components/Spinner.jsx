import { Loader, CheckCircle, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

// Status can be: 'idle', 'loading', 'success', 'error'
export default function Spinner({ status, loadingText = "Processing...", successText = "Success!", errorText = "Operation failed." }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status !== 'idle') {
      setVisible(true);
    } else {
      // Small delay to allow fade out if going back to idle
      const timeout = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [status]);

  if (!visible && status === 'idle') return null;

  return (
    <div className={`spinner-container animate-fade-in`} style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      padding: '0.5rem 1rem',
      borderRadius: '8px',
      background: status === 'loading' ? 'var(--bg-secondary)' : status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
      border: `1px solid ${status === 'loading' ? 'var(--border-color)' : status === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
      transition: 'all 0.3s ease',
      width: 'fit-content'
    }}>
      {status === 'loading' && (
        <>
          <Loader size={18} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '500' }}>{loadingText}</span>
        </>
      )}
      
      {status === 'success' && (
        <>
          <CheckCircle size={18} style={{ color: '#10b981' }} />
          <span style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: 'bold' }}>{successText}</span>
        </>
      )}

      {status === 'error' && (
        <>
          <XCircle size={18} style={{ color: '#ef4444' }} />
          <span style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: 'bold' }}>{errorText}</span>
        </>
      )}
    </div>
  );
}
