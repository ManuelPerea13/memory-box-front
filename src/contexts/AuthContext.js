import React, { createContext, useState, useContext, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../restclient/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('authToken') || null);
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('userEmail') || '');

  useEffect(() => {
    if (token) {
      try {
        jwtDecode(token);
      } catch {
        setToken(null);
        setUserEmail('');
        localStorage.removeItem('authToken');
        localStorage.removeItem('userEmail');
      }
    }
  }, [token]);

  const login = async (email, password) => {
    try {
      const data = await api.authenticate(email, password);
      if (!data.access) throw new Error('Invalid response');
      setToken(data.access);
      setUserEmail(email);
      localStorage.setItem('authToken', data.access);
      localStorage.setItem('userEmail', email);
      return true;
    } catch (err) {
      console.error('Login failed:', err);
      return false;
    }
  };

  const logout = () => {
    setToken(null);
    setUserEmail('');
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
  };

  return (
    <AuthContext.Provider value={{
      token,
      userEmail,
      isAuthenticated: !!token,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
