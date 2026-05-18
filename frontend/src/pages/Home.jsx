import { useState, useEffect, useContext } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { Wrench, PhoneCall, Bike, Settings, Zap, Search } from 'lucide-react';

const defaultIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const userIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 13);
  }, [lat, lng, map]);

  return (
    <div className="leaflet-top leaflet-left" style={{marginTop: '80px', marginLeft: '10px'}}>
      <div className="leaflet-control leaflet-bar">
        <button 
          onClick={(e) => { e.preventDefault(); map.flyTo([lat, lng], 13); }} 
          title="Center to my location"
          style={{width: '34px', height: '34px', background: 'var(--bg-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', borderRadius: '4px'}}
        >
          📍
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const navigate = useNavigate();
  const [location, setLocation] = useState({ lat: 27.7172, lng: 85.3240 }); 
  const [garages, setGarages] = useState([]);
  const [showMap, setShowMap] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [isLocating, setIsLocating] = useState(false);

  const [searchRadius, setSearchRadius] = useState(1000); // 1km default
  


  // Explore logic moved to ExploreGarages.jsx

  const fetchNearbyGarages = async (lat, lng, radiusObj) => {
    try {
      const res = await api.get(`/garages/nearby?lat=${lat}&lng=${lng}&maxDistance=${radiusObj || searchRadius}`);
      if(res.data.success) {
        setGarages(res.data.data);
      } else {
        setGarages(res.data); // in case backend format is direct array
      }
    } catch(err) {
      console.error(err);
    }
  };

  // Removed old handleTextSearch

  const handleEmergencyClick = () => {
    if (!user) {
      alert("Please login to request emergency rescue.");
      return navigate('/login');
    }
    
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocation({ lat, lng });
          setIsLocating(false);
          setShowMap(true);
          setIsScanning(true);
          fetchNearbyGarages(lat, lng, searchRadius);
        },
        (err) => {
          console.warn("Location permission denied. Using default or last known.");
          setIsLocating(false);
          setShowMap(true);
          setIsScanning(true);
          fetchNearbyGarages(location.lat, location.lng, searchRadius);
        }
      );
    } else {
      setShowMap(true);
      setIsScanning(true);
      fetchNearbyGarages(location.lat, location.lng, searchRadius);
    }
  };

  // Re-fetch automatically when radius drops down
  useEffect(() => {
    if (showMap && isScanning) fetchNearbyGarages(location.lat, location.lng, searchRadius);
  }, [searchRadius, isScanning, showMap]);

  if (showMap) {
    return (
      <div className="animate-fade-in">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem'}}>
          <div>
            <h2 style={{color: 'var(--accent-primary)'}}>Emergency Rescue Dispatch</h2>
            <p style={{color: 'var(--text-secondary)'}}>{isScanning ? 'Scanning for nearby 2-wheeler mechanics...' : 'Scan stopped. Stand by or initiate a new scan.'}</p>
          </div>
          <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
            {isScanning ? (
              <>
                <select className="input-field" style={{margin: 0, padding: '0.5rem', minWidth: '150px'}} value={searchRadius} onChange={(e) => setSearchRadius(Number(e.target.value))}>
                  <option value={1000}>Within 1 km</option>
                  <option value={5000}>Within 5 km</option>
                  <option value={10000}>Within 10 km</option>
                  <option value={20000}>Within 20 km</option>
                  <option value={50000}>Within 50 km</option>
                  <option value={10000000}>Show All (Global Network)</option>
                </select>
                <button className="btn-secondary" onClick={() => { setIsScanning(false); setGarages([]); }}>Cancel Request</button>
              </>
            ) : (
              <>
                <button className="btn-primary" onClick={() => { setSearchRadius(1000); setIsScanning(true); fetchNearbyGarages(location.lat, location.lng, 1000); }}>Scan Now</button>
                <button className="btn-secondary" onClick={() => setShowMap(false)}>Exit Map</button>
              </>
            )}
          </div>
        </div>

        <div className="animate-fade-in" style={{ height: '600px', width: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative', zIndex: 1 }}>
          <MapContainer center={[location.lat, location.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url={theme === 'dark' 
                ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              }
              attribution='&copy; CARTO'
            />
            <RecenterMap lat={location.lat} lng={location.lng} />
            
            <Marker position={[location.lat, location.lng]} icon={userIcon}>
              <Popup>
                <div style={{color: 'var(--text-primary)'}}><strong>You are here</strong><br/>Waiting for dispatch...</div>
              </Popup>
            </Marker>

            {garages.map(g => {
              const d = L.latLng(location.lat, location.lng).distanceTo(L.latLng(g.location.coordinates[1], g.location.coordinates[0]));
              const dKm = Math.round(d / 100) / 10;
              return (
              <Marker key={g._id} position={[g.location.coordinates[1], g.location.coordinates[0]]} icon={defaultIcon}>
                <Tooltip direction="top" offset={[0, -20]} opacity={0.9}>
                  <div style={{ textAlign: 'center' }}>
                    <strong style={{ display: 'block', fontSize: '1rem' }}>{g.name}</strong>
                    {g.isOpen === false && <span style={{ display: 'block', color: 'var(--error-color)', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.2rem' }}>OFFLINE / CLOSED</span>}
                    <span style={{ display: 'block', color: 'var(--accent-primary)', fontWeight: 'bold' }}>{dKm} km away</span>
                    <span style={{ display: 'block', fontSize: '0.85rem' }}>📞 {g.phone}</span>
                  </div>
                </Tooltip>
                <Popup>
                  <div style={{color: 'var(--text-primary)'}}>
                    <button className="btn-primary" style={{padding: '0.4rem 0.8rem', fontSize: '0.9rem', width: '100%'}} onClick={() => navigate(`/garage/${g._id}`)}>
                      View Profile & Book
                    </button>
                  </div>
                </Popup>
              </Marker>
            )})}
          </MapContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <div style={{ textAlign: 'center', padding: '5rem 1rem', background: 'var(--glass-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', backdropFilter: 'blur(10px)', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3rem', color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 800 }}>
          Your Ultimate <span style={{color: 'var(--accent-primary)'}}>2-Wheeler</span> Guardian
        </h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 2.5rem auto' }}>
          Whether you need a routine scooter service, or an emergency bike tow on a lonely road, our GPS mechanic dispatch gets you moving.
        </p>

        <button 
          className="btn-secondary" 
          style={{ fontSize: '1.1rem', padding: '1rem 2rem', fontWeight: 'bold', margin: '0 auto 1.5rem auto', display: 'flex', alignItems: 'center', gap: '0.8rem' }} 
          onClick={() => navigate('/explore')}
        >
          <Search size={24} />
          Explore Garage Network
        </button>

        <button 
          className="btn-primary" 
          style={{ fontSize: '1.1rem', padding: '1rem 2rem', fontWeight: 'bold', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '0.8rem', background: '#dc2626', borderColor: '#dc2626', boxShadow: '0 8px 30px rgba(220, 38, 38, 0.4)' }} 
          onClick={handleEmergencyClick}
          disabled={isLocating}
        >
          <Zap size={24} />
          {isLocating ? 'Acquiring GPS Signal...' : 'Emergency Rescue (GPS Dispatch)'}
        </button>
      </div>



      {/* Services Section */}
      <h2 style={{textAlign: 'center', marginBottom: '2.5rem', color: 'var(--text-primary)'}}>Our Specialized Services</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '4rem' }}>
        
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', transition: 'transform 0.2s', cursor: 'default' }} onMouseOver={e=>e.currentTarget.style.transform='translateY(-5px)'} onMouseOut={e=>e.currentTarget.style.transform='translateY(0)'}>
          <Bike size={40} color="var(--accent-primary)" style={{marginBottom: '1rem'}} />
          <h3 style={{marginBottom: '0.5rem'}}>Bike Servicing</h3>
          <p style={{color: 'var(--text-secondary)', fontSize: '0.95rem'}}>Standard tune-ups, oil changes, and full performance checks for motorcycles.</p>
        </div>

        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', transition: 'transform 0.2s', cursor: 'default' }} onMouseOver={e=>e.currentTarget.style.transform='translateY(-5px)'} onMouseOut={e=>e.currentTarget.style.transform='translateY(0)'}>
          <Settings size={40} color="var(--accent-primary)" style={{marginBottom: '1rem'}} />
          <h3 style={{marginBottom: '0.5rem'}}>Scooter Maintenance</h3>
          <p style={{color: 'var(--text-secondary)', fontSize: '0.95rem'}}>Belt repairs, brake tuning, and general scooter care right at your door or nearby.</p>
        </div>

        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', transition: 'transform 0.2s', cursor: 'default' }} onMouseOver={e=>e.currentTarget.style.transform='translateY(-5px)'} onMouseOut={e=>e.currentTarget.style.transform='translateY(0)'}>
          <Wrench size={40} color="var(--accent-primary)" style={{marginBottom: '1rem'}} />
          <h3 style={{marginBottom: '0.5rem'}}>Puncture & Battery</h3>
          <p style={{color: 'var(--text-secondary)', fontSize: '0.95rem'}}>Instant flat tire repairs and jumpstarts when you're stranded locally.</p>
        </div>

        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', transition: 'transform 0.2s', cursor: 'default' }} onMouseOver={e=>e.currentTarget.style.transform='translateY(-5px)'} onMouseOut={e=>e.currentTarget.style.transform='translateY(0)'}>
          <PhoneCall size={40} color="var(--accent-primary)" style={{marginBottom: '1rem'}} />
          <h3 style={{marginBottom: '0.5rem'}}>Towing Rescue</h3>
          <p style={{color: 'var(--text-secondary)', fontSize: '0.95rem'}}>Major engine failure? We dispatch a towing service directly to your GPS coordinates.</p>
        </div>

      </div>


    </div>
  );
}
