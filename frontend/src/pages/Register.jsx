import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import './Register.css';

export default function Register() {
  const { login } = useContext(AuthContext);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '', role: 'user' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    
    // Phone validation (10 digits)
    if (!/^\d{10}$/.test(formData.phone)) {
      setFieldErrors({ phone: 'Phone number must be exactly 10 digits.' });
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', formData);
      navigate('/login', { state: { message: "Account created successfully! Please login to access the platform." } });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel animate-fade-in register-container">
      <h2 className="register-title">Create Account</h2>
      {error && <div className="register-error">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label">Full Name <span className="register-required">*</span></label>
          <input type="text" className="input-field" required
            value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
        </div>
        <div className="input-group">
          <label className="input-label">Email <span className="register-required">*</span></label>
          <input type="email" className="input-field" required
            value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
        </div>
        <div className="input-group">
          <label className="input-label">Phone <span className="register-required">*</span></label>
          <input type="text" className="input-field" required
            value={formData.phone} onChange={(e) => {
                setFormData({...formData, phone: e.target.value});
                if(fieldErrors.phone) setFieldErrors({...fieldErrors, phone: ''});
            }} />
          {fieldErrors.phone && <small className="register-phone-error">{fieldErrors.phone}</small>}
        </div>
        <div className="input-group">
          <label className="input-label">Password (min 6 chars) <span className="register-required">*</span></label>
          <div className="register-password-wrapper">
            <input type={showPassword ? "text" : "password"} className="input-field register-password-input" required minLength="6"
              value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} 
              autoComplete="new-password" />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="register-eye-btn"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>
        <div className="input-group">
          <label className="input-label">I am a... <span className="register-required">*</span></label>
          <select className="input-field" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
            <option value="user">Vehicle Owner (Need service)</option>
            <option value="garage_owner">Garage Owner (Provide service)</option>
          </select>
        </div>
        
        <button type="submit" className="btn-primary register-submit-btn" disabled={loading}>
          {loading ? 'Creating...' : 'Register'}
        </button>
      </form>
      <div className="register-footer">
        Already have an account? <Link to="/login" className="register-login-link">Login</Link>
      </div>
    </div>
  );
}
