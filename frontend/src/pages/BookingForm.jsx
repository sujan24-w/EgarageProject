import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Truck, Navigation, Calendar, Settings } from 'lucide-react';

export default function BookingForm() {
  const { garageId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    api.get(`/garages/${garageId}`).then(res => setGarage(res.data)).catch(err => console.error(err));
  }, [garageId]);

  const handleSubmit = async (e, payAdvance = false) => {
    e.preventDefault();
    setLoading(true);
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
         form.submit();
         return; // Interrupted by eSewa redirect hook
      }

      alert(formPath === 'emergency' 
        ? "Emergency SOS Sent! Rescue units are being pinged." 
        : "Appointment confirmed! View it in your dashboard.");
      navigate('/my-bookings');
    } catch(err) {
      alert(err.response?.data?.message || 'Dispatch failed. Check connection.');
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
            <strong style={{ fontSize: '1.2rem', color: 'white' }}>Emergency Rescue</strong>
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
            <strong style={{ fontSize: '1.2rem', color: 'white' }}>Standard Appointment</strong>
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
             <button type="button" className="btn-secondary" style={{width: '100%', padding: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', background: liveLocation ? '#10b981' : 'transparent', color: liveLocation ? 'white' : 'white', borderColor: liveLocation ? '#10b981' : 'rgba(255,255,255,0.2)'}} onClick={() => {
               setGeoLocating(true);
               navigator.geolocation.getCurrentPosition(
                 (pos) => { setLiveLocation([pos.coords.longitude, pos.coords.latitude]); setGeoLocating(false); },
                 (err) => { alert('Failed. Check browser location permissions.'); setGeoLocating(false); }
               );
             }}>
               {geoLocating ? 'Hacking Satellites...' : (liveLocation ? '✓ Physical Coordinates Locked' : '📍 Transmit GPS Coordinates')}
             </button>
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

           <div className="input-group">
             <label className="input-label">Preferred Date & Time Placeholder <span style={{color: 'red'}}>*</span></label>
             <input type="datetime-local" className="input-field" required value={formData.appointmentDate} onChange={e => setFormData({...formData, appointmentDate: e.target.value})} />
           </div>

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
               <button type="submit" className="btn-secondary" style={{ flex: 2 }} disabled={loading}>
                 {loading ? 'Booking...' : 'Skip for now'}
               </button>
             </div>
           </div>

        </form>
      )}

    </div>
  )
}
