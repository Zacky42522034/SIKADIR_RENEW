import React, { useState, useEffect, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';
import { supabase } from '../../lib/supabase';
import { Search, Download, Table, X, Check, Calendar, CheckCircle2, UserSearch, FileSpreadsheet, Loader2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList } from 'recharts';

// Fix leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom map dot
const dotIcon = L.divIcon({
  html: `<div style="width:12px;height:12px;background:#00236f;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
  className: '',
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
}

interface AttendanceRecord {
  id: string;
  created_at: string;
  user_id: string;
  type: string;
  address: string;
  verified: boolean;
  latitude?: number;
  longitude?: number;
  face_image_url?: string;
  username?: string;
  avatar_url?: string;
}

export default function AdminReportsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Filters
  const [startDate, setStartDate] = useState(format(new Date(new Date().setDate(1)), 'yyyy-MM-dd')); // First day of current month
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd')); // Today
  const [status, setStatus] = useState('all'); 
  
  // Multi-select state
  const [searchUser, setSearchUser] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Export ref
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProfiles();
    fetchReports(); // Initial fetch with default filters
    
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('id, username, avatar_url').order('username');
    if (data) setProfiles(data);
  };

  const fetchReports = async (overrideParams?: any) => {
    setLoading(true);
    const sDate = overrideParams?.startDate || startDate;
    const eDate = overrideParams?.endDate || endDate;
    const selUsers = overrideParams?.selectedUsers !== undefined ? overrideParams.selectedUsers : selectedUsers;
    const stat = overrideParams?.status || status;

    let query = supabase
      .from('attendance')
      .select('*')
      .gte('created_at', sDate + 'T00:00:00.000Z')
      .lte('created_at', eDate + 'T23:59:59.999Z')
      .order('created_at', { ascending: false });
    
    if (selUsers.length > 0) {
      query = query.in('user_id', selUsers.map((u: Profile) => u.id));
    }
    
    if (stat === 'check_in' || stat === 'check_out') {
      query = query.eq('type', stat);
    } else if (stat === 'verified') {
      query = query.eq('verified', true);
    } else if (stat === 'unverified') {
      query = query.eq('verified', false);
    }
    
    const { data: attData } = await query;
    
    if (attData) {
      // Get all profiles map to enrich data
      const { data: profData } = await supabase.from('profiles').select('id, username, avatar_url');
      const profMap: Record<string, Profile> = {};
      profData?.forEach(p => profMap[p.id] = p);
      
      const enriched = attData.map(a => ({
        ...a,
        username: profMap[a.user_id]?.username || 'Unknown',
        avatar_url: profMap[a.user_id]?.avatar_url
      }));
      setRecords(enriched);
    } else {
      setRecords([]);
    }
    setLoading(false);
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReports();
  };
  
  const handleReset = () => {
    const resetState = {
      startDate: format(new Date(new Date().setDate(1)), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      status: 'all',
      selectedUsers: []
    };
    setStartDate(resetState.startDate);
    setEndDate(resetState.endDate);
    setStatus(resetState.status);
    setSelectedUsers([]);
    setSearchUser('');
    fetchReports(resetState);
  };
  
  const toggleUser = (user: Profile) => {
    if (selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const filteredDropdownProfiles = useMemo(() => {
    return profiles.filter(p => p.username?.toLowerCase().includes(searchUser.toLowerCase()));
  }, [profiles, searchUser]);



  const downloadExcel = async () => {
    if (records.length === 0) return;
    setExporting(true);
    
    try {
      const ExcelJS = (await import('exceljs')).default;
      const html2canvas = (await import('html2canvas')).default;
      
      const workbook = new ExcelJS.Workbook();
      
      // === SHEET 1: Data Presensi ===
      const dataSheet = workbook.addWorksheet('Data Presensi');
      dataSheet.columns = [
        { header: 'Tanggal', key: 'date', width: 15 },
        { header: 'Waktu', key: 'time', width: 15 },
        { header: 'Karyawan', key: 'name', width: 25 },
        { header: 'Tipe', key: 'type', width: 15 },
        { header: 'Status Verifikasi', key: 'verified', width: 20 },
        { header: 'Lokasi', key: 'location', width: 40 },
        { header: 'Latitude', key: 'lat', width: 15 },
        { header: 'Longitude', key: 'lng', width: 15 },
        { header: 'Foto Presensi', key: 'photo', width: 15 },
      ];
      
      dataSheet.getRow(1).font = { bold: true };
      
      records.forEach(r => {
        dataSheet.addRow({
          date: format(new Date(r.created_at), 'dd/MM/yyyy'),
          time: format(new Date(r.created_at), 'HH:mm:ss'),
          name: r.username,
          type: r.type === 'check_in' ? 'Masuk' : 'Pulang',
          verified: r.verified ? 'Terverifikasi' : 'Tidak Terverifikasi',
          location: r.address || '-',
          lat: r.latitude || '-',
          lng: r.longitude || '-',
          photo: r.face_image_url ? { text: 'Lihat Foto', hyperlink: r.face_image_url } : '-'
        });
        
        // Add style to hyperlink cell
        if (r.face_image_url) {
           const rowObj = dataSheet.lastRow;
           if (rowObj) {
             const cell = rowObj.getCell('photo');
             cell.font = { color: { argb: 'FF0563C1' }, underline: true };
           }
        }
      });
      
      // === SHEET 2: Dashboard Visualisasi ===
      const dashSheet = workbook.addWorksheet('Dashboard');
      
      dashSheet.getCell('A1').value = 'LAPORAN VISUAL & DASBOR';
      dashSheet.getCell('A1').font = { size: 16, bold: true };
      
      dashSheet.getCell('A3').value = 'Periode:';
      dashSheet.getCell('B3').value = `${format(new Date(startDate), 'dd MMM yyyy')} - ${format(new Date(endDate), 'dd MMM yyyy')}`;
      dashSheet.getCell('A3').font = { bold: true };
      
      const hadirCount = records.filter(r => r.type === 'check_in').length;
      const pulangCount = records.filter(r => r.type === 'check_out').length;
      const verifiedCount = records.filter(r => r.verified).length;
      
      dashSheet.getCell('A5').value = 'Total Check-In:';
      dashSheet.getCell('B5').value = hadirCount;
      dashSheet.getCell('A6').value = 'Total Check-Out:';
      dashSheet.getCell('B6').value = pulangCount;
      dashSheet.getCell('A7').value = 'Total Terverifikasi:';
      dashSheet.getCell('B7').value = verifiedCount;
      
      ['A5', 'A6', 'A7'].forEach(cell => dashSheet.getCell(cell).font = { bold: true });
      
      // Capture the hidden dashboard DOM
      if (exportRef.current) {
        // Wait briefly for charts and map tiles to render
        await new Promise(res => setTimeout(res, 2000));
        
        const canvas = await html2canvas(exportRef.current, { 
          useCORS: true,
          allowTaint: true,
          scale: 2,
          logging: false
        });
        const imgData = canvas.toDataURL('image/png');
        
        const imageId = workbook.addImage({
          base64: imgData,
          extension: 'png'
        });
        
        // Add image starting at Row 9
        dashSheet.addImage(imageId, {
          tl: { col: 0, row: 9 },
          ext: { width: 800, height: 400 }
        });
      }
      
      // Export file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Laporan_Presensi_Dashboard_${startDate}_to_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (e) {
      console.error(e);
      alert('Gagal membuat Excel. Error: ' + (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  // Safe map center calculation
  const mapCenterLat = records.find(r => r.latitude)?.latitude || -6.2088;
  const mapCenterLng = records.find(r => r.longitude)?.longitude || 106.8456;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 relative">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-background">Laporan Presensi</h1>
          <p className="text-base font-normal text-on-surface-variant mt-2">Buat dan unduh rekap data kehadiran karyawan.</p>
        </div>
      </div>

      {/* Filter Section */}
      <section className="bg-white/80 backdrop-blur-md rounded-xl p-6 shadow-sm border border-outline-variant/30">
        <h2 className="text-lg font-semibold text-on-surface mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">filter_list</span>
          Filter Laporan
        </h2>
        
        <form onSubmit={handleApply} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
          {/* Date Range */}
          <div className="space-y-2 lg:col-span-2">
            <label className="text-xs font-semibold tracking-wider text-on-surface-variant block">Rentang Tanggal</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
                <input 
                  className="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant rounded-lg text-sm focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-shadow" 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <span className="text-on-surface-variant text-sm">ke</span>
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
                <input 
                  className="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant rounded-lg text-sm focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-shadow" 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
          
          {/* Multi-select Pegawai */}
          <div className="space-y-2 relative" ref={dropdownRef}>
            <label className="text-xs font-semibold tracking-wider text-on-surface-variant block">Karyawan</label>
            
            <div 
              className="min-h-[42px] w-full px-3 py-1.5 bg-surface border border-outline-variant rounded-lg text-sm focus-within:border-secondary focus-within:ring-1 focus-within:ring-secondary transition-shadow cursor-text flex flex-wrap gap-2 items-center"
              onClick={() => setIsDropdownOpen(true)}
            >
              <UserSearch className="text-outline w-4 h-4 mr-1 shrink-0" />
              
              {/* Selected Chips */}
              {selectedUsers.map(u => (
                <span key={u.id} className="inline-flex items-center gap-1 px-2 py-1 bg-primary-container text-on-primary-container text-xs font-semibold rounded-md">
                  {u.username}
                  <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); toggleUser(u); }}
                    className="hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              
              {/* Input field */}
              <input 
                type="text"
                placeholder={selectedUsers.length === 0 ? "Pilih atau cari..." : ""}
                className="flex-1 bg-transparent min-w-[100px] outline-none text-sm placeholder:text-outline"
                value={searchUser}
                onChange={(e) => {
                  setSearchUser(e.target.value);
                  setIsDropdownOpen(true);
                }}
              />
            </div>
            
            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute z-[100] mt-1 w-full max-h-60 overflow-y-auto bg-surface rounded-lg shadow-lg border border-outline-variant/30 custom-scrollbar">
                {filteredDropdownProfiles.length > 0 ? (
                  filteredDropdownProfiles.map(p => {
                    const isSelected = selectedUsers.some(u => u.id === p.id);
                    return (
                      <div 
                        key={p.id} 
                        onClick={() => toggleUser(p)}
                        className={`px-4 py-2 text-sm flex items-center justify-between cursor-pointer hover:bg-surface-container-low transition-colors ${isSelected ? 'bg-surface-container' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary text-white font-bold text-[10px] flex items-center justify-center overflow-hidden shrink-0">
                            {p.avatar_url ? (
                               <img src={p.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                               (p.username || 'U').charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className="font-medium text-on-surface">{p.username}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-primary" />}
                      </div>
                    );
                  })
                ) : (
                  <div className="px-4 py-3 text-sm text-on-surface-variant text-center">Pencarian tidak ditemukan</div>
                )}
              </div>
            )}
          </div>
          
          {/* Status Dropdown */}
          <div className="space-y-2">
            <label className="text-xs font-semibold tracking-wider text-on-surface-variant block">Status Presensi</label>
            <div className="relative">
              <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
              <select 
                className="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant rounded-lg text-sm font-normal focus:border-secondary focus:ring-1 focus:ring-secondary outline-none appearance-none cursor-pointer"
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                <option value="all">Semua Status</option>
                <option value="check_in">Masuk</option>
                <option value="check_out">Pulang</option>
                <option value="verified">Terverifikasi (Wajah Cocok)</option>
                <option value="unverified">Tidak Terverifikasi</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">expand_more</span>
            </div>
          </div>
          
          {/* Action Buttons for Form */}
          <div className="lg:col-span-4 flex justify-end gap-3 pt-2">
            <button 
              onClick={handleReset}
              className="px-6 py-2 border border-primary text-primary text-xs font-semibold tracking-wider rounded-full hover:bg-surface-container-high transition-colors" 
              type="button"
            >
              Reset
            </button>
            <button 
              className="px-6 py-2 bg-primary text-white text-xs font-semibold tracking-wider rounded-full shadow-sm hover:bg-primary/90 transition-colors flex items-center gap-2" 
              type="submit"
            >
              <Search className="w-4 h-4" />
              Terapkan Filter
            </button>
          </div>
        </form>
      </section>

      {/* Data Preview & Actions */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-on-background">
            Data Laporan {loading ? '...' : `(Menampilkan ${records.length} data)`}
          </h3>
          <div className="flex gap-3">
            <button 
              onClick={downloadExcel}
              disabled={records.length === 0 || exporting}
              className="px-4 py-2 bg-secondary text-white text-xs font-semibold tracking-wider rounded-lg shadow-sm hover:bg-secondary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              {exporting ? 'Memproses...' : 'Unduh Excel (Dasbor)'}
            </button>
          </div>
        </div>
        
        {/* Table Preview inside Glass Card */}
        <div className="bg-surface-container-lowest backdrop-blur-md rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-outline-variant/30 overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-surface border-b border-outline-variant/50">
                  <th className="py-4 px-6 text-xs font-bold tracking-wider text-on-surface-variant">Tanggal</th>
                  <th className="py-4 px-6 text-xs font-bold tracking-wider text-on-surface-variant">Karyawan</th>
                  <th className="py-4 px-6 text-xs font-bold tracking-wider text-on-surface-variant">Waktu</th>
                  <th className="py-4 px-6 text-xs font-bold tracking-wider text-on-surface-variant">Tipe</th>
                  <th className="py-4 px-6 text-xs font-bold tracking-wider text-on-surface-variant">Lokasi</th>
                  <th className="py-4 px-6 text-xs font-bold tracking-wider text-on-surface-variant">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm font-normal divide-y divide-outline-variant/20 bg-white">
                {loading ? (
                  <tr><td colSpan={6} className="py-8 text-center text-on-surface-variant text-sm">Memuat data...</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-on-surface-variant text-sm">Tidak ada data untuk filter yang dipilih.</td></tr>
                ) : records.map(r => (
                  <tr key={r.id} className="hover:bg-surface-container-lowest transition-colors">
                    <td className="py-4 px-6 text-on-surface">
                      {format(new Date(r.created_at), 'dd MMM yyyy', { locale: idLocale })}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary text-white font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                          {r.avatar_url ? (
                             <img src={r.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                          ) : (
                             (r.username || 'U').charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="text-on-surface font-medium truncate max-w-[150px] block">{r.username}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-semibold text-on-surface">
                      {format(new Date(r.created_at), 'HH:mm')}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider ${r.type === 'check_in' ? 'bg-[#4edea3]/20 text-[#004a31]' : 'bg-[#ffdad6] text-[#93000a]'}`}>
                        {r.type === 'check_in' ? 'Masuk' : 'Pulang'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-on-surface-variant text-xs truncate max-w-[200px]" title={r.address}>
                      {r.address || '-'}
                    </td>
                    <td className="py-4 px-6">
                      {r.verified ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#6ffbbe]/20 text-[#004a31] text-[10px] font-semibold tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00311f]"></span>
                          Wajah Cocok
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error-container/50 text-on-error-container text-[10px] font-semibold tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                          Tidak Cocok
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      
      {/* Hidden Render Area for Export capturing */}
      {records.length > 0 && (
        <div className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none">
           <div ref={exportRef} style={{ width: '800px', height: '550px', backgroundColor: '#ffffff', padding: '24px', paddingBottom: '48px', display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: 'sans-serif' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#00236f', margin: 0 }}>Visualisasi Data Presensi</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', height: '400px' }}>
                 {/* Chart Block */}
                 <div style={{ backgroundColor: '#f9fafb', borderRadius: '12px', padding: '16px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
                   <h3 style={{ fontWeight: 'bold', marginBottom: '16px', fontSize: '14px', color: '#374151', margin: 0 }}>Grafik Tipe Presensi</h3>
                   <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={[
                         { name: 'Masuk', count: records.filter(r => r.type === 'check_in').length },
                         { name: 'Pulang', count: records.filter(r => r.type === 'check_out').length }
                       ]}>
                         <XAxis dataKey="name" fontSize={12} stroke="#6b7280" />
                         <YAxis fontSize={12} stroke="#6b7280" />
                         <Bar dataKey="count">
                           <LabelList dataKey="count" position="top" fill="#374151" fontSize={12} />
                            {
                              [0,1].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? '#00236f' : '#06B6D4'} />
                              ))
                            }
                         </Bar>
                       </BarChart>
                     </ResponsiveContainer>
                   </div>
                 </div>
                 
                 {/* Map Block */}
                 <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e7eb', height: '100%', backgroundColor: '#f3f4f6', display: 'flex', flexDirection: 'column', position: 'relative', boxSizing: 'border-box' }}>
                   <h3 style={{ fontWeight: 'bold', margin: '16px', marginBottom: '8px', fontSize: '14px', color: '#374151', position: 'absolute', zIndex: 9999, backgroundColor: 'rgba(255,255,255,0.9)', padding: '6px 10px', borderRadius: '6px', top: 0, left: 0 }}>Sebaran Lokasi</h3>
                   <MapContainer 
                      center={[mapCenterLat, mapCenterLng]} 
                      zoom={12} 
                      style={{ width: '100%', height: '100%', zIndex: 0 }}
                      zoomControl={false}
                      attributionControl={false}
                   >
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                      {records.map(r => r.latitude && r.longitude ? (
                         <Marker key={r.id} position={[r.latitude, r.longitude]} icon={dotIcon} />
                      ) : null)}
                   </MapContainer>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
