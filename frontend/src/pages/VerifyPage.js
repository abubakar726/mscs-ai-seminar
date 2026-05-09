import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';

export default function VerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    if (!token) {
      setError('Invalid QR Code. No token found.');
      setVerifying(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await api.post('/sessions/verify-qr', { token });
        const { sessionEntryToken, sessionCode } = res.data;
        
        // Save the 5-minute valid entry token to sessionStorage
        sessionStorage.setItem('sessionEntryToken', sessionEntryToken);
        sessionStorage.setItem('scannedSessionCode', sessionCode);
        
        // Redirect to join page where they just enter their name
        navigate('/join');
      } catch (err) {
        console.error('Verify error:', err);
        setError(err.response?.data?.message || 'Failed to verify QR Code.');
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [location, navigate]);

  return (
    <div className="min-h-screen bg-[#07090F] flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-[#0D1220] border border-white/10 rounded-2xl p-8 shadow-2xl">
        {verifying ? (
          <div>
            <div className="w-12 h-12 rounded-full border-4 border-[#00D4FF] border-t-transparent animate-spin mx-auto mb-4" />
            <h2 className="text-white text-xl font-bold">Verifying QR Code...</h2>
            <p className="text-slate-400 text-sm mt-2">Checking physical presence token</p>
          </div>
        ) : error ? (
          <div>
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-red-400 text-xl font-bold mb-2">Verification Failed</h2>
            <p className="text-slate-400 text-sm mb-6">{error}</p>
            <button 
              onClick={() => navigate('/join')}
              className="px-6 py-2 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20 transition"
            >
              Go to Join Page
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
