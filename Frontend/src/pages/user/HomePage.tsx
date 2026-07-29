import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { id } from 'date-fns/locale/id';
import { 
  Clock, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  ChevronRight,
  LogOut,
  CalendarCheck,
  CalendarX,
  CalendarClock,
  Bell
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Notification } from '../../lib/types';



export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [status, setStatus] = useState<'not_checked_in' | 'checked_in' | 'done' | 'on_leave'>('not_checked_in');
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [recentHistory, setRecentHistory] = useState<any[]>([]);
  const [stats, setStats] = useState({ hadir: 0, izin: 0, sakit: 0 });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchTodayStatus = async () => {
      if (!user) return;
      
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      // Check for active leave today
      const { data: leaveData } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['approved', 'pending'])
        .lte('start_date', todayStr)
        .gte('end_date', todayStr);
        
      if (leaveData && leaveData.length > 0) {
        setStatus('on_leave');
        return;
      }
      
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startOfDay.toISOString());

      if (data) {
        const hasCheckIn = data.find(d => d.type === 'check_in');
        const hasCheckOut = data.find(d => d.type === 'check_out');
        
        if (hasCheckIn && hasCheckOut) {
          setStatus('done');
        } else if (hasCheckIn) {
          setStatus('checked_in');
          const date = new Date(hasCheckIn.created_at);
          setCheckInTime(format(date, 'HH:mm'));
        } else {
          setStatus('not_checked_in');
        }
      }
    };
    const fetchRecentHistory = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);
      if (data) {
        setRecentHistory(data);
      }
    };
    
    const fetchMonthlyStats = async () => {
      if (!user) return;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      
      const { data: attData } = await supabase
        .from('attendance')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('type', 'check_in')
        .gte('created_at', startOfMonth);
        
      const { data: leaveData } = await supabase
        .from('leave_requests')
        .select('type, start_date, end_date')
        .eq('user_id', user.id)
        .in('status', ['approved', 'pending'])
        .gte('start_date', startOfMonthStr);
        
      let izinCount = 0;
      let sakitCount = 0;
      let hadirCount = 0;
      
      if (leaveData) {
        leaveData.forEach(req => {
          if (req.type === 'izin') izinCount += 1;
          else if (req.type === 'sakit') sakitCount += 1;
        });
      }
      
      if (attData) {
        // Group by day to prevent double counting check-ins on the same day (just in case)
        const uniqueHadirDays = new Set<string>();
        
        attData.forEach(att => {
          const attDate = new Date(att.created_at);
          const attDateStr = `${attDate.getFullYear()}-${String(attDate.getMonth() + 1).padStart(2, '0')}-${String(attDate.getDate()).padStart(2, '0')}`;
          
          let isOverlapped = false;
          if (leaveData) {
            isOverlapped = leaveData.some(req => {
              return attDateStr >= req.start_date && attDateStr <= req.end_date;
            });
          }
          
          if (!isOverlapped) {
            uniqueHadirDays.add(attDateStr);
          }
        });
        hadirCount = uniqueHadirDays.size;
      }
      
      setStats({ 
        hadir: hadirCount, 
        izin: izinCount, 
        sakit: sakitCount 
      });
    };

    const fetchNotifications = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    };
    
    fetchTodayStatus();
    fetchRecentHistory();
    fetchMonthlyStats();
    fetchNotifications();
  }, [user]);

  // Handle Password Recovery Redirect
  useEffect(() => {
    if (localStorage.getItem('is_password_recovery') === 'true') {
      navigate('/profil');
    }
  }, [navigate]);

  // Handle Realtime Notifications and Browser Notification Permission
  useEffect(() => {
    if (!user) return;

    // Request notification permission if not granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleOpenNotifications = async () => {
    setShowNotifications(true);
    if (unreadCount > 0) {
      // Mark as read in DB
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);
        
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  };

  const formattedDate = format(currentTime, 'EEEE, dd MMMM yyyy', { locale: id });
  const formattedTime = format(currentTime, 'HH:mm:ss');

  const handleAction = () => {
    if (status === 'done') return;
    const type = status === 'not_checked_in' ? 'check_in' : 'check_out';
    navigate('/presensi', { state: { type } });
  };

  return (
    <div className="flex flex-col w-full max-w-[600px] lg:max-w-none mx-auto pb-4 h-full">
      {/* TopAppBar */}
      <header className="bg-surface/80 backdrop-blur-md sticky top-0 z-50 border-b border-white/20 shadow-sm flex items-center justify-between lg:justify-end px-5 h-16 w-full -mt-4 lg:mt-0 mb-4 lg:rounded-b-xl lg:border-x lg:border-white/20">
        <div className="flex items-center gap-3 lg:hidden">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-variant flex items-center justify-center">
            <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCSvYqGdcpTLPCo4S4_qkT6FGHGheUgrJNeFjwrZGqFODyXQvAEE7x7jLxu5i3ze1h1lV5Y38vbolojnpxuwJfnEufpu7qw1ByutRYRd8Y6KCh4EDEnz1yn_QOvg8DuTHToDZ6xWbK186rczPxpUdPKM7K2ybw3-4ysXlA7mkXmXqpjTvoYEaY3VutUyNin5IWKaM_jdcPQlKB9v0fi61kqREyZYXGoV8akFiTZ3amZBTPtX9QancRA2Q" alt="User avatar" />
          </div>
          <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
            SIKADIR
          </div>
        </div>
        <div className="relative">
          <button 
            onClick={() => showNotifications ? setShowNotifications(false) : handleOpenNotifications()}
            className="text-primary hover:bg-surface-container-high transition-colors active:scale-95 transition-transform w-10 h-10 rounded-full flex items-center justify-center"
          >
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-error rounded-full border-2 border-white animate-pulse"></span>
            )}
          </button>
          
          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute top-12 right-0 w-80 bg-white rounded-2xl shadow-xl border border-outline-variant/30 overflow-hidden z-50 animate-fade-in origin-top-right">
              <div className="p-4 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-lowest">
                <h3 className="font-bold text-on-surface">Notifikasi</h3>
                <button onClick={() => setShowNotifications(false)} className="text-on-surface-variant hover:text-error">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                {notifications.length > 0 ? (
                  <div className="flex flex-col">
                    {notifications.map(notif => (
                      <div key={notif.id} className={`p-4 border-b border-outline-variant/10 last:border-0 ${!notif.is_read ? 'bg-primary/5' : 'hover:bg-surface-container-lowest'}`}>
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${!notif.is_read ? 'bg-primary' : 'bg-transparent'}`}></div>
                          <div>
                            <p className="text-sm font-bold text-on-surface leading-tight mb-1">{notif.title}</p>
                            <p className="text-xs text-on-surface-variant leading-relaxed mb-2">{notif.message}</p>
                            <p className="text-[10px] text-outline font-medium">{format(new Date(notif.created_at), 'dd MMM HH:mm', { locale: id })}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-sm text-on-surface-variant flex flex-col items-center">
                    <Bell className="w-8 h-8 text-outline mb-2 opacity-50" />
                    Belum ada notifikasi
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex flex-col gap-8 px-1 lg:px-0">
        
        {/* Greeting */}
        <section className="animate-fade-in">
          <h1 className="text-3xl font-bold text-on-surface tracking-tight">
            Selamat Pagi, {user?.username || user?.email?.split('@')[0] || 'Pengguna'}!
          </h1>
          <p className="text-base text-on-surface-variant mt-1">{formattedDate}</p>
        </section>

        {/* Status Card (Glassmorphism) */}
        <section className="bg-white/80 backdrop-blur-md border border-white/50 rounded-xl p-6 shadow-[0_4px_20px_rgba(0,31,111,0.04)] relative overflow-hidden animate-fade-slide-up">
          
          <div className="relative z-10 flex flex-col items-center text-center">
            {status === 'not_checked_in' && (
              <>
                <div className="w-16 h-16 rounded-full bg-error-container/30 flex items-center justify-center mb-4">
                  <Clock className="w-8 h-8 text-error" />
                </div>
                <h2 className="text-lg font-semibold text-on-surface mb-2">Belum absen</h2>
                <p className="text-sm text-on-surface-variant mb-6">Waktu masuk maksimal 09:00 WIB</p>
                <button 
                  onClick={handleAction}
                  className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg shadow-md hover:bg-primary-container transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut className="w-6 h-6 transform rotate-180" />
                  Absen Masuk Sekarang
                </button>
              </>
            )}

            {status === 'checked_in' && (
              <>
                <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-success" />
                </div>
                <h2 className="text-lg font-semibold text-on-surface mb-2">Sudah Absen Masuk</h2>
                <p className="text-sm text-on-surface-variant mb-6">Anda masuk pukul {checkInTime || '-'} WIB</p>
                <button 
                  onClick={handleAction}
                  className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg shadow-md hover:bg-primary-container transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut className="w-6 h-6" />
                  Absen Pulang
                </button>
              </>
            )}

            {status === 'done' && (
              <>
                <div className="w-16 h-16 rounded-full bg-surface-variant flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-on-surface-variant" />
                </div>
                <h2 className="text-lg font-semibold text-on-surface mb-2">Selesai</h2>
                <p className="text-sm text-on-surface-variant mb-0">Anda sudah absen masuk dan keluar hari ini. Selamat beristirahat!</p>
              </>
            )}
            {status === 'on_leave' && (
              <>
                <div className="w-16 h-16 rounded-full bg-secondary-container/30 flex items-center justify-center mb-4">
                  <CalendarClock className="w-8 h-8 text-secondary" />
                </div>
                <h2 className="text-lg font-semibold text-on-surface mb-2">Sedang Izin / Sakit</h2>
                <p className="text-sm text-on-surface-variant mb-0">Anda tidak dapat melakukan presensi karena pengajuan izin/sakit Anda sedang aktif untuk hari ini.</p>
              </>
            )}
          </div>
        </section>

        {/* Quick Stats Grid */}
        <section className="grid grid-cols-3 gap-4 animate-fade-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_4px_20px_rgba(0,31,111,0.04)] flex flex-col items-center text-center border border-outline-variant/10">
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-6 h-6 text-success" />
            </div>
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Hadir</span>
            <span className="text-xl font-bold text-on-surface mt-1">{stats.hadir}</span>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_4px_20px_rgba(0,31,111,0.04)] flex flex-col items-center text-center border border-outline-variant/10">
            <div className="w-10 h-10 rounded-full bg-secondary-container/30 flex items-center justify-center mb-2">
              <CalendarClock className="w-6 h-6 text-secondary" />
            </div>
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Izin</span>
            <span className="text-xl font-bold text-on-surface mt-1">{stats.izin}</span>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_4px_20px_rgba(0,31,111,0.04)] flex flex-col items-center text-center border border-outline-variant/10">
            <div className="w-10 h-10 rounded-full bg-error-container/50 flex items-center justify-center mb-2">
              <CalendarX className="w-6 h-6 text-error" />
            </div>
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Sakit</span>
            <span className="text-xl font-bold text-on-surface mt-1">{stats.sakit}</span>
          </div>
        </section>

        {/* Recent History */}
        <section className="flex flex-col gap-4 animate-fade-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-on-surface">Riwayat Terakhir</h3>
            <button onClick={() => navigate('/riwayat')} className="text-sm font-medium text-primary hover:underline">
              Lihat Semua
            </button>
          </div>
          
          <div className="flex flex-col gap-3">
            {recentHistory.length > 0 ? recentHistory.map((item) => (
              <div key={item.id} className="bg-surface-container-lowest p-4 rounded-xl shadow-[0_4px_20px_rgba(0,31,111,0.04)] flex items-center gap-4 border border-outline-variant/10">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.type === 'check_in' ? 'bg-success/10' : 'bg-secondary/10'}`}>
                  <LogOut className={`w-6 h-6 ${item.type === 'check_in' ? 'text-success transform rotate-180' : 'text-secondary'}`} />
                </div>
                <div className="flex-1">
                  <div className="text-base font-semibold text-on-surface">{item.type === 'check_in' ? 'Masuk' : 'Keluar'}</div>
                  <div className="text-sm text-on-surface-variant line-clamp-1">{item.address || '-'}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-on-surface">{format(new Date(item.created_at), 'HH:mm')}</div>
                  <div className="text-xs font-semibold text-on-surface-variant">{format(new Date(item.created_at), 'EEE, dd MMM', { locale: id })}</div>
                </div>
              </div>
            )) : (
              <div className="text-center py-4 text-on-surface-variant text-sm">Belum ada riwayat</div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
