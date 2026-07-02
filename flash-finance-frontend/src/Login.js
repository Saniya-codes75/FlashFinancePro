import React, { useState } from 'react';
import axios from 'axios';

function Login({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false); // Toggle between Login and Signup view
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    // Validation Check
    if (!username || !password) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    // Determine target URL based on state
    const endpoint = isRegister 
      ? 'http://127.0.0.1:8000/api/expenses/auth/register/' 
      : 'http://127.0.0.1:8000/api/expenses/auth/login/';

    const payload = isRegister 
      ? { username, password, email } 
      : { username, password };

    try {
      const response = await axios.post(endpoint, payload);
      
      // DEBUG: View exactly what the server returns in the browser console
      console.log("Django Auth Response Object:", response.data);

      // Extract token across both Simple JWT ('access') and custom register ('token') variants
      const token = response.data?.access || response.data?.token;
      const loggedInUser = response.data?.username || username;

      if (token) {
        console.log("Token validated successfully! Saving session...");
        
        // Save auth state into the browser's persistent LocalStorage
        localStorage.setItem('token', token);
        localStorage.setItem('username', loggedInUser);
        
        // Trigger App.js view update mapping
        onLoginSuccess();
      } else {
        console.warn("Auth passed but token attribute structure was missing:", response.data);
        setErrorMsg("Authentication token not found in server payload mapping.");
      }
    } catch (error) {
      console.error("Authentication error network log:", error);
      setErrorMsg(
        error.response?.data?.detail || 
        error.response?.data?.message || 
        "Authentication failed! Please check your credentials."
      );
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <h2>{isRegister ? "Create Account" : "Welcome Back"}</h2>
        <p style={{ opacity: 0.7, fontSize: '14px' }}>
          {isRegister ? "Join FlashFinance Pro today" : "Sign in to track your expenses"}
        </p>

        {/* Error Notification Alert */}
        {errorMsg && (
          <div style={{ color: '#ff4b4b', background: 'rgba(255, 75, 75, 0.1)', padding: '10px', borderRadius: '8px', margin: '15px 0', fontSize: '14px' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Form Processing */}
        <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
          <input 
            type="text" 
            placeholder="Username" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ boxSizing: 'border-box' }}
          />

          {isRegister && (
            <input 
              type="email" 
              placeholder="Email (Optional)" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ boxSizing: 'border-box' }}
            />
          )}

          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ boxSizing: 'border-box' }}
          />

          <button type="submit" className="btn" style={{ width: '100%', marginTop: '10px' }}>
            {isRegister ? "Sign Up" : "Log In"}
          </button>
        </form>

        {/* UI State Toggle Anchor */}
        <p style={{ marginTop: '20px', fontSize: '14px', opacity: 0.8 }}>
          {isRegister ? "Already have an account?" : "Don't have an account?"}{' '}
          <span 
            onClick={() => { setIsRegister(!isRegister); setErrorMsg(""); }} 
            style={{ color: '#00f2fe', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
          >
            {isRegister ? "Log In here" : "Sign Up here"}
          </span>
        </p>
      </div>
    </div>
  );
}

export default Login;