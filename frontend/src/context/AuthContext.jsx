import { createContext, useState, useEffect } from "react";
import axios from "axios";

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const token = localStorage.getItem("token");
      const mechanicData = localStorage.getItem("mechanicData");

      if (token) {
        try {
          const res = await axios.get(`${apiUrl}/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser({ ...res.data, token });
        } catch (err) {
          console.error("Token invalid", err);
          localStorage.removeItem("token");
        }
      } else if (mechanicData) {
        setUser(JSON.parse(mechanicData));
      }
      setLoading(false);
    };
    checkUser();
  }, []);

  const login = (userData) => {
    if (userData.token) {
      localStorage.setItem("token", userData.token);
    } else if (userData.role === 'mechanic') {
      localStorage.setItem("mechanicData", JSON.stringify(userData));
    }
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("mechanicData");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
        {children}
    </AuthContext.Provider>
  )
}
