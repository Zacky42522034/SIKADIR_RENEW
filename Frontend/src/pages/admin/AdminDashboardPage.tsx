import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  FileText, 
  Stethoscope, 
  XCircle, 
  MapPin, 
  UserCheck, 
  Award, 
  TrendingUp,
  Clock,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale/id';

export default function AdminDashboardPage() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState({
    hadir: 0,
    izin: 0,
    sakit: 0,
    alpa: 0,
    totalEmployees: 0
  });

  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [topEmployees, setTopEmployees] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ day: string; count: number; max: number }[]>([]);

  useEffect(() => {
    fetchDashboardData(selectedDate);
  }, [selectedDate]);

  const fetchDashboardData = async (targetDateStr: string) => {
    setLoading(true);
    try {
      // 1. Fetch total employees count
      const { data: profiles, error: profileErr } = await supabase
        .from('profiles')
        .select('id, username, avatar_url');
      
      const totalEmployeesCount = profiles ? profiles.length : 0;
      const profileMap: Record<string, any> = {};
      if (profiles) {
        profiles.forEach(p => {
          profileMap[p.id] = p;
        });
      }

      // 2. Fetch attendance for selected date
      const targetDateParts = targetDateStr.split('-');
      const targetYear = parseInt(targetDateParts[0]);
      const targetMonth = parseInt(targetDateParts[1]) - 1;
      const targetDateNum = parseInt(targetDateParts[2]);
      
      const startOfDay = new Date(targetYear, targetMonth, targetDateNum, 0, 0, 0).toISOString();
      const endOfDay = new Date(targetYear, targetMonth, targetDateNum, 23, 59, 59, 999).toISOString();

      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('created_at', { ascending: false });

      // 3. Fetch leaves covering selected date
      const { data: leaveData } = await supabase
        .from('leave_requests')
        .select('*')
        .in('status', ['approved', 'pending'])
        .lte('start_date', targetDateStr)
        .gte('end_date', targetDateStr);

      let izinCount = 0;
      let sakitCount = 0;
      const leaveUserIds = new Set<string>();

      if (leaveData) {
        leaveData.forEach(l => {
          leaveUserIds.add(l.user_id);
          if (l.type === 'izin') izinCount++;
          else if (l.type === 'sakit') sakitCount++;
        });
      }

      // Count unique hadir users (check_in) not on leave
      const hadirUserIds = new Set<string>();
      if (attendanceData) {
        attendanceData.forEach(att => {
          if (att.type === 'check_in' && !leaveUserIds.has(att.user_id)) {
            hadirUserIds.add(att.user_id);
          }
        });
      }

      const hadirCount = hadirUserIds.size;
      const alpaCount = Math.max(0, totalEmployeesCount - (hadirCount + izinCount + sakitCount));

      setStats({
        hadir: hadirCount,
        izin: izinCount,
        sakit: sakitCount,
        alpa: alpaCount,
        totalEmployees: totalEmployeesCount
      });

      // 4. Format Recent Table Logs
      if (attendanceData) {
        // Filter out attendance records if the user is on leave today
        const validAttendance = attendanceData.filter(att => !leaveUserIds.has(att.user_id));
        
        const formattedLogs = validAttendance.slice(0, 5).map(att => {
          const u = profileMap[att.user_id] || {};
          const name = u.username || u.email || 'Pengguna';
          const avatar = u.avatar_url;
          return {
            id: att.id,
            name,
            avatar,
            time: format(new Date(att.created_at), 'HH:mm'),
            type: att.type === 'check_in' ? 'Masuk' : 'Pulang',
            verified: att.verified ?? true,
            location: att.address || `${att.latitude?.toFixed(4)}, ${att.longitude?.toFixed(4)}` || 'Lokasi Terdaftar'
          };
        });
        setRecentLogs(formattedLogs);
      } else {
        setRecentLogs([]);
      }

      // 5. Calculate Weekly Attendance Chart Data (Last 5 Days leading to selected date or Mon-Fri)
      const daysOfWeek = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const curr = new Date(targetDateStr);
      const weeklyStats: { day: string; count: number; max: number }[] = [];

      for (let i = 4; i >= 0; i--) {
        const d = new Date(curr);
        d.setDate(d.getDate() - i);
        const dYear = d.getFullYear();
        const dMonth = d.getMonth();
        const dDate = d.getDate();
        const dStr = `${dYear}-${String(dMonth + 1).padStart(2, '0')}-${String(dDate).padStart(2, '0')}`;
        
        const dayStart = new Date(dYear, dMonth, dDate, 0, 0, 0).toISOString();
        const dayEnd = new Date(dYear, dMonth, dDate, 23, 59, 59, 999).toISOString();

        const { data: dayAtt } = await supabase
          .from('attendance')
          .select('user_id')
          .eq('type', 'check_in')
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd);

        const { data: dayLeaves } = await supabase
          .from('leave_requests')
          .select('user_id')
          .in('status', ['approved', 'pending'])
          .lte('start_date', dStr)
          .gte('end_date', dStr);
          
        const dayLeaveUsers = new Set(dayLeaves?.map(l => l.user_id) || []);
        
        const validUsers = new Set<string>();
        if (dayAtt) {
          dayAtt.forEach(a => {
            if (!dayLeaveUsers.has(a.user_id)) {
              validUsers.add(a.user_id);
            }
          });
        }

        weeklyStats.push({
          day: daysOfWeek[d.getDay()],
          count: validUsers.size,
          max: totalEmployeesCount || 1
        });
      }
      setWeeklyData(weeklyStats);

      // 6. Karyawan Terbaik (Top Users by attendance count this month, excluding leaves)
      const firstDayParts = targetDateStr.split('-');
      const firstDayOfMonth = new Date(parseInt(firstDayParts[0]), parseInt(firstDayParts[1]) - 1, 1, 0, 0, 0).toISOString();
      const firstDayOfMonthStr = `${targetDateStr.substring(0, 7)}-01`;
      
      const { data: monthAtt } = await supabase
        .from('attendance')
        .select('user_id, created_at')
        .eq('type', 'check_in')
        .gte('created_at', firstDayOfMonth);
        
      const { data: monthLeaves } = await supabase
        .from('leave_requests')
        .select('user_id, start_date, end_date')
        .in('status', ['approved', 'pending'])
        .gte('end_date', firstDayOfMonthStr);

      if (monthAtt && profiles) {
        const userValidDays: Record<string, Set<string>> = {};
        profiles.forEach(p => userValidDays[p.id] = new Set());
        
        monthAtt.forEach(a => {
          const attD = new Date(a.created_at);
          const attLocalStr = `${attD.getFullYear()}-${String(attD.getMonth() + 1).padStart(2, '0')}-${String(attD.getDate()).padStart(2, '0')}`;
          
          const isOverlapping = monthLeaves?.some(l => 
            l.user_id === a.user_id &&
            attLocalStr >= l.start_date &&
            attLocalStr <= l.end_date
          );
          
          if (!isOverlapping && userValidDays[a.user_id]) {
            userValidDays[a.user_id].add(attLocalStr);
          }
        });

        const sortedProfiles = [...profiles].map(p => {
          const count = userValidDays[p.id]?.size || 0;
          return {
            ...p,
            attendanceCount: count,
            rate: Math.min(100, Math.round((count / 22) * 100)) || 100 // assuming 22 working days
          };
        }).filter(p => p.attendanceCount > 0)
          .sort((a, b) => b.attendanceCount - a.attendanceCount)
          .slice(0, 5);

        setTopEmployees(sortedProfiles);
      }

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formattedHeaderDate = (() => {
    try {
      const parts = selectedDate.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return format(d, 'EEEE, d MMMM yyyy', { locale: id });
    } catch {
      return selectedDate;
    }
  })();

  const totalTracked = stats.hadir + stats.izin + stats.sakit + stats.alpa;
  const hadirPercentage = totalTracked > 0 ? Math.round((stats.hadir / totalTracked) * 100) : 0;

  return (
    <div className="p-4 lg:p-8 flex flex-col h-full bg-surface">
      {/* Header area */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white shadow-sm border border-outline-variant/20 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary font-jakarta">Ringkasan Dasbor</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">{formattedHeaderDate}</p>
        </div>
        
        {/* Interactive Date Picker */}
        <div className="flex items-center bg-surface-container-low rounded-xl border border-outline-variant/30 px-3.5 py-2 hover:border-primary transition-colors shadow-sm">
          <CalendarIcon className="w-4 h-4 text-primary mr-2.5 shrink-0" />
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-sm font-semibold text-on-surface outline-none cursor-pointer"
          />
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3 text-primary">
            <Loader2 className="w-10 h-10 animate-spin" />
            <span className="text-sm font-semibold">Memuat data dasbor...</span>
          </div>
        </div>
      ) : (
        <div className="space-y-6 flex-1">
          {/* Top Row: Stat Cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Total Hadir */}
            <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,31,111,0.04)] border border-outline-variant/20 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="p-2.5 bg-success/10 text-success rounded-xl">
                  <CheckCircle2 size={24} />
                </div>
                <span className="bg-success/10 text-success text-xs font-bold px-2.5 py-1 rounded-full">Hadir</span>
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total Hadir</p>
                <p className="text-3xl font-bold tracking-tight text-on-surface mt-1 font-jakarta">{stats.hadir}</p>
              </div>
            </div>
            
            {/* Izin */}
            <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,31,111,0.04)] border border-outline-variant/20 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="p-2.5 bg-secondary/10 text-secondary rounded-xl">
                  <FileText size={24} />
                </div>
                <span className="bg-secondary/10 text-secondary text-xs font-bold px-2.5 py-1 rounded-full">Izin</span>
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total Izin</p>
                <p className="text-3xl font-bold tracking-tight text-on-surface mt-1 font-jakarta">{stats.izin}</p>
              </div>
            </div>
            
            {/* Sakit */}
            <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,31,111,0.04)] border border-outline-variant/20 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl">
                  <Clock size={24} />
                </div>
                <span className="bg-amber-500/10 text-amber-600 text-xs font-bold px-2.5 py-1 rounded-full">Sakit</span>
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total Sakit</p>
                <p className="text-3xl font-bold tracking-tight text-on-surface mt-1 font-jakarta">{stats.sakit}</p>
              </div>
            </div>

            {/* Alpa */}
            <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,31,111,0.04)] border border-outline-variant/20 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="p-2.5 bg-danger/10 text-danger rounded-xl">
                  <XCircle size={24} />
                </div>
                <span className="bg-danger/10 text-danger text-xs font-bold px-2.5 py-1 rounded-full">Alpa</span>
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Belum Presensi</p>
                <p className="text-3xl font-bold tracking-tight text-on-surface mt-1 font-jakarta">{stats.alpa}</p>
              </div>
            </div>
          </section>

          {/* Middle Row: Charts */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Bar Chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,31,111,0.04)] border border-outline-variant/20 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-on-surface font-jakarta">Grafik Kehadiran Mingguan</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">Jumlah kehadiran unik per hari</p>
                </div>
                <div className="p-2 bg-primary/5 text-primary rounded-lg">
                  <TrendingUp size={20} />
                </div>
              </div>

              <div className="h-60 w-full bg-surface-container-lowest flex items-end justify-around pb-6 rounded-xl px-6 pt-8 relative border border-outline-variant/10">
                {weeklyData.map((item, idx) => {
                  const heightPercent = item.count === 0 ? 0 : (item.max > 0 ? Math.max(10, Math.round((item.count / item.max) * 100)) : 10);
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end group">
                      <span className="text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.count} org
                      </span>
                      <div 
                        className="w-12 bg-gradient-to-t from-primary to-accent rounded-t-lg transition-all duration-500 hover:brightness-110"
                        style={{ height: `${heightPercent}%` }}
                      />
                      <span className="text-xs font-semibold text-on-surface-variant">{item.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Donut & Top Employees */}
            <div className="flex flex-col gap-6">
              {/* Distribution */}
              <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,31,111,0.04)] border border-outline-variant/20 flex flex-col">
                <h3 className="text-base font-bold text-on-surface font-jakarta mb-4">Persentase Kehadiran</h3>
                <div className="flex-1 flex items-center justify-center relative py-2">
                  <div 
                    className="w-36 h-36 rounded-full border-[10px] border-surface-container relative flex items-center justify-center shadow-inner"
                    style={{ background: `conic-gradient(#00236f 0% ${hadirPercentage}%, #e2e8f0 ${hadirPercentage}% 100%)` }}
                  >
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center flex-col shadow-md">
                      <span className="text-2xl font-bold tracking-tight text-primary font-jakarta">{hadirPercentage}%</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Hadir</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex justify-around text-xs font-semibold text-on-surface-variant border-t border-outline-variant/10 pt-3">
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary"></span> Hadir</div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-secondary"></span> Izin</div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Sakit</div>
                </div>
              </div>

              {/* Karyawan Terbaik */}
              <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,31,111,0.04)] border border-outline-variant/20 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-bold text-on-surface font-jakarta">Karyawan Ter-Rajin</h3>
                </div>
                
                <div className="space-y-3.5 flex-1">
                  {topEmployees.length > 0 ? (
                    topEmployees.map((emp, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                            {emp.avatar_url ? (
                              <img src={emp.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              (emp.username || 'U').charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className="text-xs font-semibold text-on-surface truncate">{emp.username || 'Pengguna'}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-primary">{emp.attendanceCount} Absen</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-on-surface-variant text-center py-4">Belum ada data kehadiran bulan ini.</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Bottom Section: Tabel Kehadiran Terbaru */}
          <section className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,31,111,0.04)] border border-outline-variant/20 overflow-hidden">
            <div className="p-5 border-b border-outline-variant/10 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-on-surface font-jakarta">Catatan Presensi Tanggal Terpilih</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">Daftar presensi karyawan pada {formattedHeaderDate}</p>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant/10 text-xs uppercase tracking-wider font-semibold">
                    <th className="p-4 px-6">Nama Karyawan</th>
                    <th className="p-4 px-6">Waktu</th>
                    <th className="p-4 px-6">Tipe</th>
                    <th className="p-4 px-6">Verifikasi</th>
                    <th className="p-4 px-6">Lokasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {recentLogs.length > 0 ? (
                    recentLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-surface-container-lowest transition-colors">
                        <td className="p-4 px-6 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs overflow-hidden shrink-0">
                            {log.avatar ? (
                              <img src={log.avatar} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              log.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className="text-on-surface font-semibold text-sm">{log.name}</span>
                        </td>
                        <td className="p-4 px-6 text-on-surface-variant text-sm font-medium">{log.time} WIB</td>
                        <td className="p-4 px-6">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            log.type === 'Masuk' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'
                          }`}>
                            {log.type}
                          </span>
                        </td>
                        <td className="p-4 px-6">
                          {log.verified ? (
                            <span className="bg-success/10 text-success px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
                              <CheckCircle2 size={12} /> Wajah Cocok
                            </span>
                          ) : (
                            <span className="bg-danger/10 text-danger px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
                              <XCircle size={12} /> Tidak Cocok
                            </span>
                          )}
                        </td>
                        <td className="p-4 px-6 text-on-surface-variant text-xs flex items-center gap-1 max-w-xs truncate">
                          <MapPin size={14} className="text-primary shrink-0" />
                          <span className="truncate">{log.location}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-sm text-on-surface-variant">
                        Tidak ada catatan presensi untuk tanggal terpilih ({formattedHeaderDate}).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
