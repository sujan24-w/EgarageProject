import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import { Star, MapPin, Phone, CheckCircle, Navigation, MessageSquare } from 'lucide-react';
import Spinner from '../components/Spinner';

export default function MechanicProfile({ mechanicIdProp }) {
  const params = useParams();
  const id = mechanicIdProp || params.id;
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const fetchProfile = async () => {
      try {
        const res = await api.get(`/mechanics/profile/${id}`);
        setProfileData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load mechanic profile.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [id]);

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center' }}><Spinner status="loading" loadingText="Loading profile..." /></div>;
  if (error) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--error-color)' }}>{error}</div>;
  if (!profileData) return <div style={{ padding: '4rem', textAlign: 'center' }}>Profile not found.</div>;

  const { mechanic, reviews, stats } = profileData;

  const renderStars = (rating) => {
    return Array(5).fill(0).map((_, i) => (
      <Star key={i} size={16} fill={i < Math.floor(rating) ? "#f59e0b" : "transparent"} color={i < Math.floor(rating) ? "#f59e0b" : "var(--text-secondary)"} style={{ marginRight: '2px' }} />
    ));
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '4rem' }}>
      
      {/* Edge-to-edge Header Banner */}
      <div style={{ 
        background: 'linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-primary) 100%)',
        borderBottom: '1px solid var(--border-color)',
        padding: '4rem 2rem 6rem 2rem',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle background accent */}
        <div style={{ position: 'absolute', top: '-100px', left: '50%', transform: 'translateX(-50%)', width: '400px', height: '400px', background: 'var(--accent-primary)', opacity: 0.05, filter: 'blur(80px)', borderRadius: '50%' }}></div>
        
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '3.5rem', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
            {mechanic.name}
            {mechanic.isVerified && <CheckCircle size={32} color="var(--success-color)" fill="rgba(34, 197, 94, 0.1)" title="Verified Professional" />}
          </h1>
          <p style={{ color: 'var(--accent-primary)', fontSize: '1.2rem', fontWeight: '500', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Certified Professional Mechanic
          </p>
        </div>
      </div>

      {/* Main Content Area - Pulling up over the header */}
      <div style={{ maxWidth: '1000px', margin: '-4rem auto 0 auto', padding: '0 1.5rem', position: 'relative', zIndex: 10 }}>
        
        {/* Profile Avatar & Quick Info Row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2rem', marginBottom: '4rem', flexWrap: 'wrap' }}>
          <div style={{ 
            width: '160px', 
            height: '160px', 
            borderRadius: '50%', 
            border: '6px solid var(--bg-primary)', 
            boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
            background: 'var(--bg-secondary)',
            overflow: 'hidden',
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            {mechanic.image ? (
              <img src={mechanic.image} alt={mechanic.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '5rem' }}>👨‍🔧</span>
            )}
          </div>

          <div style={{ flex: 1, display: 'flex', gap: '2.5rem', flexWrap: 'wrap', paddingBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Phone size={20} color="var(--accent-primary)" />
              </div>
              {mechanic.phone}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Star size={20} color="#f59e0b" fill="#f59e0b" />
              </div>
              <span style={{ fontWeight: 'bold' }}>{stats.avgRating}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>({reviews.length} reviews)</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <span style={{ 
                padding: '0.5rem 1rem', 
                borderRadius: '30px', 
                fontSize: '0.95rem',
                fontWeight: '600',
                background: mechanic.status === 'available' ? 'rgba(34, 197, 94, 0.1)' : mechanic.status === 'busy' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                color: mechanic.status === 'available' ? 'var(--success-color)' : mechanic.status === 'busy' ? 'var(--error-color)' : 'var(--text-secondary)',
                border: `1px solid ${mechanic.status === 'available' ? 'var(--success-color)' : mechanic.status === 'busy' ? 'var(--error-color)' : 'var(--text-secondary)'}`
              }}>
                {mechanic.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4rem', flexWrap: 'wrap' }}>
          
          {/* Left Column: Flowing Stats & Affiliation */}
          <div style={{ flex: '1', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '3rem' }}>
            
            <section>
              <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                Track Record
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <span style={{ fontSize: '3.5rem', fontWeight: '300', color: 'var(--text-primary)', lineHeight: 1 }}>{stats.totalJobs}</span>
                  <span style={{ display: 'block', color: 'var(--accent-primary)', fontSize: '1.1rem', fontWeight: '500', marginTop: '0.3rem' }}>Successful Rescues</span>
                </div>
                <div>
                  <span style={{ fontSize: '3.5rem', fontWeight: '300', color: 'var(--text-primary)', lineHeight: 1 }}>{stats.avgRating}</span>
                  <span style={{ display: 'block', color: '#f59e0b', fontSize: '1.1rem', fontWeight: '500', marginTop: '0.3rem' }}>Average Client Rating</span>
                </div>
              </div>
            </section>

            {mechanic.garageId && (
              <section>
                <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  Affiliated Garage
                </h3>
                
                <Link to={`/garage/${mechanic.garageId._id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ 
                    display: 'flex', 
                    gap: '1.2rem', 
                    alignItems: 'center',
                    padding: '1rem',
                    borderRadius: '12px',
                    transition: 'background 0.2s',
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border-color)' }}>
                      {mechanic.garageId.images?.[0] ? (
                        <img src={mechanic.garageId.images[0]} alt="Garage" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🏢</div>
                      )}
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 0.3rem 0', fontSize: '1.2rem', color: 'var(--text-primary)' }}>{mechanic.garageId.name}</h4>
                      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <MapPin size={14} /> {mechanic.garageId.location?.address || 'Location hidden'}
                      </p>
                    </div>
                  </div>
                </Link>
              </section>
            )}
          </div>

          {/* Right Column: Clean List Reviews */}
          <div style={{ flex: '2', minWidth: '400px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: 'var(--text-primary)', fontSize: '1.8rem', marginBottom: '2rem' }}>
              <MessageSquare size={28} color="var(--accent-primary)" /> Client Reviews
            </h3>

            {reviews.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', fontStyle: 'italic' }}>No reviews yet. Be the first to book and review this mechanic!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {reviews.map(review => (
                  <div key={review._id} style={{ 
                    padding: '2rem 0', 
                    borderBottom: '1px solid var(--border-color)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                          {(review.userId?.name || 'A')[0].toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{review.userId?.name || 'Anonymous Client'}</strong>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            {new Date(review.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {renderStars(review.rating)}
                      </div>
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem', lineHeight: 1.7, paddingLeft: '3.5rem' }}>"{review.comment}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
