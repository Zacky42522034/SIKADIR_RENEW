import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { FileText, Clock, CheckCircle2, XCircle, Upload, Calendar, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { id } from 'date-fns/locale/id';

export default function IzinPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [izinType, setIzinType] = useState<'izin' | 'sakit'>('izin');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const fetchHistory = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    if (location.state?.tab === 'history') {
      setActiveTab('history');
    }
  }, [user, location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    // Check limit: 1 per day
    const hasSubmittedToday = history.some(item => {
      const createdDate = new Date(item.created_at);
      const createdStr = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}-${String(createdDate.getDate()).padStart(2, '0')}`;
      return createdStr === todayStr;
    });
    
    if (hasSubmittedToday) {
      toast.error('Anda sudah mengajukan izin/sakit hari ini. Maksimal 1 pengajuan per hari.');
      return;
    }
    
    // Validasi Manual
    if (!startDate) {
      toast.error('Dari Tanggal tidak boleh kosong!');
      return;
    }
    if (startDate < todayStr) {
      toast.error('Dari Tanggal tidak boleh sebelum hari ini!');
      return;
    }
    if (!endDate) {
      toast.error('Sampai Tanggal tidak boleh kosong!');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error('Sampai Tanggal tidak boleh sebelum Dari Tanggal!');
      return;
    }
    if (!reason.trim()) {
      toast.error('Keterangan / Alasan tidak boleh kosong!');
      return;
    }
    if (!file) {
      toast.error('Lampiran foto wajib diunggah!');
      return;
    }

    setIsSubmitting(true);
    
    try {
      let attachmentUrl = null;
      if (file) {
        const filePath = `${user.id}/izin_${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('leave-requests')
          .upload(filePath, file);
        
        if (!uploadError) {
          const { data } = supabase.storage.from('leave-requests').getPublicUrl(filePath);
          attachmentUrl = data.publicUrl;
        }
      }

      const { data, error } = await supabase.from('leave_requests').insert({
        user_id: user.id,
        type: izinType,
        start_date: startDate,
        end_date: endDate,
        reason: reason,
        attachment_url: attachmentUrl,
        status: 'pending'
      }).select();

      if (error) throw error;

      // Send to Telegram
      const TELEGRAM_BOT_TOKEN = "8650236021:AAFdpceCmZmVOUC5cSeIasyK91PN1nj_U1I";
      const TELEGRAM_CHAT_ID = "976523107";
      const fullName = user.user_metadata?.full_name || user.email;
      const msgType = izinType.toUpperCase();
      
      // We need the inserted ID for the callback data
      const leaveId = data && data[0] ? data[0].id : '';
      
      const message = `*PENGAJUAN IZIN BARU*\n\n👤 *Nama:* ${fullName}\n📄 *Tipe:* ${msgType}\n📅 *Tanggal:* ${startDate} s/d ${endDate}\n📝 *Alasan:* ${reason}`;
      
      const replyMarkup = {
        inline_keyboard: [
          [
            { text: "✅ Setujui", callback_data: `approve_${leaveId}` },
            { text: "❌ Tolak", callback_data: `reject_${leaveId}` }
          ]
        ]
      };

      if (file) {
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('photo', file);
        formData.append('caption', message);
        formData.append('parse_mode', 'Markdown');
        formData.append('reply_markup', JSON.stringify(replyMarkup));

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
          method: 'POST',
          body: formData
        }).catch(e => console.error("Telegram error", e));
      } else {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown',
            reply_markup: replyMarkup
          })
        }).catch(e => console.error("Telegram error", e));
      }

      toast.success('Pengajuan berhasil dikirim!');
      setStartDate('');
      setEndDate('');
      setReason('');
      setFile(null);
      
      // Minta izin notifikasi jika belum diberikan (agar bisa dapat notifikasi saat disetujui)
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      
      fetchHistory();
      setActiveTab('history');
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengirim pengajuan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-success/10 text-success"><CheckCircle2 size={12}/> Disetujui</span>;
      case 'pending':
        return <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-amber-500/10 text-amber-600"><Clock size={12}/> Menunggu</span>;
      case 'rejected':
        return <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-danger/10 text-danger"><XCircle size={12}/> Ditolak</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface w-full max-w-[600px] lg:max-w-none mx-auto pb-4">
      <h1 className="text-2xl font-bold text-primary font-jakarta mb-6">Pengajuan Izin</h1>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant/30 mb-6">
        <button
          onClick={() => setActiveTab('form')}
          className={`flex-1 py-3 text-sm font-bold transition-all relative ${
            activeTab === 'form' ? 'text-primary' : 'text-on-surface-variant'
          }`}
        >
          Ajukan Izin
          {activeTab === 'form' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 text-sm font-bold transition-all relative ${
            activeTab === 'history' ? 'text-primary' : 'text-on-surface-variant'
          }`}
        >
          Riwayat Pengajuan
          {activeTab === 'history' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
          )}
        </button>
      </div>

      {activeTab === 'form' ? (
        <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300" autoComplete="off">
          {/* Type Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div 
              onClick={() => setIzinType('izin')}
              className={`p-4 rounded-2xl border-2 cursor-pointer flex flex-col items-center gap-2 transition-all ${
                izinType === 'izin' ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant/30 bg-white text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              <FileText size={32} />
              <span className="font-bold">Izin</span>
            </div>
            <div 
              onClick={() => setIzinType('sakit')}
              className={`p-4 rounded-2xl border-2 cursor-pointer flex flex-col items-center gap-2 transition-all ${
                izinType === 'sakit' ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant/30 bg-white text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              <Upload size={32} />
              <span className="font-bold">Sakit</span>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Dari Tanggal</label>
              <div className="relative">
                <input 
                  type="date" 
                  min={todayStr}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-3 pl-10 rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-white text-sm" 
                />
                <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Sampai Tanggal</label>
              <div className="relative">
                <input 
                  type="date" 
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-3 pl-10 rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-white text-sm" 
                />
                <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              </div>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Keterangan / Alasan</label>
            <textarea 
              rows={4} 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan alasan izin Anda..."
              className="w-full p-3 rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-white text-sm resize-none" 
            />
          </div>

          {/* Attachment */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Lampiran (Foto Surat Dokter, dll)</label>
            <label className="border-2 border-dashed border-outline-variant/40 rounded-xl p-6 flex flex-col items-center justify-center bg-white/50 hover:bg-surface-container-low transition-colors cursor-pointer block">
              <Upload className="text-primary mb-2" size={24} />
              <p className="text-sm font-medium text-primary text-center">
                {file ? file.name : "Tap untuk upload foto"}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">Hanya file gambar (Maks. 5MB)</p>
              <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-primary text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-primary-container transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
          >
            {isSubmitting ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Kirim Pengajuan'
            )}
          </button>
        </form>
      ) : (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
              <p className="text-on-surface-variant text-sm">Memuat riwayat...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-outline-variant/20">
              <p className="text-on-surface-variant">Belum ada riwayat pengajuan izin.</p>
            </div>
          ) : (
            history.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-outline-variant/20">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${item.type === 'sakit' ? 'bg-purple-500/10 text-purple-600' : 'bg-primary/10 text-primary'}`}>
                      {item.type === 'sakit' ? <Upload size={16} /> : <FileText size={16} />}
                    </div>
                    <h3 className="font-bold text-on-surface font-jakarta capitalize">{item.type}</h3>
                  </div>
                  {getStatusBadge(item.status)}
                </div>
                
                <div className="text-sm text-on-surface-variant mt-3 space-y-1">
                  <p><span className="font-medium">Tanggal:</span> {format(new Date(item.start_date), 'dd MMM yyyy', { locale: id })} s/d {format(new Date(item.end_date), 'dd MMM yyyy', { locale: id })}</p>
                  <p><span className="font-medium">Alasan:</span> {item.reason}</p>
                  {item.attachment_url && (
                    <p className="mt-2">
                      <a href={item.attachment_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium flex items-center gap-1">
                        Lihat Lampiran
                      </a>
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
