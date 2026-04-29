import { useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { User, Calendar, CreditCard, MapPin } from 'lucide-react';
import io from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

// User = Red
const userIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41]
});

// Mechanic = Green
const mechanicIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41]
});

// Garage = Blue
const garageIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41]
});

// Helper to fit bounds continuously
function TrackingBounds({ userPos, mechPos }) {
  const map = useMap();
  useEffect(() => {
    if (userPos && mechPos) {
      const bounds = L.latLngBounds([userPos, mechPos]);
      // Enable smooth animation so the viewport fluidly glides as the tracker pings
      map.fitBounds(bounds, { 
        padding: [50, 50], 
        maxZoom: 18,
        animate: true,
        duration: 0.8
      });
    } else if (userPos) {
      map.setView(userPos, 16);
    }
  }, [userPos, mechPos, map]);
  return null;
}

export default function MyBookings() {
  const { user, theme, login } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('profile');
  
  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({ name: '', phone: '', profileImage: '' });
  const [uploadingProfilePic, setUploadingProfilePic] = useState(false);
  
  // Data States
  const [bookings, setBookings] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  
  // Filtering & Viewing
  const [filter, setFilter] = useState('all');
  const [viewingBooking, setViewingBooking] = useState(null);

  // Review State
  const [reviewingId, setReviewingId] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  // Live Tracking State
  const [trackingSession, setTrackingSession] = useState(null);
  // trackingSession = { bookingId, userPos: [lat, lng], mechPos: [lat, lng], mechanicName, garageName }

  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('mechanic_location_updated', (data) => {
       setTrackingSession(prev => {
         if (!prev || prev.bookingId !== data.bookingId) return prev;
         return {
           ...prev,
           mechPos: [data.lat, data.lng]
         };
       });
    });

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [bookingsRes, receiptsRes] = await Promise.all([
          api.get('/bookings/mybookings'),
          api.get('/payments/receipts').catch(() => ({ data: [] }))
        ]);
        // Sort bookings by creation date descending
        const sortedBookings = bookingsRes.data.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        setBookings(sortedBookings);
        setReceipts(receiptsRes.data);
      } catch(err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchData();
    }
  }, [user]);

  const triggerEdit = () => {
    setProfileData({ name: user.name, phone: user.phone || '', profileImage: user.profileImage || '' });
    setIsEditingProfile(true);
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put('/auth/profile', profileData);
      login(res.data); // Update global context immediately
      setIsEditingProfile(false);
      alert("Personal Profile successfully mapped and updated!");
    } catch(err) {
      alert("Failed to sync profile: " + (err.response?.data?.message || err.message));
    }
  };

  const handleProfileImageUpload = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const form = new FormData();
    form.append('image', file);
    form.append('type', 'user_profile');
    
    setUploadingProfilePic(true);
    try {
      const res = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfileData({...profileData, profileImage: res.data.url});
    } catch(err) {
      alert("Secure upload failed. Check connection.");
    } finally {
      setUploadingProfilePic(false);
    }
  };

  const submitReview = async (e, garageId, bookingId) => {
    e.preventDefault();
    try {
      await api.post('/reviews', { garageId, bookingId, rating, comment });
      alert("Review posted successfully! Thank you for the feedback.");
      setReviewingId(null);
      setComment('');
      setRating(5);
    } catch(err) {
      alert("Failed to submit review: " + (err.response?.data?.message || err.message));
    }
  };

  const handleEsewaPayment = async (bookingId) => {
    try {
      const res = await api.post('/payments/esewa/initiate', { bookingId });
      const { formData } = res.data;
      
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';

      for (const key in formData) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = formData[key];
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      alert("Billing initiation failed: " + (err.response?.data?.message || err.message));
    }
  };

  const handleMarkArrived = async (bookingId) => {
    try {
      await api.put(`/bookings/${bookingId}/status`, { status: 'in-progress' });
      alert("Mechanic verified. Vehicle maintenance officially commenced!");
      setTrackingSession(null);
      fetchMyBookings();
    } catch(err) {
      alert("Error marking arrival: " + (err.response?.data?.message || err.message));
    }
  };

  const cancelBooking = async (id) => {
    if (!window.confirm("Are you sure you want to totally abort this appointment/rescue request?")) return;
    try {
      await api.put(`/bookings/${id}`, { status: 'cancelled' });
      alert("Operation successfully aborted.");
      setLoading(true);
      const bookingsRes = await api.get('/bookings/mybookings');
      setBookings(bookingsRes.data.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (err) {
      alert("Cancellation failed: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const openTracker = (b) => {
    if (!socket) return alert("Socket unconnected.");
    socket.emit('join_booking', b._id);
    
    // Initial tracking state uses garage coordinates as starting point if mechanic hasn't nudged
    const gLng = b.garageId?.location?.coordinates[0] || 85.32;
    const gLat = b.garageId?.location?.coordinates[1] || 27.71;
    
    // Fallback user location if missing
    const uLng = b.issueLocation?.coordinates[0] || gLng + 0.01;
    const uLat = b.issueLocation?.coordinates[1] || gLat + 0.01;

    setTrackingSession({
      bookingId: b._id,
      userPos: [uLat, uLng],
      mechPos: [gLat, gLng],
      garagePos: [gLat, gLng],
      mechanicName: b.mechanicId?.name || "Assigned Mechanic",
      garageName: b.garageId?.name || "Garage"
    });
  };

  const filteredBookings = bookings.filter(b => {
    if (filter === 'all') return true;
    if (filter === 'pending') return b.status === 'pending';
    if (filter === 'accepted') return b.status === 'accepted' || b.status === 'in-progress';
    if (filter === 'payment_pending') return b.status === 'completed' && b.paymentStatus === 'pending' && b.totalAmount > 0;
    if (filter === 'completed') return b.status === 'completed' && b.paymentStatus === 'paid';
    if (filter === 'cancelled') return b.status === 'cancelled' || b.status === 'rejected';
    return true;
  });

  if (loading) return <div style={{padding: '2rem', textAlign: 'center'}}>Loading Dashboard...</div>;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start', position: 'relative' }}>
      
      {/* Sidebar Navigation */}
      <div className="glass-panel" style={{ flex: '1 1 250px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{color: 'var(--text-primary)', marginBottom: '1rem'}}>User Dashboard</h3>
        
        <button 
          onClick={() => setActiveTab('profile')}
          className={`btn-secondary`} 
          style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.8rem', borderColor: activeTab === 'profile' ? 'var(--accent-primary)' : '', color: activeTab === 'profile' ? 'var(--accent-primary)' : '' }}
        >
          <User size={20} /> My Profile
        </button>
        
        <button 
          onClick={() => setActiveTab('bookings')}
          className={`btn-secondary`} 
          style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.8rem', borderColor: activeTab === 'bookings' ? 'var(--accent-primary)' : '', color: activeTab === 'bookings' ? 'var(--accent-primary)' : '' }}
        >
          <Calendar size={20} /> Active & Past Bookings
        </button>

        <button 
          onClick={() => setActiveTab('billing')}
          className={`btn-secondary`} 
          style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.8rem', borderColor: activeTab === 'billing' ? 'var(--accent-primary)' : '', color: activeTab === 'billing' ? 'var(--accent-primary)' : '' }}
        >
          <CreditCard size={20} /> Payment & Receipts
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: '3 1 600px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
           <div className="glass-panel animate-fade-in" style={{ padding: '2rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
               <h2 style={{color: 'var(--accent-primary)', margin: 0}}>Personal Account Settings</h2>
               {!isEditingProfile && (
                 <button className="btn-secondary" onClick={triggerEdit}>✏️ Edit Profile</button>
               )}
             </div>
             
             {isEditingProfile ? (
               <form onSubmit={handleProfileUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '500px' }} className="animate-fade-in">
                 
                 <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--accent-primary)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
                      {profileData.profileImage ? <img src={profileData.profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" /> : <span style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', fontSize: '2rem' }}>👤</span>}
                    </div>
                    <div>
                      <label className="input-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Update Cloudinary Avatar</label>
                      <input type="file" className="input-field" accept="image/*" onChange={handleProfileImageUpload} style={{ padding: '0.5rem' }} />
                      {uploadingProfilePic && <span style={{ color: 'var(--accent-primary)', fontSize: '0.85rem' }}>Uploading secure image...</span>}
                    </div>
                 </div>

                 <div className="input-group">
                   <label className="input-label">Full Name <span style={{color: 'red'}}>*</span></label>
                   <input type="text" className="input-field" required value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} />
                 </div>
                 
                 <div className="input-group">
                   <label className="input-label">Contact Route (Phone)</label>
                   <input type="text" className="input-field" value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} placeholder="e.g. 9812345678" />
                 </div>

                 <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                   <button type="submit" className="btn-primary" disabled={uploadingProfilePic}>Apply Modifications</button>
                   <button type="button" className="btn-secondary" onClick={() => setIsEditingProfile(false)}>Cancel Edit</button>
                 </div>
               </form>
             ) : (
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }} className="animate-fade-in">
                 <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ width: '100px', height: '100px', borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--accent-primary)', background: 'var(--bg-secondary)' }}>
                      {user?.profileImage ? <img src={user.profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="User Avatar" /> : <span style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', fontSize: '3rem' }}>👤</span>}
                    </div>
                    <div>
                      <h3 style={{ margin: '0 0 0.2rem 0', color: 'var(--text-primary)', fontSize: '1.5rem' }}>{user?.name}</h3>
                      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Level 1 Verified Dispatch Client</p>
                    </div>
                 </div>

                 <div>
                   <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.3rem'}}>Registered Email Address</p>
                   <p style={{fontSize: '1.1rem', fontWeight: 'bold'}}>{user?.email}</p>
                 </div>
                 <div>
                   <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.3rem'}}>Direct Contact Layer</p>
                   <p style={{fontSize: '1.1rem', fontWeight: 'bold', color: user?.phone ? 'inherit' : '#ef4444'}}>{user?.phone || 'Missing - Update Required!'}</p>
                 </div>
                 <div>
                   <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.3rem'}}>Security Clearance</p>
                   <p style={{fontSize: '1.1rem', fontWeight: 'bold'}}>{user?.role === 'user' ? 'Standard Customer' : user?.role}</p>
                 </div>
               </div>
             )}
           </div>
        )}

        {/* BOOKINGS TAB */}
        {activeTab === 'bookings' && (
           <div className="glass-panel animate-fade-in" style={{ padding: '2rem' }}>
             <h2 style={{color: 'var(--accent-primary)', marginBottom: '1.5rem'}}>My Bookings & Rescues</h2>
             
             {/* Filter Controls */}
             <div style={{display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)'}}>
               <button className={filter === 'all' ? 'btn-primary' : 'btn-secondary'} style={{padding: '0.4rem 1rem'}} onClick={() => setFilter('all')}>All Requests</button>
               <button className={filter === 'pending' ? 'btn-primary' : 'btn-secondary'} style={{padding: '0.4rem 1rem'}} onClick={() => setFilter('pending')}>Pending Approval</button>
               <button className={filter === 'accepted' ? 'btn-primary' : 'btn-secondary'} style={{padding: '0.4rem 1rem'}} onClick={() => setFilter('accepted')}>Active Dispatches</button>
               <button className={filter === 'payment_pending' ? 'btn-primary' : 'btn-secondary'} style={{padding: '0.4rem 1rem'}} onClick={() => setFilter('payment_pending')}>Payment Pending</button>
               <button className={filter === 'completed' ? 'btn-primary' : 'btn-secondary'} style={{padding: '0.4rem 1rem'}} onClick={() => setFilter('completed')}>Completed History</button>
               <button className={filter === 'cancelled' ? 'btn-primary' : 'btn-secondary'} style={{padding: '0.4rem 1rem'}} onClick={() => setFilter('cancelled')}>Cancelled/Rejected</button>
             </div>

             {filteredBookings.length === 0 ? <p style={{color: 'var(--text-secondary)'}}>No bookings found for the selected filter.</p> : (
               <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                 {filteredBookings.map(b => (
                   <div key={b._id} className="animate-fade-in" style={{border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: '12px', background: 'var(--bg-primary)', position: 'relative'}}>
                     <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem'}}>
                       <h3 style={{ margin: 0 }}>{b.garageId?.name || 'Unknown Garage'}</h3>
                       
                       <div style={{display: 'flex', gap: '0.8rem', alignItems: 'center'}}>
                         <button className="btn-secondary" style={{borderColor: '#3b82f6', color: '#3b82f6', padding: '0.3rem 0.8rem', fontSize: '0.85rem'}} onClick={() => setViewingBooking(b)}>👁️ View Details</button>
                         { (b.status === 'pending' || b.status === 'accepted') && (
                           <button className="btn-secondary" style={{borderColor: '#ef4444', color: '#ef4444', padding: '0.3rem 0.8rem', fontSize: '0.85rem'}} onClick={() => cancelBooking(b._id)}>✕ Abort</button>
                         )}
                         <span style={{
                           padding: '0.3rem 0.8rem',
                           borderRadius: '20px',
                           fontWeight: 'bold',
                           fontSize: '0.85rem',
                           background: b.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : 
                                      (b.status === 'rejected' || b.status === 'cancelled') ? 'rgba(239, 68, 68, 0.2)' : 
                                      b.status === 'in-progress' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                           color: b.status === 'completed' ? '#10b981' : 
                                  (b.status === 'rejected' || b.status === 'cancelled') ? '#ef4444' : 
                                  b.status === 'in-progress' ? '#f59e0b' : '#3b82f6'
                         }}>
                           {b.status.toUpperCase()}
                         </span>
                       </div>
                     </div>
                     
                     <p style={{color: 'var(--text-secondary)', marginBottom: '0.5rem'}}>
                       <strong>Type:</strong> <span style={{ textTransform: 'capitalize' }}>{b.type}</span> | <strong>Date:</strong> {new Date(b.createdAt).toLocaleDateString()}
                     </p>
                     {b.mechanicId && <p style={{color: 'var(--text-secondary)', marginBottom: '0.5rem'}}><strong>Mechanic Dispatched:</strong> {b.mechanicId.name}</p>}
                     
                     {/* Live Tracker Entry Point */}
                     {b.status === 'accepted' && (b.type === 'immediate' || b.type === 'towing') && (
                       <div style={{marginTop: '1rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px'}}>
                         <p style={{color: 'var(--accent-primary)', fontWeight: 'bold', marginBottom: '0.5rem'}}>Mechanic is on the way!</p>
                         <button className="btn-primary" onClick={() => openTracker(b)} style={{width: '100%'}}>
                           🔴 View Live Radar Route
                         </button>
                       </div>
                     )}

                     {b.status === 'in-progress' && (
                       <div style={{marginTop: '1rem', padding: '1rem', background: 'rgba(251, 191, 36, 0.05)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: '8px'}}>
                         <p style={{color: '#f59e0b', fontWeight: 'bold', marginBottom: '0', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>⚙️ Mechanic is actively working on your vehicle on-site.</p>
                       </div>
                     )}

                     {b.status === 'completed' && (
                       <div style={{marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)'}}>
                         
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                           {b.paymentStatus === 'pending' && b.totalAmount > 0 ? (
                             <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1.5rem', borderRadius: '8px', border: '1px solid #10b981', flex: 1 }}>
                               <h4 style={{ color: '#10b981', margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>Outstanding Garage Invoice</h4>
                               
                               {b.costBreakdown && b.costBreakdown.length > 0 && (
                                 <div style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                   <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Line-Item Breakdown:</p>
                                   <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                     {b.costBreakdown.map((item, idx) => (
                                       <li key={idx} style={{ marginBottom: '0.3rem' }}>
                                         {item.item} — <strong style={{color: item.price < 0 ? '#fbbf24' : 'inherit'}}>Rs. {item.price}</strong>
                                       </li>
                                     ))}
                                     {b.advanceAmountPaid > 0 && (
                                       <li style={{ marginBottom: '0.3rem', color: '#3b82f6' }}>
                                         Initial Advance Payment Deduction — <strong>- Rs. {b.advanceAmountPaid}</strong>
                                       </li>
                                     )}
                                   </ul>
                                 </div>
                               )}

                               <p style={{ margin: '0 0 1rem 0', fontSize: '1.6rem', fontWeight: 'bold', color: '#10b981', borderTop: '2px solid rgba(16,185,129,0.3)', paddingTop: '0.8rem' }}>Net Total Due: Rs. {b.totalAmount}</p>
                               <button className="btn-primary" style={{ background: '#10b981', borderColor: '#10b981', color: 'white', width: '100%', padding: '1rem', fontSize: '1.1rem' }} onClick={() => handleEsewaPayment(b._id)}>Secure Checkout via eSewa</button>
                             </div>
                           ) : b.paymentStatus === 'paid' ? (
                             <div style={{ flex: 1 }}>
                               <span style={{ padding: '0.4rem 1rem', background: '#10b981', color: 'white', borderRadius: '20px', fontWeight: 'bold' }}>✓ Invoice Paid natively</span>
                             </div>
                           ) : (
                             <div style={{ flex: 1 }}>
                               <span style={{ color: 'var(--text-secondary)' }}>Pending garage invoice resolution...</span>
                             </div>
                           )}
                         </div>

                         {reviewingId === b._id ? (
                           <form onSubmit={(e) => submitReview(e, b.garageId?._id, b._id)} style={{background: 'var(--glass-bg)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
                             <h4 style={{marginBottom: '1rem', color: 'var(--text-primary)'}}>Leave a Review</h4>
                             <select className="input-field" value={rating} onChange={e => setRating(e.target.value)} style={{marginBottom: '1rem'}}>
                               <option value="5">⭐⭐⭐⭐⭐ (Excellent)</option>
                               <option value="4">⭐⭐⭐⭐ (Good)</option>
                               <option value="3">⭐⭐⭐ (Average)</option>
                               <option value="2">⭐⭐ (Poor)</option>
                               <option value="1">⭐ (Terrible)</option>
                             </select>
                             <label className="input-label" style={{marginTop: '0.5rem', display: 'block'}}>Review Comments <span style={{color: 'red'}}>*</span></label>
                             <textarea className="input-field" rows="3" placeholder="Tell others about your experience..." required value={comment} onChange={e => setComment(e.target.value)} style={{marginBottom: '1rem'}}></textarea>
                             <div style={{display: 'flex', gap: '1rem'}}>
                               <button type="submit" className="btn-primary">Post Feedback</button>
                               <button type="button" className="btn-secondary" onClick={() => setReviewingId(null)}>Cancel</button>
                             </div>
                           </form>
                         ) : (
                           <button className="btn-secondary" style={{borderColor: '#fbbf24', color: '#fbbf24'}} onClick={() => setReviewingId(b._id)}>
                             ⭐ Write a Review
                           </button>
                         )}
                       </div>
                     )}
                   </div>
                 ))}
               </div>
             )}
           </div>
        )}

        {/* BILLING TAB */}
        {activeTab === 'billing' && (
           <div className="glass-panel animate-fade-in" style={{ padding: '2rem' }}>
             <h2 style={{color: 'var(--accent-primary)', marginBottom: '1.5rem'}}>Payment History & Receipts</h2>
             {receipts.length === 0 ? <p style={{color: 'var(--text-secondary)'}}>No receipts found. You haven't made any payments yet.</p> : (
               <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                 {receipts.map(r => (
                   <div key={r._id} style={{ border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: '12px', background: 'var(--bg-primary)' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                       <div>
                         <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Garage Service @ {r.garageId?.name || 'Network Partner'}</h4>
                         <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}><strong>Issued:</strong> {new Date(r.createdAt).toLocaleString()}</p>
                         <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}><strong>Operation Core:</strong> #{r.bookingId?.slice(-6).toUpperCase()}</p>
                         <span style={{ 
                           display: 'inline-block', 
                           padding: '0.3rem 0.8rem', 
                           background: r.status === 'completed' ? '#10b98122' : '#f59e0b22', 
                           color: r.status === 'completed' ? '#10b981' : '#f59e0b', 
                           borderRadius: '20px', 
                           fontSize: '0.85rem',
                           fontWeight: 'bold',
                           marginTop: '0.5rem'
                         }}>
                           {r.status === 'completed' ? '✓ Verified Safe via ' + r.paymentMethod : 'Awaiting Ledger Sync...'}
                         </span>
                       </div>
                       <div style={{ textAlign: 'right', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                         <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 0.2rem 0' }}>Settled Asset Transfer</p>
                         <p style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0 0 0.3rem 0', color: '#10b981' }}>Rs. {r.totalAmount}</p>
                         <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0, fontFamily: 'monospace' }}>TXN: {r.transactionId || 'N/A'}</p>
                         <button className="btn-secondary" style={{ marginTop: '0.8rem', width: '100%', padding: '0.3rem 0.5rem', fontSize: '0.8rem' }} onClick={() => alert("Digital receipt PDF generation API arrives in v2.0!")}>⬇ Download Copy</button>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             )}
           </div>
        )}

      </div>

      {trackingSession && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh', background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
           <div className="animate-fade-in" style={{ width: '90%', maxWidth: '1000px', height: '80vh', background: 'var(--bg-primary)', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              
              <div style={{ padding: '1.5rem', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                 <div>
                   <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Live Dispatch Radar</h2>
                   <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)' }}>Monitoring: {trackingSession.mechanicName} ({trackingSession.garageName})</p>
                 </div>
                 <div style={{ display: 'flex', gap: '1rem' }}>
                   <button onClick={() => handleMarkArrived(trackingSession.bookingId)} className="btn-primary" style={{ background: '#10b981', borderColor: '#10b981', color: 'white', fontWeight: 'bold' }}>
                     ✓ Mark Mechanic Arrived
                   </button>
                   <button className="btn-secondary" onClick={() => setTrackingSession(null)} style={{ borderColor: 'var(--error-color)', color: 'var(--error-color)' }}>Close Map</button>
                 </div>
              </div>

              <div style={{ flex: 1, position: 'relative' }}>
                <MapContainer center={trackingSession.userPos} zoom={13} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    url={theme === 'dark' 
                      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    }
                    attribution='&copy; CARTO'
                  />
                  <TrackingBounds userPos={trackingSession.userPos} mechPos={trackingSession.mechPos} />
                  
                  {/* Garage Base Pin (Blue) */}
                  <Marker position={trackingSession.garagePos} icon={garageIcon}>
                    <Popup><strong>{trackingSession.garageName} Base HQ (Blue)</strong></Popup>
                  </Marker>
                  
                  {/* User Pin (Red) */}
                  <Marker position={trackingSession.userPos} icon={userIcon}>
                    <Popup><strong>{user?.name || 'You'} are here (Red)</strong></Popup>
                  </Marker>
                  
                  {/* Mechanic Pin (Green) */}
                  <Marker position={trackingSession.mechPos} icon={mechanicIcon}>
                    <Popup><strong>{trackingSession.mechanicName} (Green)</strong><br/>En route to location.</Popup>
                  </Marker>

                  {/* Polyline Route Estimate */}
                  <Polyline positions={[trackingSession.mechPos, trackingSession.userPos]} color="#10b981" weight={4} dashArray="5, 10" />
                </MapContainer>
                
                {/* Distance overlay */}
                <div style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'var(--bg-primary)', padding: '1rem 2rem', borderRadius: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', border: '2px solid var(--accent-primary)', textAlign: 'center' }}>
                  <strong style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>
                    { Math.round(L.latLng(trackingSession.userPos[0], trackingSession.userPos[1]).distanceTo(L.latLng(trackingSession.mechPos[0], trackingSession.mechPos[1])) / 100) / 10 } km
                  </strong>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Distance remaining</p>
                </div>
              </div>

           </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {viewingBooking && (
        <div className="modal-overlay animate-fade-in" style={{zIndex: 100000}} onClick={() => setViewingBooking(null)}>
          <div className="modal-content" style={{maxWidth: '600px', width: '90%', padding: '2rem'}} onClick={e => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setViewingBooking(null)}>✕</button>
            <h2 style={{color: 'var(--accent-primary)', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem'}}>
              Operation Dossier
            </h2>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.8rem'}}>
              <p><strong>Affiliated Garage:</strong> <span style={{color: 'var(--text-secondary)'}}>{viewingBooking.garageId?.name} (📞 {viewingBooking.garageId?.phone})</span></p>
              <p><strong>Operation Code:</strong> <span style={{textTransform: 'capitalize', color: 'var(--text-secondary)'}}>{viewingBooking.type} Base</span></p>
              <p><strong>Current Status:</strong> <span style={{color: 'var(--text-secondary)', fontWeight: 'bold'}}>{viewingBooking.status.toUpperCase()}</span></p>
              <p><strong>Timestamp Created:</strong> <span style={{color: 'var(--text-secondary)'}}>{new Date(viewingBooking.createdAt).toLocaleString()}</span></p>
              
              {viewingBooking.type === 'standard' && (
                <div style={{background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--accent-primary)', marginTop: '0.5rem'}}>
                  <p style={{margin: '0 0 0.5rem 0'}}><strong>Registered Vehicle:</strong> {viewingBooking.vehicleBrand} {viewingBooking.vehicleModel}</p>
                  <p style={{margin: 0}}><strong>Target Appointment:</strong> {new Date(viewingBooking.appointmentDate).toLocaleString()}</p>
                </div>
              )}
              
              {viewingBooking.notes && (
                <div style={{background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', marginTop: '0.5rem'}}>
                  <strong style={{color: 'var(--text-secondary)'}}>Symptom / Initial Notes:</strong>
                  <p style={{marginTop: '0.5rem', fontStyle: 'italic'}}>{viewingBooking.notes}</p>
                </div>
              )}
              
              {viewingBooking.mechanicId && (
                <div style={{background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '1rem', borderRadius: '8px', marginTop: '0.5rem'}}>
                  <strong style={{color: '#3b82f6'}}>Dispatched Specialist Details:</strong>
                  <p style={{marginTop: '0.5rem', fontWeight: 'bold'}}>{viewingBooking.mechanicId.name} | 📞 {viewingBooking.mechanicId.phone}</p>
                </div>
              )}
              
              {viewingBooking.status === 'completed' && (
                <div style={{background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1rem', borderRadius: '8px', marginTop: '0.5rem'}}>
                   <strong style={{color: '#10b981', fontSize: '1.2rem', display: 'block', marginBottom: '0.5rem'}}>Final Billing Matrix:</strong>
                   
                   <ul style={{marginBottom: '1rem', marginLeft: '1.5rem', color: 'var(--text-secondary)'}}>
                     {viewingBooking.costBreakdown?.map((item, idx) => (
                       <li key={idx} style={{marginBottom: '0.3rem'}}>{item.item} : Rs. {item.price}</li>
                     ))}
                     {viewingBooking.advanceAmountPaid > 0 && (
                       <li style={{color: '#3b82f6'}}>Advance Deduction Contract : - Rs. {viewingBooking.advanceAmountPaid}</li>
                     )}
                   </ul>
                   
                   <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(16, 185, 129, 0.3)', paddingTop: '1rem'}}>
                     <span style={{fontWeight: 'bold', fontSize: '1.3rem', color: 'var(--text-primary)'}}>
                       Total Balance: Rs. {viewingBooking.totalAmount}
                     </span>
                     <span style={{
                       padding: '0.4rem 1rem', 
                       borderRadius: '20px', 
                       fontWeight: 'bold',
                       background: viewingBooking.paymentStatus === 'paid' ? '#10b981' : '#f59e0b',
                       color: 'white'
                     }}>
                       {viewingBooking.paymentStatus.toUpperCase()} SECURE
                     </span>
                   </div>
                </div>
              )}
              
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
