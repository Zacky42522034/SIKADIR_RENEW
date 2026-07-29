import React, { useState, useEffect } from 'react';
import { format, subDays, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { id } from 'date-fns/locale/id';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, MapPin, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

interface HistoryItem {
  id: string;
  date: Date;
  timeIn: string;
  timeOut: string;
  status: string;
  locationIn: string;
  locationOut: string;
  faceImageUrlIn?: string;
  faceImageUrlOut?: string;
}

export default function RiwayatPage() {
  const { user } = useAuth();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const startDate = startOfMonth(currentMonth).toISOString();
        const endDate = endOfMonth(currentMonth).toISOString();
        
        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        const grouped: Record<string, HistoryItem> = {};
        
        data?.forEach(record => {
          const date = new Date(record.created_at);
          const dateStr = format(date, 'yyyy-MM-dd');
          const time = format(date, 'HH:mm');
          
          if (!grouped[dateStr]) {
            grouped[dateStr] = {
              id: dateStr,
              date: date,
              timeIn: record.type === 'check_in' ? time : '-',
              timeOut: record.type === 'check_out' ? time : '-',
              status: 'hadir',
              locationIn: record.type === 'check_in' ? record.address || '-' : '-',
              locationOut: record.type === 'check_out' ? record.address || '-' : '-',
              faceImageUrlIn: record.type === 'check_in' ? record.face_image_url : undefined,
              faceImageUrlOut: record.type === 'check_out' ? record.face_image_url : undefined,
            };
          } else {
            if (record.type === 'check_in') {
              grouped[dateStr].timeIn = time;
              grouped[dateStr].locationIn = record.address || '-';
              if (record.face_image_url) {
                grouped[dateStr].faceImageUrlIn = record.face_image_url;
              }
            } else if (record.type === 'check_out') {
              grouped[dateStr].timeOut = time;
              grouped[dateStr].locationOut = record.address || '-';
              if (record.face_image_url) {
                grouped[dateStr].faceImageUrlOut = record.face_image_url;
              }
            }
          }
        });
        
        const sortedHistory = Object.values(grouped).sort((a, b) => b.date.getTime() - a.date.getTime());
        setHistory(sortedHistory);
      } catch (err) {
        console.error("Error fetching history:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHistory();
  }, [user, currentMonth]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hadir': return 'bg-success text-white';
      case 'terlambat': return 'bg-amber-500 text-white';
      case 'izin': return 'bg-primary text-white';
      case 'sakit': return 'bg-purple-500 text-white';
      case 'alpa': return 'bg-danger text-white';
      default: return 'bg-gray-200 text-gray-700';
    }
  };

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case 'hadir': return 'bg-success';
      case 'terlambat': return 'bg-amber-500';
      case 'izin': return 'bg-primary';
      case 'sakit': return 'bg-purple-500';
      case 'alpa': return 'bg-danger';
      default: return 'bg-gray-300';
    }
  };

  const prevMonth = () => setCurrentMonth(subDays(startOfMonth(currentMonth), 1));
  const nextMonth = () => setCurrentMonth(addDays(endOfMonth(currentMonth), 1));

  return (
    <div className="flex flex-col h-full bg-surface w-full max-w-[600px] lg:max-w-none mx-auto pb-4">
      <h1 className="text-2xl font-bold text-primary font-jakarta mb-6">Riwayat Presensi</h1>

      {/* Tabs */}
      <div className="flex bg-surface-container-low p-1 rounded-xl mb-6 shadow-inner">
        <button
          onClick={() => setView('list')}
          className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'list' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          <List size={18} /> Daftar
        </button>
        <button
          onClick={() => setView('calendar')}
          className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'calendar' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          <CalendarIcon size={18} /> Kalender
        </button>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-outline-variant/20 mb-6">
        <button onClick={prevMonth} className="p-2 hover:bg-surface-container-low rounded-lg transition-colors">
          <ChevronLeft size={20} />
        </button>
        <span className="font-bold text-on-surface font-jakarta">
          {format(currentMonth, 'MMMM yyyy', { locale: id })}
        </span>
        <button onClick={nextMonth} className="p-2 hover:bg-surface-container-low rounded-lg transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* View Content */}
      <div className="flex-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
            <p className="text-on-surface-variant text-sm">Memuat riwayat presensi...</p>
          </div>
        ) : view === 'list' ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {history.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-outline-variant/20">
                <p className="text-on-surface-variant">Belum ada riwayat presensi pada bulan ini.</p>
              </div>
            ) : (
              history.map((record) => (
                <div key={record.id} className="bg-white p-4 rounded-2xl shadow-sm border border-outline-variant/20 flex flex-col gap-3">
                <div className="flex justify-between items-center border-b border-outline-variant/20 pb-3">
                  <span className="font-medium text-sm text-on-surface font-jakarta">
                    {format(record.date, 'EEEE, dd MMM yyyy', { locale: id })}
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${getStatusColor(record.status)}`}>
                    {record.status}
                  </span>
                </div>
                <div className="flex flex-col gap-4 mt-1">
                  {/* Absen Masuk */}
                  <div className="flex items-start gap-3">
                    {record.faceImageUrlIn ? (
                      <a href={record.faceImageUrlIn} target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-xl overflow-hidden border border-outline-variant/30 flex-shrink-0 block hover:opacity-80 transition-opacity mt-1">
                        <img src={record.faceImageUrlIn} alt="Foto Masuk" className="w-full h-full object-cover" />
                      </a>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-surface-variant/50 border border-outline-variant/30 flex-shrink-0 mt-1" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-on-surface-variant font-medium">Masuk</p>
                      <p className="font-bold text-lg text-primary">{record.timeIn}</p>
                      {record.locationIn !== '-' && (
                        <div className="flex items-start gap-1 text-[11px] text-on-surface-variant mt-1 leading-tight">
                          <MapPin size={12} className="shrink-0 mt-0.5 text-primary" /> 
                          <span className="line-clamp-2">{record.locationIn}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="w-full h-px bg-outline-variant/10"></div>

                  {/* Absen Keluar */}
                  <div className="flex items-start gap-3">
                    {record.faceImageUrlOut ? (
                      <a href={record.faceImageUrlOut} target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-xl overflow-hidden border border-outline-variant/30 flex-shrink-0 block hover:opacity-80 transition-opacity mt-1">
                        <img src={record.faceImageUrlOut} alt="Foto Keluar" className="w-full h-full object-cover" />
                      </a>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-surface-variant/50 border border-outline-variant/30 flex-shrink-0 mt-1" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-on-surface-variant font-medium">Keluar</p>
                      <p className="font-bold text-lg text-on-surface">{record.timeOut}</p>
                      {record.locationOut !== '-' && (
                        <div className="flex items-start gap-1 text-[11px] text-on-surface-variant mt-1 leading-tight">
                          <MapPin size={12} className="shrink-0 mt-0.5 text-on-surface" /> 
                          <span className="line-clamp-2">{record.locationOut}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-outline-variant/20 animate-in fade-in zoom-in-95 duration-300">
            <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-bold text-on-surface-variant">
              <div>Sen</div><div>Sel</div><div>Rab</div><div>Kam</div><div>Jum</div><div>Sab</div><div>Min</div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {daysInMonth.map((day, i) => {
                const historyRecord = history.find(h => isSameDay(h.date, day));
                const statusDot = historyRecord ? getStatusDotColor(historyRecord.status) : 'bg-transparent';
                
                return (
                  <div key={i} className="aspect-square flex flex-col items-center justify-center p-1 relative hover:bg-surface-container-low rounded-lg cursor-pointer transition-colors">
                    <span className={`text-sm ${isSameDay(day, new Date()) ? 'bg-primary text-white w-7 h-7 flex items-center justify-center rounded-full font-bold' : ''}`}>
                      {format(day, 'd')}
                    </span>
                    <div className={`w-1.5 h-1.5 rounded-full mt-1 ${statusDot}`} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
