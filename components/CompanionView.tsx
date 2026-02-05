import React, { useState, useEffect, useRef } from 'react';
import { Message, Route, Teammate, Track, Waypoint } from '../types';
import { generateHikingAdvice } from '../services/geminiService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient'; // Import config check
import { Mic, Send, Navigation, Camera, AlertCircle, Map as MapIcon, Users, Droplet, Tent, Cigarette, Info, MessageSquare, Play, Square, Save, MapPin, Thermometer, Wind, Mountain, Heart, Battery, Flame, Zap, Phone, Bell, ShieldAlert, Home, AlertTriangle } from 'lucide-react';

const L = (window as any).L;

interface CompanionViewProps {
  activeRoute: Route | null;
  onSaveTrack: (track: Track) => void;
}

// --- MOCK DATA FOR DRAGON'S BACK DEMO ---
const MOCK_TEAMMATES_INIT: Teammate[] = [
  { id: 't1', name: 'Alice', lat: 22.228, lng: 114.242, status: 'active', avatar: 'https://picsum.photos/40/40?random=1' },
  { id: 't2', name: 'Bob', lat: 22.227, lng: 114.2415, status: 'active', avatar: 'https://picsum.photos/40/40?random=2' },
];

const USER_START_POS: [number, number] = [22.2225, 114.2415]; // Adjusted slightly to be near amenities

const CompanionView: React.FC<CompanionViewProps> = ({ activeRoute, onSaveTrack }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', sender: 'ai', text: 'Hello! HikePal AI here. I am connecting to your database to load trail info...', timestamp: new Date() }
  ]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [mode, setMode] = useState<'map' | 'chat'>('map'); 
  const [chatType, setChatType] = useState<'ai' | 'team'>('ai');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [trackName, setTrackName] = useState(activeRoute?.name || 'My Hike');
  const [showSOS, setShowSOS] = useState(false);

  // Database POIs state
  const [dbPois, setDbPois] = useState<Waypoint[]>([]);

  // Risk Shield State
  const [deviceConnected, setDeviceConnected] = useState(true);
  const [riskStats, setRiskStats] = useState({
      temp: 24,
      humidity: 78,
      altitude: 284,
      heartRate: 110,
      battery: 85,
      calories: 320
  });

  // Tracking State
  const [userPos, setUserPos] = useState<[number, number]>(USER_START_POS);
  const [teammates, setTeammates] = useState<Teammate[]>(MOCK_TEAMMATES_INIT);
  const [recordedPath, setRecordedPath] = useState<[number, number][]>([USER_START_POS]);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const teammateMarkersRef = useRef<{ [id: string]: any }>({});
  const poiMarkersRef = useRef<any[]>([]);
  const recordedPolylineRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // --- Fetch Data from Supabase ---
  useEffect(() => {
    const fetchMapData = async () => {
        if (!isSupabaseConfigured) {
            setMessages(prev => [...prev, { 
                id: 'sys-alert', 
                sender: 'ai', 
                text: '⚠️ Setup Required: Please open "services/supabaseClient.ts" in your code editor and paste your Project URL and API Key.', 
                timestamp: new Date() 
            }]);
            return;
        }

        const loadedPoints: Waypoint[] = [];
        console.log("Starting Supabase Sync...");

        // 1. Fetch Facilities (Water, Toilet, Shelter)
        const { data: facilities, error: facilityError } = await supabase
            .from('facilities')
            .select('*');
        
        if (facilityError) {
            console.error("Supabase Facility Error:", facilityError);
            setMessages(prev => [...prev, { id: 'err-1', sender: 'ai', text: 'Error connecting to database. Please check your API Keys.', timestamp: new Date() }]);
        }

        if (facilities) {
            console.log("Facilities Loaded:", facilities);
            facilities.forEach((f: any) => {
                // Map DB types to Frontend types
                // SQL Table values: 'water_station', 'toilet', 'shelter'
                let type: any = 'marker';
                if (f.type === 'water_station') type = 'water';
                else if (f.type === 'toilet') type = 'toilet';
                else if (f.type === 'shelter') type = 'shelter';

                loadedPoints.push({
                    id: `fac-${f.id}`,
                    lat: f.latitude,
                    lng: f.longitude,
                    type: type,
                    note: f.name
                });
            });
        }

        // 2. Fetch Risk Zones
        // We fetch ALL risks for the demo, regardless of route_id
        const { data: risks, error: riskError } = await supabase
            .from('risk_zones')
            .select('*');

        if (risks) {
            console.log("Risk Zones Loaded:", risks);
            risks.forEach((r: any) => {
                loadedPoints.push({
                    id: `risk-${r.id}`,
                    lat: r.latitude,
                    lng: r.longitude,
                    type: 'risk',
                    riskType: r.type as any, // 'cliff', 'landslide', etc.
                    radius: r.radius,
                    note: r.message
                });
            });
        }

        setDbPois(loadedPoints);

        if (loadedPoints.length > 0) {
            setMessages(prev => [...prev, { 
                id: 'sys-2', 
                sender: 'ai', 
                text: `✅ Data Sync Successful! Loaded ${facilities?.length || 0} facilities and ${risks?.length || 0} risk zones from your cloud database.`, 
                timestamp: new Date() 
            }]);
        } else if (!facilityError) {
             setMessages(prev => [...prev, { 
                id: 'sys-3', 
                sender: 'ai', 
                text: `Connected to database, but no points found. Did you run the SQL INSERT commands?`, 
                timestamp: new Date() 
            }]);
        }
    };

    fetchMapData();
  }, []);

  // --- Real-time Simulation & Recording Logic ---
  useEffect(() => {
    // Timer for elapsed time
    if (isRecording) {
        timerRef.current = setInterval(() => {
            setElapsedTime(prev => prev + 1);
            // Simulate Risk Shield Updates
            setRiskStats(prev => ({
                ...prev,
                altitude: Math.max(0, prev.altitude + (Math.random() > 0.5 ? 1 : -1)),
                heartRate: Math.min(180, Math.max(60, prev.heartRate + Math.floor(Math.random() * 5) - 2)),
                calories: prev.calories + 0.5
            }));
        }, 1000);
    } else {
        if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  useEffect(() => {
    // Simulate User & Teammate Movement every 1s
    const interval = setInterval(() => {
        // 1. Move User randomly slightly
        if (isRecording) {
            setUserPos(prev => {
                const newLat = prev[0] + (Math.random() - 0.3) * 0.0001; // Bias slightly north
                const newLng = prev[1] + (Math.random() - 0.4) * 0.0001;
                const newPos: [number, number] = [newLat, newLng];
                setRecordedPath(path => [...path, newPos]);
                return newPos;
            });
        }

        // 2. Move Teammates (even if not recording, they move)
        setTeammates(prev => prev.map(t => ({
            ...t,
            lat: t.lat + (Math.random() - 0.5) * 0.00015,
            lng: t.lng + (Math.random() - 0.5) * 0.00015
        })));

    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording]);

  // --- Map Effect ---
  useEffect(() => {
    if (!mapContainerRef.current || !L) return;
    if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
            zoomControl: false,
            attributionControl: false
        }).setView(USER_START_POS, 14);

        // Revert to CartoDB Light for a cleaner look
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Active Route Line (Static reference - Dragon's Back rough path)
        L.polyline([
          [22.2195, 114.2405], [22.2220, 114.2410], [22.2250, 114.2425],
          [22.2285, 114.2428], [22.2310, 114.2440], [22.2350, 114.2445], [22.2400, 114.2430]
        ], { color: '#BDBDBD', weight: 4, dashArray: '5, 10' }).addTo(map);

        // Recorded Path Line (Dynamic)
        recordedPolylineRef.current = L.polyline([], { color: '#2E7D32', weight: 5 }).addTo(map);

        // User Marker
        const userIcon = L.divIcon({
            className: 'custom-user-marker',
            html: `<div style="background-color: #2563EB; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.4);"></div>`,
            iconSize: [14, 14]
        });
        userMarkerRef.current = L.marker(USER_START_POS, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);

        mapInstanceRef.current = map;
    }

    // --- RENDER DB POIS ---
    // Clear existing POI markers
    poiMarkersRef.current.forEach(m => mapInstanceRef.current.removeLayer(m));
    poiMarkersRef.current = [];

    dbPois.forEach(poi => {
             let iconHtml = '';
             let className = 'custom-poi-marker';
             let bgClass = '';
             let iconSvg = '';

             switch(poi.type) {
                 case 'water':
                     bgClass = 'bg-blue-500';
                     iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`; // Droplet
                     break;
                 case 'toilet':
                     bgClass = 'bg-gray-600';
                     iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21h6"/><path d="M9 21v-4"/><path d="M15 21v-4"/><path d="M8 9h8a2 2 0 0 1 2 2v2H6v-2a2 2 0 0 1 2-2z"/><rect x="8" y="13" width="8" height="4" rx="1"/></svg>`; // Armchair/Toilet approx
                     break;
                 case 'shelter':
                     bgClass = 'bg-green-600';
                     iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21v-7l8-6 8 6v7"/></svg>`; // Tent/Home
                     break;
                 case 'risk':
                     bgClass = 'bg-red-500 animate-pulse';
                     iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/></svg>`; // Alert
                     break;
                 default:
                     bgClass = 'bg-gray-400';
                     iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
             }

             const icon = L.divIcon({
                 className: className,
                 html: `<div class="${bgClass} w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white">${iconSvg}</div>`,
                 iconSize: [32, 32],
                 iconAnchor: [16, 32],
                 popupAnchor: [0, -32]
             });

             const marker = L.marker([poi.lat, poi.lng], { icon }).addTo(mapInstanceRef.current);
             marker.bindPopup(`
                 <div class="text-center">
                    <strong class="block text-sm text-gray-800">${poi.note}</strong>
                    <span class="text-xs text-gray-500 uppercase font-bold">${poi.type === 'risk' ? poi.riskType : poi.type}</span>
                 </div>
             `);
             poiMarkersRef.current.push(marker);
             
             // If it's a risk zone, add a circle
             if (poi.type === 'risk' && poi.radius) {
                 const circle = L.circle([poi.lat, poi.lng], {
                     radius: poi.radius,
                     color: '#EF4444',
                     fillColor: '#FCA5A5',
                     fillOpacity: 0.3,
                     weight: 1
                 }).addTo(mapInstanceRef.current);
                 poiMarkersRef.current.push(circle);
             }
    });

    // Update User Marker
    if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng(userPos);
        if (mode === 'map' && isRecording) {
            mapInstanceRef.current.panTo(userPos);
        }
    }

    // Update Recorded Polyline
    if (recordedPolylineRef.current) {
        recordedPolylineRef.current.setLatLngs(recordedPath);
    }

    // Update Teammates
    teammates.forEach(t => {
        let marker = teammateMarkersRef.current[t.id];
        if (!marker) {
            const teamIcon = L.divIcon({
                className: 'custom-team-marker',
                html: `<div style="background-color: #FF6F00; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
                iconSize: [12, 12]
            });
            marker = L.marker([t.lat, t.lng], { icon: teamIcon }).addTo(mapInstanceRef.current).bindPopup(t.name);
            teammateMarkersRef.current[t.id] = marker;
        } else {
            marker.setLatLng([t.lat, t.lng]);
        }
    });

  }, [userPos, teammates, recordedPath, waypoints, isRecording, mode, dbPois]);


  // Handle adding markers dynamically
  const addMapMarker = (type: 'photo' | 'marker') => {
      if (!mapInstanceRef.current) return;
      
      const newWaypoint: Waypoint = {
          id: Date.now().toString(),
          lat: userPos[0],
          lng: userPos[1],
          type: type,
          note: type === 'photo' ? 'Photo taken here' : 'Marked location'
      };

      setWaypoints(prev => [...prev, newWaypoint]);

      const iconHtml = type === 'photo' 
          ? `<div class="bg-blue-500 text-white p-1.5 rounded-lg shadow-lg"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>`
          : `<div class="bg-red-500 text-white p-1 rounded-full shadow-lg"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>`;

      const icon = L.divIcon({
          className: 'custom-wp-marker',
          html: iconHtml,
          iconSize: [24, 24],
          iconAnchor: [12, 24]
      });

      L.marker(userPos, { icon }).addTo(mapInstanceRef.current).bindPopup(newWaypoint.note || '');
  };


  const formatTime = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleFinishRecording = () => {
      setIsRecording(false);
      setShowSaveDialog(true);
  };

  const confirmSave = () => {
      const newTrack: Track = {
          id: Date.now().toString(),
          name: trackName,
          date: new Date(),
          duration: formatTime(elapsedTime),
          distance: (recordedPath.length * 0.005).toFixed(2) + ' km', // Mock calculation
          coordinates: recordedPath,
          waypoints: waypoints
      };
      onSaveTrack(newTrack);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const newUserMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputText('');

    if (chatType === 'team') {
        setTimeout(() => {
            const teamMsg: Message = {
                id: (Date.now() + 1).toString(),
                sender: 'teammate',
                senderName: 'Alice',
                text: "We are taking a break at the pavilion.",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, teamMsg]);
        }, 1500);
    } else {
        try {
            const context = {
                location: `Lat: ${userPos[0].toFixed(4)}, Lng: ${userPos[1].toFixed(4)}`,
                route: activeRoute?.name || 'Dragon\'s Back',
                teammates: teammates.map(t => t.name)
            };
            const loadingId = 'loading-' + Date.now();
            setMessages(prev => [...prev, { id: loadingId, sender: 'ai', text: 'Thinking...', timestamp: new Date() }]);
            const responseText = await generateHikingAdvice(newUserMsg.text, context);
            setMessages(prev => prev.filter(m => m.id !== loadingId).concat({
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: responseText,
                timestamp: new Date()
            }));
        } catch (error) { console.error(error); }
    }
  };

  const handleSOS = () => {
      setShowSOS(true);
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 relative">
      {/* SOS Overlay */}
      {showSOS && (
          <div className="absolute inset-0 z-[2000] bg-red-600/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-white text-center animate-fade-in">
            <ShieldAlert size={64} className="mb-4 animate-bounce" />
            <h2 className="text-4xl font-black mb-2 tracking-tighter">SOS ACTIVE</h2>
            <p className="mb-6 opacity-90">Emergency Mode Engaged</p>
            
            <div className="bg-white/20 p-6 rounded-2xl w-full mb-6 border border-white/30 backdrop-blur-md">
                <div className="text-xs uppercase opacity-70 mb-1 font-bold">Your Current Location</div>
                <div className="font-mono text-3xl font-bold tracking-widest flex flex-col items-center justify-center">
                    <span>{userPos[0].toFixed(5)} N</span>
                    <span>{userPos[1].toFixed(5)} E</span>
                </div>
                <div className="text-sm mt-3 flex items-center justify-center gap-1 opacity-80 border-t border-white/20 pt-2">
                    <MapPin size={14} /> Altitude: {riskStats.altitude}m
                </div>
            </div>

            <div className="w-full space-y-3">
                <a href="tel:999" className="block w-full bg-white text-red-600 py-4 rounded-xl font-bold text-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform">
                    <Phone size={24} /> Call Emergency (999)
                </a>
                <button 
                    onClick={() => {
                        const sosMsg: Message = {
                            id: Date.now().toString(),
                            sender: 'user',
                            text: `🚨 SOS! Emergency at ${userPos[0].toFixed(5)}, ${userPos[1].toFixed(5)}. Altitude: ${riskStats.altitude}m.`,
                            timestamp: new Date()
                        };
                        setMessages(prev => [...prev, sosMsg]);
                        alert("Emergency alert sent to teammates and emergency contacts!");
                        setChatType('team'); // Switch to team chat to see context
                        setMode('chat'); // Switch to chat mode
                        setShowSOS(false);
                    }}
                    className="block w-full bg-black/40 hover:bg-black/50 text-white py-4 rounded-xl font-bold text-lg border border-white/20 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                     <Bell size={20} /> Notify Teammates
                </button>
                <button 
                    onClick={() => setShowSOS(false)} 
                    className="block w-full py-4 text-white/80 font-bold text-sm mt-4"
                >
                    Cancel Alert
                </button>
            </div>
          </div>
      )}

      {/* Save Dialog Overlay */}
      {showSaveDialog && (
          <div className="absolute inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                  <h3 className="text-xl font-bold mb-4">Save Hike</h3>
                  <div className="mb-4">
                      <label className="text-xs text-gray-500 font-bold uppercase">Track Name</label>
                      <input 
                        value={trackName} 
                        onChange={e => setTrackName(e.target.value)}
                        className="w-full border-b-2 border-hike-green py-2 text-lg focus:outline-none"
                      />
                  </div>
                  <div className="flex gap-4 text-sm text-gray-600 mb-6">
                      <div className="flex-1 bg-gray-50 p-2 rounded">
                          <div className="text-xs">Duration</div>
                          <div className="font-mono font-bold">{formatTime(elapsedTime)}</div>
                      </div>
                      <div className="flex-1 bg-gray-50 p-2 rounded">
                          <div className="text-xs">Points</div>
                          <div className="font-mono font-bold">{waypoints.length}</div>
                      </div>
                  </div>
                  <button onClick={confirmSave} className="w-full bg-hike-green text-white py-3 rounded-xl font-bold shadow-lg">
                      Save to Library
                  </button>
                  <button onClick={() => setShowSaveDialog(false)} className="w-full mt-3 text-gray-500 py-2 text-sm">
                      Discard
                  </button>
              </div>
          </div>
      )}

      {/* Map Area */}
      <div className={`relative transition-all duration-300 ${mode === 'map' ? 'h-[75%]' : 'h-[40%]'}`}>
        <div ref={mapContainerRef} className="absolute inset-0 bg-gray-200 z-0" />
        
        {/* Risk Shield Dashboard */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[450] flex flex-col items-center">
            <div className={`bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-white/50 p-2 transition-all duration-300 ${deviceConnected ? 'w-[90vw] max-w-xs' : 'w-auto'}`}>
                <div className="flex items-center justify-around gap-2 text-xs font-bold text-gray-700">
                    <div className="flex flex-col items-center">
                        <Thermometer size={14} className="text-orange-500 mb-0.5" />
                        <span>{riskStats.temp}°C</span>
                    </div>
                     <div className="flex flex-col items-center">
                        <Wind size={14} className="text-blue-500 mb-0.5" />
                        <span>{riskStats.humidity}%</span>
                    </div>
                     <div className="flex flex-col items-center">
                        <Mountain size={14} className="text-gray-600 mb-0.5" />
                        <span>{riskStats.altitude}m</span>
                    </div>
                    {/* Device Toggle */}
                    <button 
                        onClick={() => setDeviceConnected(!deviceConnected)}
                        className={`p-1 rounded bg-gray-100 ${deviceConnected ? 'text-hike-green' : 'text-gray-400'}`}
                    >
                        <Zap size={14} fill={deviceConnected ? "currentColor" : "none"} />
                    </button>
                </div>

                {/* Extended Stats (Device) */}
                {deviceConnected && (
                    <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-3 gap-2 animate-fade-in">
                        <div className="flex flex-col items-center">
                             <div className="flex items-center gap-1 text-red-500">
                                <Heart size={12} fill="currentColor" className="animate-pulse" />
                                <span className="font-bold text-sm">{riskStats.heartRate}</span>
                             </div>
                             <span className="text-[9px] text-gray-400">BPM</span>
                        </div>
                        <div className="flex flex-col items-center">
                             <div className="flex items-center gap-1 text-green-600">
                                <Battery size={12} />
                                <span className="font-bold text-sm">{riskStats.battery}%</span>
                             </div>
                             <span className="text-[9px] text-gray-400">Device</span>
                        </div>
                        <div className="flex flex-col items-center">
                             <div className="flex items-center gap-1 text-orange-600">
                                <Flame size={12} />
                                <span className="font-bold text-sm">{Math.floor(riskStats.calories)}</span>
                             </div>
                             <span className="text-[9px] text-gray-400">Kcal</span>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Recording Status (Moved below risk shield) */}
        {isRecording && (
            <div className="absolute top-24 left-4 z-[400]">
                <div className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow animate-pulse flex items-center gap-1">
                   <div className="w-2 h-2 bg-white rounded-full"></div> REC {formatTime(elapsedTime)}
                </div>
            </div>
        )}

        {/* Map Controls */}
        <div className="absolute top-20 right-4 z-[400] flex flex-col gap-2">
            {/* SOS Button - Positioned prominently */}
            <button 
                onClick={handleSOS}
                className="bg-red-600 text-white p-3 rounded-full shadow-lg font-bold flex items-center justify-center animate-pulse active:scale-95 transition-transform border-2 border-white"
            >
                <span className="font-black text-[10px] leading-tight">SOS</span>
            </button>
        </div>

        <div className="absolute bottom-10 right-4 z-[400] flex flex-col gap-2">
             {/* Record Toggle */}
            <button 
                onClick={() => isRecording ? handleFinishRecording() : setIsRecording(true)}
                className={`p-3 rounded-full shadow-lg text-white font-bold transition-all active:scale-95 ${isRecording ? 'bg-red-500' : 'bg-hike-green'}`}
            >
                {isRecording ? <Square size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
            </button>

            {/* Tools */}
            {isRecording && (
                <>
                <button onClick={() => addMapMarker('marker')} className="bg-white/90 p-2.5 rounded-full shadow text-gray-700 hover:bg-white active:scale-95">
                    <MapPin size={20} className="text-red-500" />
                </button>
                <button onClick={() => addMapMarker('photo')} className="bg-white/90 p-2.5 rounded-full shadow text-gray-700 hover:bg-white active:scale-95">
                    <Camera size={20} className="text-blue-500" />
                </button>
                </>
            )}
        </div>
        
        {/* Resize Handle */}
        <div 
          onClick={() => setMode(mode === 'map' ? 'chat' : 'map')}
          className="absolute bottom-0 left-0 right-0 h-6 bg-white rounded-t-3xl flex items-center justify-center cursor-pointer shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-[401]"
        >
           <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white flex flex-col pb-20 overflow-hidden">
         <div className="flex border-b border-gray-100 shrink-0">
            <button 
               onClick={() => setChatType('ai')}
               className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${chatType === 'ai' ? 'text-hike-green border-b-2 border-hike-green' : 'text-gray-400'}`}
            >
               <div className="bg-green-100 p-1 rounded text-hike-green"><MessageSquare size={14}/></div>
               AI Guide
            </button>
            <button 
               onClick={() => setChatType('team')}
               className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${chatType === 'team' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}
            >
               <div className="bg-blue-100 p-1 rounded text-blue-600"><Users size={14}/></div>
               Team (2)
            </button>
         </div>

         <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
             {/* Chat messages ... same as before */}
             {chatType === 'ai' && messages.length < 2 && (
                <div className="grid grid-cols-4 gap-2 mb-4">
                    {/* Reusing prompt buttons logic inline for brevity */}
                    <button onClick={() => { setInputText("Where is water?"); setMode('chat'); }} className="flex flex-col items-center bg-white p-2 rounded-xl border"><Droplet size={18} className="text-blue-500 mb-1"/><span className="text-[10px]">Water</span></button>
                    <button onClick={() => { setInputText("Rest points?"); setMode('chat'); }} className="flex flex-col items-center bg-white p-2 rounded-xl border"><Tent size={18} className="text-green-500 mb-1"/><span className="text-[10px]">Rest</span></button>
                    <button onClick={() => { setInputText("Emergency exit?"); setMode('chat'); }} className="flex flex-col items-center bg-white p-2 rounded-xl border"><AlertCircle size={18} className="text-red-500 mb-1"/><span className="text-[10px]">Help</span></button>
                    <button onClick={() => { setInputText("Toilet?"); setMode('chat'); }} className="flex flex-col items-center bg-white p-2 rounded-xl border"><Info size={18} className="text-gray-500 mb-1"/><span className="text-[10px]">Info</span></button>
                </div>
             )}
             <div className="space-y-4">
                {messages.filter(m => chatType === 'ai' ? m.sender !== 'teammate' : m.sender !== 'ai').map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.sender !== 'user' && (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 shrink-0 ${msg.sender === 'ai' ? 'bg-hike-green text-white' : 'bg-orange-500 text-white'}`}>
                                {msg.sender === 'ai' ? <MapIcon size={14} /> : msg.senderName?.[0]}
                            </div>
                        )}
                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                            msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                        }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
         </div>

         <div className="p-3 bg-white border-t border-gray-100 shrink-0">
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-full px-2">
               <input 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onFocus={() => setMode('chat')}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={chatType === 'ai' ? "Ask AI..." : "Message team..."}
                  className="flex-1 bg-transparent border-none outline-none text-sm px-2 py-2"
               />
               <button onClick={handleSendMessage} className="p-2 bg-hike-green text-white rounded-full shadow-sm">
                  <Send size={16} />
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default CompanionView;