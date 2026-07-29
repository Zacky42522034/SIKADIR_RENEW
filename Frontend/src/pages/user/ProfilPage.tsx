import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Lock, 
  Info, 
  LogOut, 
  ChevronRight,
  ShieldCheck,
  Mail,
  Briefcase,
  Calendar,
  Camera,
  X
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { Modal } from '../../components/ui/Modal';

export default function ProfilPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  
  // Modals state
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  
  // Edit Profile Form State
  const [editName, setEditName] = useState('');
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Change Password Form State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const username = user?.username || user?.email?.split('@')[0] || 'Pengguna';
  const avatarUrl = user?.avatar_url || null;
  const initialLetter = user?.username ? user.username.charAt(0).toUpperCase() : (user?.email?.charAt(0).toUpperCase() || '?');

  const recoveryToastShown = useRef(false);

  useEffect(() => {
    // If the user just clicked a password reset link, they are redirected here
    if (localStorage.getItem('is_password_recovery') === 'true') {
      setIsChangePasswordOpen(true);
      // Remove it from here so Strict Mode double-mount doesn't destroy it immediately.
      // We'll clear it when the modal is closed.
      if (!recoveryToastShown.current) {
        setTimeout(() => toast.success('Silakan masukkan kata sandi baru Anda'), 100);
        recoveryToastShown.current = true;
      }
    }
  }, []);

  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSigningOut(false);
    }
  };

  // -----------------------------------------
  // EDIT PROFILE LOGIC
  // -----------------------------------------
  const openEditProfile = () => {
    setEditName(username);
    setEditAvatarFile(null);
    setEditAvatarPreview(avatarUrl);
    setIsEditProfileOpen(true);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEditAvatarFile(file);
      setEditAvatarPreview(URL.createObjectURL(file));
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      toast.error('Nama tidak boleh kosong');
      return;
    }
    
    setIsSavingProfile(true);
    try {
      let finalAvatarUrl = avatarUrl;
      
      if (editAvatarFile) {
        const filePath = `${user?.id}/avatar_${Date.now()}.jpg`;
        const bucket = 'avatars';
        const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, editAvatarFile, { upsert: true });
        
        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
        finalAvatarUrl = publicUrlData.publicUrl;
      }
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username: editName,
          avatar_url: finalAvatarUrl
        })
        .eq('id', user?.id);
      
      if (updateError) throw updateError;
      
      // Also update auth metadata for completeness
      await supabase.auth.updateUser({
        data: {
          username: editName,
          avatar_url: finalAvatarUrl
        }
      });
      
      toast.success('Profil berhasil diperbarui!');
      setIsEditProfileOpen(false);
      // Optional: reload window to reflect changes globally if state doesn't auto-update
      window.location.reload(); 
    } catch (error: any) {
      toast.error('Gagal memperbarui profil: ' + error.message);
    } finally {
      setIsSavingProfile(true);
    }
  };

  // -----------------------------------------
  // CHANGE PASSWORD LOGIC
  // -----------------------------------------
  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Kata sandi minimal 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Kata sandi tidak cocok');
      return;
    }
    
    setIsSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      
      toast.success('Kata sandi berhasil diubah!');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangePasswordOpen(false);
      localStorage.removeItem('is_password_recovery');
    } catch (error: any) {
      toast.error('Gagal mengubah sandi: ' + error.message);
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface w-full max-w-[600px] lg:max-w-none mx-auto pb-4">
      {/* Profile Header */}
      <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-500 mb-8 mt-4">
        <div className="relative mb-4">
          {avatarUrl ? (
            <div className="w-24 h-24 rounded-full overflow-hidden shadow-lg border-4 border-white">
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-24 h-24 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center text-white shadow-lg border-4 border-white">
              <span className="text-4xl font-bold font-jakarta">{initialLetter}</span>
            </div>
          )}
          <div className="absolute bottom-0 right-0 bg-success p-1.5 rounded-full border-2 border-white text-white">
            <ShieldCheck size={14} />
          </div>
        </div>
        <h1 className="text-xl font-bold text-on-surface font-jakarta">{username}</h1>
        <p className="text-sm text-on-surface-variant font-medium">
          {user?.role === 'admin' ? 'Administrator' : 'Karyawan'}
        </p>
      </div>

      {user?.role === 'admin' && (
        <div className="mx-1 mb-6">
          <button 
            onClick={() => navigate('/admin')}
            className="w-full bg-primary text-white font-bold py-3.5 px-4 rounded-xl shadow-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <ShieldCheck size={20} />
            Masuk ke Portal Admin
          </button>
        </div>
      )}

      {/* Account Info Card */}
      <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,31,111,0.04)] border border-outline-variant/10 mb-6 mx-1 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
        <h2 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-4 px-2">Informasi Akun</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="p-2 bg-surface-container-low text-on-surface-variant rounded-lg shrink-0">
              <Mail size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-on-surface-variant">Email</p>
              <p className="text-sm font-medium text-on-surface truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-2">
            <div className="p-2 bg-surface-container-low text-on-surface-variant rounded-lg shrink-0">
              <Calendar size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-on-surface-variant">Terdaftar Sejak</p>
              <p className="text-sm font-medium text-on-surface">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Section */}
      <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,31,111,0.04)] border border-outline-variant/10 overflow-hidden mb-6 mx-1 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
        <button 
          onClick={openEditProfile}
          className="w-full flex items-center justify-between p-4 hover:bg-surface-container-low transition-colors border-b border-outline-variant/10"
        >
          <div className="flex items-center gap-3 text-on-surface">
            <div className="text-primary"><User size={20} /></div>
            <span className="font-medium text-sm">Edit Profil</span>
          </div>
          <ChevronRight size={18} className="text-outline-variant" />
        </button>
        
        <button 
          onClick={() => setIsChangePasswordOpen(true)}
          className="w-full flex items-center justify-between p-4 hover:bg-surface-container-low transition-colors border-b border-outline-variant/10"
        >
          <div className="flex items-center gap-3 text-on-surface">
            <div className="text-primary"><Lock size={20} /></div>
            <span className="font-medium text-sm">Ubah Kata Sandi</span>
          </div>
          <ChevronRight size={18} className="text-outline-variant" />
        </button>
        
        <button 
          onClick={() => setIsAboutOpen(true)}
          className="w-full flex items-center justify-between p-4 hover:bg-surface-container-low transition-colors"
        >
          <div className="flex items-center gap-3 text-on-surface">
            <div className="text-primary"><Info size={20} /></div>
            <span className="font-medium text-sm">Tentang Aplikasi</span>
          </div>
          <ChevronRight size={18} className="text-outline-variant" />
        </button>
      </div>

      <button 
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="mx-1 bg-white text-danger font-bold py-3.5 px-4 rounded-xl shadow-sm border border-danger/20 hover:bg-danger/5 transition-colors flex items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 disabled:opacity-50"
      >
        {isSigningOut ? (
          <div className="w-5 h-5 border-2 border-danger/30 border-t-danger rounded-full animate-spin" />
        ) : (
          <LogOut size={20} />
        )}
        {isSigningOut ? 'Keluar...' : 'Keluar Akun'}
      </button>

      <p className="text-center text-xs text-outline-variant mt-8 mb-4">
        SIKADIR App v1.0.0 &copy; 2026
      </p>

      {/* ----------------------------------------- */}
      {/* MODALS */}
      {/* ----------------------------------------- */}
      
      {/* Edit Profile Modal */}
      <Modal 
        isOpen={isEditProfileOpen} 
        onClose={() => setIsEditProfileOpen(false)} 
        title="Edit Profil"
      >
        <form onSubmit={saveProfile} className="space-y-4" autoComplete="off">
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="relative">
              {editAvatarPreview ? (
                <div className="w-20 h-20 rounded-full overflow-hidden shadow-md">
                  <img src={editAvatarPreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center text-white shadow-md">
                  <span className="text-3xl font-bold">{editName ? editName.charAt(0).toUpperCase() : initialLetter}</span>
                </div>
              )}
              <label className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full shadow-lg cursor-pointer hover:bg-primary-container transition-colors">
                <Camera size={14} />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleAvatarChange}
                />
              </label>
            </div>
            <span className="text-xs text-on-surface-variant text-center">Tap ikon kamera untuk ubah foto</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Nama Lengkap</label>
            <input 
              type="text" 
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoComplete="off"
              className="w-full p-3 rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-white text-sm" 
            />
          </div>
          
          <button 
            type="submit"
            disabled={isSavingProfile}
            className="w-full py-3 mt-4 bg-primary text-white rounded-xl font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSavingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </form>
      </Modal>

      {/* Change Password Modal */}
      <Modal 
        isOpen={isChangePasswordOpen} 
        onClose={() => {
          setIsChangePasswordOpen(false);
          localStorage.removeItem('is_password_recovery');
        }} 
        title="Ubah Kata Sandi"
      >
        <form onSubmit={savePassword} className="space-y-4" autoComplete="off">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Kata Sandi Baru</label>
            <input 
              type="password" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full p-3 rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-white text-sm" 
              placeholder="Minimal 6 karakter"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Konfirmasi Kata Sandi</label>
            <input 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full p-3 rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-white text-sm" 
              placeholder="Ulangi kata sandi baru"
            />
          </div>
          
          <button 
            type="submit"
            disabled={isSavingPassword}
            className="w-full py-3 mt-4 bg-primary text-white rounded-xl font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSavingPassword ? 'Menyimpan...' : 'Perbarui Kata Sandi'}
          </button>
        </form>
      </Modal>

      {/* About App Modal */}
      <Modal 
        isOpen={isAboutOpen} 
        onClose={() => setIsAboutOpen(false)} 
        title="Tentang Aplikasi"
      >
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="w-16 h-16 flex items-center justify-center mb-2 mx-auto">
            <img src="/pwa-192x192.png" alt="SIKADIR Logo" className="w-full h-full object-contain drop-shadow-md" />
          </div>
          <h3 className="text-xl font-bold text-primary font-jakarta">SIKADIR</h3>
          <p className="text-sm text-on-surface-variant font-medium">Versi 1.0.0</p>
          
          <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 text-sm text-on-surface text-left w-full mt-4 space-y-3 shadow-sm">
            <p><strong>SIKADIR</strong> adalah sistem informasi kehadiran presensi digital berbasis lokasi (GPS) dan pengenalan wajah (*Facial Recognition*).</p>
            <ul className="list-disc pl-4 space-y-1 text-on-surface-variant">
              <li>Verifikasi Wajah AI Terintegrasi</li>
              <li>Pelacakan Lokasi Akurat (GPS)</li>
              <li>Manajemen Pengajuan Izin/Sakit</li>
              <li>Notifikasi Otomatis Bot Telegram</li>
            </ul>
            <p className="text-xs text-center text-outline-variant mt-4 pt-4 border-t border-outline-variant/10">
              Dikembangkan dengan ❤️ untuk masa depan administrasi yang lebih baik.
            </p>
          </div>
          
          <button 
            onClick={() => setIsAboutOpen(false)}
            className="w-full py-3 mt-4 bg-surface-container-low text-on-surface rounded-xl font-bold hover:bg-surface-container transition-colors"
          >
            Tutup
          </button>
        </div>
      </Modal>
    </div>
  );
}
