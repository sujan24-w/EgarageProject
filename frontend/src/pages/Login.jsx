import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import Spinner from '../components/Spinner';
import './Login.css';

export default function Login() {
  const { login } = useContext(AuthContext);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginStatus, setLoginStatus] = useState('idle');
  const [showPassword, setShowPassword] = useState(false);
  const [loginType, setLoginType] = useState('user'); // 'user', 'garage_owner', 'mechanic'

  const navigate = useNavigate();
  const routerLocation = useLocation();
  const successMsg = routerLocation.state?.message;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setLoginStatus('loading');
    try {
      if (loginType === 'mechanic') {
        const res = await api.post('/mechanics/login', { phone: formData.email });
        setLoginStatus('success');
        login({ 
          _id: res.data.mechanicId, 
          name: res.data.name, 
          role: 'mechanic',
          garageId: res.data.garageId 
        });
        setTimeout(() => navigate(`/mechanic/${res.data.mechanicId}`), 500);
        return;
      }

      const res = await api.post('/auth/login', formData);
      
      // Enforce correct tab login
      if (res.data.role !== 'admin' && res.data.role !== loginType) {
        setError(`This account is registered as a ${res.data.role === 'user' ? 'Vehicle Owner' : 'Garage Partner'}. Please switch tabs to login.`);
        setLoginStatus('error');
        setLoading(false);
        return;
      }

      login(res.data);
      setLoginStatus('success');
      setTimeout(() => {
        if (res.data.role === 'garage_owner') navigate('/garage-dashboard');
        else if (res.data.role === 'admin') navigate('/admin-dashboard');
        else navigate('/');
      }, 500);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      setLoginStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel animate-fade-in login-container">
      <h2 className="login-title">Welcome Back</h2>
      {successMsg && <div className="login-success">{successMsg}</div>}
      
      <div style={{ display: 'flex', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
        <button 
          type="button"
          onClick={() => { setLoginType('user'); setError(''); setLoginStatus('idle'); }}
          style={{ flex: 1, padding: '0.6rem', background: 'transparent', border: 'none', borderBottom: loginType === 'user' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: loginType === 'user' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: loginType === 'user' ? 'bold' : 'normal', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.95rem' }}
        >
          Vehicle Owner
        </button>
        <button 
          type="button"
          onClick={() => { setLoginType('garage_owner'); setError(''); setLoginStatus('idle'); }}
          style={{ flex: 1, padding: '0.6rem', background: 'transparent', border: 'none', borderBottom: loginType === 'garage_owner' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: loginType === 'garage_owner' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: loginType === 'garage_owner' ? 'bold' : 'normal', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.95rem' }}
        >
          Garage Partner
        </button>
        <button 
          type="button"
          onClick={() => { setLoginType('mechanic'); setError(''); setLoginStatus('idle'); }}
          style={{ flex: 1, padding: '0.6rem', background: 'transparent', border: 'none', borderBottom: loginType === 'mechanic' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: loginType === 'mechanic' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: loginType === 'mechanic' ? 'bold' : 'normal', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.95rem' }}
        >
          Mechanic Portal
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        {loginType === 'mechanic' ? (
          <div className="input-group" style={{ marginBottom: '1.5rem' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem', background: 'rgba(59, 130, 246, 0.1)', padding: '0.8rem', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
              ℹ️ Mechanics can log in instantly using their registered phone number. <strong>No admin verification is required.</strong> Only your Garage Owner needs to approve you.
            </p>
            <label className="input-label">Registered Phone Number <span className="login-required">*</span></label>
            <input 
              type="text" 
              className="input-field" 
              value={formData.email} // reusing email field state for simplicity
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              placeholder="e.g. 9800000000"
              required
            />
          </div>
        ) : (
          <>
            <div className="input-group">
              <label className="input-label">Email <span className="login-required">*</span></label>
              <input 
                type="email" 
                className="input-field" 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                autoComplete="username"
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Password <span className="login-required">*</span></label>
              <div className="login-password-wrapper">
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="input-field login-password-input"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  autoComplete="current-password"
                  required
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="login-eye-btn"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
              <Link to="/forgot-password" style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', textDecoration: 'none' }}>Forgot Password?</Link>
            </div>
          </>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <button type="submit" className="btn-primary login-submit-btn" disabled={loading}>
            Login as {loginType === 'user' ? 'Vehicle Owner' : loginType === 'garage_owner' ? 'Garage Partner' : 'Mechanic'}
          </button>
          <Spinner status={loginStatus} loadingText="Authenticating..." successText="Login Successful!" errorText={error || "Login Failed"} />
        </div>
      </form>
      <div className="login-footer">
        Don't have an account? <Link to="/register" className="login-register-link">Register</Link>
      </div>
    </div>
  );
}
