import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/ui/Modal';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  // Forgot Password State
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }
      
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }
      
      // Navigation will be handled by AuthLayout detecting the logged-in user
    } catch (err: any) {
      setError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error('Silakan masukkan email Anda');
      return;
    }
    
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        // Redirection URL after user clicks the link in their email
        redirectTo: `${window.location.origin}/login`, 
      });
      
      if (error) throw error;
      
      toast.success('Tautan reset kata sandi telah dikirim ke email Anda!');
      setIsForgotModalOpen(false);
      setForgotEmail('');
    } catch (err: any) {
      toast.error('Gagal mengirim tautan: ' + err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-5 font-sans text-base text-on-surface antialiased overflow-hidden relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('/auth-bg.png')` }}
    >
      {/* Background Overlay & Blur */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-0 pointer-events-none"></div>
      
      {/* Login Card Container */}
      <div className="relative z-10 w-full max-w-md animate-fade-slide-up">
        {/* Main Card */}
        <div className="bg-surface rounded-2xl shadow-[0_4px_40px_rgba(0,31,111,0.15)] glass-card-top-border overflow-hidden">
          <div className="p-8 sm:p-10 flex flex-col items-center">
            
            {/* Logo & Branding */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 flex items-center justify-center mb-4 mx-auto">
                <img src="/pwa-192x192.png" alt="SIKADIR Logo" className="w-full h-full object-contain drop-shadow-md" />
              </div>
              <h1 className="text-3xl font-bold text-primary text-center tracking-tight">SIKADIR</h1>
              <p className="text-sm text-on-surface-variant text-center mt-1">Effortless Accountability</p>
            </div>

            {error && (
              <div className="w-full bg-error-container text-on-error-container px-4 py-3 rounded-lg mb-6 text-sm text-center">
                {error}
              </div>
            )}

            {/* Form */}
            <form className="w-full flex flex-col gap-4" onSubmit={handleLogin} autoComplete="off">
              {/* Email Input */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-outline-variant group-focus-within:text-secondary transition-colors" />
                </div>
                <input 
                  type="email" 
                  id="email" 
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address or Username" 
                  autoComplete="off"
                  required 
                  className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary focus:border-secondary transition-all placeholder:text-outline-variant"
                />
              </div>

              {/* Password Input */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-outline-variant group-focus-within:text-secondary transition-colors" />
                </div>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  id="password" 
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password" 
                  autoComplete="new-password"
                  required 
                  className="w-full pl-12 pr-12 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary focus:border-secondary transition-all placeholder:text-outline-variant"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-outline-variant hover:text-on-surface transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Action Row */}
              <div className="flex items-center justify-between mt-1 mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary bg-surface-container-lowest cursor-pointer" 
                  />
                  <span className="text-xs font-semibold text-on-surface-variant">Ingat Saya</span>
                </label>
                <button 
                  type="button" 
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-xs font-semibold text-primary hover:text-secondary transition-colors"
                >
                  Lupa Kata Sandi?
                </button>
              </div>

              {/* Primary Action Button */}
              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3.5 px-4 bg-primary text-white font-bold text-lg rounded-xl shadow-md hover:bg-primary-container transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Masuk</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

          </div>
          
          {/* Footer Action */}
          <div className="bg-surface-container-low px-8 py-5 text-center border-t border-outline-variant/30">
            <p className="text-sm text-on-surface-variant">
              Belum punya akun?{' '}
              <Link to="/register" className="text-primary hover:text-secondary transition-colors ml-1 font-semibold">Daftar</Link>
            </p>
          </div>
        </div>
      </div>
      
      {/* Forgot Password Modal */}
      <Modal 
        isOpen={isForgotModalOpen} 
        onClose={() => setIsForgotModalOpen(false)} 
        title="Lupa Kata Sandi"
      >
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <p className="text-sm text-on-surface-variant mb-4">
            Masukkan alamat email yang terdaftar. Kami akan mengirimkan tautan untuk mengatur ulang kata sandi Anda.
          </p>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="w-4 h-4 text-outline-variant" />
              </div>
              <input 
                type="email" 
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full p-3 pl-10 rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-white text-sm" 
                placeholder="email@anda.com"
                required
              />
            </div>
          </div>
          
          <button 
            type="submit"
            disabled={forgotLoading}
            className="w-full py-3.5 mt-4 bg-primary text-white rounded-xl font-bold shadow-md hover:bg-primary-container transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {forgotLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Kirim Tautan Reset'
            )}
          </button>
        </form>
      </Modal>
    </div>
  );
}
