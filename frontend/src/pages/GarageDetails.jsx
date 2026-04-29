import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { Star, MapPin, Phone, ShieldCheck, PenTool } from 'lucide-react';

export default function GarageDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  
  const [garage, setGarage] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const [resGarage, resReviews] = await Promise.all([
          api.get(`/garages/${id}`),
          api.get(`/reviews/garage/${id}`)
        ]);
        setGarage(resGarage.data);
        setReviews(resReviews.data);
      } catch (err) {
        console.error("Error fetching garage details", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  if (loading) return <div className="animate-fade-in" style={{padding: '3rem', textAlign: 'center'}}>Loading Garage Profile...</div>;
  if (!garage) return <div style={{padding: '3rem', textAlign: 'center'}}>Garage not found (404)</div>;

  const images = garage.images?.length > 0 ? garage.images : (garage.documents?.length > 0 ? garage.documents : ['https://images.unsplash.com/photo-1599256621730-535171e28f5b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80']);
  const bgImage = images[currentImageIdx];

  const nextImage = () => setCurrentImageIdx((prev) => (prev + 1) % images.length);
  const prevImage = () => setCurrentImageIdx((prev) => (prev - 1 + images.length) % images.length);

  const formatTime = (timeStr) => {
    if(!timeStr) return '';
    const [hours, mins] = timeStr.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${mins} ${ampm}`;
  };

  const getOperatingHoursText = (timing) => {
    if (!timing) return "Operating rules unlisted";
    if (timing.is24_7) return "24/7 Active Service";
    
    let text = `${formatTime(timing.openTime)} - ${formatTime(timing.closeTime)}`;
    if (timing.closedDays && timing.closedDays.length > 0) {
      text += ` (Closed on: ${timing.closedDays.join(', ')})`;
    }
    return text;
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '4rem' }}>
      
      {/* Hero Banner */}
      <div style={{ 
        height: '300px', 
        borderRadius: '16px', 
        overflow: 'hidden', 
        position: 'relative',
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        marginBottom: '2rem',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
      }}>
        <div style={{
          position: 'absolute', inset: 0, 
          background: 'linear-gradient(to top, var(--bg-primary) 0%, rgba(0,0,0,0.1) 100%)',
          transition: 'all 0.5s ease-in-out'
        }} />

        {images.length > 1 && (
          <>
            <button onClick={prevImage} style={{position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', zIndex: 10}}>❮</button>
            <button onClick={nextImage} style={{position: 'absolute', top: '50%', right: '1rem', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', zIndex: 10}}>❯</button>
            <div style={{position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem'}}>
              {currentImageIdx + 1} / {images.length}
            </div>
          </>
        )}

        <div style={{ position: 'absolute', bottom: '2rem', left: '2rem', right: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ color: 'white', fontSize: '3rem', marginBottom: '0.5rem', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>{garage.name}</h1>
            <div style={{ display: 'flex', gap: '1rem', color: '#e2e8f0', fontSize: '1rem' }}>
              <span style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}><MapPin size={18} /> {garage.location?.address}</span>
              <span style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}><Phone size={18} /> {garage.phone}</span>
            </div>
          </div>
          {garage.isVerified && (
            <div style={{ background: 'var(--success-color)', color: 'white', padding: '0.5rem 1rem', borderRadius: '30px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 15px rgba(34, 197, 94, 0.4)' }}>
              <ShieldCheck size={20} /> Verified Partner
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '2rem' }}>
        
        {/* Left Column: Details & Reviews */}
        <div>
          <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}><PenTool color="var(--accent-primary)" /> Services Available</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
              {['2-Wheeler Routing Maintenance', 'Emergency Puncture / Flat Tire', 'Battery Jumpstart', 'Engine Diagnostics', 'On-Site Towing Response'].map(s => (
                <span key={s} style={{ background: 'var(--bg-primary)', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '0.9rem' }}>{s}</span>
              ))}
            </div>
          </div>

          {/* New Mechanics Render Array */}
          <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}><span style={{fontSize: '1.5rem'}}>👷</span> Roster of Mechanics</h2>
            {garage.mechanics && garage.mechanics.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                {garage.mechanics.map(m => (
                  <div key={m._id} style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: m.status === 'offline' ? '1px solid #4b5563' : '1px solid var(--glass-border)', textAlign: 'center', opacity: m.status === 'offline' ? 0.6 : 1 }}>
                    <div style={{width: '60px', height: '60px', borderRadius: '50%', background: 'var(--bg-primary)', overflow: 'hidden', margin: '0 auto 1rem auto', border: m.status === 'offline' ? '2px solid #6b7280' : '2px solid var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {m.image ? <img src={m.image} alt={m.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <span style={{fontSize: '2rem'}}>👤</span>}
                    </div>
                    <strong style={{display: 'block', color: 'var(--text-primary)', marginBottom: '0.5rem'}}>{m.name}</strong>
                    <span style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', borderRadius: '4px', fontWeight: 'bold',
                      background: m.status === 'busy' ? 'rgba(239, 68, 68, 0.1)' : m.status === 'offline' ? 'rgba(156, 163, 175, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                      color: m.status === 'busy' ? 'var(--error-color)' : m.status === 'offline' ? '#9ca3af' : 'var(--success-color)' }}>
                      {m.status === 'busy' ? 'BUSY (ON ROUTE)' : m.status === 'offline' ? 'OFFLINE' : 'AVAILABLE NOW'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>No mechanics currently registered.</p>
            )}
          </div>

          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}><Star color="#fbbf24" fill="#fbbf24" /> Client Reviews & Reputation</h2>
            {reviews.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>This garage hasn't received any reviews yet.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {reviews.map(r => (
                  <div key={r._id} style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <strong style={{fontSize: '1.05rem'}}>{r.userId?.name || 'Customer'}</strong>
                      <span style={{ color: '#fbbf24', letterSpacing: '2px' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                    </div>
                    <p style={{ color: 'var(--text-primary)', fontStyle: 'italic', marginBottom: '0.5rem' }}>"{r.comment}"</p>
                    <small style={{ color: 'var(--text-secondary)' }}>{new Date(r.createdAt).toLocaleDateString()}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: CTA */}
        <div>
          <div className="glass-panel" style={{ padding: '2rem', position: 'sticky', top: '2rem', textAlign: 'center' }}>
            
            {garage.isOpen === false && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error-color)', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem' }}>
                 <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🛑</p>
                 <strong style={{ color: 'var(--error-color)', display: 'block', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Currently Offline / Closed</strong>
                 <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>This Garage is not accepting live dispatches right now. Try again during active hours.</p>
                 <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginTop: '0.8rem', fontWeight: 'bold' }}>Hours: {getOperatingHoursText(garage.timing)}</p>
              </div>
            )}

            <h3 style={{ marginBottom: '1rem' }}>Need Assistance?</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>Request an emergency rescue or book a standard appointment directly with {garage.name}.</p>
            <button 
              className={garage.isOpen === false ? 'btn-secondary' : 'btn-primary'}
              disabled={garage.isOpen === false}
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', background: garage.isOpen === false ? 'var(--bg-secondary)' : 'var(--accent-primary)', color: garage.isOpen === false ? '#6b7280' : 'white', boxShadow: garage.isOpen === false ? 'none' : '0 8px 25px rgba(59, 130, 246, 0.4)', cursor: garage.isOpen === false ? 'not-allowed' : 'pointer' }}
              onClick={() => {
                if(garage.isOpen === false) return;
                if (!user) {
                  alert("Please login first to submit a booking.");
                  navigate('/login');
                } else {
                  navigate(`/book/${garage._id}`);
                }
              }}
            >
              Request Booking Session
            </button>
            <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>By booking, you agree to direct coordination with the garage owner for physical resolution.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
