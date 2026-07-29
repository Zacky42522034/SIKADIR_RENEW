import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './hooks/useAuth';

// Layouts
import { AuthLayout } from './layouts/AuthLayout';
import { UserLayout } from './layouts/UserLayout';
import { AdminLayout } from './layouts/AdminLayout';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// User Pages
import HomePage from './pages/user/HomePage';
import PresensiPage from './pages/user/PresensiPage';
import RiwayatPage from './pages/user/RiwayatPage';
import IzinPage from './pages/user/IzinPage';
import ProfilPage from './pages/user/ProfilPage';

// Admin Pages
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminMapPage from './pages/admin/AdminMapPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
      <BrowserRouter>
        <Routes>
          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Admin Routes */}
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/map" element={<AdminMapPage />} />
            <Route path="/admin/reports" element={<AdminReportsPage />} />
          </Route>

          {/* User Routes */}
          <Route element={<UserLayout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/presensi" element={<PresensiPage />} />
            <Route path="/riwayat" element={<RiwayatPage />} />
            <Route path="/izin" element={<IzinPage />} />
            <Route path="/profil" element={<ProfilPage />} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
