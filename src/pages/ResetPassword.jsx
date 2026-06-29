import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Monitor, Loader2 } from 'lucide-react';

export default function ResetPassword() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true); setError('');
    try {
      await base44.auth.resetPassword({ resetToken: token, newPassword: password });
      setDone(true);
      setTimeout(() => { window.location.href = '/login'; }, 2000);
    } catch (err) {
      setError(err.message || 'Reset failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#0a0e27] to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center"><Monitor className="w-5 h-5 text-white" /></div>
          <span className="text-white text-xl font-bold">SurePOS</span>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-xl">
          {done ? (
            <div className="text-center py-4">
              <p className="text-emerald-600 font-medium mb-2">Password reset!</p>
              <p className="text-gray-500 text-sm">Redirecting to login...</p>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">New Password</h2>
              <p className="text-gray-500 text-sm mb-6">Enter your new password</p>
              {error && <p className="text-red-600 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Password</label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Confirm Password</label><Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required /></div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset Password"}</Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}