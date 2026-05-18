import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import io from 'socket.io-client';
import TrackingMap from '../components/TrackingMap';
import MechanicProfile from './MechanicProfile';
import toast from 'react-hot-toast';

export default function MechanicPortal() {
  const { mechanicId } = useParams();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [trackingSession, setTrackingSession] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [activeDispatch, setActiveDispatch] = useState(null);
  const [activeTab, setActiveTab] = useState('dispatch');
  const [completingBooking, setCompletingBooking] = useState(null);
  const [maintenanceReport, setMaintenanceReport] = useState('');

  useEffect(() => {
    fetchBookings();
    const newSocket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000');
    setSocket(newSocket);
    
    newSocket.emit('join_mechanic_room', mechanicId);

    newSocket.on('new_assignment', (data) => {
       toast.success(data.message || 'New assignment received!', { icon: '🛠️' });
       fetchBookings();
    });

    const interval = setInterval(fetchBookings, 15000); // Polling as fallback

    return () => {
      newSocket.close();
      clearInterval(interval);
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [mechanicId]);

  const fetchBookings = async () => {
    try {
      const res = await api.get(`/bookings/mechanic/${mechanicId}`);
      setBookings(res.data);
    } catch (err) {
      console.error("Failed to fetch mechanic bookings", err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status, report = null) => {
    try {
      await api.put(`/bookings/${id}/mechanic`, { status, mechanicId, maintenanceReport: report });
      fetchBookings();
    } catch (err) {
      alert("Failed to update status: " + (err.response?.data?.message || err.message));
    }
  };

  const handleAcceptDispatch = async (b) => {
    await updateStatus(b._id, 'dispatched');
    setActiveDispatch(b);
    
    if (socket) {
       const uid = typeof b.userId === 'object' ? b.userId._id : b.userId;
       const gid = typeof b.garageId === 'object' ? b.garageId._id : b.garageId;
       socket.emit('notify_status_update', { userId: uid, garageId: gid, status: 'dispatched', message: 'Mechanic is en route!' });
    }
    
    // Start watching position and emitting to socket
    if (navigator.geolocation && socket) {
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          socket.emit('update_mechanic_location', {
            bookingId: b._id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        (err) => console.error(err),
        { enableHighAccuracy: true, maximumAge: 0 }
      );
      setWatchId(id);
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  const handleMarkArrived = async (bookingId) => {
    await updateStatus(bookingId, 'arrived');
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setActiveDispatch(null);
    setTrackingSession(null);
    toast.success("Arrival Confirmed! Please begin service.");
    
    // Emit arrival to users
    const b = bookings.find(x => x._id === bookingId);
    if (b && socket) {
       const uid = typeof b.userId === 'object' ? b.userId._id : b.userId;
       const gid = typeof b.garageId === 'object' ? b.garageId._id : b.garageId;
       socket.emit('notify_status_update', { userId: uid, garageId: gid, status: 'arrived', message: 'Mechanic has arrived at location!' });
    }
  };

  const openTracker = (b) => {
    if (!socket) return alert("Socket unconnected.");
    socket.emit('join_booking', b._id);
    
    const gLng = b.garageId?.location?.coordinates[0] || 85.32;
    const gLat = b.garageId?.location?.coordinates[1] || 27.71;
    
    const uLng = b.issueLocation?.coordinates[0] || gLng + 0.01;
    const uLat = b.issueLocation?.coordinates[1] || gLat + 0.01;

    // Use current location if available, otherwise default to garage base
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setTrackingSession({
          bookingId: b._id,
          userPos: [uLat, uLng],
          mechPos: [pos.coords.latitude, pos.coords.longitude],
          garagePos: [gLat, gLng],
          mechanicName: "You",
          mechanicPhone: "Your Phone",
          garageName: b.garageId?.name || "Garage Base",
          garagePhone: b.garageId?.phone || "N/A",
          userName: b.userId?.name || "User",
          userPhone: b.userId?.phone || "N/A"
        });
      },
      () => {
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
          mechanicName: "You",
          mechanicPhone: "Your Phone",
          garageName: b.garageId?.name || "Garage Base",
          garagePhone: b.garageId?.phone || "N/A",
          userName: b.userId?.name || "User",
          userPhone: b.userId?.phone || "N/A"
        });
      }
    );
  };

  if (loading) return <div style={{padding: '2rem'}}>Loading Mechanic Portal...</div>;

  const activeBookings = bookings.filter(b => ['assigned', 'dispatched', 'arrived', 'in-progress', 'maintenance-completed'].includes(b.status));
  // Logic updated: mechanics can now handle parallel jobs (standard + dispatch)
  const hasActiveDispatch = activeBookings.some(b => ['dispatched', 'arrived', 'in-progress', 'maintenance-completed'].includes(b.status) && (b.type === 'immediate' || b.type === 'towing'));

  return (
    <div className="animate-fade-in" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ color: 'var(--accent-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
        🛠️ Mechanic Dashboard
      </h1>
      
      {/* Portal Navigation Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <button 
          onClick={() => setActiveTab('dispatch')}
          className={`btn-secondary ${activeTab === 'dispatch' ? 'active' : ''}`}
          style={{ 
            background: activeTab === 'dispatch' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'dispatch' ? 'var(--btn-primary-text)' : 'var(--text-primary)',
            borderColor: activeTab === 'dispatch' ? 'var(--accent-primary)' : 'var(--border-color)',
            flex: 1,
            maxWidth: '300px'
          }}
        >
          🚨 Live Dispatches
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={`btn-secondary ${activeTab === 'profile' ? 'active' : ''}`}
          style={{ 
            background: activeTab === 'profile' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'profile' ? 'var(--btn-primary-text)' : 'var(--text-primary)',
            borderColor: activeTab === 'profile' ? 'var(--accent-primary)' : 'var(--border-color)',
            flex: 1,
            maxWidth: '300px'
          }}
        >
          👤 My Public Profile
        </button>
      </div>

      {activeTab === 'profile' ? (
        <MechanicProfile mechanicIdProp={mechanicId} />
      ) : (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>Mechanic Dispatch Portal</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Live Operation Terminal</p>

          {activeBookings.length === 0 ? (
             <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                <h3 style={{ color: 'var(--text-secondary)' }}>No active dispatches.</h3>
                <p>You are currently available and waiting for garage assignments.</p>
             </div>
          ) : (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {activeBookings.map(b => (
                   <div key={b._id} className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent-primary)' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                       <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{b.type.toUpperCase()} RESCUE</h3>
                       <span style={{
                         padding: '0.3rem 0.8rem',
                         borderRadius: '20px',
                         fontWeight: 'bold',
                         fontSize: '0.85rem',
                         background: 'rgba(59, 130, 246, 0.2)',
                         color: '#3b82f6'
                       }}>
                         {b.status.toUpperCase()}
                       </span>
                     </div>
                     
                     <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}><strong>Client:</strong> {b.userId?.name} ({b.userId?.phone})</p>
                     <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}><strong>Vehicle:</strong> {b.vehicleBrand} {b.vehicleModel}</p>
                     <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}><strong>Notes:</strong> {b.notes || 'None'}</p>

                     {b.status === 'assigned' && (
                        <button className="btn-primary" style={{ width: '100%', background: '#dc2626', borderColor: '#dc2626', padding: '1rem', fontSize: '1.1rem' }} onClick={() => handleAcceptDispatch(b)}>
                          Acknowledge & Start Dispatch
                        </button>
                     )}

                      {b.status === 'in-progress' && (
                         <button className="btn-primary" style={{ width: '100%', background: '#10b981', borderColor: '#10b981', padding: '1rem', fontSize: '1.1rem' }} onClick={() => setCompletingBooking(b)}>
                           ✓ Finish Maintenance & Send Report
                         </button>
                      )}

                      {b.status === 'maintenance-completed' && (
                        <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                          ✅ Work Finished. Awaiting User Acceptance...
                        </div>
                      )}

                     {(b.status === 'dispatched' || b.status === 'arrived') && (
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          <button className="btn-secondary" style={{ flex: 1, borderColor: '#3b82f6', color: '#3b82f6' }} onClick={() => openTracker(b)}>
                            🔴 Open Navigation Radar
                          </button>
                           <div style={{ flex: 1, padding: '0.8rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '8px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 'bold' }}>
                             ⏳ Awaiting User Arrival Confirmation
                           </div>
                        </div>
                     )}
                   </div>
                ))}
             </div>
          )}
        </div>
      )}

       <TrackingMap 
         trackingSession={trackingSession} 
         theme="light" 
         onClose={() => setTrackingSession(null)} 
         role="mechanic"
       />

       {/* MAINTENANCE REPORT MODAL */}
       {completingBooking && (
         <div className="modal-overlay animate-fade-in" style={{zIndex: 99999}}>
           <div className="modal-content" style={{maxWidth: '500px', width: '90%'}}>
              <button className="modal-close-btn" onClick={() => { setCompletingBooking(null); setMaintenanceReport(''); }}>✕</button>
              <h2 style={{color: 'var(--accent-primary)', marginBottom: '1rem'}}>Submit Maintenance Report</h2>
              <p style={{color: 'var(--text-secondary)', marginBottom: '1.5rem'}}>
                Describe the repairs performed, parts replaced, and any additional findings for <strong>{completingBooking.userId?.name}</strong>.
              </p>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if(!maintenanceReport.trim()) return alert("Please provide report details.");
                
                await updateStatus(completingBooking._id, 'maintenance-completed', maintenanceReport);
                
                if (socket) {
                   const uid = typeof completingBooking.userId === 'object' ? completingBooking.userId._id : completingBooking.userId;
                   const gid = typeof completingBooking.garageId === 'object' ? completingBooking.garageId._id : completingBooking.garageId;
                   socket.emit('notify_status_update', { 
                     userId: uid, 
                     garageId: gid, 
                     status: 'maintenance-completed', 
                     message: 'Mechanic has finished work and submitted the maintenance report.' 
                   });
                }
                
                toast.success("Work report submitted to garage for invoicing!");
                setCompletingBooking(null);
                setMaintenanceReport('');
              }}>
                 <textarea 
                   className="input-field" 
                   style={{ minHeight: '150px', marginBottom: '1.5rem', padding: '1rem' }} 
                   placeholder="Example: Replaced flat tire with spare, adjusted air pressure, checked brake pads (OK)..."
                   required
                   value={maintenanceReport}
                   onChange={e => setMaintenanceReport(e.target.value)}
                 />
                 <button type="submit" className="btn-primary" style={{width: '100%', background: '#10b981', borderColor: '#10b981'}}>Send Report to Garage HQ</button>
              </form>
           </div>
         </div>
       )}
    </div>
  );
}
