import { useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { User, Calendar, CreditCard, Navigation } from 'lucide-react';
import io from 'socket.io-client';
import TrackingMap from '../components/TrackingMap';
import toast from 'react-hot-toast';

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

    newSocket.on('status_update', (data) => {
        toast.success(data.message || `Booking status updated to ${data.status}`, { icon: 'ℹ️' });
        fetchData();
        
        // Auto-open tracker if status is dispatched/arrived
        if (data.status === 'dispatched' || data.status === 'arrived') {
          // We need the booking object to open tracker. 
          // fetchData will refresh bookings, but we might need to wait or find it.
          // For now, fetchData is called, and we can trigger open tracker if we have the ID.
          api.get('/bookings/mybookings').then(res => {
            const b = res.data.find(x => x._id === data.bookingId);
            if (b && (b.type === 'immediate' || b.type === 'towing')) {
              openTracker(b);
            }
          });
        }
    });

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    if (socket && user?._id) {
       socket.emit('join_user_room', user._id);
    }
  }, [socket, user?._id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bookingsRes, receiptsRes] = await Promise.all([
        api.get('/bookings/mybookings'),
        api.get('/payments/receipts').catch(() => ({ data: [] }))
      ]);
      const sortedBookings = bookingsRes.data.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      setBookings(sortedBookings);
      setReceipts(receiptsRes.data);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
    if (profileData.phone && !/^(98|97|96)\d{8}$/.test(profileData.phone)) {
      return alert('Phone number must be exactly 10 digits and start with 98, 97, or 96.');
    }
    try {
      const res = await api.put('/auth/profile', profileData);
      login(res.data);
      setIsEditingProfile(false);
      alert("Personal Profile successfully updated!");
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
      localStorage.setItem('payment_return_url', window.location.pathname);
      form.submit();
    } catch (err) {
      alert("Billing initiation failed: " + (err.response?.data?.message || err.message));
    }
  };

  const handleSitePaymentRequest = async (bookingId) => {
    try {
      if (!window.confirm("Are you sure you want to request 'Site Payment' (Pay later at garage)?")) return;
      const b = bookings.find(x => x._id === bookingId);
      await api.post('/payments/cash/request', { bookingId });
      toast.success("Site Payment requested! Awaiting Garage Owner confirmation.");
      
      if (socket && b && b.garageId) {
        socket.emit('notify_status_update', { 
          garageId: typeof b.garageId === 'object' ? b.garageId._id : b.garageId, 
          status: 'cash_requested', 
          message: 'Client has requested Site Payment (Pay Later at Garage).' 
        });
      }
      
      fetchData();
    } catch (err) {
      alert("Site Payment request failed: " + (err.response?.data?.message || err.message));
    }
  };

  const handleMarkArrived = async (bookingId) => {
    try {
      const b = bookings.find(x => x._id === bookingId);
      await api.put(`/bookings/${bookingId}/status`, { status: 'in-progress' });
      
      if (socket && b) {
        socket.emit('notify_status_update', {
          mechanicId: b.mechanicId?._id || b.mechanicId,
          garageId: b.garageId?._id || b.garageId,
          status: 'in-progress',
          message: 'User has confirmed your arrival. Work is now in-progress.'
        });
      }

      alert("Mechanic verified. Vehicle maintenance officially commenced!");
      setTrackingSession(null);
      fetchData();
    } catch (err) {
      alert("Error marking arrival: " + (err.response?.data?.message || err.message));
    }
  };

  const cancelBooking = async (id) => {
    if (!window.confirm("Are you sure you want to totally abort this appointment/rescue request?")) return;
    try {
      await api.put(`/bookings/${id}`, { status: 'cancelled' });
      alert("Operation successfully aborted.");
      fetchData();
    } catch (err) {
      alert("Cancellation failed: " + (err.response?.data?.message || err.message));
    }
  };

  const openTracker = (b) => {
    if (!socket) return alert("Socket unconnected.");
    socket.emit('join_booking', b._id);
    const gLng = b.garageId?.location?.coordinates[0] || 85.32;
    const gLat = b.garageId?.location?.coordinates[1] || 27.71;
    const uLng = b.issueLocation?.coordinates[0] || gLng + 0.01;
    const uLat = b.issueLocation?.coordinates[1] || gLat + 0.01;

    let mLat = gLat;
    let mLng = gLng;
    if (b.mechanicLocation?.coordinates && b.mechanicLocation.coordinates[0] !== 0) {
      mLng = b.mechanicLocation.coordinates[0];
      mLat = b.mechanicLocation.coordinates[1];
    }

    setTrackingSession({
      bookingId: b._id,
      userPos: [uLat, uLng],
      mechPos: [mLat, mLng],
      garagePos: [gLat, gLng],
      mechanicName: b.mechanicId?.name || "Assigned Mechanic",
      mechanicPhone: b.mechanicId?.phone || "N/A",
      garageName: b.garageId?.name || "Garage",
      garagePhone: b.garageId?.phone || "N/A",
      userName: user?.name || "You",
      userPhone: user?.phone || "Your Phone",
      status: b.status
    });
  };

  const filteredBookings = bookings.filter(b => {
    if (filter === 'all') return true;
    if (filter === 'pending') return b.status === 'pending';
    if (filter === 'accepted') return b.status === 'accepted' || b.status === 'assigned' || b.status === 'dispatched' || b.status === 'arrived' || b.status === 'in-progress' || b.status === 'maintenance-completed' || b.status === 'work-accepted';
    if (filter === 'payment_pending') return (b.status === 'completed' || b.status === 'work-accepted') && b.paymentStatus !== 'paid' && (b.totalAmount > 0 || b.status === 'work-accepted');
    if (filter === 'completed') return b.status === 'completed' && b.paymentStatus === 'paid';
    if (filter === 'cancelled') return b.status === 'cancelled' || b.status === 'rejected';
    return true;
  });

  if (loading) return <div style={{padding: '4rem', textAlign: 'center'}}>Loading Dashboard...</div>;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', minHeight: '80vh', flexDirection: 'row', flexWrap: 'wrap' }}>
      
      {/* Sidebar Navigation - Clean, No Box */}
      <div style={{ flex: '0 0 260px', padding: '2rem 2rem 2rem 0', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        <h3 style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px', marginBottom: '1rem' }}>User Dashboard</h3>
        
        <button 
          onClick={() => setActiveTab('profile')}
          style={{
            background: activeTab === 'profile' ? 'var(--bg-secondary)' : 'transparent',
            color: activeTab === 'profile' ? 'var(--accent-primary)' : 'var(--text-primary)',
            border: 'none',
            padding: '0.8rem 1rem',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '0.8rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: activeTab === 'profile' ? '600' : '400',
            transition: 'all 0.2s'
          }}
        >
          <User size={18} /> My Profile
        </button>
        
        <button 
          onClick={() => setActiveTab('bookings')}
          style={{
            background: activeTab === 'bookings' ? 'var(--bg-secondary)' : 'transparent',
            color: activeTab === 'bookings' ? 'var(--accent-primary)' : 'var(--text-primary)',
            border: 'none',
            padding: '0.8rem 1rem',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '0.8rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: activeTab === 'bookings' ? '600' : '400',
            transition: 'all 0.2s'
          }}
        >
          <Calendar size={18} /> Bookings & Rescues
        </button>

        <button 
          onClick={() => setActiveTab('billing')}
          style={{
            background: activeTab === 'billing' ? 'var(--bg-secondary)' : 'transparent',
            color: activeTab === 'billing' ? 'var(--accent-primary)' : 'var(--text-primary)',
            border: 'none',
            padding: '0.8rem 1rem',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '0.8rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: activeTab === 'billing' ? '600' : '400',
            transition: 'all 0.2s'
          }}
        >
          <CreditCard size={18} /> Digital Receipts
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: '1 1 500px', padding: '2rem 3rem' }}>
        
        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
           <div className="animate-fade-in" style={{ maxWidth: '800px' }}>
             
             {isEditingProfile ? (
               <form onSubmit={handleProfileUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                   <h2 style={{color: 'var(--text-primary)', margin: 0, fontSize: '2rem'}}>Edit Profile</h2>
                 </div>
                 
                 <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <div style={{ width: '100px', height: '100px', borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
                      {profileData.profileImage ? <img src={profileData.profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" /> : <span style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', fontSize: '2.5rem' }}>👤</span>}
                    </div>
                    <div>
                      <label className="input-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Upload New Photo</label>
                      <input type="file" className="input-field" accept="image/*" onChange={handleProfileImageUpload} />
                      {uploadingProfilePic && <span style={{ color: 'var(--accent-primary)', fontSize: '0.85rem' }}>Uploading...</span>}
                    </div>
                 </div>

                 <div className="input-group">
                   <label className="input-label">Full Name</label>
                   <input type="text" className="input-field" required value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} />
                 </div>
                 
                 <div className="input-group">
                   <label className="input-label">Phone Number</label>
                   <input type="text" className="input-field" value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} placeholder="e.g. 9812345678" />
                 </div>

                 <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                   <button type="submit" className="btn-primary" disabled={uploadingProfilePic} style={{ padding: '0.8rem 2rem' }}>Save Changes</button>
                   <button type="button" className="btn-secondary" onClick={() => setIsEditingProfile(false)} style={{ padding: '0.8rem 2rem', border: 'none' }}>Cancel</button>
                 </div>
               </form>
             ) : (
               <div className="animate-fade-in">
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '2rem', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                      <div style={{ width: '120px', height: '120px', borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        {user?.profileImage ? <img src={user.profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="User Avatar" /> : <span style={{ fontSize: '3.5rem' }}>👤</span>}
                      </div>
                      <div>
                        <h1 style={{ margin: '0 0 0.2rem 0', color: 'var(--text-primary)', fontSize: '2.5rem' }}>{user?.name}</h1>
                        <p style={{ margin: 0, color: 'var(--accent-primary)', fontSize: '1rem', fontWeight: '500' }}>Verified Dispatch Client</p>
                      </div>
                    </div>
                    <button className="btn-secondary" onClick={triggerEdit} style={{ border: '1px solid var(--border-color)', padding: '0.6rem 1.2rem', borderRadius: '20px' }}>
                      Edit Profile
                    </button>
                 </div>

                 <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                   <div>
                     <p style={{color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 0.3rem 0'}}>Email Address</p>
                     <p style={{fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0}}>{user?.email}</p>
                   </div>
                   <div>
                     <p style={{color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 0.3rem 0'}}>Phone Number</p>
                     <p style={{fontSize: '1.2rem', color: user?.phone ? 'var(--text-primary)' : 'var(--error-color)', margin: 0}}>{user?.phone || 'Not provided'}</p>
                   </div>
                 </div>
               </div>
             )}
           </div>
        )}

        {/* BOOKINGS TAB */}
        {activeTab === 'bookings' && (
           <div className="animate-fade-in">
             <h2 style={{color: 'var(--text-primary)', fontSize: '2rem', margin: '0 0 1.5rem 0'}}>Bookings & Rescues</h2>
             
             {/* Filter Pills */}
             <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '2rem'}}>
               <button onClick={() => setFilter('all')} style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: '1px solid var(--border-color)', background: filter === 'all' ? 'var(--accent-primary)' : 'transparent', color: filter === 'all' ? 'white' : 'var(--text-primary)', cursor: 'pointer', transition: 'all 0.2s' }}>All</button>
               <button onClick={() => setFilter('pending')} style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: '1px solid var(--border-color)', background: filter === 'pending' ? 'var(--accent-primary)' : 'transparent', color: filter === 'pending' ? 'white' : 'var(--text-primary)', cursor: 'pointer', transition: 'all 0.2s' }}>Pending</button>
               <button onClick={() => setFilter('accepted')} style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: '1px solid var(--border-color)', background: filter === 'accepted' ? 'var(--accent-primary)' : 'transparent', color: filter === 'accepted' ? 'white' : 'var(--text-primary)', cursor: 'pointer', transition: 'all 0.2s' }}>Active</button>
               <button onClick={() => setFilter('payment_pending')} style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: '1px solid var(--border-color)', background: filter === 'payment_pending' ? 'var(--accent-primary)' : 'transparent', color: filter === 'payment_pending' ? 'white' : 'var(--text-primary)', cursor: 'pointer', transition: 'all 0.2s' }}>Payment Due</button>
               <button onClick={() => setFilter('completed')} style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: '1px solid var(--border-color)', background: filter === 'completed' ? 'var(--accent-primary)' : 'transparent', color: filter === 'completed' ? 'white' : 'var(--text-primary)', cursor: 'pointer', transition: 'all 0.2s' }}>Completed</button>
             </div>

             {filteredBookings.length === 0 ? <p style={{color: 'var(--text-secondary)', fontStyle: 'italic'}}>No bookings found for the selected filter.</p> : (
               <div style={{display: 'flex', flexDirection: 'column'}}>
                 {filteredBookings.map(b => (
                   <div key={b._id} className="animate-fade-in" style={{ padding: '2rem 0', borderBottom: '1px solid var(--border-color)' }}>
                     <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem'}}>
                       
                       <div style={{ flex: 1 }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.5rem' }}>
                           <h3 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-primary)' }}>{b.garageId?.name || 'Unknown Garage'}</h3>
                           <span style={{
                             padding: '0.2rem 0.6rem',
                             borderRadius: '4px',
                             fontSize: '0.75rem',
                             fontWeight: 'bold',
                             background: b.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 
                                        (b.status === 'rejected' || b.status === 'cancelled') ? 'rgba(239, 68, 68, 0.1)' : 
                                        b.status === 'in-progress' ? 'rgba(251, 191, 36, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                             color: b.status === 'completed' ? '#10b981' : 
                                    (b.status === 'rejected' || b.status === 'cancelled') ? '#ef4444' : 
                                    b.status === 'in-progress' ? '#f59e0b' : 
                                    (b.status === 'maintenance-completed' || b.status === 'work-accepted') ? '#10b981' : '#3b82f6'
                           }}>
                             {(b.status || 'unknown').toUpperCase()}
                           </span>
                         </div>
                         <p style={{color: 'var(--text-secondary)', margin: '0 0 0.5rem 0', fontSize: '0.9rem'}}>
                           <strong style={{textTransform: 'capitalize', color: 'var(--text-primary)'}}>{b.type}</strong> | Requested on {new Date(b.createdAt).toLocaleDateString()}
                         </p>
                         {b.mechanicId && <p style={{color: 'var(--text-secondary)', margin: '0', fontSize: '0.9rem'}}>Assigned: <span style={{color: 'var(--text-primary)'}}>{b.mechanicId.name}</span></p>}
                       </div>
                       
                       <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                         <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', border: 'none', background: 'var(--bg-secondary)' }} onClick={() => setViewingBooking(b)}>Details</button>
                         { (b.status === 'pending' || b.status === 'accepted') && (
                           <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', border: 'none', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }} onClick={() => cancelBooking(b._id)}>Abort</button>
                         )}
                       </div>

                     </div>
                     
                     {/* Dynamic Actions Block */}
                     <div style={{ marginTop: '1.5rem' }}>
                        {b.maintenanceReport && (
                          <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.05)', borderLeft: '3px solid #3b82f6', borderRadius: '4px' }}>
                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#3b82f6', fontWeight: 'bold', textTransform: 'uppercase' }}>Maintenance Summary:</p>
                            <p style={{ margin: 0, color: 'var(--text-primary)', fontStyle: 'italic', fontSize: '0.95rem' }}>"{b.maintenanceReport}"</p>
                          </div>
                        )}

                        {b.status === 'maintenance-completed' && b.paymentStatus === 'pending' && (
                          <div style={{ padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '8px', borderLeft: '3px solid #10b981', marginTop: '1rem' }}>
                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981' }}>🛠️ Work Complete!</p>
                            <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}>Mechanic has finished the repairs. Please review the summary above and confirm the work is satisfactory to proceed to billing.</p>
                            <button 
                              className="btn-primary" 
                              style={{ background: '#10b981', borderColor: '#10b981', width: '100%' }}
                              onClick={async () => {
                                try {
                                  await api.put(`/bookings/${b._id}/status`, { status: 'work-accepted' });
                                  if (socket) {
                                    socket.emit('notify_status_update', {
                                      garageId: b.garageId?._id || b.garageId,
                                      status: 'work-accepted',
                                      message: 'User has accepted the maintenance work. Please generate the invoice.'
                                    });
                                  }
                                  toast.success("Work accepted! Garage HQ notified for invoicing.");
                                  fetchData();
                                } catch (err) {
                                  toast.error("Failed to accept work.");
                                }
                              }}
                            >
                              Confirm & Accept Work
                            </button>
                          </div>
                        )}

                        {b.status === 'work-accepted' && b.paymentStatus === 'pending' && (
                          <div style={{ padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '8px', borderLeft: '3px solid #3b82f6', marginTop: '1rem' }}>
                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 'bold', color: '#3b82f6' }}>✅ Work Accepted</p>
                            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>You have accepted the repairs. We are now awaiting the garage to generate the final bill/invoice for you.</p>
                          </div>
                        )}

                        {(b.status === 'dispatched' || b.status === 'arrived' || b.status === 'in-progress') && (b.type === 'immediate' || b.type === 'towing') && (
                         <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                           <span style={{color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: '500'}}>Mechanic is en-route/arrived!</span>
                           <button className="btn-primary" onClick={() => openTracker(b)} style={{ padding: '0.4rem 1rem', fontSize: '0.9rem' }}>
                             Open Radar
                           </button>
                         </div>
                       )}

                       {b.paymentStatus === 'pending' && b.totalAmount > 0 && b.status === 'completed' && (
                         <div style={{ padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '8px', borderLeft: '3px solid #10b981', marginTop: '1rem' }}>
                           <p style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981' }}>Outstanding Balance: Rs. {b.totalAmount}</p>
                           <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                             <button className="btn-primary" style={{ background: '#10b981', borderColor: '#10b981', color: 'white' }} onClick={() => handleEsewaPayment(b._id)}>Pay via eSewa</button>
                             <button className="btn-secondary" style={{ border: 'none' }} onClick={() => handleSitePaymentRequest(b._id)}>Site Payment (Pay Later)</button>
                           </div>
                         </div>
                       )}

                       {b.paymentStatus === 'cash_requested' && b.status === 'completed' && (
                         <div style={{ padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '8px', borderLeft: '3px solid #f59e0b', marginTop: '1rem' }}>
                           <p style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 'bold', color: '#f59e0b' }}>⏳ Site Payment Requested</p>
                           <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Awaiting Garage Owner to confirm receipt of Rs. {b.totalAmount}. The invoice will clear automatically once confirmed.</p>
                         </div>
                       )}

                       {b.status === 'completed' && b.paymentStatus === 'paid' && !reviewingId && (
                         <button className="btn-secondary" style={{ marginTop: '1rem', border: 'none', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' }} onClick={() => setReviewingId(b._id)}>
                           Write a Review
                         </button>
                       )}

                       {reviewingId === b._id && (
                         <form onSubmit={(e) => submitReview(e, b.garageId?._id, b._id)} style={{marginTop: '1rem', padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '8px'}}>
                           <h4 style={{margin: '0 0 1rem 0', color: 'var(--text-primary)'}}>Rate your experience</h4>
                           <select className="input-field" value={rating} onChange={e => setRating(e.target.value)} style={{marginBottom: '1rem', width: 'auto'}}>
                             <option value="5">5 Stars - Excellent</option>
                             <option value="4">4 Stars - Good</option>
                             <option value="3">3 Stars - Average</option>
                             <option value="2">2 Stars - Poor</option>
                             <option value="1">1 Star - Terrible</option>
                           </select>
                           <textarea className="input-field" rows="2" placeholder="Leave a comment..." required value={comment} onChange={e => setComment(e.target.value)} style={{marginBottom: '1rem'}}></textarea>
                           <div style={{display: 'flex', gap: '1rem'}}>
                             <button type="submit" className="btn-primary" style={{ padding: '0.4rem 1rem' }}>Submit Review</button>
                             <button type="button" className="btn-secondary" style={{ padding: '0.4rem 1rem', border: 'none' }} onClick={() => setReviewingId(null)}>Cancel</button>
                           </div>
                         </form>
                       )}
                     </div>

                   </div>
                 ))}
               </div>
             )}
           </div>
        )}

        {/* BILLING TAB */}
        {activeTab === 'billing' && (
           <div className="animate-fade-in">
             <h2 style={{color: 'var(--text-primary)', fontSize: '2rem', margin: '0 0 2rem 0'}}>Digital Receipts</h2>
             
             {(!Array.isArray(receipts) || receipts.length === 0) ? (
               <p style={{color: 'var(--text-secondary)', fontStyle: 'italic'}}>No receipts found. Complete a paid booking to generate one.</p>
             ) : (
               <div style={{display: 'flex', flexDirection: 'column'}}>
                 {receipts.map(r => (
                   <div key={r._id} className="animate-fade-in" style={{ padding: '2rem 0', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '2rem' }}>
                     
                     <div>
                       <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.3rem', color: 'var(--text-primary)' }}>{r.garageId?.name || 'Network Partner'}</h3>
                       <p style={{ margin: '0 0 0.3rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Date: {new Date(r.createdAt).toLocaleString()}</p>
                       <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Operation: #{ (typeof r.bookingId === 'object' ? r.bookingId?._id : r.bookingId)?.slice(-6).toUpperCase() }</p>
                       <span style={{ 
                         padding: '0.2rem 0.6rem', 
                         background: 'rgba(16, 185, 129, 0.1)', 
                         color: '#10b981', 
                         borderRadius: '4px', 
                         fontSize: '0.8rem',
                         fontWeight: 'bold'
                       }}>
                         PAID VIA {(r.paymentMethod || 'SYSTEM').toUpperCase()}
                       </span>
                     </div>
                     
                     <div style={{ textAlign: 'right' }}>
                       <p style={{ margin: '0 0 0.2rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Settled</p>
                       <p style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', fontWeight: '300', color: '#10b981', lineHeight: 1 }}>Rs. {r.totalAmount}</p>
                       <p style={{ margin: '0', color: 'var(--text-secondary)', fontSize: '0.85rem', fontFamily: 'monospace' }}>TXN: {r.transactionId || 'N/A'}</p>
                     </div>

                   </div>
                 ))}
               </div>
             )}
           </div>
        )}

      </div>

      <TrackingMap 
        trackingSession={trackingSession} 
        theme={theme} 
        onClose={() => setTrackingSession(null)} 
        role="user"
        onMarkArrived={handleMarkArrived} 
      />

      {/* VIEW DETAILS MODAL */}
      {viewingBooking && (
        <div className="modal-overlay animate-fade-in" style={{zIndex: 100000}} onClick={() => setViewingBooking(null)}>
          <div className="modal-content" style={{maxWidth: '500px', width: '90%', padding: '2.5rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '12px'}} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{color: 'var(--text-primary)', margin: 0, fontSize: '1.5rem'}}>Booking Details</h2>
              <button onClick={() => setViewingBooking(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
            </div>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '1.2rem'}}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Garage</span>
                <strong style={{ color: 'var(--text-primary)' }}>{viewingBooking.garageId?.name}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Type</span>
                <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{viewingBooking.type}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                <strong style={{ color: 'var(--text-primary)' }}>{viewingBooking.status.toUpperCase()}</strong>
              </div>

              {viewingBooking.type === 'standard' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Vehicle</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{viewingBooking.vehicleBrand} {viewingBooking.vehicleModel}</strong>
                </div>
              )}
              
              {viewingBooking.notes && (
                <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Notes / Issue Description</span>
                  <p style={{ margin: 0, color: 'var(--text-primary)', fontStyle: 'italic' }}>{viewingBooking.notes}</p>
                </div>
              )}
              
              {viewingBooking.mechanicId && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Mechanic</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{viewingBooking.mechanicId.name}</strong>
                </div>
              )}
              
              {viewingBooking.status === 'completed' && (
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '8px', marginTop: '1rem' }}>
                   <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem'}}>Cost Breakdown</p>
                   {viewingBooking.costBreakdown?.map((item, idx) => (
                     <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                       <span>{item.item}</span>
                       <span>Rs. {item.price}</span>
                     </div>
                   ))}
                   {viewingBooking.advanceAmountPaid > 0 && (
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#3b82f6' }}>
                       <span>Advance Deduction</span>
                       <span>- Rs. {viewingBooking.advanceAmountPaid}</span>
                     </div>
                   )}
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                     <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Total</strong>
                     <strong style={{ fontSize: '1.2rem', color: '#10b981' }}>Rs. {viewingBooking.totalAmount}</strong>
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
