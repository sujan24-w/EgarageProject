import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import io from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import TrackingMap from '../components/TrackingMap';
import Spinner from '../components/Spinner';
import toast from 'react-hot-toast';

const garageIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function LocationMarker({ coordinates, setCoordinates }) {
  const map = useMap();
  
  useEffect(() => {
    if (coordinates && coordinates[0] && coordinates[1]) {
      map.flyTo([coordinates[1], coordinates[0]], map.getZoom());
    }
  }, [coordinates, map]);

  useMapEvents({
    click(e) {
      setCoordinates([e.latlng.lng, e.latlng.lat]);
    },
  });

  return coordinates[0] && coordinates[1] ? (
    <Marker position={[coordinates[1], coordinates[0]]} icon={garageIcon}>
      <Popup>Garage Location</Popup>
    </Marker>
  ) : null;
}

export default function GarageDashboard() {
  const { user } = useContext(AuthContext);
  const [tab, setTab] = useState('overview'); // overview, bookings, history, profile, mechanics, reviews
  const [myGarage, setMyGarage] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [mechanicsList, setMechanicsList] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);
  
  // Profile State
  const [garageData, setGarageData] = useState({ 
    name: '', phone: '', address: '', coordinates: [85.32, 27.71], fileUrl: null, images: [], isOpen: true, 
    timing: { is24_7: true, openTime: '09:00', closeTime: '18:00', closedDays: [] } 
  });
  const [docUploadStatus, setDocUploadStatus] = useState('idle');
  const [galleryUploadStatus, setGalleryUploadStatus] = useState('idle');
  const [profileSubmitStatus, setProfileSubmitStatus] = useState('idle');

  // Mechanic State
  const [mechData, setMechData] = useState({ name: '', phone: '', fileUrl: null });
  const [uploadingMech, setUploadingMech] = useState(false);
  const [assignment, setAssignment] = useState({});
  
  // Billing Completion Modal
  const [completingBooking, setCompletingBooking] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([{ name: '', price: '' }]);
  const [invoiceDiscount, setInvoiceDiscount] = useState('');

  const [trackingSession, setTrackingSession] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (myGarage?.images?.length > 1 && tab === 'overview') {
      const timer = setInterval(() => {
        setCurrentSlide(prev => (prev + 1) % myGarage.images.length);
      }, 6000);
      return () => clearInterval(timer);
    }
  }, [myGarage?.images, tab]);

  useEffect(() => {
    fetchDashboardData();
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

    newSocket.on('incoming_request', (data) => {
        toast.success(data.message || 'New request arrived!', { icon: '🚨' });
        fetchDashboardData(); // Refreshes the queue
    });

    newSocket.on('status_update', (data) => {
        if (data.status === 'cash_requested') {
          toast.success(data.message || 'New Site Payment approval request!', { icon: '💰', duration: 6000 });
        }
        fetchDashboardData();
    });

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    if (socket && myGarage?._id) {
       socket.emit('join_garage_room', myGarage._id);
    }
  }, [socket, myGarage?._id]);

  const fetchDashboardData = async () => {
    try {
      let garagePayload = null;
      try {
        const resGarage = await api.get('/garages/my');
        garagePayload = resGarage.data;
        setMyGarage(garagePayload);
        
        setGarageData({
          name: garagePayload.name || '',
          phone: garagePayload.phone || '',
          address: garagePayload.location?.address || '',
          coordinates: garagePayload.location?.coordinates || [85.32, 27.71],
          fileUrl: garagePayload.documents?.length > 0 ? garagePayload.documents[0] : null,
          images: garagePayload.images || [],
          isOpen: garagePayload.isOpen !== undefined ? garagePayload.isOpen : true,
          timing: garagePayload.timing || { is24_7: true, openTime: '09:00', closeTime: '18:00', closedDays: [] }
        });
      } catch(e) { /* ignore if profile 404s */ }

      const [resBookings, resMechs, resReviews, resReceipts] = await Promise.all([
        api.get('/bookings/garage'),
        api.get('/mechanics/my-mechanics'),
        api.get('/reviews/my-reviews'),
        api.get('/payments/garage/receipts')
      ]);
      setBookings(resBookings.data);
      setMechanicsList(resMechs.data);
      setReviews(resReviews.data);
      setReceipts(resReceipts.data);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const simulateMechanicMovement = (booking) => {
    if (!socket || !myGarage) return alert("Socket unconnected or Garage untethered.");
    if (booking.type === 'standard') return; // only live track emergencies

    const gLng = myGarage.location.coordinates[0];
    const gLat = myGarage.location.coordinates[1];
    
    // Fallback if issue location absent
    const uLng = booking.issueLocation?.coordinates[0] || gLng;
    const uLat = booking.issueLocation?.coordinates[1] || gLat;

    let step = 0;
    const totalSteps = 20;
    
    alert("📡 Initiating Advanced Tracker: Dispatching Mechanic to Target coordinates...");
    
    const intervalId = setInterval(() => {
      if (step >= totalSteps) {
        clearInterval(intervalId);
        alert("📍 Tracked unit has physically arrived at User GPS coordinates. You may mark 'Mechanic Arrived' now.");
        return;
      }
      
      step++;
      const progress = step / totalSteps;
      const currentLng = gLng + (uLng - gLng) * progress;
      const currentLat = gLat + (uLat - gLat) * progress;

      socket.emit('update_mechanic_location', {
        bookingId: booking._id,
        lng: currentLng,
        lat: currentLat
      });
    }, 1000); // Emits every 1 second
  };

  const openTracker = (b) => {
    if (!socket) return alert("Socket unconnected.");
    socket.emit('join_booking', b._id);
    
    const gLng = myGarage?.location?.coordinates[0] || 85.32;
    const gLat = myGarage?.location?.coordinates[1] || 27.71;
    
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
      garageName: myGarage?.name || "Garage",
      garagePhone: myGarage?.phone || "N/A",
      userName: b.userId?.name || "User",
      userPhone: b.userId?.phone || "N/A"
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const form = new FormData();
    form.append('image', file); 
    form.append('type', 'garage_document');
    
    setDocUploadStatus('loading');
    try {
      const res = await api.post('/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setGarageData({...garageData, fileUrl: res.data.url});
      setDocUploadStatus('success');
    } catch(err) {
      setDocUploadStatus('error');
    }
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    if (garageData.images.length + files.length > 5) return alert('Maximum 5 images allowed for the Garage layout');
    
    setGalleryUploadStatus('loading');
    try {
      const uploadPromises = files.map(file => {
        const form = new FormData();
        form.append('image', file);
        form.append('type', 'garage_image');
        return api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      });
      const results = await Promise.all(uploadPromises);
      const newUrls = results.map(res => res.data.url);
      setGarageData({...garageData, images: [...garageData.images, ...newUrls]});
      setGalleryUploadStatus('success');
    } catch(err) {
      setGalleryUploadStatus('error');
    }
  };

  const fetchLocation = (e) => {
    e.preventDefault();
    if(!navigator.geolocation) return alert('Geolocation is not supported by your browser');
    navigator.geolocation.getCurrentPosition((position) => {
       setGarageData({
          ...garageData,
          coordinates: [position.coords.longitude, position.coords.latitude]
       });
       alert('GPS Coordinates acquired successfully!');
    }, () => {
       alert('Unable to retrieve your location. Please check browser permissions.');
    });
  };

  const submitProfile = async (e) => {
    e.preventDefault();
    setProfileSubmitStatus('loading');
    try {
      await api.post('/garages', {
        name: garageData.name,
        phone: garageData.phone,
        address: garageData.address,
        coordinates: garageData.coordinates,
        documents: garageData.fileUrl ? [garageData.fileUrl] : [],
        images: garageData.images,
        isOpen: garageData.isOpen,
        timing: garageData.timing
      });
      setProfileSubmitStatus('success');
      fetchDashboardData();
      setTimeout(() => setProfileSubmitStatus('idle'), 3000);
    } catch(err) {
      setProfileSubmitStatus('error');
      setTimeout(() => setProfileSubmitStatus('idle'), 3000);
    }
  };

  const addMechanic = async (e) => {
    e.preventDefault();
    try {
      await api.post('/mechanics', {
         name: mechData.name,
         phone: mechData.phone,
         image: mechData.fileUrl || ""
      });
      alert("Mechanic added!");
      setMechData({ name: '', phone: '', fileUrl: null });
      fetchDashboardData();
    } catch(err) {
      alert("Failed. Have you created your garage profile first? Check backend logs if this persists.");
    }
  };

  const handleMechImageUpload = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const form = new FormData();
    form.append('image', file);
    form.append('type', 'garage_image'); 
    
    setUploadingMech(true);
    try {
      const res = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMechData({...mechData, fileUrl: res.data.url});
    } catch(err) {
      alert('Upload failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingMech(false);
    }
  };

  const updateStatus = async (id, status, mechanicId = null, extraPayload = {}) => {
    try {
      const b = bookings.find(x => x._id === id);
      const payload = { status, ...extraPayload };
      if (mechanicId) payload.mechanicId = mechanicId;
      await api.put(`/bookings/${id}`, payload);
      
      if (socket && b) {
        const uid = typeof b.userId === 'object' ? b.userId._id : b.userId;
        socket.emit('notify_status_update', { 
          userId: uid, 
          status, 
          message: `Your booking status has been updated to: ${status.toUpperCase()}.` 
        });
      }
      
      fetchDashboardData();
    } catch (err) {
      alert("Failed to update status");
    }
  };

  const handleConfirmSitePayment = async (bookingId, userId) => {
    try {
      if(!window.confirm("Are you sure you have received the exact Site Payment amount from the user?")) return;
      await api.post('/payments/cash/confirm', { bookingId });
      toast.success("Site payment confirmed! Invoice cleared and digital receipt generated.");
      
      if (socket) {
        const uid = typeof userId === 'object' ? userId._id : userId;
        socket.emit('notify_status_update', { 
          userId: uid, 
          status: 'paid', 
          message: 'Garage has confirmed your Site Payment! Your booking is now fully settled.' 
        });
      }
      
      fetchDashboardData();
    } catch (err) {
      alert("Failed to confirm cash payment: " + (err.response?.data?.message || err.message));
    }
  };

  const [editingMechanic, setEditingMechanic] = useState(null);
  const [editingMechImage, setEditingMechImage] = useState(null);
  const [uploadingEditMech, setUploadingEditMech] = useState(false);

  const handleEditMechImageUpload = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const form = new FormData();
    form.append('image', file);
    form.append('type', 'garage_image'); 
    
    setUploadingEditMech(true);
    try {
      const res = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setEditingMechImage(res.data.url);
    } catch(err) {
      alert('Upload failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingEditMech(false);
    }
  };

  const deleteMechanic = async (mechanicId) => {
    if(!window.confirm("Are you sure you want to permanently delete this mechanic?")) return;
    try {
      await api.delete(`/mechanics/${mechanicId}`);
      alert("Mechanic deleted successfully");
      fetchDashboardData();
    } catch(err) {
      alert("Failed to delete mechanic: " + (err.response?.data?.message || err.message));
    }
  };

  const updateMechanicDetails = async (mechanicId, payload) => {
    try {
      await api.put(`/mechanics/${mechanicId}`, payload);
      setEditingMechanic(null);
      fetchDashboardData();
    } catch(err) {
      alert("Failed to update mechanic info");
    }
  };

  if (loading) return <div>Loading Dashboard...</div>;

  const emergencyBookings = bookings.filter(b => (b.type === 'immediate' || b.type === 'towing') && (b.status === 'pending' || b.status === 'accepted' || b.status === 'assigned' || b.status === 'dispatched' || b.status === 'arrived' || b.status === 'in-progress'));
  const standardBookings = bookings.filter(b => b.type === 'standard' && (b.status === 'pending' || b.status === 'accepted' || b.status === 'in-progress'));

  return (
    <div  className="animate-fade-in" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
     
      <div style={{ flex: '0 0 260px', padding: '2rem 2rem 2rem 0', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.8rem', position: 'sticky', top: '0' }}>
        <h2 style={{color: 'var(--text-primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem'}}>Garage Pro</h2>
        <button className={tab === 'overview' ? 'btn-primary' : 'btn-secondary'} style={{textAlign: 'left', width: '100%', padding: '0.8rem 1rem', border: 'none', background: tab === 'overview' ? 'var(--bg-secondary)' : 'transparent', color: tab === 'overview' ? 'var(--accent-primary)' : 'var(--text-primary)', fontWeight: tab === 'overview' ? '600' : '400'}} onClick={() => setTab('overview')}>Overview</button>
        <button className={tab === 'bookings' ? 'btn-primary' : 'btn-secondary'} style={{textAlign: 'left', width: '100%', padding: '0.8rem 1rem', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: tab === 'bookings' ? 'var(--bg-secondary)' : 'transparent', color: tab === 'bookings' ? 'var(--accent-primary)' : 'var(--text-primary)', fontWeight: tab === 'bookings' ? '600' : '400'}} onClick={() => setTab('bookings')}>
          <span>Live Action Requests</span>
          {emergencyBookings.filter(b => b.status === 'pending').length > 0 && (
            <span style={{background: '#ef4444', color: 'white', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '10px', fontWeight: 'bold'}}>
              {emergencyBookings.filter(b => b.status === 'pending').length} New
            </span>
          )}
        </button>
        <button className={tab === 'history' ? 'btn-primary' : 'btn-secondary'} style={{textAlign: 'left', width: '100%', padding: '0.8rem 1rem', border: 'none', background: tab === 'history' ? 'var(--bg-secondary)' : 'transparent', color: tab === 'history' ? 'var(--accent-primary)' : 'var(--text-primary)', fontWeight: tab === 'history' ? '600' : '400'}} onClick={() => setTab('history')}>Rescue History</button>
        <button className={tab === 'receipts' ? 'btn-primary' : 'btn-secondary'} style={{textAlign: 'left', width: '100%', padding: '0.8rem 1rem', border: 'none', background: tab === 'receipts' ? 'var(--bg-secondary)' : 'transparent', color: tab === 'receipts' ? 'var(--accent-primary)' : 'var(--text-primary)', fontWeight: tab === 'receipts' ? '600' : '400'}} onClick={() => setTab('receipts')}>Payment Ledgers</button>
        <button className={tab === 'mechanics' ? 'btn-primary' : 'btn-secondary'} style={{textAlign: 'left', width: '100%', padding: '0.8rem 1rem', border: 'none', background: tab === 'mechanics' ? 'var(--bg-secondary)' : 'transparent', color: tab === 'mechanics' ? 'var(--accent-primary)' : 'var(--text-primary)', fontWeight: tab === 'mechanics' ? '600' : '400'}} onClick={() => setTab('mechanics')}>Manage Mechanics</button>
        <button className={tab === 'profile' ? 'btn-primary' : 'btn-secondary'} style={{textAlign: 'left', width: '100%', padding: '0.8rem 1rem', border: 'none', background: tab === 'profile' ? 'var(--bg-secondary)' : 'transparent', color: tab === 'profile' ? 'var(--accent-primary)' : 'var(--text-primary)', fontWeight: tab === 'profile' ? '600' : '400'}} onClick={() => setTab('profile')}>Profile & Docs</button>
        <button className={tab === 'reviews' ? 'btn-primary' : 'btn-secondary'} style={{textAlign: 'left', width: '100%', padding: '0.8rem 1rem', border: 'none', background: tab === 'reviews' ? 'var(--bg-secondary)' : 'transparent', color: tab === 'reviews' ? 'var(--accent-primary)' : 'var(--text-primary)', fontWeight: tab === 'reviews' ? '600' : '400'}} onClick={() => setTab('reviews')}>Client Reviews</button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: '1 1 500px', padding: '2rem 3rem' }}>
        {tab === 'overview' && (
          <div className="animate-fade-in" style={{ maxWidth: '1000px' }}>
            {!myGarage ? (
              <div style={{textAlign: 'center', padding: '3rem', background: 'var(--bg-secondary)', borderRadius: '12px'}}>
                <h3 style={{color: 'var(--text-primary)', fontSize: '2rem'}}>Welcome to E-Garage Global Network!</h3>
                <p style={{marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '1.1rem'}}>To begin receiving rescue requests, you must configure your <strong>Garage Profile & Docs</strong>.</p>
                <button className="btn-primary" style={{marginTop: '2rem', fontSize: '1.1rem', padding: '0.8rem 2rem'}} onClick={() => setTab('profile')}>Edit Profile & Docs</button>
              </div>
            ) : (
              <div>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem'}}>
                  <div>
                    <h1 style={{fontSize: '2.5rem', color: 'var(--text-primary)', margin: '0 0 0.5rem 0'}}>{myGarage.name}</h1>
                    <p style={{color: 'var(--text-secondary)', margin: 0, fontSize: '1.1rem'}}>{myGarage.phone} | {myGarage.location?.address}</p>
                    <p style={{color: '#fbbf24', marginTop: '0.5rem', fontWeight: 'bold', fontSize: '1.2rem', margin: '0.5rem 0 0 0'}}>
                      {myGarage.rating > 0 ? `⭐ ${myGarage.rating} (${myGarage.totalReviews} Reviews)` : '⭐ No Reviews Yet'}
                    </p>
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1rem'}}>
                    <span style={{padding: '0.5rem 1rem', borderRadius: '8px', background: myGarage.isVerified ? 'var(--success-color)' : 'var(--error-color)', color: 'white', fontWeight: 'bold'}}>
                      {myGarage.isVerified ? 'VERIFIED PARTNER ✅' : 'PENDING APPROVAL ⚠️'}
                    </span>
                    <button className="btn-secondary" style={{padding: '0.6rem 1.2rem', border: '1px solid var(--border-color)', borderRadius: '20px'}} onClick={() => setTab('profile')}>Edit Profile Settings</button>
                  </div>
                </div>
                
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginTop: '2rem'}}>
                  <div style={{background: 'var(--bg-secondary)', padding: '2rem', borderRadius: '12px', textAlign: 'left', border: '1px solid var(--border-color)'}}>
                    <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 0.5rem 0'}}>Ongoing work</p>
                    <strong style={{fontSize: '3rem', color: 'var(--text-primary)', display: 'block', lineHeight: 1}}>{bookings.filter(b => b.status === 'pending' || b.status === 'accepted' || b.status === 'in-progress').length}</strong>
                  </div>
                  <div style={{background: 'var(--bg-secondary)', padding: '2rem', borderRadius: '12px', textAlign: 'left', border: '1px solid var(--border-color)'}}>
                    <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 0.5rem 0'}}>Available Mechanic</p>
                    <strong style={{fontSize: '3rem', color: 'var(--text-primary)', display: 'block', lineHeight: 1}}>{myGarage.stats?.availableMechanics} <span style={{fontSize: '1.5rem', color: 'var(--text-secondary)'}}>/ {myGarage.stats?.totalMechanics}</span></strong>
                  </div>
                  <div style={{background: 'var(--bg-secondary)', padding: '2rem', borderRadius: '12px', textAlign: 'left', border: '1px solid var(--border-color)'}}>
                    <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 0.5rem 0'}}>Service Count</p>
                    <strong style={{fontSize: '3rem', color: 'var(--text-primary)', display: 'block', lineHeight: 1}}>{bookings.filter(b => b.status === 'completed').length}</strong>
                  </div>
                </div>
                
                {myGarage.images && myGarage.images.length > 0 && (
                   <div style={{marginTop: '3rem'}}>
                     <h3 style={{color: 'var(--text-primary)', marginBottom: '1.5rem'}}>Public Gallery Previews</h3>
                     
                     <div style={{ position: 'relative', width: '100%', height: '400px', overflow: 'hidden', borderRadius: '16px', background: 'var(--bg-secondary)' }}>
                       {myGarage.images.map((img, index) => (
                         <div 
                           key={index} 
                           style={{
                             position: 'absolute',
                             top: 0,
                             left: 0,
                             width: '100%',
                             height: '100%',
                             opacity: currentSlide === index ? 1 : 0,
                             transform: `translateX(${(index - currentSlide) * 100}%)`,
                             transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                           }}
                         >
                           <img src={img} alt={`Garage preview ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                         </div>
                       ))}
                       
                       {/* Controls */}
                       {myGarage.images.length > 1 && (
                         <>
                           <button 
                             onClick={() => setCurrentSlide(prev => (prev === 0 ? myGarage.images.length - 1 : prev - 1))}
                             style={{ position: 'absolute', top: '50%', left: '15px', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '45px', height: '45px', cursor: 'pointer', zIndex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.5rem', transition: 'background 0.2s' }}
                           >❮</button>
                           <button 
                             onClick={() => setCurrentSlide(prev => (prev + 1) % myGarage.images.length)}
                             style={{ position: 'absolute', top: '50%', right: '15px', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '45px', height: '45px', cursor: 'pointer', zIndex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.5rem', transition: 'background 0.2s' }}
                           >❯</button>
                           
                           {/* Dots */}
                           <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px', zIndex: 2 }}>
                             {myGarage.images.map((_, i) => (
                               <button 
                                 key={i} 
                                 onClick={() => setCurrentSlide(i)}
                                 style={{ width: '10px', height: '10px', borderRadius: '50%', border: 'none', background: currentSlide === i ? 'white' : 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 0 }}
                               />
                             ))}
                           </div>
                         </>
                       )}
                     </div>
                     
                   </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'bookings' && (
          <div className="animate-fade-in">
            <h2 style={{borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem'}}>Action Center</h2>
            
            {/* EMERGENCY QUEUE */}
            <div style={{marginTop: '2rem'}}>
              <h3 style={{color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>🚨 Emergency Response Queue</h3>
              {emergencyBookings.length === 0 ? <p style={{color: 'var(--text-secondary)'}}>No active emergency broadcasts.</p> : (
                <div style={{marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                  {emergencyBookings.map(b => (
                    <div key={b._id} style={{
                      border: b.status === 'pending' ? '2px solid #ef4444' : '1px solid #dc262644', 
                      padding: '1rem', 
                      borderRadius: '8px', 
                      background: b.status === 'pending' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(220, 38, 38, 0.05)',
                      boxShadow: b.status === 'pending' ? '0 0 15px rgba(239, 68, 68, 0.2)' : 'none'
                    }}>
                      <div style={{display: 'flex', justifyContent: 'space-between'}}>
                        <strong style={{color: '#dc2626'}}>{b.type.toUpperCase()} Rescue Operation</strong>
                        <span style={{color: b.status === 'pending' ? 'var(--accent-primary)' : 'var(--success-color)', fontWeight: 'bold'}}>
                          {b.status === 'assigned' ? 'PENDING MECHANIC ACCEPTANCE' : b.status.toUpperCase()}
                        </span>
                      </div>
                      <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem'}}>Client: {b.userId?.name} | Phone: {b.userId?.phone}</p>
                      <p style={{marginTop: '0.5rem', fontWeight: 'bold', color: 'var(--text-secondary)'}}>Payment Resolution: <span style={{color: 'var(--success-color)'}}>eSewa On Completion</span></p>
                      <p style={{marginTop: '0.5rem', color: 'var(--text-secondary)', fontStyle: 'italic'}}>{b.notes}</p>
                      
                      {b.status === 'pending' && (
                        <div style={{marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center'}}>
                          <button className="btn-primary" style={{background: '#dc2626', borderColor: '#dc2626'}} onClick={() => updateStatus(b._id, 'accepted')}>Acknowledge & Accept Request</button>
                        </div>
                      )}

                      {b.status === 'accepted' && (
                        <div style={{marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center'}}>
                          <select className="input-field" style={{margin: 0, padding: '0.5rem', width: '220px'}} 
                            value={assignment[b._id] || ''} 
                            onChange={(e) => setAssignment({...assignment, [b._id]: e.target.value})}>
                            <option value="">-- Assign Mechanic --</option>
                            {mechanicsList.map(m => (
                              <option key={m._id} value={m._id} disabled={m.status !== 'available'}>{m.name} ({m.status})</option>
                            ))}
                          </select>
                          <button className="btn-primary" style={{background: '#3b82f6', borderColor: '#3b82f6'}} onClick={() => {
                            if(!assignment[b._id]) return alert("Assign a mechanic immediately.");
                            updateStatus(b._id, 'assigned', assignment[b._id]);
                          }}>Assign & Notify Mechanic</button>
                        </div>
                      )}
                      
                      {(b.status === 'assigned' || b.status === 'dispatched' || b.status === 'arrived') && (
                        <div style={{marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid rgba(220, 38, 38, 0.1)', paddingTop: '1rem'}}>
                          <p style={{color: 'var(--accent-primary)', fontWeight: 'bold', width: '100%'}}>Status: {b.status === 'assigned' ? 'PENDING MECHANIC ACCEPTANCE' : b.status.toUpperCase()}</p>
                          <button className="btn-secondary" style={{borderColor: '#3b82f6', color: '#3b82f6'}} onClick={() => openTracker(b)}>🔴 View Live Radar Route</button>
                          {b.status === 'dispatched' && (
                            <button className="btn-secondary" style={{borderColor: '#10b981', color: '#10b981'}} onClick={() => simulateMechanicMovement(b)}>📡 Simulate Mechanic GPS Ping</button>
                          )}
                          {(b.status === 'dispatched' || b.status === 'arrived') && (
                            <button className="btn-primary" style={{background: '#fbbf24', borderColor: '#fbbf24', color: 'black'}} onClick={() => updateStatus(b._id, 'in-progress')}>Mark Service In-Progress</button>
                          )}
                        </div>
                      )}

                      {b.status === 'in-progress' && (
                        <div style={{marginTop: '1.5rem', borderTop: '1px solid rgba(220, 38, 38, 0.1)', paddingTop: '1rem'}}>
                          <p style={{color: '#fbbf24', fontWeight: 'bold'}}>Mechanic is currently on-site working on the vehicle...</p>
                        </div>
                      )}
                      {b.status === 'maintenance-completed' && (
                        <div style={{marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid #10b981', paddingTop: '1rem'}}>
                          <p style={{color: '#10b981', fontWeight: 'bold', width: '100%'}}>✅ Maintenance Completed! Mechanic has submitted the report.</p>
                          <button className="btn-primary" style={{background: '#10b981', borderColor: '#10b981'}} onClick={() => setCompletingBooking(b)}>Review Report & Generate Invoice</button>
                        </div>
                      )}
                      {b.status === 'work-accepted' && (
                        <div style={{marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid #3b82f6', paddingTop: '1rem'}}>
                          <p style={{color: '#3b82f6', fontWeight: 'bold', width: '100%'}}>🤝 User has accepted the work. Ready for Invoicing.</p>
                          <button className="btn-primary" style={{background: '#3b82f6', borderColor: '#3b82f6'}} onClick={() => setCompletingBooking(b)}>Issue Final Invoice</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* STANDARD QUEUE */}
            <div style={{marginTop: '3rem'}}>
              <h3 style={{color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>📅 Standard Service Appointments</h3>
              {standardBookings.length === 0 ? <p style={{color: 'var(--text-secondary)'}}>No incoming routine appointments.</p> : (
                <div style={{marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                  {standardBookings.map(b => (
                    <div key={b._id} style={{border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '8px', background: 'var(--bg-secondary)'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between'}}>
                        <strong>Booked Routine Service</strong>
                        <span style={{color: b.status === 'pending' ? 'var(--accent-primary)' : 'var(--success-color)', fontWeight: 'bold'}}>
                          {b.status.toUpperCase()}
                        </span>
                      </div>
                      <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem'}}>Client: {b.userId?.name} | Phone: {b.userId?.phone}</p>
                      <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem'}}>Scheduled Date: {new Date(b.appointmentDate).toLocaleString()}</p>
                      <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.3rem'}}>Vehicle: {b.vehicleBrand} {b.vehicleModel}</p>
                      
                      {b.status === 'pending' && (
                        <div style={{marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center'}}>
                          <select className="input-field" style={{margin: 0, padding: '0.5rem', width: '220px'}} 
                            value={assignment[b._id] || ''} 
                            onChange={(e) => setAssignment({...assignment, [b._id]: e.target.value})}>
                            <option value="">-- Assign Garage Mechanic --</option>
                            {mechanicsList.map(m => (
                              <option key={m._id} value={m._id}>{m.name} ({m.status})</option>
                            ))}
                          </select>
                          <button className="btn-primary" onClick={() => {
                            if(!assignment[b._id]) return alert("Assign a mechanic.");
                            updateStatus(b._id, 'accepted', assignment[b._id]);
                          }}>Approve Appointment</button>
                          <button className="btn-secondary" style={{color: '#dc2626', borderColor: '#dc2626'}} onClick={() => updateStatus(b._id, 'rejected')}>Reject Booking</button>
                        </div>
                      )}
                      {b.status === 'accepted' && (
                        <div style={{marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center'}}>
                          <button className="btn-primary" style={{background: '#fbbf24', borderColor: '#fbbf24', color: 'black'}} onClick={() => updateStatus(b._id, 'in-progress')}>Mechanic is working on vehicle</button>
                        </div>
                      )}
                      {b.status === 'in-progress' && (
                        <div style={{marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center'}}>
                          <p style={{color: '#fbbf24', fontWeight: 'bold'}}>Service in progress at workshop...</p>
                        </div>
                      )}
                      {b.status === 'maintenance-completed' && (
                        <div style={{marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center'}}>
                          <p style={{color: '#10b981', fontWeight: 'bold', width: '100%'}}>✅ Maintenance Finished. Awaiting user approval.</p>
                        </div>
                      )}
                      {b.status === 'work-accepted' && (
                        <div style={{marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center'}}>
                          <p style={{color: '#3b82f6', fontWeight: 'bold', width: '100%'}}>🤝 User Approved. Build Final Bill.</p>
                          <button className="btn-primary" style={{background: '#3b82f6', borderColor: '#3b82f6'}} onClick={() => setCompletingBooking(b)}>Generate Invoice</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{marginTop: '4rem'}}>
                  <h4 style={{color: 'var(--text-secondary)', marginBottom: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '2rem'}}>Active Fleet Overview</h4>
                  {mechanicsList.length === 0 ? <p style={{color: 'var(--text-secondary)'}}>No mechanics deployed yet. Add them in the Manage Mechanics tab.</p> : (
                    <div style={{display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
                      {mechanicsList.map(m => (
                        <div key={m._id} style={{background: 'var(--bg-secondary)', padding: '1rem', width: '200px', borderRadius: '8px', border: '1px solid var(--glass-border)', textAlign: 'center'}}>
                          <div style={{width: '60px', height: '60px', borderRadius: '50%', background: 'var(--bg-primary)', overflow: 'hidden', border: '2px solid var(--accent-primary)', margin: '0 auto 0.5rem auto'}}>
                            {m.image ? <img src={m.image} alt={m.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <span style={{fontSize: '2rem'}}>👤</span>}
                          </div>
                          <strong style={{display: 'block', color: 'var(--text-primary)'}}>{m.name}</strong>
                          <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 'bold', display: 'inline-block', marginTop: '0.5rem',
                            background: (bookings.some(b => b.mechanicId?._id === m._id && ['dispatched', 'arrived', 'in-progress'].includes(b.status))) ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                            color: (bookings.some(b => b.mechanicId?._id === m._id && ['dispatched', 'arrived', 'in-progress'].includes(b.status))) ? 'var(--error-color)' : 'var(--success-color)' }}>
                            {(bookings.some(b => b.mechanicId?._id === m._id && ['dispatched', 'arrived', 'in-progress'].includes(b.status))) ? 'BUSY' : 'AVAILABLE'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
            </div>

          </div>
        )}

        {tab === 'profile' && (
          <form style={{maxWidth: '500px'}} onSubmit={submitProfile}>
            <h3 style={{marginBottom: '1rem'}}>Setup / Update Garage Profile</h3>

            <div className="input-group" style={{background: 'rgba(16, 185, 129, 0.1)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.4)', marginBottom: '1.5rem'}}>
              <h4 style={{margin: '0 0 1rem 0', color: 'var(--success-color)'}}>Live Operations Center</h4>
              
              <label style={{display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', marginBottom: '1rem', fontWeight: 'bold', fontSize: '1.1rem'}}>
                <input 
                  type="checkbox" 
                  checked={garageData.isOpen} 
                  onChange={e => setGarageData({...garageData, isOpen: e.target.checked})} 
                  style={{width: '20px', height: '20px', accentColor: '#10b981'}}
                />
                Accepting New Dispatch & Booking Requests (Garage is Open)
              </label>

              <div style={{marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(16, 185, 129, 0.4)'}}>
                <label style={{display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', marginBottom: '1rem', fontWeight: 'bold'}}>
                  <input 
                    type="checkbox" 
                    checked={garageData.timing.is24_7} 
                    onChange={e => setGarageData({...garageData, timing: {...garageData.timing, is24_7: e.target.checked}})} 
                    style={{width: '18px', height: '18px', accentColor: '#10b981'}}
                  />
                  Garage provides 24/7 Service Support
                </label>

                {!garageData.timing.is24_7 && (
                  <div className="animate-fade-in" style={{background: 'var(--bg-primary)', padding: '1rem', borderRadius: '8px'}}>
                    <div style={{display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap'}}>
                      <div style={{flex: 1, minWidth: '150px'}}>
                        <label className="input-label" style={{fontSize: '0.85rem'}}>Opening Time</label>
                        <input type="time" className="input-field" value={garageData.timing.openTime} onChange={e => setGarageData({...garageData, timing: {...garageData.timing, openTime: e.target.value}})} style={{padding: '0.5rem'}} />
                      </div>
                      <div style={{flex: 1, minWidth: '150px'}}>
                        <label className="input-label" style={{fontSize: '0.85rem'}}>Closing Time</label>
                        <input type="time" className="input-field" value={garageData.timing.closeTime} onChange={e => setGarageData({...garageData, timing: {...garageData.timing, closeTime: e.target.value}})} style={{padding: '0.5rem'}} />
                      </div>
                    </div>

                    <label className="input-label" style={{fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block'}}>Regular Closed Days (Off-Limits)</label>
                    <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                         <label key={day} style={{display: 'flex', alignItems: 'center', gap: '0.3rem', background: garageData.timing.closedDays.includes(day) ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-secondary)', border: garageData.timing.closedDays.includes(day) ? '1px solid var(--error-color)' : '1px solid var(--border-color)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.85rem', cursor: 'pointer'}}>
                           <input type="checkbox" 
                             checked={garageData.timing.closedDays.includes(day)}
                             onChange={e => {
                               const arr = e.target.checked 
                                  ? [...garageData.timing.closedDays, day] 
                                  : garageData.timing.closedDays.filter(d => d !== day);
                               setGarageData({...garageData, timing: {...garageData.timing, closedDays: arr}});
                             }} 
                           />
                           {day.substring(0,3)}
                         </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Garage Name <span style={{color: 'red'}}>*</span></label>
              <input type="text" className="input-field" required value={garageData.name} onChange={e => setGarageData({...garageData, name: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label">Contact Phone <span style={{color: 'red'}}>*</span></label>
              <input type="text" className="input-field" required value={garageData.phone} onChange={e => setGarageData({...garageData, phone: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label">Address / Landmark <span style={{color: 'red'}}>*</span></label>
              <input type="text" className="input-field" required value={garageData.address} onChange={e => setGarageData({...garageData, address: e.target.value})} />
            </div>
            <div className="input-group" style={{background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.5rem'}}>
              <label className="input-label" style={{marginBottom: '0.5rem', display: 'block'}}>Live Dispatch Coordinates (Map Pin) <span style={{color: 'red'}}>*</span></label>
              <div style={{display: 'flex', gap: '1rem', marginBottom: '1rem'}}>
                <input type="number" step="any" className="input-field" placeholder="Longitude" required value={garageData.coordinates[0]} onChange={e => setGarageData({...garageData, coordinates: [parseFloat(e.target.value) || 0, garageData.coordinates[1]]})} />
                <input type="number" step="any" className="input-field" placeholder="Latitude" required value={garageData.coordinates[1]} onChange={e => setGarageData({...garageData, coordinates: [garageData.coordinates[0], parseFloat(e.target.value) || 0]})} />
              </div>
              <button className="btn-secondary" onClick={fetchLocation} style={{padding: '0.5rem 1rem', width: '100%', marginBottom: '1rem'}}>📍 Auto-Locate Me via Device GPS</button>
              
              <div style={{height: '300px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative', zIndex: 1}}>
                <MapContainer center={[garageData.coordinates[1] || 27.71, garageData.coordinates[0] || 85.32]} zoom={13} style={{height: '100%', width: '100%'}}>
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; CARTO'
                  />
                  <LocationMarker 
                    coordinates={garageData.coordinates} 
                    setCoordinates={(coords) => setGarageData({...garageData, coordinates: coords})} 
                  />
                </MapContainer>
              </div>
              <small style={{display: 'block', marginTop: '0.5rem', color: 'var(--text-secondary)'}}>* You can also click anywhere on the map to pin your garage location manually.</small>
            </div>
            <div className="input-group">
              <label className="input-label">Public Garage Showcase (Upload up to 5 photos) <span style={{color: 'red'}}>*</span></label>
              <input type="file" className="input-field" multiple onChange={handleGalleryUpload} accept="image/*" style={{padding: '0.5rem'}} required={garageData.images.length === 0} />
              {garageData.images.length > 0 && (
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', overflowX: 'auto', scrollSnapType: 'x mandatory', paddingBottom: '1rem', scrollbarWidth: 'thin' }}>
                  {garageData.images.map((img, i) => (
                     <div key={i} style={{ position: 'relative', flex: '0 0 auto', scrollSnapAlign: 'start' }}>
                      <img src={img} alt="preview" style={{width: '280px', height: '160px', objectFit: 'cover', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)'}} />
                      <button type="button" onClick={() => setGarageData({...garageData, images: garageData.images.filter((_, idx) => idx !== i)})} style={{position: 'absolute', top: '-10px', right: '-10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize: '1.2rem', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.5)'}}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{marginTop: '1rem'}}>
                <Spinner status={galleryUploadStatus} loadingText="Uploading images..." successText="Images uploaded!" errorText="Upload failed" />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Upload Verification Document (Citizenship / Registration) <span style={{color: 'red'}}>*</span></label>
              <input type="file" className="input-field" onChange={handleFileUpload} accept="image/*" style={{padding: '0.5rem'}} required={!garageData.fileUrl} />
              <div style={{marginTop: '0.5rem'}}>
                <Spinner status={docUploadStatus} loadingText="Uploading document..." successText="Document uploaded!" errorText="Upload failed" />
              </div>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
              <button type="submit" className="btn-primary" disabled={docUploadStatus === 'loading' || galleryUploadStatus === 'loading' || profileSubmitStatus === 'loading'}>
                Save Profile Details
              </button>
              <Spinner status={profileSubmitStatus} loadingText="Saving profile..." successText="Profile Saved!" errorText="Failed to save profile" />
            </div>
          </form>
        )}

        {tab === 'mechanics' && (
          <div>
            <form style={{maxWidth: '500px', marginBottom: '3rem'}} onSubmit={addMechanic}>
              <h3 style={{marginBottom: '1rem'}}>Add New Mechanic</h3>
              
              <div className="input-group">
                <label className="input-label">Employee Name <span style={{color: 'red'}}>*</span></label>
                <input type="text" className="input-field" required value={mechData.name} onChange={e => setMechData({...mechData, name: e.target.value})} />
              </div>
              <div className="input-group">
                <label className="input-label">Phone Number / Route Comms <span style={{color: 'red'}}>*</span></label>
                <input type="text" className="input-field" required value={mechData.phone} onChange={e => setMechData({...mechData, phone: e.target.value})} />
              </div>
              <div className="input-group">
                <label className="input-label">Mechanic Avatar (Direct Cloudinary Vault)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <input type="file" className="input-field" accept="image/*" onChange={handleMechImageUpload} style={{padding: '0.4rem', flex: 1}} />
                  {uploadingMech && <span style={{color: 'var(--accent-primary)'}}>Syncing...</span>}
                  {!uploadingMech && mechData.fileUrl && (
                     <div style={{ width: '50px', height: '50px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #10b981', flexShrink: 0 }}>
                       <img src={mechData.fileUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Mech Preview"/>
                     </div>
                  )}
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={uploadingMech}>Provision Employee</button>
            </form>

            {mechanicsList.filter(m => !m.isVerified).length > 0 && (
              <>
                <h3 style={{marginBottom: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '2rem', color: '#f59e0b'}}>Pending Approvals</h3>
                <div style={{display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1rem', marginBottom: '2rem'}}>
                  {mechanicsList.filter(m => !m.isVerified).map(m => (
                    <div key={m._id} className="glass-panel" style={{padding: '1.5rem', width: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '1px solid #f59e0b'}}>
                      <div style={{width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-primary)', overflow: 'hidden', marginBottom: '1rem', border: '2px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        {m.image ? <img src={m.image} alt={m.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <span style={{fontSize: '2.5rem'}}>👤</span>}
                      </div>
                      <strong style={{fontSize: '1.2rem', color: 'var(--text-primary)'}}>{m.name}</strong>
                      <p style={{color: 'var(--text-secondary)', marginTop: '0.5rem'}}>{m.phone}</p>
                      
                      {m.certificate && (
                        <a href={m.certificate} target="_blank" rel="noopener noreferrer" style={{marginTop: '1rem', color: 'var(--accent-primary)', fontSize: '0.9rem', textDecoration: 'underline'}}>
                          📄 View Certificate / ID
                        </a>
                      )}

                      <div style={{display: 'flex', gap: '0.5rem', width: '100%', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem'}}>
                         <button className="btn-primary" style={{flex: 1, padding: '0.4rem', fontSize: '0.85rem', background: '#10b981', borderColor: '#10b981'}} onClick={() => updateMechanicDetails(m._id, { isVerified: true, status: 'available' })}>✅ Approve</button>
                         <button className="btn-secondary" style={{flex: 1, padding: '0.4rem', fontSize: '0.85rem', borderColor: 'var(--error-color)', color: 'var(--error-color)'}} onClick={() => deleteMechanic(m._id)}>❌ Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <h3 style={{marginBottom: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '2rem'}}>Your Active Dispatch Roster</h3>
            {mechanicsList.filter(m => m.isVerified).length === 0 ? <p style={{color: 'var(--text-secondary)'}}>No active mechanics deployed yet.</p> : (
              <div style={{display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1rem'}}>
                {mechanicsList.filter(m => m.isVerified).map(m => (
                  <div key={m._id} className="glass-panel" style={{padding: '1.5rem', width: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'}}>
                    
                     {editingMechanic === m._id ? (
                      <div style={{width: '100%'}}>
                         <strong style={{color: 'var(--accent-primary)', marginBottom: '1rem', display: 'block'}}>Override Mechanic</strong>
                         <input type="text" className="input-field" defaultValue={m.name} id={`edit-name-${m._id}`} placeholder="Name" style={{marginBottom: '0.5rem', padding: '0.4rem'}} />
                         <input type="text" className="input-field" defaultValue={m.phone} id={`edit-phone-${m._id}`} placeholder="Phone" style={{marginBottom: '0.5rem', padding: '0.4rem'}} />
                         
                         <label style={{display:'block', textAlign:'left', fontSize:'0.85rem', marginBottom:'0.3rem'}}>Override Avatar:</label>
                         <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1rem'}}>
                           <input type="file" className="input-field" accept="image/*" onChange={handleEditMechImageUpload} disabled={uploadingEditMech} style={{padding: '0.4rem', flex: 1, fontSize:'0.8rem'}} />
                           {uploadingEditMech ? <span style={{fontSize:'0.8rem', color:'var(--accent-primary)'}}>Syncing...</span> : (
                             editingMechImage && <img src={editingMechImage} alt="editing preview" style={{width:'35px', height:'35px', borderRadius:'50%', objectFit:'cover', border:'1px solid var(--accent-primary)'}} />
                           )}
                         </div>

                         <label style={{display:'block', textAlign:'left', fontSize:'0.85rem', marginBottom:'0.3rem'}}>Override Status:</label>
                         <select className="input-field" defaultValue={m.status} id={`edit-status-${m._id}`} style={{marginBottom: '1rem', padding: '0.4rem'}}>
                           <option value="available">🟢 Available (On Standby)</option>
                           <option value="busy">🔴 Busy (Working)</option>
                           <option value="offline">⚪ Offline / Off-Shift</option>
                         </select>

                         <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'center'}}>
                            <button className="btn-primary" disabled={uploadingEditMech} style={{padding: '0.4rem', flex: 1}} onClick={() => {
                               const newName = document.getElementById(`edit-name-${m._id}`).value;
                               const newPhone = document.getElementById(`edit-phone-${m._id}`).value;
                               const newStatus = document.getElementById(`edit-status-${m._id}`).value;
                               updateMechanicDetails(m._id, { name: newName, phone: newPhone, status: newStatus, image: editingMechImage });
                            }}>Save</button>
                            <button className="btn-secondary" style={{padding: '0.4rem', flex: 1}} onClick={() => { setEditingMechanic(null); setEditingMechImage(null); }}>Cancel</button>
                         </div>
                      </div>
                    ) : (
                      <>
                        <div style={{width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-primary)', overflow: 'hidden', marginBottom: '1rem', border: '2px solid var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.3)'}}>
                          {m.image ? <img src={m.image} alt={m.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <span style={{fontSize: '2.5rem'}}>👤</span>}
                        </div>
                        <Link to={`/mechanic-profile/${m._id}`} style={{ textDecoration: 'none' }}>
                          <strong style={{fontSize: '1.2rem', color: 'var(--accent-primary)', textDecoration: 'underline'}}>{m.name} ↗</strong>
                        </Link>
                        <p style={{color: 'var(--text-secondary)', marginTop: '0.5rem'}}>{m.phone}</p>
                        
                        <p style={{marginTop: '1rem', fontSize: '0.85rem', fontWeight: 'bold', display: 'inline-block', padding: '0.3rem 0.6rem', borderRadius: '4px',
                          background: m.status === 'busy' ? 'rgba(239, 68, 68, 0.1)' : m.status === 'offline' ? 'rgba(156, 163, 175, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                          color: m.status === 'busy' ? 'var(--error-color)' : m.status === 'offline' ? '#9ca3af' : 'var(--success-color)'}}>
                          {m.status.toUpperCase()}
                        </p>

                        {m.certificate && (
                          <a href={m.certificate} target="_blank" rel="noopener noreferrer" style={{marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textDecoration: 'underline'}}>
                            View Document
                          </a>
                        )}

                        <div style={{display: 'flex', gap: '0.5rem', width: '100%', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem'}}>
                           <button className="btn-secondary" style={{flex: 1, padding: '0.4rem', fontSize: '0.85rem'}} onClick={() => { setEditingMechanic(m._id); setEditingMechImage(m.image || null); }}>✏️ Edit</button>
                           <button className="btn-secondary" style={{flex: 1, padding: '0.4rem', fontSize: '0.85rem', borderColor: 'var(--error-color)', color: 'var(--error-color)'}} onClick={() => deleteMechanic(m._id)}>🗑️ Delete</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div>
            <h3>Rescue History Ledger</h3>
            <p style={{color: 'var(--text-secondary)', marginBottom: '1.5rem'}}>Archive of all completed services and rejected requests.</p>
            {bookings.filter(b => b.status === 'completed' || b.status === 'rejected').length === 0 ? <p style={{color: 'var(--text-secondary)'}}>No historical records.</p> : (
              <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                {bookings.filter(b => b.status === 'completed' || b.status === 'rejected').map(b => (
                  <div key={b._id} style={{border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '8px', background: 'var(--bg-secondary)', opacity: 0.85}}>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <strong>{b.type.toUpperCase()} Protocol</strong>
                      <span style={{color: b.status === 'rejected' ? 'var(--error-color)' : 'var(--success-color)'}}>{b.status.toUpperCase()}</span>
                    </div>
                    <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem'}}>Client: {b.userId?.name} | Handled By: {b.mechanicId?.name || 'N/A'}</p>
                    {b.status === 'completed' && (
                      <div style={{marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <div>
                          <p style={{margin: '0 0 0.3rem 0', fontWeight: 'bold'}}>Garage Invoice: <span style={{color: 'var(--text-primary)'}}>Rs. {b.totalAmount || 0}</span></p>
                          <p style={{margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)'}}>Client Payment Resolution:</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{
                            padding: '0.3rem 0.6rem', 
                            borderRadius: '4px', 
                            fontWeight: 'bold', 
                            fontSize: '0.8rem',
                            background: b.paymentStatus === 'paid' ? 'rgba(16, 185, 129, 0.1)' : 
                                        b.paymentStatus === 'cash_requested' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: b.paymentStatus === 'paid' ? '#10b981' : 
                                   b.paymentStatus === 'cash_requested' ? '#f59e0b' : '#ef4444'
                          }}>
                            {b.paymentStatus === 'paid' ? '✓ SUCCESS (PAID)' : 
                             b.paymentStatus === 'cash_requested' ? '⏳ SITE PAYMENT REQ' : '⚠️ INCOMPLETE (PENDING)'}
                          </span>
                          
                          {b.paymentStatus === 'cash_requested' && (
                            <button className="btn-primary" style={{ background: '#f59e0b', borderColor: '#f59e0b', color: 'black', padding: '0.3rem 0.8rem', fontSize: '0.85rem' }} onClick={() => handleConfirmSitePayment(b._id, b.userId)}>
                              Confirm Site Payment Received
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'receipts' && (
          <div>
            <h3 style={{marginBottom: '0.5rem'}}>Digital Payment Ledgers</h3>
            <p style={{color: 'var(--text-secondary)', marginBottom: '1.5rem'}}>Complete financial history of all settled operations.</p>
            {receipts.length === 0 ? <p style={{color: 'var(--text-secondary)'}}>No finalized payments yet.</p> : (
              <div style={{ overflowX: 'auto', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Date</th>
                      <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Client</th>
                      <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Service</th>
                      <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Method</th>
                      <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Total</th>
                      <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.map(r => (
                      <tr key={r._id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                        <td style={{ padding: '1rem', fontSize: '0.9rem' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '1rem', fontWeight: 'bold' }}>{r.userId?.name}</td>
                        <td style={{ padding: '1rem', textTransform: 'capitalize' }}>{r.bookingId?.type}</td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{ 
                            padding: '0.2rem 0.6rem', 
                            background: r.paymentMethod === 'eSewa' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', 
                            color: r.paymentMethod === 'eSewa' ? '#10b981' : '#3b82f6', 
                            borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' 
                          }}>
                            {r.paymentMethod?.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', fontWeight: 'bold', color: '#10b981' }}>Rs. {r.totalAmount}</td>
                        <td style={{ padding: '1rem' }}>
                          <button className="btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setViewingReceipt(r)}>
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'reviews' && (
           <div>
             <h3>Client Feedback & Reviews</h3>
             <p style={{color: 'var(--text-secondary)', marginBottom: '1.5rem'}}>Read-only view of post-service customer satisfaction.</p>
             {reviews.length === 0 ? <p style={{color: 'var(--text-secondary)'}}>No reviews posted for your garage yet.</p> : (
               <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                 {reviews.map(r => (
                   <div key={r._id} style={{padding: '1.5rem', background: 'var(--bg-secondary)', borderLeft: '4px solid var(--accent-primary)', borderRadius: '8px'}}>
                     <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem'}}>
                       <strong style={{fontSize: '1.1rem'}}>{r.userId?.name}</strong>
                       <span style={{color: '#fbbf24', fontWeight: 'bold', fontSize: '1.2rem', textShadow: '0 0 10px rgba(251, 191, 36, 0.3)'}}>
                         {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                       </span>
                     </div>
                     <p style={{color: 'var(--text-primary)', fontStyle: 'italic', fontSize: '1.05rem'}}>"{r.comment}"</p>
                     <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.8rem'}}>{new Date(r.createdAt).toLocaleDateString()}</p>
                   </div>
                 ))}
               </div>
             )}
           </div>
        )}
      </div>

      {/* COMPLETION / INVOICE MODAL */}
      {completingBooking && (
        <div className="modal-overlay animate-fade-in" style={{zIndex: 99999}}>
          <div className="modal-content" style={{maxWidth: '600px', width: '90%'}}>
             <button className="modal-close-btn" onClick={() => { 
                setCompletingBooking(null); 
                setInvoiceItems([{ name: '', price: '' }]);
                setInvoiceDiscount('');
             }}>✕</button>
             <h2 style={{color: 'var(--accent-primary)', marginBottom: '1rem'}}>Issue Detailed Invoice</h2>
              {completingBooking.maintenanceReport && (
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', borderLeft: '4px solid #3b82f6', padding: '1rem', borderRadius: '4px', marginBottom: '1.5rem' }}>
                  <strong style={{ color: '#3b82f6', fontSize: '0.9rem', textTransform: 'uppercase' }}>Mechanic's Work Report:</strong>
                  <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-primary)', fontStyle: 'italic', fontSize: '1rem' }}>
                    "{completingBooking.maintenanceReport}"
                  </p>
                </div>
              )}
             <p style={{color: 'var(--text-secondary)', marginBottom: '1.5rem'}}>
               Build the final bill for <strong>{completingBooking.userId?.name}</strong>. Add individual operations or parts, apply discounts, and we will automatically render the final payable amount securely for the eSewa checkout.
             </p>
             <form onSubmit={(e) => {
               e.preventDefault();
               const subtotal = invoiceItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
               const discount = parseFloat(invoiceDiscount) || 0;
               const finalTotal = subtotal - discount;
               
               if(finalTotal < 0) return alert("Final Total cannot be negative!");
               if(subtotal === 0) return alert("Please add at least one valid cost item.");

               // Build breakdown array
               const costBreakdown = invoiceItems
                  .filter(i => i.name.trim() !== '' && i.price !== '')
                  .map(i => ({ item: i.name, price: parseFloat(i.price) }));
               
               if(discount > 0) {
                  costBreakdown.push({ item: 'Garage Discount Applied', price: -Math.abs(discount) });
               }

               updateStatus(completingBooking._id, 'completed', null, { 
                 totalAmount: finalTotal, // the backend payment route deducts advance natively on top of this later.
                 costBreakdown: costBreakdown 
               });
               
               alert("Detailed Invoice Submitted & Route Completed! Mechanic Restored to Base.");
               setCompletingBooking(null);
               setInvoiceItems([{ name: '', price: '' }]);
               setInvoiceDiscount('');
             }}>
                
                <h4 style={{marginBottom: '0.8rem', color: 'var(--text-primary)'}}>Itemized Cost Breakdown</h4>
                {invoiceItems.map((item, idx) => (
                   <div key={idx} style={{ display: 'flex', gap: '1rem', marginBottom: '0.8rem', alignItems: 'center' }}>
                     <input type="text" className="input-field" placeholder="Item/Service Name (e.g. Engine Oil)" required value={item.name} 
                       onChange={(e) => {
                          const newItems = [...invoiceItems];
                          newItems[idx].name = e.target.value;
                          setInvoiceItems(newItems);
                       }} style={{ flex: 2, padding: '0.6rem' }} />
                       
                     <div style={{ position: 'relative', flex: 1 }}>
                       <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Rs.</span>
                       <input type="number" className="input-field" placeholder="Cost" required min="0" value={item.price} 
                         onChange={(e) => {
                            const newItems = [...invoiceItems];
                            newItems[idx].price = e.target.value;
                            setInvoiceItems(newItems);
                         }} style={{ padding: '0.6rem 0.6rem 0.6rem 2.2rem', width: '100%' }} />
                     </div>
                     
                     {invoiceItems.length > 1 && (
                       <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.8rem', borderColor: '#ef4444', color: '#ef4444' }} 
                         onClick={() => setInvoiceItems(invoiceItems.filter((_, i) => i !== idx))}>✕</button>
                     )}
                   </div>
                ))}
                
                <button type="button" className="btn-secondary" style={{ width: '100%', marginBottom: '1.5rem', padding: '0.5rem', borderStyle: 'dashed' }} 
                   onClick={() => setInvoiceItems([...invoiceItems, { name: '', price: '' }])}>
                   + Add Another Item
                </button>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                   <div>
                     <label className="input-label" style={{display: 'block', marginBottom: '0.2rem'}}>Apply Flat Discount (Optional)</label>
                     <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Deduct a fixed Rs. amount.</p>
                   </div>
                   <div style={{ position: 'relative', width: '150px' }}>
                       <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontWeight: 'bold' }}>-Rs.</span>
                       <input type="number" className="input-field" placeholder="0" min="0" value={invoiceDiscount} onChange={(e) => setInvoiceDiscount(e.target.value)} style={{ padding: '0.6rem 0.6rem 0.6rem 2.6rem', width: '100%', borderColor: '#fbbf24' }} />
                   </div>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'right' }}>
                   {(() => {
                      const subtotal = invoiceItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
                      const discount = parseFloat(invoiceDiscount) || 0;
                      const userAdvance = completingBooking.advanceAmountPaid || 0;
                      const netTotal = subtotal - discount;
                   return (
                     <>
                       <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>Gross Subtotal: Rs. {subtotal}</p>
                       {discount > 0 && <p style={{ margin: '0 0 0.5rem 0', color: '#fbbf24' }}>Active Discount: -Rs. {discount}</p>}
                       {userAdvance > 0 && <p style={{ margin: '0 0 0.5rem 0', color: '#3b82f6' }}>Pre-Paid Advance (System Deduced): Yes (Rs. {userAdvance})</p>}
                       <h3 style={{ margin: 0, color: '#10b981', fontSize: '1.8rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(16, 185, 129, 0.3)' }}>
                         Net Invoice Total: Rs. {netTotal > 0 ? netTotal : 0}
                       </h3>
                     </>
                   );
                   })()}
                </div>

                <button type="submit" className="btn-primary" style={{width: '100%', background: '#10b981', borderColor: '#10b981', padding: '1rem'}}>Confirm & Push Legal Invoice to Subledger</button>
             </form>
          </div>
        </div>
      )}
      {/* VIEW RECEIPT MODAL */}
      {viewingReceipt && (
        <div className="modal-overlay animate-fade-in" style={{zIndex: 100000}} onClick={() => setViewingReceipt(null)}>
          <div className="modal-content" style={{maxWidth: '500px', width: '90%', padding: '2.5rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '12px'}} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{color: 'var(--text-primary)', margin: 0, fontSize: '1.5rem'}}>Digital Receipt Details</h2>
              <button onClick={() => setViewingReceipt(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
            </div>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '1.2rem'}}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Date Settled</span>
                <strong style={{ color: 'var(--text-primary)' }}>{new Date(viewingReceipt.createdAt).toLocaleString()}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Client Name</span>
                <strong style={{ color: 'var(--text-primary)' }}>{viewingReceipt.userId?.name}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Client Contact</span>
                <strong style={{ color: 'var(--text-primary)' }}>{viewingReceipt.userId?.phone || 'N/A'}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Service Type</span>
                <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{viewingReceipt.bookingId?.type}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Vehicle</span>
                <strong style={{ color: 'var(--text-primary)' }}>{viewingReceipt.bookingId?.vehicleBrand} {viewingReceipt.bookingId?.vehicleModel}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Transaction ID</span>
                <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{viewingReceipt.transactionId || 'N/A'}</strong>
              </div>

              <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '8px', marginTop: '1rem' }}>
                 <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between'}}>
                   <span>Cost Breakdown</span>
                   <span style={{ fontWeight: 'bold', color: viewingReceipt.paymentMethod === 'eSewa' ? '#10b981' : '#3b82f6' }}>{viewingReceipt.paymentMethod?.toUpperCase()}</span>
                 </p>
                 {viewingReceipt.costBreakdown?.map((item, idx) => (
                   <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                     <span>{item.item}</span>
                     <span>Rs. {item.price}</span>
                   </div>
                 ))}
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                   <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Total Settled</strong>
                   <strong style={{ fontSize: '1.2rem', color: '#10b981' }}>Rs. {viewingReceipt.totalAmount}</strong>
                 </div>
              </div>
              
            </div>
          </div>
        </div>
      )}

      <TrackingMap 
        trackingSession={trackingSession} 
        theme="light" 
        onClose={() => setTrackingSession(null)} 
        role="garage" 
      />
    </div>
  ); 
  }