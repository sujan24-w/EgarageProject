import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import './Login.css';

export default function Login() {
  const { login } = useContext(AuthContext);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const routerLocation = useLocation();
  const successMsg = routerLocation.state?.message;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', formData);
      login(res.data);
      if (res.data.role === 'garage_owner') navigate('/garage-dashboard');
      else if (res.data.role === 'admin') navigate('/admin-dashboard');
      else navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel animate-fade-in login-container">
      <h2 className="login-title">Welcome Back</h2>
      {successMsg && <div className="login-success">{successMsg}</div>}
      {error && <div className="login-error">{error}</div>}
      
      <form onSubmit={handleSubmit}>
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
        <button type="submit" className="btn-primary login-submit-btn" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      <div className="login-footer">
        Don't have an account? <Link to="/register" className="login-register-link">Register</Link>
      </div>
    </div>
  );
}
