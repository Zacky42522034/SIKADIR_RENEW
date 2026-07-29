import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, Camera, ArrowRight, ArrowLeft, Check, Fingerprint, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

const getPasswordStrength = (pass: string) => {
  if (pass.length === 0) return 0;
  let score = 0;
  if (pass.length >= 8) score += 1;
  if (pass.match(/[A-Z]/)) score += 1;
  if (pass.match(/[0-9]/)) score += 1;
  if (pass.match(/[^A-Za-z0-9]/)) score += 1;
  return score;
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  
  // Form State
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Face Sample State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [detectingFace, setDetectingFace] = useState(false);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraActive(true);
      setError(null);
    } catch (err) {
      setError("Tidak dapat mengakses kamera. Pastikan memberikan izin.");
      toast.error("Akses kamera ditolak. Mohon izinkan kamera untuk menggunakan fitur ini.", { id: 'camera-error' });
      setCameraActive(false);
    }
  };

  useEffect(() => {
    if (step !== 2 && stream) {
      stopCamera();
    } else if (step === 2 && !photoUrl && !stream) {
      startCamera();
    }
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Kamera sedang memuat, silakan tunggu 1-2 detik.");
      return;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setPhotoUrl(dataUrl);
    stopCamera();
    
    validateFace(dataUrl);
  };
  
  const validateFace = async (dataUrl: string) => {
    setDetectingFace(true);
    try {
      // Hanya mengecek apakah wajah terdeteksi (tidak mengecek duplikat)
      const backendUrl = import.meta.env.VITE_DEEPFACE_URL || '/api';
      const response = await fetch(`${backendUrl.replace(/\/verify$/, '')}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captured_image_base64: dataUrl
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Gagal mendeteksi wajah di server");
      }
      
      // Jika berhasil, berarti wajah terdeteksi dengan baik
    } catch (err: any) {
      setError(err.message || "Wajah tidak terdeteksi. Silakan coba lagi.");
      setPhotoUrl(null);
      startCamera();
    } finally {
      setDetectingFace(false);
    }
  };

  const retakePhoto = () => {
    setPhotoUrl(null);
    startCamera();
  };

  const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    const match = arr[0].match(/:(.*?);/);
    const mime = match ? match[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const handleSubmit = async () => {
    if (!photoUrl) return;
    setError(null);
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          }
        }
      });

      if (authError) throw authError;
      
      const user = authData.user;
      if (!user) throw new Error("Gagal mendaftarkan user.");

      const fileBlob = dataURLtoBlob(photoUrl);
      const filePath = `${user.id}/face_sample.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('face-samples')
        .upload(filePath, fileBlob, { upsert: true });
        
      if (uploadError) {
        console.error("Failed to upload face photo:", uploadError);
        throw new Error("Gagal mengunggah foto wajah.");
      }

      // Get public URL for the image
      const { data: { publicUrl } } = supabase.storage
        .from('face-samples')
        .getPublicUrl(filePath);

      // Update profile with face image path
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ face_image_path: publicUrl })
        .eq('id', user.id);

      if (profileError) {
        console.error("Failed to update profile:", profileError);
      }
      
      navigate('/login', { state: { message: 'Registrasi berhasil! Silakan masuk.' }});
      
    } catch (err: any) {
      setError(err.message || 'Gagal melakukan registrasi');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      if (!username || !email || !password || !confirmPassword) {
        setError("Semua field harus diisi.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Password tidak cocok.");
        return;
      }
      if (password.length < 8) {
        setError("Password minimal 8 karakter.");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError("Format email tidak valid.");
        return;
      }
    }
    if (step === 2 && !photoUrl) {
      setError("Silakan ambil foto wajah terlebih dahulu.");
      return;
    }
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    setStep(prev => prev - 1);
  };

  const passStrength = getPasswordStrength(password);

  return (
    <div 
      className="min-h-screen text-on-surface font-sans antialiased flex justify-center w-full bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url('/auth-bg.png')` }}
    >
      {/* Background Overlay & Blur */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-0 pointer-events-none"></div>

      <div className="w-full max-w-[600px] bg-surface-container-lowest min-h-screen shadow-2xl relative z-10 flex flex-col border-x border-white/20">
        
        {/* Header */}
        <header className="flex items-center px-5 h-16 w-full bg-surface-container-lowest border-b border-outline-variant/30 sticky top-0 z-50">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-on-surface ml-2">Daftar Akun</h1>
        </header>

        <main className="flex-1 px-5 py-6 flex flex-col gap-4">
          
          {/* Step Indicator */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-widest">
                Langkah {step} dari 3
              </span>
              <span className="text-xs font-semibold text-on-surface-variant">
                {step === 1 ? 'Kredensial' : step === 2 ? 'Foto Wajah' : 'Konfirmasi'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-surface-variant rounded-full overflow-hidden flex">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-300" 
                style={{ width: `${(step / 3) * 100}%` }}
              ></div>
            </div>
          </div>

          {error && (
            <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          {/* Form Container */}
          <div className="flex-1 relative">
            
            {/* Step 1 - Kredensial */}
            {step === 1 && (
              <form className="flex flex-col gap-5 animate-fade-in" onSubmit={(e) => { e.preventDefault(); handleNext(); }} autoComplete="off">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="username" className="text-sm font-semibold text-on-surface">Username</label>
                  <div className="relative">
                    <User className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input id="username" type="text" placeholder="Masukkan username" required value={username} onChange={e=>setUsername(e.target.value)} autoComplete="off" className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-base text-on-surface focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-shadow" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="text-sm font-semibold text-on-surface">Email</label>
                  <div className="relative">
                    <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input id="email" type="email" placeholder="nama@perusahaan.com" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="off" className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-base text-on-surface focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-shadow" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="password" className="text-sm font-semibold text-on-surface">Password</label>
                  <div className="relative">
                    <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input id="password" type={showPassword ? "text" : "password"} placeholder="Minimal 8 karakter" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" className="w-full pl-12 pr-12 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-base text-on-surface focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-shadow" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary focus:outline-none">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  
                  {/* Password Strength Indicator */}
                  <div className="mt-2 flex gap-1 h-1 w-full rounded-full overflow-hidden">
                    {[1, 2, 3, 4].map(s => {
                      let bgColor = 'bg-surface-variant';
                      if (passStrength >= s) {
                        if (passStrength === 1) bgColor = 'bg-error';
                        else if (passStrength === 2) bgColor = 'bg-yellow-500';
                        else bgColor = 'bg-tertiary-container';
                      }
                      return <div key={s} className={`flex-1 transition-colors duration-300 ${bgColor}`}></div>
                    })}
                  </div>
                  <span className="text-xs font-semibold text-on-surface-variant mt-1">
                    Kekuatan password: <span className={
                      passStrength === 0 ? "text-on-surface" :
                      passStrength === 1 ? "text-error" :
                      passStrength === 2 ? "text-yellow-600" :
                      "text-tertiary-container"
                    }>
                      {passStrength === 0 ? "Lemah" : passStrength === 1 ? "Lemah" : passStrength === 2 ? "Sedang" : passStrength === 4 ? "Sangat Kuat" : "Kuat"}
                    </span>
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 mb-6">
                  <label htmlFor="confirm-password" className="text-sm font-semibold text-on-surface">Konfirmasi Password</label>
                  <div className="relative">
                    <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input id="confirm-password" type={showConfirmPassword ? "text" : "password"} placeholder="Ulangi password" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" className="w-full pl-12 pr-12 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-base text-on-surface focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-shadow" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary focus:outline-none">
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-lg shadow-md hover:bg-primary-container transition-colors flex items-center justify-center gap-2">
                  Lanjut
                  <ArrowRight className="w-5 h-5" />
                </button>
                
                <p className="text-center text-sm text-on-surface-variant mt-4">
                  Sudah punya akun? <Link to="/login" className="text-primary font-semibold hover:underline">Masuk di sini</Link>
                </p>
              </form>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div className="flex flex-col h-full animate-fade-in absolute inset-0 w-full bg-background z-20 pb-4">
                <h2 className="text-xl font-bold text-on-surface mt-2 mb-4 text-center">Verifikasi Wajah</h2>
                
                {/* Camera Interface */}
                <div className="flex-1 flex flex-col items-center justify-center relative w-full rounded-2xl overflow-hidden bg-black mb-4 min-h-[350px]">
                  {/* Camera Feed */}
                  {!photoUrl ? (
                    <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 opacity-80" />
                  ) : (
                    <img src={photoUrl} alt="Captured face" className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 opacity-80" />
                  )}
                  
                  {/* Dark Overlay Mask */}
                  <div className="absolute inset-0 pointer-events-none"></div>
                  
                  {/* Focus Circle - Removed masking for full view */}
                  <div className="relative w-full h-full z-10 flex items-center justify-center">
                    {/* Just an empty container to keep layout intact if needed, or we can just remove it */}
                  </div>
                  
                  {/* Feedback Text */}
                  {detectingFace && (
                    <div className="absolute bottom-6 left-0 right-0 text-center z-20 px-4">
                      <div className="inline-flex items-center gap-2 bg-surface/80 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border-t border-white/20">
                        <RefreshCw className="w-4 h-4 text-secondary animate-spin" />
                        <span className="text-xs font-semibold text-on-surface uppercase tracking-widest">Mendeteksi Wajah...</span>
                      </div>
                    </div>
                  )}

                  <canvas ref={canvasRef} className="hidden" />
                </div>
                
                {/* Instructions */}
                <div className="text-center mb-6 z-20">
                  <p className="text-base text-on-surface-variant">Posisikan wajah Anda di dalam lingkaran</p>
                  <p className="text-sm text-outline-variant mt-1">Pastikan pencahayaan cukup</p>
                </div>

                {/* Bottom Action */}
                <div className="w-full flex justify-center pb-4 z-20 gap-4">
                  {!photoUrl ? (
                    <button type="button" onClick={capturePhoto} disabled={!cameraActive} className="relative group w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary p-1 shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100">
                      <div className="w-full h-full rounded-full bg-surface-container-lowest flex items-center justify-center border-4 border-transparent group-hover:bg-surface transition-colors">
                        <Camera className="w-8 h-8 text-primary" />
                      </div>
                      <div className="absolute inset-0 rounded-full border border-secondary/30 pointer-events-none"></div>
                    </button>
                  ) : detectingFace ? (
                    <div className="w-full flex flex-col justify-center items-center py-2 animate-fade-in">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                      <span className="text-sm font-medium text-on-surface-variant">Memverifikasi wajah...</span>
                    </div>
                  ) : (
                    <div className="flex gap-4 w-full animate-fade-slide-up">
                      <button type="button" onClick={retakePhoto} className="flex-1 py-3 px-4 bg-surface-container-high hover:bg-surface-variant text-on-surface rounded-xl font-medium transition-all flex items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5" /> Ulangi
                      </button>
                      <button type="button" onClick={handleNext} className="flex-1 py-3.5 px-4 bg-primary text-white font-bold rounded-xl shadow-md hover:bg-primary-container transition-colors flex items-center justify-center gap-2">
                        Lanjut <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div className="flex flex-col items-center animate-fade-in">
                <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-6 w-full flex flex-col items-center mb-8 shadow-sm">
                  <h3 className="text-on-surface font-semibold mb-6">Ringkasan Profil</h3>
                  
                  <div className="w-28 h-28 rounded-full border-4 border-accent overflow-hidden mb-6 shadow-md">
                    {photoUrl && <img src={photoUrl} alt="Profile" className="w-full h-full object-cover transform -scale-x-100" />}
                  </div>
                  
                  <div className="w-full space-y-4 text-sm">
                    <div className="flex justify-between border-b border-outline-variant/20 pb-3">
                      <span className="text-on-surface-variant">Username</span>
                      <span className="text-on-surface font-semibold">{username}</span>
                    </div>
                    <div className="flex justify-between border-b border-outline-variant/20 pb-3">
                      <span className="text-on-surface-variant">Email</span>
                      <span className="text-on-surface font-semibold">{email}</span>
                    </div>
                    <div className="flex justify-between border-b border-outline-variant/20 pb-3">
                      <span className="text-on-surface-variant">Foto Wajah</span>
                      <span className="text-success font-semibold flex items-center"><Check className="w-4 h-4 mr-1"/> Tersimpan</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 w-full">
                  <button type="button" onClick={handleBack} disabled={loading} className="flex-1 py-3 px-4 bg-surface-container-high hover:bg-surface-variant text-on-surface rounded-xl font-medium transition-all flex items-center justify-center">
                    Kembali
                  </button>
                  
                  <button type="button" onClick={handleSubmit} disabled={loading} className="flex-[2] py-3.5 px-4 bg-primary text-white font-bold rounded-xl shadow-md hover:bg-primary-container transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        Daftar Sekarang
                        <Check className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
            
          </div>
        </main>
      </div>
    </div>
  );
}
