import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { id } from 'date-fns/locale/id';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Camera, MapPin, CheckCircle2, ChevronRight, X, Loader2, Navigation, Calendar } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { verifyFace } from '../../lib/deepface';
import toast from 'react-hot-toast';

// Fix Leaflet default icon issue
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const customMarkerIcon = new L.Icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

type Step = 1 | 2 | 3 | 4 | 5;

export default function PresensiPage() {
  const navigate = useNavigate();
  const reactLocation = useLocation();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>('Mencari alamat...');
  const [isVerifying, setIsVerifying] = useState(false);
  const [gpsError, setGpsError] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const [attendanceType, setAttendanceType] = useState<'check_in' | 'check_out' | 'done' | 'on_leave' | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [watermarkedPhotoBlob, setWatermarkedPhotoBlob] = useState<Blob | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Check attendance status for today
  useEffect(() => {
    const fetchTodayStatus = async () => {
      if (!user) return;
      
      // If navigated with state, use it initially to prevent flicker, but still verify
      if (reactLocation.state?.type) {
        setAttendanceType(reactLocation.state.type);
      }

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      try {
        // Check for active leave today
        const { data: leaveData } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['approved', 'pending'])
          .lte('start_date', todayStr)
          .gte('end_date', todayStr);

        if (leaveData && leaveData.length > 0) {
          setAttendanceType('on_leave');
          return;
        }

        const { data } = await supabase
          .from('attendance')
          .select('type')
          .eq('user_id', user.id)
          .gte('created_at', startOfDay.toISOString());

        if (data) {
          const hasCheckIn = data.some(d => d.type === 'check_in');
          const hasCheckOut = data.some(d => d.type === 'check_out');
          
          if (hasCheckIn && hasCheckOut) {
            setAttendanceType('done');
          } else if (hasCheckIn) {
            setAttendanceType('check_out');
          } else {
            setAttendanceType('check_in');
          }
        }
      } catch (e) {
        console.error("Error fetching today status", e);
      } finally {
        setIsCheckingStatus(false);
      }
    };
    
    fetchTodayStatus();
  }, [user, reactLocation.state]);

  // Step 1: Camera Logic
  useEffect(() => {
    if (step === 1 && !isCheckingStatus && attendanceType !== 'done' && attendanceType !== 'on_leave') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [step, isCheckingStatus, attendanceType]);
  
  // Extra cleanup for unmount navigation
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setCameraActive(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("Akses kamera ditolak. Mohon izinkan kamera untuk menggunakan fitur ini.", { id: 'camera-error' });
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    } else if (videoRef.current && videoRef.current.srcObject) {
      const mediaStream = videoRef.current.srcObject as MediaStream;
      mediaStream.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      setIsVerifying(true);
      const video = videoRef.current;
      video.pause();
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setPhoto(dataUrl);
        
        if (user && user.face_image_path) {
          try {
            // Verify with DeepFace Python backend
            const result = await verifyFace(dataUrl, user.face_image_path);
            if (result.verified) {
              setIsVerifying(false);
              setStep(2);
            } else {
              toast.error("Wajah tidak cocok!");
              setPhoto(null);
              setIsVerifying(false);
              video.play();
            }
          } catch (error: any) {
            toast.error("Error verifikasi wajah: " + error.message);
            setPhoto(null);
            setIsVerifying(false);
            video.play();
          }
        } else {
          toast.error("Anda belum mendaftarkan data wajah. Silakan hubungi admin.");
          setPhoto(null);
          setIsVerifying(false);
          video.play();
        }
      }
    }
  };

  // Step 2: GPS Logic
  const requestGPS = () => {
    setGpsError(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLocation({ lat, lng });
        
        // Reverse geocoding
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
          .then(res => res.json())
          .then(data => {
            setAddress(data.display_name || 'Alamat tidak ditemukan');
            setTimeout(() => setStep(3), 1000);
          })
          .catch(() => {
            setAddress('Gagal memuat alamat');
            setTimeout(() => setStep(3), 1000);
          });
      },
      (error) => {
        console.error("GPS Error:", error);
        toast.error("Akses lokasi ditolak. Mohon izinkan akses lokasi Anda.");
        setGpsError(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (step === 2) {
      requestGPS();
    }
  }, [step]);

  const generateWatermark = async () => {
    if (!photo || !location || !address) return;
    
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(); return; }
        
        ctx.drawImage(img, 0, 0);
        
        // Configuration - Scaled down
        const boxHeight = 100;
        const margin = 10;
        const boxY = img.height - boxHeight - margin;
        
        // Draw semi-transparent dark box
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(margin, boxY, img.width - (margin * 2), boxHeight, 12);
        } else {
          ctx.fillRect(margin, boxY, img.width - (margin * 2), boxHeight); 
        }
        ctx.fill();
        
        // Draw white icon box
        const iconBoxSize = 75;
        const iconBoxX = margin + 10;
        const iconBoxY = boxY + (boxHeight - iconBoxSize) / 2;
        
        ctx.fillStyle = 'white';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(iconBoxX, iconBoxY, iconBoxSize, iconBoxSize, 8);
        } else {
          ctx.fillRect(iconBoxX, iconBoxY, iconBoxSize, iconBoxSize);
        }
        ctx.fill();
        
        const drawText = () => {
          const textX = iconBoxX + iconBoxSize + 15;
          const maxWidth = img.width - textX - margin - 10;
          
          const addressParts = address.split(', ');
          const district = addressParts.length > 2 ? addressParts[0] + ', ' + addressParts[addressParts.length - 1] : address;
          
          // Top line: Short Location
          ctx.fillStyle = 'white';
          ctx.font = 'bold 15px sans-serif';
          ctx.fillText(district, textX, boxY + 25, maxWidth);
          
          // Second line: Detailed address
          ctx.font = '11px sans-serif';
          ctx.fillStyle = '#e2e8f0';
          const words = address.split(' ');
          let line = '';
          let yPos = boxY + 42;
          let lineCount = 0;
          
          for(let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
              ctx.fillText(line, textX, yPos);
              line = words[n] + ' ';
              yPos += 16;
              lineCount++;
              if (lineCount >= 2) break;
            } else {
              line = testLine;
            }
          }
          if (lineCount < 2) ctx.fillText(line, textX, yPos);
          
          // Third line: Lat Lng (Koordinat Peta)
          yPos += 20;
          ctx.font = 'bold 12px monospace';
          ctx.fillStyle = '#fca5a5'; 
          ctx.fillText(`Koordinat: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`, textX, yPos);
          
          // Fourth line: DateTime
          yPos += 18;
          ctx.font = '12px sans-serif';
          ctx.fillStyle = '#fef08a';
          ctx.fillText(format(new Date(), "dd/MM/yyyy, HH.mm.ss"), textX, yPos);
          
          // Save Blob to state (DO NOT overwrite photo state to hide it from UI)
          canvas.toBlob((blob) => {
            if (blob) setWatermarkedPhotoBlob(blob);
            resolve();
          }, 'image/jpeg', 0.92);
        };

        // Fetch map tile for location thumbnail
        const z = 15;
        const n = Math.pow(2, z);
        const exactX = ((location.lng + 180) / 360) * n;
        const exactY = (1 - (Math.log(Math.tan(location.lat * Math.PI / 180) + 1 / Math.cos(location.lat * Math.PI / 180)) / Math.PI)) / 2 * n;
        
        const tileX = Math.floor(exactX);
        const tileY = Math.floor(exactY);
        const pixelX = Math.floor((exactX - tileX) * 256);
        const pixelY = Math.floor((exactY - tileY) * 256);
        
        const mapUrl = `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${tileX}/${tileY}.png`;

        const mapImg = new Image();
        mapImg.crossOrigin = 'Anonymous';
        mapImg.onload = () => {
           ctx.save();
           
           // Clip to rounded box
           ctx.beginPath();
           if (ctx.roundRect) ctx.roundRect(iconBoxX, iconBoxY, iconBoxSize, iconBoxSize, 8);
           else ctx.fillRect(iconBoxX, iconBoxY, iconBoxSize, iconBoxSize);
           ctx.clip();
           
           // Background fallback
           ctx.fillStyle = '#e2e8f0';
           ctx.fill();

           // Draw the map tile
           const destX = iconBoxX + (iconBoxSize / 2) - pixelX;
           const destY = iconBoxY + (iconBoxSize / 2) - pixelY;
           ctx.drawImage(mapImg, destX, destY, 256, 256);
           
           // Draw center marker dot
           ctx.fillStyle = '#ef4444';
           ctx.beginPath();
           ctx.arc(iconBoxX + iconBoxSize / 2, iconBoxY + iconBoxSize / 2, 6, 0, Math.PI * 2);
           ctx.fill();
           ctx.strokeStyle = 'white';
           ctx.lineWidth = 2;
           ctx.stroke();

           ctx.restore();
           drawText();
        };
        mapImg.onerror = () => { 
           // Fallback to pin if map fails to load
           const pinImg = new Image();
           pinImg.onload = () => {
              const pinW = 30;
              const pinH = 48;
              ctx.drawImage(pinImg, iconBoxX + (iconBoxSize - pinW)/2, iconBoxY + (iconBoxSize - pinH)/2 - 4, pinW, pinH);
              drawText();
           };
           pinImg.onerror = () => drawText();
           pinImg.src = customMarkerIcon.options.iconUrl || '';
        };
        mapImg.src = mapUrl;
      };
      img.src = photo;
    });
  };

  const handleConfirmLocation = () => {
    // Generate watermark asynchronously, don't wait/block the UI
    generateWatermark();
    setStep(4);
  };

  const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    const match = arr[0].match(/:(.*?);/);
    const mime = match ? match[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const handleSubmit = async () => {
    try {
      if (!user) throw new Error("Anda belum login");
      
      let faceImageUrl = null;
      if (watermarkedPhotoBlob || photo) {
        try {
          const fileBlob = watermarkedPhotoBlob || dataURLtoBlob(photo!);
          const filePath = `${user.id}/attendance_${Date.now()}.jpg`;
          
          const { error: uploadError } = await supabase.storage
            .from('attendance')
            .upload(filePath, fileBlob);
            
          if (uploadError) {
            console.error("Failed to upload attendance photo:", uploadError);
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from('attendance')
              .getPublicUrl(filePath);
            faceImageUrl = publicUrl;
          }
        } catch (e) {
          console.error("Error preparing photo upload:", e);
        }
      }
      
      const { error } = await supabase.from('attendance').insert({
        user_id: user.id,
        type: attendanceType === 'done' ? 'check_out' : attendanceType, // fallback just in case
        latitude: location?.lat,
        longitude: location?.lng,
        address: address,
        verified: true,
        face_image_url: faceImageUrl,
      });

      if (error) throw error;

      setStep(5);
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (error: any) {
      console.error(error);
      toast.error("Gagal menyimpan presensi: " + error.message);
    }
  };

  if (isCheckingStatus) {
    return (
      <div className="flex flex-col h-[calc(100vh-80px)] w-full max-w-[600px] lg:max-w-none mx-auto bg-surface items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-on-surface-variant font-medium">Memeriksa status presensi...</p>
      </div>
    );
  }

  if (attendanceType === 'on_leave') {
    return (
      <div className="flex flex-col h-[calc(100vh-80px)] w-full max-w-[600px] lg:max-w-none mx-auto bg-surface items-center justify-center p-6 text-center animate-fade-in">
        <div className="w-20 h-20 bg-secondary-container/30 rounded-full flex items-center justify-center mb-6">
          <Calendar className="w-10 h-10 text-secondary" />
        </div>
        <h2 className="text-2xl font-bold text-on-surface mb-2 font-jakarta">Sedang Izin / Sakit</h2>
        <p className="text-on-surface-variant mb-8">
          Anda tidak dapat melakukan presensi karena pengajuan izin/sakit Anda sedang aktif untuk hari ini.
        </p>
        <button 
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-primary text-white rounded-full font-semibold active:scale-95 transition-transform"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  if (attendanceType === 'done') {
    return (
      <div className="flex flex-col h-[calc(100vh-80px)] w-full max-w-[600px] lg:max-w-none mx-auto bg-surface items-center justify-center p-6 text-center animate-fade-in">
        <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-success" />
        </div>
        <h2 className="text-2xl font-bold text-on-surface mb-2 font-jakarta">Presensi Selesai</h2>
        <p className="text-on-surface-variant mb-8">
          Anda sudah melakukan absensi masuk dan pulang untuk hari ini. Selamat beristirahat!
        </p>
        <button 
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-primary text-white rounded-full font-semibold active:scale-95 transition-transform"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] lg:h-[calc(100vh-40px)] w-full max-w-[600px] lg:max-w-none mx-auto bg-surface relative overflow-hidden">
      {/* Header and Progress Bar - Only show if not in camera full-screen mode */}
      {step > 1 && (
        <div className="z-10 bg-white">
          <div className="px-4 py-4 flex items-center shadow-sm">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-on-surface">
              <X size={24} />
            </button>
            <h1 className="text-lg font-bold ml-2 font-jakarta flex-1 text-center pr-8">Presensi</h1>
          </div>
          <div className="w-full bg-surface-container-low h-1">
            <div 
              className="bg-primary h-full transition-all duration-500 ease-out"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className={`flex-1 overflow-hidden relative ${step === 1 ? 'absolute inset-0 z-50 bg-black' : ''}`}>
        {/* Step 1: Face Verification (Split Screen Camera) */}
        {step === 1 && (
          <div className="h-full w-full flex flex-col animate-in fade-in duration-300 bg-surface">
            {/* Camera Frame */}
            <div className="flex-1 relative bg-black rounded-b-[2rem] overflow-hidden shadow-lg z-10">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <canvas ref={canvasRef} className="hidden" />


            </div>

            {/* Bottom Controls Area */}
            <div className="h-40 shrink-0 flex flex-col items-center justify-center bg-surface w-full max-w-[600px] mx-auto z-0">
              {!isVerifying ? (
                <button 
                  onClick={capturePhoto}
                  disabled={!cameraActive}
                  className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white shadow-[0_8px_30px_rgba(0,35,111,0.3)] hover:scale-105 active:scale-95 transition-transform ring-4 ring-primary/10 border-4 border-surface disabled:opacity-50 disabled:active:scale-100 disabled:hover:scale-100 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Camera size={36} />
                </button>
              ) : (
                <div className="flex flex-col items-center gap-3 animate-in fade-in">
                  <div className="relative w-16 h-16 bg-success/10 rounded-full flex items-center justify-center">
                    <Loader2 className="animate-spin text-success w-8 h-8 absolute" />
                  </div>
                  <span className="text-sm font-semibold text-on-surface-variant">Memverifikasi...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: GPS Lock */}
        {step === 2 && (
          <div className="h-full flex flex-col items-center justify-center p-6 animate-in fade-in slide-in-from-right-8 duration-300">
            {!gpsError ? (
              <>
                <div className="relative mb-8">
                  <div className="w-32 h-32 bg-accent/20 rounded-full animate-ping absolute inset-0" />
                  <div className="w-32 h-32 bg-accent/30 rounded-full animate-pulse flex items-center justify-center relative z-10">
                    <Navigation size={48} className="text-primary animate-bounce" />
                  </div>
                </div>
                <h2 className="text-xl font-bold font-jakarta mb-2">Mengunci Lokasi GPS</h2>
                <p className="text-on-surface-variant text-center text-sm">
                  Mohon tunggu, sedang mendapatkan lokasi presisi Anda...
                </p>
              </>
            ) : (
              <>
                <div className="w-24 h-24 bg-danger/10 text-danger rounded-full flex items-center justify-center mb-6">
                  <X size={48} />
                </div>
                <h2 className="text-xl font-bold font-jakarta mb-2 text-danger">Akses Lokasi Ditolak</h2>
                <p className="text-on-surface-variant text-center text-sm mb-8">
                  Presensi membutuhkan akses lokasi Anda. Silakan izinkan lokasi di pengaturan browser/perangkat Anda.
                </p>
                <div className="flex gap-4 w-full max-w-xs">
                  <button onClick={() => navigate(-1)} className="flex-1 py-3 bg-surface-container-high hover:bg-surface-variant text-on-surface rounded-xl font-semibold transition-colors">
                    Kembali
                  </button>
                  <button onClick={requestGPS} className="flex-1 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-container transition-colors shadow-md">
                    Coba Lagi
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Map & Address */}
        {step === 3 && location && (
          <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-8 duration-300">
            <div className="flex-1 relative z-0">
               <MapContainer 
                center={[location.lat, location.lng]} 
                zoom={16} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />
                <Marker position={[location.lat, location.lng]} icon={customMarkerIcon}>
                  <Popup>Lokasi Anda saat ini</Popup>
                </Marker>
              </MapContainer>
            </div>
            <div className="bg-white p-6 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] relative z-10 -mt-6">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <MapPin className="text-primary" /> Lokasi Ditemukan
              </h3>
              <p className="text-sm text-on-surface-variant mb-6 line-clamp-3">
                {address}
              </p>
              <button 
                onClick={handleConfirmLocation}
                className="w-full bg-primary text-white font-bold py-3 px-4 rounded-xl shadow-md hover:bg-primary-container transition-colors"
              >
                Konfirmasi Lokasi
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Preview */}
        {step === 4 && (
          <div className="h-full flex flex-col p-4 overflow-y-auto animate-in fade-in slide-in-from-right-8 duration-300 bg-surface">
            <h2 className="text-xl font-bold font-jakarta mb-6 pt-2">Ringkasan Presensi</h2>
            
            <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl shadow-lg p-5 mb-6">
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-outline-variant/30">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary">
                  {photo && <img src={photo} alt="Captured" className="w-full h-full object-cover" />}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-primary">{attendanceType === 'check_in' ? 'Absen Masuk' : 'Absen Pulang'}</h3>
                  <p className="text-sm text-on-surface-variant font-medium">
                    {format(new Date(), "dd MMMM yyyy, HH:mm", { locale: id })} WIB
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Kordinat</h4>
                  <p className="text-sm font-medium">{location?.lat.toFixed(5)}, {location?.lng.toFixed(5)}</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Alamat</h4>
                  <p className="text-sm font-medium text-on-surface">{address}</p>
                </div>
              </div>
            </div>

            <div className="mt-auto space-y-3 pb-6">
              <button 
                onClick={handleSubmit}
                className="w-full bg-primary text-white font-bold py-3.5 px-4 rounded-xl shadow-md hover:bg-primary-container transition-colors flex items-center justify-center gap-2 text-lg"
              >
                <CheckCircle2 size={24} />
                Kirim Presensi
              </button>
              <button 
                onClick={() => navigate('/')}
                className="w-full bg-white text-danger font-bold py-3 px-4 rounded-xl shadow-sm border border-danger/20 hover:bg-danger/5 transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Success */}
        {step === 5 && (
          <div className="h-full flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-500 bg-success/5">
            <div className="w-24 h-24 bg-success text-white rounded-full flex items-center justify-center shadow-lg shadow-success/30 mb-6 animate-bounce">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-2xl font-bold font-jakarta mb-2 text-success">Presensi Berhasil!</h2>
            <p className="text-on-surface-variant text-center mb-8">
              Data absensi {attendanceType === 'check_in' ? 'masuk' : 'pulang'} Anda telah tersimpan ke sistem.
            </p>
            <div className="bg-white p-4 rounded-xl shadow-sm w-full max-w-xs text-center border border-success/10 mb-8">
              <p className="font-bold text-lg">{format(new Date(), "HH:mm")} WIB</p>
              <p className="text-xs text-on-surface-variant">{format(new Date(), "dd MMMM yyyy", { locale: id })}</p>
            </div>
            <button 
              onClick={() => navigate('/')}
              className="bg-white text-on-surface font-bold py-3 px-8 rounded-xl shadow-md border border-outline-variant/30 hover:bg-surface-container-low transition-colors"
            >
              Kembali ke Beranda
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
