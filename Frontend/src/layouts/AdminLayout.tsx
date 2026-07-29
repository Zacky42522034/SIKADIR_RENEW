import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  LayoutDashboard, 
  Users, 
  MapPin, 
  FileText, 
  LogOut, 
  ShieldCheck, 
  Menu
} from 'lucide-react';

export function AdminLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  React.useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/login');
      } else if (user.role !== 'admin') {
        navigate('/home'); // Redirect non-admins to user home
      }
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') return null;

  const handleLogout = async () => {
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

  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Live Map', path: '/admin/map', icon: MapPin },
    { name: 'Reports', path: '/admin/reports', icon: FileText },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-surface font-jakarta">
      {/* NavigationSidebar (Left Nav for Web) */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full border-r border-outline-variant/30 bg-white w-64 shadow-sm z-40">
        <div className="p-6 border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <img src="/pwa-192x192.png" alt="SIKADIR Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-primary">Admin Portal</h2>
              <p className="text-xs text-on-surface-variant">SIKADIR</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
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
          <button 
            onClick={handleLogout}
            disabled={isSigningOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-danger hover:bg-danger/5 rounded-xl transition-colors font-semibold text-base disabled:opacity-50"
          >
            {isSigningOut ? (
              <div className="w-5 h-5 border-2 border-danger/30 border-t-danger rounded-full animate-spin" />
            ) : (
              <LogOut className="w-5 h-5" />
            )}
            <span>{isSigningOut ? 'Keluar...' : 'Keluar Akun'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col lg:ml-64 h-full overflow-hidden bg-surface">
        {/* TopAppBar (Mobile Header) */}
        <header className="lg:hidden flex items-center justify-between px-5 h-16 w-full max-w-[600px] mx-auto top-0 sticky z-50 bg-white/90 backdrop-blur-xl border-b border-outline-variant/30 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <img src="/pwa-192x192.png" alt="SIKADIR Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-lg font-bold text-primary font-jakarta">Admin Portal</h1>
          </div>
        </header>

        {/* Content Canvas */}
        <div className="flex-1 overflow-y-auto relative">
          <Outlet />
          {/* Bottom padding for mobile nav */}
          <div className="h-24 lg:hidden"></div>
        </div>
      </main>

      {/* BottomNavBar for Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 w-full z-50 bg-white/90 backdrop-blur-xl border-t border-outline-variant/30 shadow-[0_-2px_20px_rgba(0,0,0,0.08)]">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
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
                  <span className={`text-[10px] leading-tight ${isActive ? 'font-semibold' : 'font-normal'}`}>
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
}
