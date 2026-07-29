import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';
import { supabase } from '../../lib/supabase';
import { Search, Edit, History, Trash2, X, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';

interface Profile {
  id: string;
  email: string;
  username: string;
  role: string;
  avatar_url: string;
  created_at: string;
  is_active: boolean;
}

interface AttendanceLog {
  id: string;
  type: string;
  created_at: string;
  verified: boolean;
  address: string;
  face_image_url?: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, inactive
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  
  // Edit form state
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History state
  const [historyLogs, setHistoryLogs] = useState<AttendanceLog[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        (user.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = 
        statusFilter === 'all' ? true :
        statusFilter === 'active' ? user.is_active !== false :
        statusFilter === 'inactive' ? user.is_active === false : true;

      return matchesSearch && matchesStatus;
    });
  }, [users, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const openEditModal = (user: Profile) => {
    setSelectedUser(user);
    setEditName(user.username || '');
    setEditEmail(user.email || '');
    setEditPassword('');
    setEditIsActive(user.is_active !== false);
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.rpc('admin_update_user', {
        target_user_id: selectedUser.id,
        new_email: editEmail !== selectedUser.email ? editEmail : null,
        new_password: editPassword !== '' ? editPassword : null,
        new_name: editName,
        new_is_active: editIsActive
      });

      if (error) throw error;
      
      await fetchUsers();
      setIsEditModalOpen(false);
    } catch (err: any) {
      alert('Gagal mengupdate: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteModal = (user: Profile) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc('admin_delete_user', {
        target_user_id: selectedUser.id
      });
      if (error) throw error;
      
      await fetchUsers();
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      alert('Gagal menghapus: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openHistoryModal = async (user: Profile) => {
    setSelectedUser(user);
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    setShowAllHistory(false);
    
    const { data } = await supabase
      .from('attendance')
      .select('id, type, created_at, verified, address, face_image_url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
      
    if (data) setHistoryLogs(data);
    setHistoryLoading(false);
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-on-surface">Manajemen User</h1>
            <p className="text-sm font-normal text-on-surface-variant mt-1">Kelola data pegawai dan hak akses sistem.</p>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-outline-variant/30 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
            <input 
              className="w-full pl-10 pr-4 py-2 bg-surface rounded-lg border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors text-sm font-normal text-on-surface placeholder:text-outline" 
              placeholder="Cari nama atau email..." 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-on-surface-variant text-xs font-semibold tracking-wider">Status:</span>
            <select 
              className="bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm font-normal focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-outline-variant/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface border-b border-outline-variant/50">
                  <th className="px-6 py-4 text-sm font-semibold text-on-surface-variant">User</th>
                  <th className="px-6 py-4 text-sm font-semibold text-on-surface-variant hidden sm:table-cell">Email</th>
                  <th className="px-6 py-4 text-sm font-semibold text-on-surface-variant">Status</th>
                  <th className="px-6 py-4 text-sm font-semibold text-on-surface-variant hidden md:table-cell">Tanggal Daftar</th>
                  <th className="px-6 py-4 text-sm font-semibold text-on-surface-variant text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {loading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-on-surface-variant">Memuat data...</td></tr>
                ) : paginatedUsers.length > 0 ? (
                  paginatedUsers.map(u => (
                    <tr key={u.id} className="hover:bg-surface-container-lowest transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {u.avatar_url ? (
                            <img className="w-10 h-10 rounded-full object-cover bg-surface-variant" alt={u.username} src={u.avatar_url} />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg">
                              {(u.username || 'U')[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-on-surface">{u.username || 'Pengguna'}</p>
                            <p className="text-xs font-normal text-outline sm:hidden">{u.email}</p>
                            <p className="text-[10px] font-semibold text-primary uppercase mt-0.5">{u.role === 'admin' ? 'Administrator' : 'Karyawan'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell text-sm font-normal text-on-surface-variant">
                        {u.email}
                      </td>
                      <td className="px-6 py-4">
                        {u.is_active !== false ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#D1FAE5] text-[#065F46]">
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FEF3C7] text-[#92400E]">
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell text-sm font-normal text-on-surface-variant">
                        {format(new Date(u.created_at), 'dd MMM yyyy', { locale: idLocale })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEditModal(u)} className="p-2 text-outline hover:text-primary transition-colors rounded-full" title="Edit">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => openHistoryModal(u)} className="p-2 text-outline hover:text-secondary transition-colors rounded-full" title="History">
                            <History className="w-4 h-4" />
                          </button>
                          {u.role !== 'admin' && (
                            <button onClick={() => openDeleteModal(u)} className="p-2 text-outline hover:text-error transition-colors rounded-full" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="p-8 text-center text-on-surface-variant">Tidak ada data pengguna.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filteredUsers.length > 0 && (
            <div className="px-6 py-4 border-t border-outline-variant/50 flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface-container-lowest">
              <span className="text-sm font-normal text-on-surface-variant">
                Menampilkan {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredUsers.length)} dari {filteredUsers.length} data
              </span>
              <div className="flex gap-1 items-center">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded text-sm font-medium text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50"
                >
                  Sebelumnya
                </button>
                <div className="px-4 py-1.5 rounded bg-primary text-white text-sm font-bold">
                  {currentPage}
                </div>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded text-sm font-medium text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Profil Pengguna">
        <form onSubmit={handleUpdateUser} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-on-surface mb-1">Nama Pengguna (Username)</label>
            <input 
              required
              type="text" 
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-on-surface mb-1">Email</label>
            <input 
              required
              type="email" 
              value={editEmail}
              onChange={e => setEditEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-on-surface mb-1">Password Baru (Opsional)</label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={editPassword}
                onChange={e => setEditPassword(e.target.value)}
                placeholder="Kosongkan jika tidak ingin mengubah"
                className="w-full px-4 py-2 pr-10 rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {selectedUser?.role !== 'admin' && (
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-2">Status Akun</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="status" 
                    checked={editIsActive} 
                    onChange={() => setEditIsActive(true)}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-on-surface">Aktif</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="status" 
                    checked={!editIsActive} 
                    onChange={() => setEditIsActive(false)}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-on-surface">Nonaktif</span>
                </label>
              </div>
            </div>
          )}
          
          <div className="pt-4 flex gap-3 justify-end border-t border-outline-variant/30">
            <button 
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              Batal
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-70"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} title={`Riwayat ${selectedUser?.username}`}>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {historyLoading ? (
            <p className="text-center py-4 text-on-surface-variant text-sm">Memuat riwayat...</p>
          ) : historyLogs.length > 0 ? (
            <div className="space-y-3">
              {(showAllHistory ? historyLogs : historyLogs.slice(0, 10)).map(log => (
                <div key={log.id} className="flex gap-3 p-3 rounded-lg border border-outline-variant/30 bg-surface-container-lowest">
                  {log.face_image_url && (
                    <a 
                      href={log.face_image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-16 h-16 shrink-0 rounded-md overflow-hidden bg-surface-variant border border-outline-variant/20 block hover:opacity-80 transition-opacity cursor-pointer"
                      title="Klik untuk melihat foto ukuran penuh"
                    >
                      <img src={log.face_image_url} alt="Presensi" className="w-full h-full object-cover" />
                    </a>
                  )}
                  <div className="flex-1 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-sm ${log.type === 'check_in' ? 'text-success' : 'text-secondary'}`}>
                          {log.type === 'check_in' ? 'Masuk' : 'Pulang'}
                        </span>
                        {log.verified && <CheckCircle2 className="w-3 h-3 text-success" />}
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2 pr-2">{log.address || 'Lokasi Terdaftar'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-on-surface">{format(new Date(log.created_at), 'HH:mm')}</p>
                      <p className="text-[10px] text-on-surface-variant">{format(new Date(log.created_at), 'dd MMM yyyy', { locale: idLocale })}</p>
                    </div>
                  </div>
                </div>
              ))}
              
              {!showAllHistory && historyLogs.length > 10 && (
                <button 
                  onClick={() => setShowAllHistory(true)}
                  className="w-full py-2 mt-2 text-sm font-semibold text-primary hover:bg-primary/5 rounded-lg transition-colors border border-primary/20"
                >
                  Tampilkan Semua ({historyLogs.length})
                </button>
              )}
            </div>
          ) : (
            <p className="text-center py-4 text-on-surface-variant text-sm">Belum ada riwayat presensi.</p>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Konfirmasi Hapus">
        <div className="space-y-4">
          <p className="text-sm text-on-surface">
            Apakah Anda yakin ingin menghapus pengguna <strong>{selectedUser?.username || selectedUser?.email}</strong> secara permanen?
            <br/><br/>
            Tindakan ini akan menghapus semua data akses pengguna dari sistem. Data presensi terkait mungkin akan menjadi yatim (orphaned).
          </p>
          
          <div className="pt-4 flex gap-3 justify-end border-t border-outline-variant/30">
            <button 
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              Batal
            </button>
            <button 
              onClick={handleDeleteUser}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-error text-white text-sm font-semibold hover:bg-error/90 transition-colors disabled:opacity-70 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {isSubmitting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
