import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../utils/api';
import { Search, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';

export default function AdminDashboard() {
  const [tab, setTab] = useState('garages'); // garages, users
  
  // Data State
  const [garages, setGarages] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [garageFilter, setGarageFilter] = useState('all'); // all, verified, pending
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  
  // Modals for Edit
  const [editingUser, setEditingUser] = useState(null);
  const [editingGarage, setEditingGarage] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resGarages, resUsers] = await Promise.all([
        api.get('/admin/garages'),
        api.get('/admin/users')
      ]);
      setGarages(resGarages.data);
      setUsers(resUsers.data);
    } catch(err) {
      console.error("Admin fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // GARAGES CRUD
  const handleVerifyToggle = async (id) => {
    try {
      await api.put(`/admin/garages/${id}/verify`);
      fetchData();
    } catch(err) {
      alert("Verification toggle failed");
    }
  };

  const handleUpdateGarage = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/admin/garages/${editingGarage._id}`, {
        name: editingGarage.name,
        phone: editingGarage.phone,
      });
      alert("Garage Metadata Updated");
      setEditingGarage(null);
      fetchData();
    } catch(err) { alert("Failed to update garage"); }
  };

  const handleDeleteGarage = async (id) => {
    if(!window.confirm("CRITICAL WARNING: Are you sure you want to permanently obliterate this garage profile?")) return;
    try {
      await api.delete(`/admin/garages/${id}`);
      fetchData();
    } catch(err) { alert("Failed to delete garage"); }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/admin/users/${editingUser._id}`, {
        name: editingUser.name,
        email: editingUser.email,
        phone: editingUser.phone,
        role: editingUser.role,
        isActive: editingUser.isActive
      });
      alert("User Privileges and Metadata Saved");
      setEditingUser(null);
      fetchData();
    } catch(err) { alert("Failed to update user"); }
  }

  const handleDeleteUser = async (id) => {
    if(!window.confirm("CRITICAL WARNING: Deleting a user bypasses suspension. Irreversible! Proceed?")) return;
    try {
      await api.delete(`/admin/users/${id}`);
      fetchData();
    } catch(err) { alert("Failed to delete user"); }
  }


  // Filtered Lists
  const filteredGarages = garages.filter(g => {
    if (garageFilter === 'verified') return g.isVerified;
    if (garageFilter === 'pending') return !g.isVerified;
    return true; 
  });

  const filteredUsers = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchSearch && matchRole;
  });

  if (loading) return <div>Loading Global Control Panel...</div>;

  return (
    <div className="animate-fade-in" style={{position: 'relative'}}>
      <h2 style={{color: 'var(--accent-primary)', marginBottom: '1.5rem'}}>Platform Admin CMS</h2>

      <div style={{display: 'flex', gap: '1rem', marginBottom: '1.5rem'}}>
        <button className={tab === 'garages' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('garages')}>Business Network</button>
        <button className={tab === 'users' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('users')}>Application Users</button>
      </div>

      <div className="glass-panel" style={{padding: '1.5rem'}}>
        
        {/* GARAGE VIEW */}
        {tab === 'garages' && (
          <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem'}}>
              <h3>Garages Directory</h3>
              <select className="input-field" style={{width: '200px', margin: 0}} value={garageFilter} onChange={e => setGarageFilter(e.target.value)}>
                <option value="all">Total Network</option>
                <option value="pending">Needs Approval</option>
                <option value="verified">Verified Hubs</option>
              </select>
            </div>

            {/* Garage Edit Modal */}
            {editingGarage && createPortal(
              <div className="modal-overlay" onClick={() => setEditingGarage(null)}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                  <button className="modal-close-btn" onClick={() => setEditingGarage(null)}><XCircle size={24}/></button>
                  <div style={{marginBottom: '2rem'}}>
                    <h3 style={{fontSize: '1.5rem', color: 'var(--text-primary)'}}>Edit Garage Profile</h3>
                    <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem'}}>Update primary contact details</p>
                  </div>
                  
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await api.put(`/admin/garages/${editingGarage._id}`, {
                        name: editingGarage.name,
                        phone: editingGarage.phone,
                        isVerified: editingGarage.isVerified,
                        location: editingGarage.location
                      });
                      alert("Garage Record Fully Updated");
                      setEditingGarage(null);
                      fetchData();
                    } catch(err) { alert("Failed to update garage"); }
                  }}>
                    <div className="input-group">
                      <label className="input-label" style={{fontSize: '0.85rem', fontWeight: 600}}>Business Name <span style={{color: 'red'}}>*</span></label>
                      <input className="input-field" style={{background: 'var(--bg-secondary)'}} value={editingGarage.name} onChange={e => setEditingGarage({...editingGarage, name: e.target.value})} required/>
                    </div>
                    <div className="input-group">
                      <label className="input-label" style={{fontSize: '0.85rem', fontWeight: 600}}>Contact Phone <span style={{color: 'red'}}>*</span></label>
                      <input className="input-field" style={{background: 'var(--bg-secondary)'}} value={editingGarage.phone} onChange={e => setEditingGarage({...editingGarage, phone: e.target.value})} required/>
                    </div>
                    <div className="input-group">
                      <label className="input-label" style={{fontSize: '0.85rem', fontWeight: 600}}>Address Area <span style={{color: 'red'}}>*</span></label>
                      <input className="input-field" style={{background: 'var(--bg-secondary)'}} value={editingGarage.location?.address || ''} onChange={e => setEditingGarage({...editingGarage, location: {...editingGarage.location, address: e.target.value}})} required/>
                    </div>
                    <div style={{display: 'flex', gap: '1rem', marginBottom: '1rem'}}>
                      <div className="input-group" style={{flex: 1}}>
                         <label className="input-label" style={{fontSize: '0.85rem', fontWeight: 600}}>Map Longitude <span style={{color: 'red'}}>*</span></label>
                         <input type="number" step="any" className="input-field" style={{background: 'var(--bg-secondary)'}} value={editingGarage.location?.coordinates?.[0] || 0} onChange={e => setEditingGarage({...editingGarage, location: {...editingGarage.location, coordinates: [parseFloat(e.target.value), editingGarage.location.coordinates[1]]}})} required/>
                      </div>
                      <div className="input-group" style={{flex: 1}}>
                         <label className="input-label" style={{fontSize: '0.85rem', fontWeight: 600}}>Map Latitude <span style={{color: 'red'}}>*</span></label>
                         <input type="number" step="any" className="input-field" style={{background: 'var(--bg-secondary)'}} value={editingGarage.location?.coordinates?.[1] || 0} onChange={e => setEditingGarage({...editingGarage, location: {...editingGarage.location, coordinates: [editingGarage.location.coordinates[0], parseFloat(e.target.value)]}})} required/>
                      </div>
                    </div>
                    <div className="input-group">
                      <label className="input-label" style={{fontSize: '0.85rem', fontWeight: 600}}>Verification Compliance</label>
                      <select className="input-field" style={{background: 'var(--bg-secondary)', color: editingGarage.isVerified ? 'var(--success-color)' : 'var(--error-color)'}} value={editingGarage.isVerified} onChange={e => setEditingGarage({...editingGarage, isVerified: e.target.value === 'true'})}>
                        <option value="true">Verified Operations ✅</option>
                        <option value="false">Unverified ⚠️</option>
                      </select>
                    </div>
                    <div style={{display: 'flex', gap: '1rem', marginTop: '2rem'}}>
                      <button type="submit" className="btn-primary" style={{flex: 1}}>Save Full Changes</button>
                    </div>
                  </form>
                </div>
              </div>,
              document.body
            )}

            {filteredGarages.length === 0 ? <p style={{color: 'var(--text-secondary)'}}>No garages match this filter criteria.</p> : (
              <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                {filteredGarages.map(g => (
                  <div key={g._id} style={{border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: '12px', background: 'var(--bg-secondary)', display: 'flex', flexWrap: 'wrap', gap: '2rem'}}>
                    <div style={{flex: 1, minWidth: '280px'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                        <strong style={{fontSize: '1.4rem', color: 'var(--accent-primary)'}}>{g.name}</strong>
                        {g.isVerified 
                          ? <span style={{backgroundColor: 'var(--success-color)', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold'}}>Verified ✅</span>
                          : <span style={{backgroundColor: 'var(--error-color)', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold'}}>Unverified ⚠️</span>
                        }
                      </div>
                      <div style={{marginTop: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6'}}>
                        <p><strong style={{color: 'var(--text-primary)'}}>Owner ID Name:</strong> {g.ownerId?.name || 'Deleted User'}</p>
                        <p><strong style={{color: 'var(--text-primary)'}}>Contact Mail:</strong> {g.ownerId?.email || 'N/A'}</p>
                        <p><strong style={{color: 'var(--text-primary)'}}>Garage Business Phone:</strong> {g.phone}</p>
                        <p><strong style={{color: 'var(--text-primary)'}}>Listed Area:</strong> {g.location?.address || 'GPS Only'}</p>
                        <p style={{marginTop: '0.5rem', background: 'var(--bg-primary)', padding: '0.5rem', borderRadius: '4px', borderLeft: '4px solid var(--accent-primary)'}}>
                          <strong style={{color: 'var(--text-primary)'}}>Fleet Strength:</strong> {g.stats?.totalMechanics || 0} Total ({g.stats?.availableMechanics || 0} Available)
                        </p>
                      </div>
                      <div style={{marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
                         <button className={g.isVerified ? "btn-secondary" : "btn-primary"} onClick={() => handleVerifyToggle(g._id)} style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                           {g.isVerified ? <><XCircle size={16}/> Revoke Status</> : <><CheckCircle size={16}/> Approve Operations</>}
                         </button>
                         <button className="btn-secondary" onClick={() => setEditingGarage(g)} style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                           <Edit size={16}/> Edit Mode
                         </button>
                         <button className="btn-secondary" style={{color: 'var(--error-color)', borderColor: 'var(--error-color)'}} onClick={() => handleDeleteGarage(g._id)}>
                           <Trash2 size={16}/> Delete
                         </button>
                      </div>
                    </div>

                    <div style={{flex: 1, minWidth: '280px'}}>
                      <strong style={{color: 'white', display: 'block', paddingBottom: '0.5rem', borderBottom: '1px solid var(--glass-border)'}}>Official Documents & Media</strong>
                      
                      <div style={{marginTop: '1rem'}}>
                        <p style={{fontSize: '0.9rem', color: 'var(--text-secondary)'}}>Legal Verification Docs:</p>
                        {g.documents && g.documents.length > 0 ? (
                          <div style={{display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginTop: '0.5rem'}}>
                            {g.documents.map((doc, i) => (
                              <a key={i} href={doc} target="_blank" rel="noreferrer" style={{display: 'block', overflow: 'hidden', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)'}}>
                                {doc.endsWith('.pdf') ? (
                                  <div style={{padding: '1rem', color: 'var(--accent-primary)', textAlign: 'center'}}>PDF FILE</div>
                                ) : (
                                  <img src={doc} alt="document" style={{height: '100px', width: '100px', objectFit: 'cover'}} />
                                )}
                              </a>
                            ))}
                          </div>
                        ) : <span style={{fontSize: '0.8rem', color: 'var(--error-color)'}}>Non-compliant: Missing Documents</span>}
                      </div>

                      <div style={{marginTop: '1.5rem'}}>
                        <p style={{fontSize: '0.9rem', color: 'var(--text-secondary)'}}>Premise Photos:</p>
                        {g.images && g.images.length > 0 ? (
                           <div style={{display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginTop: '0.5rem'}}>
                            {g.images.map((img, i) => (
                              <a key={i} href={img} target="_blank" rel="noreferrer" style={{display: 'block', overflow: 'hidden', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
                                <img src={img} alt="garage view" style={{height: '100px', width: '100px', objectFit: 'cover'}} />
                              </a>
                            ))}
                          </div>
                        ) : <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>No structural photos uploaded yet</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* USER VIEW */}
        {tab === 'users' && (
          <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem'}}>
              <h3>Consumer & Fleet Roster</h3>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '1rem'}}>
                <select className="input-field" style={{margin: 0, width: '150px'}} value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)}>
                  <option value="all">Every Role</option>
                  <option value="admin">Admins</option>
                  <option value="garage_owner">Garage Owners</option>
                  <option value="user">Standard Users</option>
                </select>
                <div style={{display: 'flex', alignItems: 'center', background: 'var(--glass-bg)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
                  <Search size={18} color="var(--text-secondary)" style={{marginRight: '0.5rem'}} />
                  <input 
                    type="text" 
                    placeholder="Search query..." 
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    style={{background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '200px'}}
                  />
                </div>
              </div>
            </div>
            
            {/* User Edit Modal */}
            {editingUser && createPortal(
              <div className="modal-overlay" onClick={() => setEditingUser(null)}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                  <button className="modal-close-btn" onClick={() => setEditingUser(null)}><XCircle size={24}/></button>
                  <div style={{marginBottom: '2rem'}}>
                    <h3 style={{fontSize: '1.5rem', color: 'var(--text-primary)'}}>Edit User Privilege</h3>
                    <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem'}}>Manage access rights and suspension</p>
                  </div>

                  <form onSubmit={handleUpdateUser}>
                    <div className="input-group">
                      <label className="input-label" style={{fontSize: '0.85rem', fontWeight: 600}}>User Name</label>
                      <input className="input-field" style={{background: 'var(--bg-secondary)'}} value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
                    </div>
                    <div className="input-group">
                      <label className="input-label" style={{fontSize: '0.85rem', fontWeight: 600}}>Access Role</label>
                      <select className="input-field" style={{background: 'var(--bg-secondary)'}} value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})}>
                        <option value="user">Application User</option>
                        <option value="garage_owner">Garage Owner</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="input-group">
                      <label className="input-label" style={{fontSize: '0.85rem', fontWeight: 600}}>Contact Phone (Optional)</label>
                      <input className="input-field" style={{background: 'var(--bg-secondary)'}} value={editingUser.phone || ''} onChange={e => setEditingUser({...editingUser, phone: e.target.value})} />
                    </div>
                    <div className="input-group">
                      <label className="input-label" style={{fontSize: '0.85rem', fontWeight: 600}}>Email Authority <span style={{color: 'red'}}>*</span></label>
                      <input type="email" className="input-field" style={{background: 'var(--bg-secondary)'}} value={editingUser.email} onChange={e => setEditingUser({...editingUser, email: e.target.value})} required/>
                    </div>
                    <div className="input-group">
                      <label className="input-label" style={{fontSize: '0.85rem', fontWeight: 600}}>Account Status</label>
                      <select className="input-field" style={{background: 'var(--bg-secondary)', color: editingUser.isActive ? 'var(--success-color)' : 'var(--error-color)'}} value={editingUser.isActive} onChange={e => setEditingUser({...editingUser, isActive: e.target.value === 'true'})}>
                        <option value="true">Active 🟢</option>
                        <option value="false">Suspended 🔴</option>
                      </select>
                    </div>
                    <div style={{display: 'flex', gap: '1rem', marginTop: '2rem'}}>
                      <button type="submit" className="btn-primary" style={{flex: 1}}>Commit Full Changes</button>
                    </div>
                  </form>
                </div>
              </div>,
              document.body
            )}

            <div style={{overflowX: 'auto', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
              <table style={{width: '100%', textAlign: 'left', borderCollapse: 'collapse'}}>
                <thead>
                  <tr style={{borderBottom: '1px solid var(--border-color)', background: 'var(--glass-border)'}}>
                    <th style={{padding: '1rem', color: 'var(--text-secondary)'}}>Client Name</th>
                    <th style={{padding: '1rem', color: 'var(--text-secondary)'}}>Email Auth</th>
                    <th style={{padding: '1rem', color: 'var(--text-secondary)'}}>Privilege</th>
                    <th style={{padding: '1rem', color: 'var(--text-secondary)'}}>Status</th>
                    <th style={{padding: '1rem', color: 'var(--text-secondary)', textAlign: 'center'}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u._id} style={{borderBottom: '1px solid var(--border-color)'}}>
                      <td style={{padding: '1rem', fontWeight: 'bold'}}>{u.name}</td>
                      <td style={{padding: '1rem'}}>{u.email}</td>
                      <td style={{padding: '1rem'}}>
                        <span style={{
                          padding: '0.3rem 0.6rem', 
                          borderRadius: '8px', 
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          background: u.role === 'admin' ? 'var(--accent-glow)' : u.role === 'garage_owner' ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-tertiary)',
                          color: u.role === 'admin' ? 'var(--accent-primary)' : u.role === 'garage_owner' ? '#60a5fa' : 'var(--text-primary)'
                        }}>{u.role.toUpperCase()}</span>
                      </td>
                      <td style={{padding: '1rem'}}>
                        {u.isActive ? <span style={{color: 'var(--success-color)', fontWeight: 'bold'}}>🟢 ONLINE</span> : <span style={{color: 'var(--error-color)', fontWeight: 'bold'}}>🔴 SUSPENDED</span>}
                      </td>
                      <td style={{padding: '1rem', textAlign: 'center'}}>
                        <div style={{display: 'flex', justifyContent: 'center', gap: '0.5rem'}}>
                          <button className="btn-secondary" style={{padding: '0.4rem'}} onClick={() => setEditingUser(u)} title="Edit Privileges"><Edit size={16}/></button>
                          <button className="btn-secondary" style={{padding: '0.4rem', color: 'var(--error-color)', borderColor: 'var(--error-color)'}} onClick={() => handleDeleteUser(u._id)} title="Delete User"><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan="5" style={{padding: '2rem', textAlign: 'center'}}>No users found matching query.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
