import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';

// Fix leafet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom User HTML marker generator
const createUserMarker = (
  name: string,
  time: string,
  type: 'check_in' | 'check_out',
  avatarUrl: string
) => {
  const colorClass = type === 'check_in' ? 'bg-[#4edea3]' : 'bg-[#ba1a1a]';
  const shadowColor = type === 'check_in' ? 'rgba(78,222,163,0.7)' : 'rgba(186,26,26,0.7)';
  const textColor = type === 'check_in' ? 'text-[#004a31]' : 'text-[#93000a]';
  
  const html = `
    <div class="flex flex-col items-center justify-center -mt-8 -ml-16 relative w-32">
      <div class="bg-white/90 backdrop-blur-md p-1.5 rounded-xl shadow-lg mb-1 flex items-center gap-2 border border-white/50 w-max">
        <img class="w-7 h-7 rounded-full object-cover" src="${avatarUrl}" />
        <div>
          <p class="text-xs font-semibold text-gray-900 leading-tight truncate max-w-[80px]">${name}</p>
          <p class="text-[10px] font-bold ${textColor} leading-tight">${time}</p>
        </div>
      </div>
      <div class="w-4 h-4 ${colorClass} rounded-full border-2 border-white shadow-md map-marker" style="--shadow-color: ${shadowColor};"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-user-marker',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

interface MapLocation {
  id: string;
  name: string;
  time: string;
  type: 'check_in' | 'check_out';
  avatarUrl: string;
  position: [number, number];
  address: string;
}

const RecenterAutomatically = ({ center }: { center: {lat: number, lng: number, zoom: number} }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo([center.lat, center.lng], center.zoom, { duration: 1.5 });
  }, [center, map]);
  return null;
};

export default function AdminMapPage() {
  const [filter, setFilter] = useState<'all' | 'check_in' | 'check_out'>('all');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number, zoom: number}>({ lat: -6.2088, lng: 106.8456, zoom: 13 });

  useEffect(() => {
    fetchLocations();
    
    // Auto refresh every minute
    const interval = setInterval(fetchLocations, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchLocations = async () => {
    setLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const { data: attData } = await supabase
      .from('attendance')
      .select('id, type, latitude, longitude, address, created_at, user_id')
      .gte('created_at', todayIso)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('created_at', { ascending: false });

    if (attData && attData.length > 0) {
      const userIds = [...new Set(attData.map(a => a.user_id))];
      const { data: profData } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

      const profileMap: Record<string, any> = {};
      profData?.forEach(p => {
        profileMap[p.id] = p;
      });

      const latestPerUser: Record<string, boolean> = {};
      const formattedLocs: MapLocation[] = [];
      
      attData.forEach(att => {
         if (!latestPerUser[att.user_id]) {
            latestPerUser[att.user_id] = true;
            const p = profileMap[att.user_id] || {};
            formattedLocs.push({
               id: att.id,
               name: p.username || 'Pengguna',
               time: format(new Date(att.created_at), 'HH:mm'),
               type: att.type as 'check_in' | 'check_out',
               avatarUrl: p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.username || 'U')}&background=1e3a8a&color=fff`,
               position: [att.latitude, att.longitude],
               address: att.address || 'Lokasi tidak diketahui'
            });
         }
      });
      setLocations(formattedLocs);
      
      // Auto center map if there's data
      if (formattedLocs.length > 0) {
        // Average center
        const avgLat = formattedLocs.reduce((sum, l) => sum + l.position[0], 0) / formattedLocs.length;
        const avgLng = formattedLocs.reduce((sum, l) => sum + l.position[1], 0) / formattedLocs.length;
        setMapCenter({ lat: avgLat, lng: avgLng, zoom: 13 });
      }
    } else {
      setLocations([]);
    }
    setLoading(false);
  };

  const filteredLocations = locations.filter(loc => 
    filter === 'all' ? true : loc.type === filter
  );

  return (
    <div className="absolute inset-0 z-0 flex w-full h-full overflow-hidden">
      {/* Map Container */}
      <div className="relative flex-1 h-full w-full">
        <MapContainer 
          center={[mapCenter.lat, mapCenter.lng]} 
          zoom={mapCenter.zoom} 
          className="w-full h-full z-0"
          zoomControl={false}
        >
          <RecenterAutomatically center={mapCenter} />
          {/* OpenStreetMap TileLayer (CartoDB Voyager for a cleaner look) */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          
          {filteredLocations.map((loc) => (
            <Marker 
              key={loc.id} 
              position={loc.position} 
              icon={createUserMarker(loc.name, loc.time, loc.type, loc.avatarUrl)}
            >
              <Popup>
                <div className="text-center min-w-[150px]">
                  <strong>{loc.name}</strong><br/>
                  <span className="text-xs text-gray-600 block mt-1 leading-tight">{loc.address}</span>
                  <div className="mt-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${loc.type === 'check_in' ? 'bg-[#4edea3]/20 text-[#004a31]' : 'bg-[#ba1a1a]/20 text-[#93000a]'}`}>
                       {loc.type === 'check_in' ? 'Check-in' : 'Check-out'} @ {loc.time}
                    </span>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Global Styles for Marker Animation */}
        <style dangerouslySetInnerHTML={{__html: `
          .map-marker {
              animation: pulse-map 2s infinite;
          }
          @keyframes pulse-map {
              0% { transform: scale(1); box-shadow: 0 0 0 0 var(--shadow-color); }
              70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(0, 0, 0, 0); }
              100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(0, 0, 0, 0); }
          }
          .custom-user-marker {
             background: transparent;
             border: none;
          }
        `}} />

        {/* Floating Controls Panel */}
        <div className="absolute top-4 left-4 z-[400] flex flex-wrap gap-2 bg-surface/90 backdrop-blur-md p-2 rounded-xl shadow-sm border border-outline-variant/30 max-w-[calc(100vw-80px)]">
          <button 
            onClick={() => setFilter('all')}
            className={`px-4 py-2 text-xs font-semibold tracking-wider rounded-lg transition-colors ${filter === 'all' ? 'bg-primary-container text-on-primary-container font-bold' : 'text-on-surface hover:bg-surface-container-high'}`}
          >
            Semua
          </button>
          <button 
            onClick={() => setFilter('check_in')}
            className={`px-4 py-2 text-xs font-semibold tracking-wider rounded-lg transition-colors ${filter === 'check_in' ? 'bg-primary-container text-on-primary-container font-bold' : 'text-on-surface hover:bg-surface-container-high'}`}
          >
            Check-in
          </button>
          <button 
            onClick={() => setFilter('check_out')}
            className={`px-4 py-2 text-xs font-semibold tracking-wider rounded-lg transition-colors ${filter === 'check_out' ? 'bg-primary-container text-on-primary-container font-bold' : 'text-on-surface hover:bg-surface-container-high'}`}
          >
            Check-out
          </button>
        </div>
      </div>

      {/* Collapsible Sidebar Panel (Right) */}
      <aside className={`absolute right-0 top-0 bottom-0 w-80 max-w-full bg-surface/95 backdrop-blur-xl shadow-[-4px_0_24px_rgba(0,0,0,0.05)] border-l border-outline-variant/20 flex flex-col z-[400] transition-transform duration-300 transform ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b border-surface-container-highest flex justify-between items-center">
          <h3 className="text-lg font-semibold text-on-surface flex items-center gap-2">
            Live Status {loading && <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>}
          </h3>
          <button onClick={() => setSidebarOpen(false)} className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors">
             <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {!loading && filteredLocations.length === 0 ? (
             <p className="text-sm text-center text-on-surface-variant mt-4">Belum ada aktivitas presensi hari ini.</p>
          ) : (
            filteredLocations.map(loc => (
              <div 
                key={loc.id} 
                onClick={() => {
                  setMapCenter({ lat: loc.position[0], lng: loc.position[1], zoom: 16 });
                  if (filter === 'all') {
                    setFilter(loc.type);
                  }
                  if (window.innerWidth < 768) setSidebarOpen(false);
                }}
                className="bg-surface-container-lowest p-3 rounded-xl shadow-sm border border-outline-variant/10 flex items-center gap-3 cursor-pointer hover:bg-surface-container-low transition-colors"
              >
                <div className={`w-2 h-10 ${loc.type === 'check_in' ? 'bg-[#4edea3]' : 'bg-[#ba1a1a]'} rounded-full`}></div>
                <img className="w-10 h-10 rounded-full object-cover" alt={loc.name} src={loc.avatarUrl} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">{loc.name}</p>
                  <p className="text-[10px] font-normal text-on-surface-variant truncate" title={loc.address}>{loc.address}</p>
                </div>
                <div className="text-right flex flex-col items-end shrink-0">
                  <span className={`px-2 py-0.5 ${loc.type === 'check_in' ? 'bg-[#4edea3]/20 text-[#004a31]' : 'bg-[#ffdad6] text-[#93000a]'} text-[10px] font-semibold tracking-wider rounded-full`}>
                    {loc.type === 'check_in' ? 'Masuk' : 'Pulang'}
                  </span>
                  <p className="text-xs font-normal mt-1 text-on-surface-variant">{loc.time}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Toggle button for sidebar when closed */}
      {!sidebarOpen && (
        <button 
          onClick={() => setSidebarOpen(true)}
          className="absolute right-4 top-4 z-[400] p-2 bg-surface shadow-md rounded-full text-on-surface"
        >
          <span className="material-symbols-outlined">menu_open</span>
        </button>
      )}
    </div>
  );
}
