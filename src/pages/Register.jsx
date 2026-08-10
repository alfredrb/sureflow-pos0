import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Monitor, Loader2 } from 'lucide-react';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('register');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true); setError('');
    try {
      await base44.auth.register({ email, password });
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Registration failed');
    }
    setLoading(false);
  };

  const handleOtp = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { access_token } = await base44.auth.verifyOtp({ email, otpCode: otp });
      base44.auth.setToken(access_token);
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Invalid code');
    }
    setLoading(false);
  };

  const resend = async () => {
    try { await base44.auth.resendOtp(email); } catch {}
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#0a0e27] to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center"><Monitor className="w-5 h-5 text-white" /></div>
          <span className="text-white text-xl font-bold">SureFlow POS</span>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-xl">
          {step === 'register' ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Create Account</h2>
              <p className="text-gray-500 text-sm mb-6">Register for management access</p>
              {error && <p className="text-red-600 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
              <form onSubmit={handleRegister} className="space-y-4">
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Email</label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Password</label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Confirm Password</label><Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required /></div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register"}</Button>
              </form>
              <p className="mt-4 text-center text-sm text-gray-500">Already have an account? <a href="/login" className="text-blue-600 hover:underline">Sign in</a></p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Verify Email</h2>
              <p className="text-gray-500 text-sm mb-6">Enter the code sent to {email}</p>
              {error && <p className="text-red-600 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
              <form onSubmit={handleOtp} className="space-y-4">
                <Input value={otp} onChange={e => setOtp(e.target.value)} placeholder="Enter code" className="text-center text-xl tracking-widest" required />
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}</Button>
              </form>
              <button onClick={resend} className="mt-3 text-sm text-blue-600 hover:underline w-full text-center">Resend code</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}