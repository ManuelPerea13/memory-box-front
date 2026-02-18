import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import MainRouting from './routing/MainRouting';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <MainRouting />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
