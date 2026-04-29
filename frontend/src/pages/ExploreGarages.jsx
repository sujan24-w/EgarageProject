import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function ExploreGarages() {
  const navigate = useNavigate();
  const [exploreGarages, setExploreGarages] = useState([]);
  const [exploreSort, setExploreSort] = useState('desc');
  const [exploreSearch, setExploreSearch] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; // 3 columns x 2 rows

  useEffect(() => {
    fetchExploreGarages(exploreSearch, exploreSort);
  }, [exploreSearch, exploreSort]);

  const fetchExploreGarages = async (name, sort) => {
    try {
      const qs = new URLSearchParams();
      if (name) qs.append('name', name);
      if (sort) qs.append('sortByRating', sort);
      const res = await api.get(`/garages/search?${qs.toString()}`);
      setExploreGarages(res.data);
      setCurrentPage(1); // reset to page 1 on new search
    } catch(err) {
      console.error(err);
    }
  };

  // Pagination Logic
  const totalPages = Math.ceil(exploreGarages.length / itemsPerPage);
  const currentGarages = exploreGarages.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="animate-fade-in" style={{ padding: '2rem 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 800 }}>
          Explore <span style={{color: 'var(--accent-primary)'}}>Our Network</span>
        </h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
          Browse top-rated 2-wheeler mechanics, sort by rating, and find the perfect match for your needs.
        </p>
      </div>

      {/* Global Manual Search Bar & Sort */}
      <form onSubmit={e => e.preventDefault()} style={{ display: 'flex', maxWidth: '800px', margin: '0 auto 2.5rem auto', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
            <Search size={20} color="var(--text-secondary)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input type="text" className="input-field" placeholder="Explore garages by name..." style={{ paddingLeft: '3rem', margin: 0, height: '100%' }} value={exploreSearch} onChange={e => setExploreSearch(e.target.value)} />
        </div>
        <select className="input-field" style={{ flex: '0 0 200px', margin: 0 }} value={exploreSort} onChange={e => setExploreSort(e.target.value)}>
            <option value="desc">Rating (High to Low)</option>
            <option value="asc">Rating (Low to High)</option>
        </select>
      </form>

      {/* RENDER EXPLORE RESULTS  */}
      {exploreGarages.length > 0 ? (
        <div style={{ marginBottom: '4rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {currentGarages.map(g => (
              <div key={g._id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{color: 'var(--text-primary)', marginBottom: '0.5rem'}}>{g.name}</h3>
                  <p style={{color: '#fbbf24', fontWeight: 'bold', marginBottom: '0.5rem'}}>
                    {g.rating > 0 ? `⭐ ${g.rating} (${g.totalReviews || 0})` : '⭐ New Garage'}
                  </p>
                  <p style={{color: 'var(--text-secondary)', marginBottom: '0.5rem'}}>{g.location?.address}</p>
                  <p style={{marginBottom: '1rem', flex: 1}}>Phone: {g.phone}</p>
                  <button className="btn-primary" style={{width: '100%'}} onClick={() => navigate(`/garage/${g._id}`)}>View Garage Profile</button>
              </div>
            ))}
          </div>
          
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
              <button 
                className="btn-secondary" 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <ChevronLeft size={20} /> Prev
              </button>
              <span style={{ color: 'var(--text-secondary)' }}>Page {currentPage} of {totalPages}</span>
              <button 
                className="btn-secondary" 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                Next <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      ) : (
          <div style={{textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '4rem'}}>
             No garages found matching your criteria.
          </div>
      )}
    </div>
  );
}
