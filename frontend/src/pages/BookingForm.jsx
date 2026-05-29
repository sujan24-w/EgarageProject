import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Truck, Navigation, Calendar, Settings } from 'lucide-react';
import AppointmentPicker from '../components/AppointmentPicker';
import Spinner from '../components/Spinner';
import io from 'socket.io-client';
import toast from 'react-hot-toast';

export default function BookingForm() {
  const { garageId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('idle'); // 'idle', 'loading', 'success', 'error'
  const [garage, setGarage] = useState(null);
  
  // High-Level Pathway State
  const [formPath, setFormPath] = useState(null); // 'emergency' | 'standard'

  // Input States
  const [formData, setFormData] = useState({ 
    type: 'immediate', // 'immediate' (mechanic dispatch), 'towing', or 'standard'
    notes: '',
    vehicleBrand: '',
    vehicleModel: '',
    appointmentDate: ''
  });
  
  const [geoLocating, setGeoLocating] = useState(false);
  const [liveLocation, setLiveLocation] = useState(null);
  const [skipPayment, setSkipPayment] = useState(false);

  useEffect(() => {
    api.get(`/garages/${garageId}`).then(res => setGarage(res.data)).catch(err => console.error(err));
  }, [garageId]);

  const handleSubmit = async (e, payAdvance = false) => {
    e.preventDefault();
    setLoading(true);
    setSubmitStatus('loading');
    try {
      let locationData = undefined; 
      
      if (formPath === 'emergency') {
        if (!liveLocation) {
          setLoading(false);
          return alert("Emergency protocols require Exact GPS coordinates. Please tap 'Grab GPS' first.");
        }
        locationData = { type: 'Point', coordinates: liveLocation, address: 'Auto-detected user location' };
      }
      
      const res = await api.post('/bookings', {
        garageId,
        type: formData.type,
        issueLocation: locationData,
        notes: formData.notes,
        vehicleBrand: formPath === 'standard' ? formData.vehicleBrand : undefined,
        vehicleModel: formPath === 'standard' ? formData.vehicleModel : undefined,
        appointmentDate: formPath === 'standard' ? formData.appointmentDate : undefined
      });
      
      if (payAdvance) {
         const payRes = await api.post('/payments/esewa/initiate', { bookingId: res.data._id, isAdvance: true });
         const { formData: eSewaForm } = payRes.data;
         
         const form = document.createElement('form');
         form.method = 'POST';
         form.action = 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';

         for (const key in eSewaForm) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = eSewaForm[key];
            form.appendChild(input);
         }

         document.body.appendChild(form);
         localStorage.setItem('payment_return_url', window.location.pathname);
         form.submit();
         return; // Interrupted by eSewa redirect hook
      }

      setSubmitStatus('success');
      toast.success(formPath === 'emergency' 
        ? "Emergency SOS Sent! Rescue units are being pinged." 
        : "Appointment confirmed! View it in your dashboard.");
        
      // Notify the garage in real-time
      const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000');
      socket.emit("notify_garage", {
        garageId,
        message: formPath === 'emergency' ? "🚨 New Emergency Rescue Request!" : "📅 New Standard Appointment Booked!",
        type: formPath
      });
      setTimeout(() => socket.disconnect(), 1000);

      navigate('/my-bookings');
    } catch(err) {
      setSubmitStatus('error');
      toast.error(err.response?.data?.message || 'Dispatch failed. Check connection.');
    } finally {
      setLoading(false);
    }
  };

  if(!garage) return <div style={{padding:'2rem', textAlign:'center', color:'var(--text-secondary)'}}>Initializing securely...</div>;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '2rem auto', padding: '1rem' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{color: 'var(--text-primary)', fontSize: '2rem', marginBottom: '0.5rem'}}>Request Assistance</h2>
        <p style={{color: 'var(--text-secondary)'}}>Connecting to: <strong style={{color: 'var(--accent-primary)'}}>{garage.name}</strong></p>
      </div>

      {/* Pathway Selection Phase */}
      {!formPath && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
          
          <button onClick={() => { setFormPath('emergency'); setFormData({...formData, type: 'immediate'}); }} 
            style={{ padding: '2.5rem 1.5rem', background: 'rgba(239, 68, 68, 0.05)', border: '2px solid rgba(239, 68, 68, 0.5)', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'}
          >
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
              <Navigation size={30} />
            </div>
            <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Emergency Rescue</strong>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Immediate dispatch or GPS towing services. We'll locate you.</p>
          </button>

          <button onClick={() => { setFormPath('standard'); setFormData({...formData, type: 'standard'}); }} 
            className="glass-panel"
            style={{ padding: '2.5rem 1.5rem', border: '2px solid rgba(59, 130, 246, 0.5)', cursor: 'pointer', transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 1)'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'}
          >
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
              <Settings size={30} />
            </div>
            <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Standard Appointment</strong>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Routine checks, scheduled maintenance, or diagnostics.</p>
          </button>
          
        </div>
      )}

      {/* Emergency Form Phase */}
      {formPath === 'emergency' && (
        <form onSubmit={(e) => handleSubmit(e, false)} className="glass-panel animate-fade-in" style={{ padding: '2rem' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
             <h3 style={{ margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Navigation /> Rescue Protocol</h3>
             <button type="button" onClick={() => setFormPath(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>← Back</button>
           </div>
           
           <div className="input-group" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '8px' }}>
              <button type="button" 
                onClick={() => setFormData({...formData, type: 'immediate'})}
                style={{ flex: 1, padding: '0.8rem', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: formData.type === 'immediate' ? '#ef4444' : 'transparent', color: formData.type === 'immediate' ? 'white' : 'var(--text-secondary)' }}
              >Physical Mechanic</button>
              <button type="button" 
                onClick={() => setFormData({...formData, type: 'towing'})}
                style={{ flex: 1, padding: '0.8rem', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: formData.type === 'towing' ? '#ef4444' : 'transparent', color: formData.type === 'towing' ? 'white' : 'var(--text-secondary)', display: 'flex', justifyContent: 'center', gap: '0.3rem', alignItems: 'center' }}
              ><Truck size={18} /> Need Towing</button>
           </div>

           <div className="input-group" style={{background: 'rgba(239, 68, 68, 0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '1.5rem'}}>
              <label className="input-label" style={{color: '#ef4444'}}>Emergency Grid Coordinates</label>
              <button type="button" className="btn-secondary" style={{width: '100%', padding: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', background: liveLocation ? '#10b981' : 'transparent', color: liveLocation ? 'white' : 'var(--text-primary)', borderColor: liveLocation ? '#10b981' : 'var(--border-color)'}} onClick={() => {
               setGeoLocating(true);
                 navigator.geolocation.getCurrentPosition(
                   (pos) => { setLiveLocation([pos.coords.longitude, pos.coords.latitude]); setGeoLocating(false); },
                   (err) => { 
                     alert('GPS failed/blocked. Defaulting to Kathmandu Center coordinates so you can test the dispatch!'); 
                     setLiveLocation([85.3240, 27.7172]); 
                     setGeoLocating(false); 
                   }
                 );
              }}>
                {geoLocating ? 'Acquiring GPS Signal...' : (liveLocation ? '✓ GPS Coordinates Locked' : '📍 Upload My GPS Location')}
              </button>
              
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Or select a test location preset:</span>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: liveLocation && liveLocation[0] === 85.3240 ? 'rgba(16, 185, 129, 0.15)' : 'transparent', color: liveLocation && liveLocation[0] === 85.3240 ? '#10b981' : 'var(--text-primary)' }} onClick={() => setLiveLocation([85.3240, 27.7172])}>Kathmandu Center</button>
                  <button type="button" className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: liveLocation && liveLocation[0] === 85.3150 ? 'rgba(16, 185, 129, 0.15)' : 'transparent', color: liveLocation && liveLocation[0] === 85.3150 ? '#10b981' : 'var(--text-primary)' }} onClick={() => setLiveLocation([85.3150, 27.6700])}>Patan Lalitpur</button>
                  <button type="button" className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: liveLocation && liveLocation[0] === 85.4200 ? 'rgba(16, 185, 129, 0.15)' : 'transparent', color: liveLocation && liveLocation[0] === 85.4200 ? '#10b981' : 'var(--text-primary)' }} onClick={() => setLiveLocation([85.4200, 27.6700])}>Bhaktapur</button>
                  <button type="button" className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: liveLocation && liveLocation[0] === 85.3500 ? 'rgba(16, 185, 129, 0.15)' : 'transparent', color: liveLocation && liveLocation[0] === 85.3500 ? '#10b981' : 'var(--text-primary)' }} onClick={() => setLiveLocation([85.3500, 27.7200])}>Chabahil</button>
                </div>
              </div>
            </div>

           <div className="input-group">
             <label className="input-label">Briefly describe the emergency <span style={{color: 'red'}}>*</span></label>
             <textarea className="input-field" rows="3" required value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="E.g. Tire blew out on the highway, smoking engine." />
           </div>

           <button type="submit" className="btn-primary" style={{ width: '100%', background: '#ef4444', borderColor: '#ef4444', fontSize: '1.1rem', padding: '1rem' }} disabled={loading}>
             {loading ? 'Transmitting Data...' : 'Dispatch Help Now'}
           </button>
        </form>
      )}

      {/* Standard Appointment Form Phase */}
      {formPath === 'standard' && (
        <form onSubmit={(e) => handleSubmit(e, false)} className="glass-panel animate-fade-in" style={{ padding: '2rem' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
             <h3 style={{ margin: 0, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Settings /> Routine Diagnostics</h3>
             <button type="button" onClick={() => setFormPath(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>← Back</button>
           </div>
           
           <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
             <div className="input-group" style={{ flex: 1 }}>
               <label className="input-label">Maker / Company <span style={{color: 'red'}}>*</span></label>
               <input type="text" className="input-field" required value={formData.vehicleBrand} onChange={e => setFormData({...formData, vehicleBrand: e.target.value})} placeholder="E.g. Honda, Yamaha, TVS" />
             </div>
             <div className="input-group" style={{ flex: 1 }}>
               <label className="input-label">Vehicle Model <span style={{color: 'red'}}>*</span></label>
               <input type="text" className="input-field" required value={formData.vehicleModel} onChange={e => setFormData({...formData, vehicleModel: e.target.value})} placeholder="E.g. Dio, FZ-S, Ntorq" />
             </div>
           </div>

           <AppointmentPicker 
             garage={garage} 
             onDateSelect={(dateObj) => setFormData({...formData, appointmentDate: dateObj ? dateObj.toISOString() : ''})} 
           />

           <div className="input-group">
             <label className="input-label">Identified Issue / Description <span style={{color: 'red'}}>*</span></label>
             <textarea className="input-field" rows="4" required value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="Describe what feels wrong with the vehicle or what service you require..." />
           </div>

           <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
             <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
               <strong>Billing Options:</strong> You can either pay a non-compulsory Rs. 500 advance fee to lock your slot, OR skip payment completely until the Garage provides a final post-service invoice!
             </p>
             <div style={{ display: 'flex', gap: '1rem' }}>
               <button type="button" onClick={(e) => handleSubmit(e, true)} className="btn-primary" style={{ flex: 3, background: '#10b981', borderColor: '#10b981', color: 'white' }} disabled={loading}>
                 Pay Rs. 500 Advance
               </button>
               <button type="button" onClick={() => setSkipPayment(true)} className="btn-secondary" style={{ flex: 2 }} disabled={loading || skipPayment}>
                 Skip Payment
               </button>
             </div>
             
             {skipPayment && (
               <div className="animate-fade-in" style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                 <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>You opted to skip the advance. Please confirm your booking.</p>
                 <button type="submit" className="btn-primary" style={{ width: '100%', background: '#3b82f6', borderColor: '#3b82f6' }} disabled={loading}>
                   {loading ? 'Securing Appointment...' : 'Confirm Booking'}
                 </button>
               </div>
             )}

             <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
               <Spinner status={submitStatus} loadingText="Securing Appointment..." successText="Booking Confirmed!" errorText="Failed to Book" />
             </div>
           </div>

        </form>
      )}

    </div>
  )
}
