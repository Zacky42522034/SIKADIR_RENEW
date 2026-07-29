import React, { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { Notification } from '../lib/types';
import { Home, ScanFace, CalendarClock, FileText, UserCircle } from 'lucide-react';

export const UserLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  React.useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    } else if (!loading && user) {
      if (localStorage.getItem('is_password_recovery') === 'true') {
        navigate('/profil', { replace: true });
      }
    }
  }, [user, loading, navigate]);

  // Global device notification listener
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('global-notifications')
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
          if ('Notification' in window && Notification.permission === 'granted') {
            const browserNotif = new window.Notification(newNotif.title, {
              body: newNotif.message,
              icon: '/pwa-192x192.png'
            });
            
            browserNotif.onclick = () => {
              window.focus(); // Bring window to front
              navigate('/izin', { state: { tab: 'history', refresh: Date.now() } });
            };
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) return null;

  const navItems = [
    { name: 'Home', path: '/home', icon: Home },
    { name: 'Presensi', path: '/presensi', icon: ScanFace },
    { name: 'Riwayat', path: '/riwayat', icon: CalendarClock },
    { name: 'Izin', path: '/izin', icon: FileText },
    { name: 'Profil', path: '/profil', icon: UserCircle },
  ];

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-surface">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-outline-variant/30 shadow-sm">
        <div className="p-6 border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <img src="/pwa-192x192.png" alt="SIKADIR Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-xl font-bold text-primary">SIKADIR</h1>
          </div>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-primary/10 text-primary font-semibold shadow-sm' 
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="font-semibold text-base">{item.name}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-outline-variant/20">
          <p className="text-xs text-on-surface-variant text-center">SIKADIR v1.0.0</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 pb-20 lg:pb-0 overflow-y-auto min-h-screen">
        <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 h-full">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-outline-variant/30 z-50 shadow-[0_-2px_20px_rgba(0,0,0,0.08)]">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors duration-200 ${
                  isActive ? 'text-primary' : 'text-on-surface-variant/60'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1 rounded-xl transition-all duration-200 ${isActive ? 'bg-primary/10' : ''}`}>
                    <item.icon 
                      className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : 'scale-100'}`} 
                      strokeWidth={isActive ? 2.5 : 1.5}
                    />
                  </div>
                  <span className={`text-xs mt-1 ${isActive ? 'font-semibold' : 'font-semibold'}`}>
                    {item.name}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};
