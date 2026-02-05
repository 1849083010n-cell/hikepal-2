import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { ArrowLeft, Save, AlertTriangle, Map, CheckCircle, Loader } from 'lucide-react';

interface AdminViewProps {
    onBack: () => void;
}

const AdminView: React.FC<AdminViewProps> = ({ onBack }) => {
    const [mode, setMode] = useState<'route' | 'risk'>('route');
    const [loading, setLoading] = useState(false);
    const [existingRoutes, setExistingRoutes] = useState<any[]>([]);

    // Route Form State
    const [routeForm, setRouteForm] = useState({
        name: '',
        description: '',
        difficulty: 'Medium',
        startLat: '',
        startLng: '',
        endLat: '',
        endLng: ''
    });

    // Risk Form State
    const [riskForm, setRiskForm] = useState({
        routeId: '',
        type: 'landslide',
        lat: '',
        lng: '',
        radius: '50',
        message: ''
    });

    useEffect(() => {
        if (isSupabaseConfigured) {
            fetchRoutes();
        }
    }, []);

    const fetchRoutes = async () => {
        const { data, error } = await supabase.from('routes').select('id, name');
        if (data) setExistingRoutes(data);
        if (error) console.error(error);
    };

    const handleRouteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const routeData = {
            name: routeForm.name,
            description: routeForm.description,
            difficulty: routeForm.difficulty,
            start_point: {
                lat: parseFloat(routeForm.startLat),
                lng: parseFloat(routeForm.startLng)
            },
            end_point: {
                lat: parseFloat(routeForm.endLat),
                lng: parseFloat(routeForm.endLng)
            },
            geo_path: {
                type: 'LineString',
                coordinates: [
                    [parseFloat(routeForm.startLng), parseFloat(routeForm.startLat)],
                    [parseFloat(routeForm.endLng), parseFloat(routeForm.endLat)]
                ]
            }
        };

        const { error } = await supabase.from('routes').insert([routeData]);
        setLoading(false);

        if (error) {
            alert('Error adding route: ' + error.message);
        } else {
            alert('Route added successfully!');
            setRouteForm({
                name: '', description: '', difficulty: 'Medium',
                startLat: '', startLng: '', endLat: '', endLng: ''
            });
            fetchRoutes();
        }
    };

    const handleRiskSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const riskData = {
            route_id: parseInt(riskForm.routeId),
            type: riskForm.type,
            latitude: parseFloat(riskForm.lat),
            longitude: parseFloat(riskForm.lng),
            radius: parseInt(riskForm.radius),
            message: riskForm.message
        };

        const { error } = await supabase.from('risk_zones').insert([riskData]);
        setLoading(false);

        if (error) {
            alert('Error adding risk zone: ' + error.message);
        } else {
            alert('Risk zone added successfully!');
            setRiskForm(prev => ({ ...prev, message: '', lat: '', lng: '' }));
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 animate-fade-in">
            {/* Header */}
            <div className="bg-gray-900 text-white p-4 shadow-sm flex items-center gap-3 sticky top-0 z-20">
                <button onClick={onBack} className="p-1 hover:bg-white/20 rounded-full transition-colors"><ArrowLeft size={24} /></button>
                <h2 className="text-xl font-bold">Admin Data Entry</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-24">
                {!isSupabaseConfigured && (
                    <div className="bg-yellow-50 p-4 rounded-lg mb-4 border border-yellow-200 text-yellow-800 text-sm">
                        <strong>Configuration Missing:</strong> Please update <code>services/supabaseClient.ts</code> with your Supabase credentials to save data.
                    </div>
                )}

                {/* Mode Toggle */}
                <div className="flex bg-white rounded-xl p-1 shadow-sm mb-6 border border-gray-200">
                    <button 
                        onClick={() => setMode('route')}
                        className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${mode === 'route' ? 'bg-hike-green text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Map size={16} /> Add Route
                    </button>
                    <button 
                        onClick={() => setMode('risk')}
                        className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${mode === 'risk' ? 'bg-orange-500 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <AlertTriangle size={16} /> Add Risk Zone
                    </button>
                </div>

                {mode === 'route' ? (
                    <form onSubmit={handleRouteSubmit} className={`bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4 ${!isSupabaseConfigured ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="flex items-center gap-2 mb-2 text-hike-green font-bold border-b border-gray-100 pb-2">
                             <CheckCircle size={20} /> New Route Details
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Route Name</label>
                            <input required value={routeForm.name} onChange={e => setRouteForm({...routeForm, name: e.target.value})} className="w-full border rounded-lg p-2 mt-1 focus:ring-2 focus:ring-hike-green outline-none" placeholder="e.g. Dragon's Back" />
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
                            <textarea required value={routeForm.description} onChange={e => setRouteForm({...routeForm, description: e.target.value})} className="w-full border rounded-lg p-2 mt-1 focus:ring-2 focus:ring-hike-green outline-none" rows={3} placeholder="Route details..." />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Difficulty</label>
                                <select required value={routeForm.difficulty} onChange={e => setRouteForm({...routeForm, difficulty: e.target.value})} className="w-full border rounded-lg p-2 mt-1 bg-white">
                                    <option value="Easy">Easy</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Hard">Hard</option>
                                </select>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                             <h4 className="text-xs font-bold text-gray-800 uppercase mb-2">Start Point</h4>
                             <div className="grid grid-cols-2 gap-2">
                                <input required type="number" step="0.0001" value={routeForm.startLat} onChange={e => setRouteForm({...routeForm, startLat: e.target.value})} placeholder="Lat (22.xxx)" className="border rounded p-2 text-sm" />
                                <input required type="number" step="0.0001" value={routeForm.startLng} onChange={e => setRouteForm({...routeForm, startLng: e.target.value})} placeholder="Lng (114.xxx)" className="border rounded p-2 text-sm" />
                             </div>
                        </div>

                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                             <h4 className="text-xs font-bold text-gray-800 uppercase mb-2">End Point</h4>
                             <div className="grid grid-cols-2 gap-2">
                                <input required type="number" step="0.0001" value={routeForm.endLat} onChange={e => setRouteForm({...routeForm, endLat: e.target.value})} placeholder="Lat" className="border rounded p-2 text-sm" />
                                <input required type="number" step="0.0001" value={routeForm.endLng} onChange={e => setRouteForm({...routeForm, endLng: e.target.value})} placeholder="Lng" className="border rounded p-2 text-sm" />
                             </div>
                        </div>

                        <button type="submit" disabled={loading} className="w-full bg-hike-green text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2">
                            {loading ? <Loader className="animate-spin" size={20} /> : <Save size={20} />}
                            Save Route to DB
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleRiskSubmit} className={`bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4 ${!isSupabaseConfigured ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="flex items-center gap-2 mb-2 text-orange-500 font-bold border-b border-gray-100 pb-2">
                             <AlertTriangle size={20} /> New Risk Zone
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Associated Route</label>
                            <select required value={riskForm.routeId} onChange={e => setRiskForm({...riskForm, routeId: e.target.value})} className="w-full border rounded-lg p-2 mt-1 bg-white">
                                <option value="">Select a Route...</option>
                                {existingRoutes.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                            {existingRoutes.length === 0 && <p className="text-xs text-red-500 mt-1">No routes found. Add a route first.</p>}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Risk Type</label>
                            <select required value={riskForm.type} onChange={e => setRiskForm({...riskForm, type: e.target.value})} className="w-full border rounded-lg p-2 mt-1 bg-white">
                                <option value="landslide">Landslide (滑坡)</option>
                                <option value="no_signal">No Signal (无信号)</option>
                                <option value="cliff">Cliff (悬崖)</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Latitude</label>
                                <input required type="number" step="0.0001" value={riskForm.lat} onChange={e => setRiskForm({...riskForm, lat: e.target.value})} className="w-full border rounded-lg p-2 mt-1" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Longitude</label>
                                <input required type="number" step="0.0001" value={riskForm.lng} onChange={e => setRiskForm({...riskForm, lng: e.target.value})} className="w-full border rounded-lg p-2 mt-1" />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Radius (meters)</label>
                            <input required type="number" value={riskForm.radius} onChange={e => setRiskForm({...riskForm, radius: e.target.value})} className="w-full border rounded-lg p-2 mt-1" />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Warning Message</label>
                            <textarea required value={riskForm.message} onChange={e => setRiskForm({...riskForm, message: e.target.value})} className="w-full border rounded-lg p-2 mt-1" rows={2} placeholder="e.g. Loose rocks ahead..." />
                        </div>

                        <button type="submit" disabled={loading} className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2">
                             {loading ? <Loader className="animate-spin" size={20} /> : <AlertTriangle size={20} />}
                             Add Risk Zone
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default AdminView;