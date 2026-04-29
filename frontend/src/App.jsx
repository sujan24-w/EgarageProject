import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import { ThemeContext } from './context/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import GarageDashboard from './pages/GarageDashboard';
import MyBookings from './pages/MyBookings';
import BookingForm from './pages/BookingForm';
import AdminDashboard from './pages/AdminDashboard';
import GarageDetails from './pages/GarageDetails';
import ExploreGarages from './pages/ExploreGarages';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentFailure from './pages/PaymentFailure';
import About from './pages/About';
import Contact from './pages/Contact';

function App() {
  const { user, loading, logout } = useContext(AuthContext);
  const { theme, toggleTheme } = useContext(ThemeContext);

  if (loading) return <div className="animate-fade-in" style={{padding: '2rem', textAlign: 'center'}}>Loading App...</div>;

  return (
    <>
      <nav className="nav-header">
        <Link to={user?.role === 'garage_owner' ? '/garage-dashboard' : (user?.role === 'admin' ? '/admin-dashboard' : '/')} style={{ textDecoration: 'none' }}>
            <h2 style={{color: 'var(--accent-primary)', margin: 0}}>E-Garage</h2>
        </Link>
        <div className="nav-links">
            <Link to="/" className="nav-link">Home</Link>
            <Link to="/about" className="nav-link">About</Link>
            <Link to="/contact" className="nav-link">Contact Us</Link>
            
            {user ? (
                <>
                    {user.role === 'garage_owner' && <Link to="/garage-dashboard" className="nav-link">Dashboard</Link>}
                    {user.role === 'admin' && <Link to="/admin-dashboard" className="nav-link">Admin Panel</Link>}
                    {user.role === 'user' && <Link to="/my-bookings" className="nav-link">Dashboard</Link>}
                    <span style={{color: 'var(--text-secondary)', marginLeft: '1rem'}}>Hi, {user.name}</span>
                    <button onClick={logout} className="btn-secondary" style={{padding: '0.4rem 1rem'}}>Logout</button>
                </>
            ) : (
                <>
                    <Link to="/login" className="nav-link">Login</Link>
                    <Link to="/register" className="btn-primary" style={{textDecoration: 'none'}}>Register</Link>
                </>
            )}

            <button onClick={toggleTheme} className="btn-secondary" style={{padding: '0.4rem', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', marginLeft: '0.5rem'}}>
              {theme === 'dark' ? <Sun size={20} color="var(--accent-primary)" /> : <Moon size={20} color="var(--accent-primary)" />}
            </button>
        </div>
      </nav>
      
      <main className="container animate-fade-in" style={{ marginTop: '2rem' }}>
        <Routes>
          <Route path="/" element={user?.role === 'garage_owner' ? <Navigate to="/garage-dashboard" /> : user?.role === 'admin' ? <Navigate to="/admin-dashboard" /> : <Home />} />
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
          <Route path="/explore" element={<ExploreGarages />} />
          <Route path="/garage/:id" element={<GarageDetails />} />
          <Route path="/garage-dashboard" element={user && user.role === 'garage_owner' ? <GarageDashboard /> : <Navigate to="/" />} />
          <Route path="/admin-dashboard" element={user && user.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />} />
          <Route path="/my-bookings" element={user ? <MyBookings /> : <Navigate to="/" />} />
          <Route path="/book/:garageId" element={user ? <BookingForm /> : <Navigate to="/login" />} />
          <Route path="/payment/success" element={user ? <PaymentSuccess /> : <Navigate to="/login" />} />
          <Route path="/payment/failure" element={user ? <PaymentFailure /> : <Navigate to="/login" />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
