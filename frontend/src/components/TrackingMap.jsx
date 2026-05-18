import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

const userIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41]
});

const mechanicIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41]
});

const garageIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41]
});

function TrackingBounds({ userPos, mechPos, garagePos }) {
  const map = useMap();
  useEffect(() => {
    if (userPos && mechPos && garagePos) {
      const bounds = L.latLngBounds([userPos, mechPos, garagePos]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18, animate: true, duration: 0.8 });
    } else if (userPos && mechPos) {
      const bounds = L.latLngBounds([userPos, mechPos]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18, animate: true, duration: 0.8 });
    } else if (userPos) {
      map.setView(userPos, 16);
    }
  }, [userPos, mechPos, garagePos, map]);
  return null;
}

export default function TrackingMap({ trackingSession, theme, onClose, role, onMarkArrived }) {
  if (!trackingSession) return null;
  const isArrived = ['arrived', 'in-progress', 'completed'].includes(trackingSession.status);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh', background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
       <div className="animate-fade-in" style={{ width: '90%', maxWidth: '1000px', height: '80vh', background: 'var(--bg-primary)', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ padding: '1.5rem', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
             <div>
               <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Live Dispatch Radar</h2>
               <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)' }}>Monitoring: {trackingSession.mechanicName} ({trackingSession.garageName})</p>
             </div>
             <div style={{ display: 'flex', gap: '1rem' }}>
                {role === 'user' && !isArrived && (
                  <button 
                    onClick={() => onMarkArrived(trackingSession.bookingId)}
                    className="btn-primary animate-pulse"
                    style={{ background: '#10b981', borderColor: '#10b981', color: 'white', padding: '0.6rem 1.5rem', borderRadius: '20px', fontWeight: 'bold' }}
                  >
                    ✓ Confirm Mechanic Arrived
                  </button>
                )}
               <button className="btn-secondary" onClick={onClose} style={{ borderColor: 'var(--error-color)', color: 'var(--error-color)' }}>Close Map</button>
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
              <TrackingBounds userPos={trackingSession.userPos} mechPos={trackingSession.mechPos} garagePos={trackingSession.garagePos} />
              
              <Marker position={trackingSession.garagePos} icon={garageIcon} title={`Garage: ${trackingSession.garageName}`}>
                <Popup>
                  <strong>{trackingSession.garageName} Base HQ (Blue)</strong><br/>
                  📞 {trackingSession.garagePhone || 'No Contact Info'}<br/>
                  <small>Distance to User: { Math.round(L.latLng(trackingSession.garagePos[0], trackingSession.garagePos[1]).distanceTo(L.latLng(trackingSession.userPos[0], trackingSession.userPos[1])) / 100) / 10 } km</small>
                </Popup>
              </Marker>
              
              <Marker position={trackingSession.userPos} icon={userIcon} title={`User: ${trackingSession.userName}`}>
                <Popup>
                  <strong>{trackingSession.userName || 'User'} (Green)</strong><br/>
                  📞 {trackingSession.userPhone || 'No Contact Info'}<br/>
                  <small>Distance from Garage: { Math.round(L.latLng(trackingSession.userPos[0], trackingSession.userPos[1]).distanceTo(L.latLng(trackingSession.garagePos[0], trackingSession.garagePos[1])) / 100) / 10 } km</small>
                </Popup>
              </Marker>
              
              <Marker position={trackingSession.mechPos} icon={mechanicIcon} title={`Mechanic: ${trackingSession.mechanicName}`}>
                <Popup>
                  <strong>{trackingSession.mechanicName || 'Mechanic'} (Red)</strong><br/>
                  📞 {trackingSession.mechanicPhone || 'No Contact Info'}<br/>
                  <small>Distance to User: { Math.round(L.latLng(trackingSession.mechPos[0], trackingSession.mechPos[1]).distanceTo(L.latLng(trackingSession.userPos[0], trackingSession.userPos[1])) / 100) / 10 } km</small>
                </Popup>
              </Marker>

              <Polyline positions={[trackingSession.mechPos, trackingSession.userPos]} color="#10b981" weight={5} />
            </MapContainer>
            
            <div style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'var(--bg-primary)', padding: '1rem 2rem', borderRadius: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', border: '2px solid var(--accent-primary)', textAlign: 'center' }}>
              <strong style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>
                { Math.round(L.latLng(trackingSession.userPos[0], trackingSession.userPos[1]).distanceTo(L.latLng(trackingSession.mechPos[0], trackingSession.mechPos[1])) / 100) / 10 } km
              </strong>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'bold' }}>Remaining Distance</p>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Between Mechanic & User</p>
            </div>
          </div>
       </div>
    </div>
  );
}
