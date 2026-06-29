import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Monitor, Loader2 } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await base44.auth.resetPasswordRequest(email); } catch {}
    setSent(true);
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
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Reset Password</h2>
          <p className="text-gray-500 text-sm mb-6">Enter your email to receive a reset link</p>
          {sent ? (
            <div className="text-center py-4">
              <p className="text-emerald-600 font-medium mb-2">Check your email</p>
              <p className="text-gray-500 text-sm">If an account exists, a reset link has been sent.</p>
              <a href="/login" className="text-blue-600 hover:underline text-sm mt-4 inline-block">Back to login</a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Email</label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Reset Link"}</Button>
              <a href="/login" className="text-sm text-blue-600 hover:underline block text-center">Back to login</a>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}