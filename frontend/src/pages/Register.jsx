import { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import Spinner from '../components/Spinner';
import './Register.css';

export default function Register() {
  const { login } = useContext(AuthContext);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '', role: 'user' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [registerStatus, setRegisterStatus] = useState('idle');
  const [showPassword, setShowPassword] = useState(false);
  
  // Mechanic specific states
  const [allGarages, setAllGarages] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAllGarages = async () => {
      try {
        const res = await api.get('/garages/search');
        setAllGarages(res.data);
      } catch (err) { console.error("Failed to fetch garages for dropdown", err); }
    };
    fetchAllGarages();
  }, []);

  const handleMechFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append('image', file);
    form.append('type', 'garage_document');
    
    setLoading(true);
    setRegisterStatus('loading');
    try {
      const res = await api.post('/upload/public', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setFormData(prev => ({ ...prev, [type]: res.data.url }));
      setRegisterStatus('idle');
      setLoading(false);
    } catch (err) {
      setError('File upload failed. Try again.');
      setRegisterStatus('error');
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    const errors = {};
    
    if (formData.role !== 'mechanic') {
      // Email Validation
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(formData.email)) {
        errors.email = 'Please provide a valid email address.';
      }

      // Password Validation
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(formData.password)) {
        errors.password = 'Password must be at least 8 chars long with 1 uppercase, 1 lowercase, 1 number, and 1 special character.';
      }
    } else {
      if (!formData.garageId) errors.garageId = 'Please select a garage.';
      if (!formData.certificate) errors.certificate = 'Verification certificate is mandatory.';
    }

    // Phone validation (Nepal format: 10 digits starting with 98, 97, or 96)
    if (!/^(98|97|96)\d{8}$/.test(formData.phone)) {
      errors.phone = 'Phone number must be 10 digits and start with 98, 97, or 96.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);
    setRegisterStatus('loading');
    try {
      if (formData.role === 'mechanic') {
        const res = await api.post('/mechanics/register', {
          name: formData.name,
          phone: formData.phone,
          garageId: formData.garageId,
          image: formData.image,
          certificate: formData.certificate
        });
        
        // Notify Garage Owner
        const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000');
        socket.emit('notify_status_update', {
          garageId: formData.garageId,
          status: 'mechanic_registered',
          message: `${formData.name} has registered as a mechanic and is pending your approval.`
        });
        setTimeout(() => socket.disconnect(), 1000);

        setRegisterStatus('success');
        setError(res.data.message); // Show success message
        setTimeout(() => {
          navigate('/login', { state: { message: "Mechanic Registration successful! Pending garage owner approval." } });
        }, 3000);
      } else {
        await api.post('/auth/register', formData);
        setRegisterStatus('success');
        setTimeout(() => {
          navigate('/login', { state: { message: "Account created successfully! Please login to access the platform." } });
        }, 500);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
      setRegisterStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel animate-fade-in register-container">
      <h2 className="register-title">Create Account</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label">Full Name <span className="register-required">*</span></label>
          <input type="text" className="input-field" required
            value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
        </div>
        <div className="input-group">
          <label className="input-label">Phone <span className="register-required">*</span></label>
          <input type="text" className="input-field" required
            value={formData.phone} onChange={(e) => {
                setFormData({...formData, phone: e.target.value});
                if(fieldErrors.phone) setFieldErrors({...fieldErrors, phone: ''});
            }} />
          {fieldErrors.phone && <small className="register-phone-error" style={{color: 'var(--error-color)', display: 'block', marginTop: '0.3rem'}}>{fieldErrors.phone}</small>}
        </div>
        <div className="input-group">
          <label className="input-label">I am a... <span className="register-required">*</span></label>
          <select className="input-field" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
            <option value="user">Vehicle Owner (Need service)</option>
            <option value="garage_owner">Garage Owner (Provide service)</option>
            <option value="mechanic">Mechanic (Work for garage)</option>
          </select>
        </div>

        {formData.role !== 'mechanic' ? (
          <>
            <div className="input-group">
              <label className="input-label">Email <span className="register-required">*</span></label>
              <input type="email" className="input-field" required
                value={formData.email || ''} onChange={(e) => {
                    setFormData({...formData, email: e.target.value});
                    if(fieldErrors.email) setFieldErrors({...fieldErrors, email: ''});
                }} />
              {fieldErrors.email && <small className="register-phone-error" style={{color: 'var(--error-color)', display: 'block', marginTop: '0.3rem'}}>{fieldErrors.email}</small>}
            </div>
            
            <div className="input-group">
              <label className="input-label">Password <span className="register-required">*</span></label>
              <div className="register-password-wrapper">
                <input type={showPassword ? "text" : "password"} className="input-field register-password-input" required
                  value={formData.password || ''} onChange={(e) => {
                      setFormData({...formData, password: e.target.value});
                      if(fieldErrors.password) setFieldErrors({...fieldErrors, password: ''});
                  }} 
                  autoComplete="new-password" />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="register-eye-btn"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {fieldErrors.password && <small className="register-phone-error" style={{color: 'var(--error-color)', display: 'block', marginTop: '0.3rem'}}>{fieldErrors.password}</small>}
            </div>
          </>
        ) : (
          <>
            <div className="input-group">
              <label className="input-label">Select Affiliated Garage <span style={{color: 'red'}}>*</span></label>
              <select className="input-field" required value={formData.garageId || ''} onChange={e => {
                  setFormData({...formData, garageId: e.target.value});
                  if(fieldErrors.garageId) setFieldErrors({...fieldErrors, garageId: ''});
              }}>
                <option value="">-- Choose Garage --</option>
                {allGarages.map(g => (
                  <option key={g._id} value={g._id}>{g.name} ({g.location?.address})</option>
                ))}
              </select>
              {fieldErrors.garageId && <small className="register-phone-error" style={{color: 'var(--error-color)', display: 'block', marginTop: '0.3rem'}}>{fieldErrors.garageId}</small>}
            </div>
            <div className="input-group">
              <label className="input-label">Profile Photo (Optional)</label>
              <input type="file" className="input-field" accept="image/*" onChange={(e) => handleMechFileUpload(e, 'image')} />
              {formData.image && <small style={{color: 'var(--success-color)'}}>✓ Photo uploaded</small>}
            </div>
            <div className="input-group">
              <label className="input-label">Verification Certificate / ID <span style={{color: 'red'}}>*</span></label>
              <input type="file" className="input-field" accept="image/*" required={!formData.certificate} onChange={(e) => handleMechFileUpload(e, 'certificate')} />
              {formData.certificate && <small style={{color: 'var(--success-color)'}}>✓ Certificate uploaded</small>}
              {fieldErrors.certificate && <small className="register-phone-error" style={{color: 'var(--error-color)', display: 'block', marginTop: '0.3rem'}}>{fieldErrors.certificate}</small>}
            </div>
          </>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
          <button type="submit" className="btn-primary register-submit-btn" disabled={loading} style={{ width: '100%' }}>
            Register
          </button>
          <Spinner status={registerStatus} loadingText="Creating Account..." successText="Registration Successful!" errorText={error || "Registration Failed"} />
        </div>
      </form>
      <div className="register-footer">
        Already have an account? <Link to="/login" className="register-login-link">Login</Link>
      </div>
    </div>
  );
}
