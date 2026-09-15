import React, { useState, useEffect } from 'react';
import {
  Province, District, LocationItem, PredictionResult
} from '../types';
import {
  fetchProvinces, fetchDistricts, fetchLocations, requestPrediction
} from '../services/api';
import {
  BrainCircuit, MapPin, CloudRain, Mountain, ShieldAlert,
  AlertTriangle, CheckCircle2, RefreshCw, Layers, ArrowRight,
  TrendingUp, TrendingDown, Clock, ShieldCheck
} from 'lucide-react';

export const PredictionView: React.FC = () => {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);

  const [selectedProvId, setSelectedProvId] = useState<number | ''>('');
  const [selectedDistId, setSelectedDistId] = useState<number | ''>('');
  const [selectedLocId, setSelectedLocId] = useState<number | ''>('');
  const [selectedModel, setSelectedModel] = useState<string>('XGBoost');

  const [customLat, setCustomLat] = useState<string>('');
  const [customLon, setCustomLon] = useState<string>('');
  const [useCustomCoords, setUseCustomCoords] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch Provinces on Mount
  useEffect(() => {
    fetchProvinces()
      .then(data => {
        setProvinces(data);
        // Default to Bagmati Province (id=3) if present
        const bagmati = data.find(p => p.id === 3 || p.title_en?.toLowerCase().includes('bagmati'));
        if (bagmati) setSelectedProvId(bagmati.id);
        else if (data.length > 0) setSelectedProvId(data[0].id);
      })
      .catch(err => console.error('Failed to load provinces:', err));
  }, []);

  // 2. Fetch Districts when Province changes
  useEffect(() => {
    if (!selectedProvId) {
      setDistricts([]);
      return;
    }
    fetchDistricts(Number(selectedProvId))
      .then(data => {
        setDistricts(data);
        if (data.length > 0) {
          // Select first district or Sindhupalchok if in Bagmati
          const defaultDist = data.find(d => d.title_en?.toLowerCase().includes('sindhupalchok')) || data[0];
          setSelectedDistId(defaultDist.id);
        } else {
          setSelectedDistId('');
        }
      })
      .catch(err => console.error('Failed to load districts:', err));
  }, [selectedProvId]);

  // 3. Fetch Locations when District changes
  useEffect(() => {
    if (!selectedDistId) {
      setLocations([]);
      return;
    }
    fetchLocations(Number(selectedDistId))
      .then(data => {
        setLocations(data);
        if (data.length > 0) {
          setSelectedLocId(data[0].id);
        } else {
          setSelectedLocId('');
        }
      })
      .catch(err => console.error('Failed to load locations:', err));
  }, [selectedDistId]);

  // Submit Prediction
  const handleGetPrediction = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      setLoadingStep('Resolving geospatial coordinates & nearest DHM telemetry...');
      await new Promise(r => setTimeout(r, 400));

      setLoadingStep('Ingesting real-time rainfall & DEM terrain finite-difference slope...');
      await new Promise(r => setTimeout(r, 400));

      setLoadingStep(`Running trained ${selectedModel} model inference (predict_proba)...`);

      let payload: any = { model_name: selectedModel };
      if (useCustomCoords && customLat && customLon) {
        payload.lat = parseFloat(customLat);
        payload.lon = parseFloat(customLon);
        payload.location_name = `Custom GPS (${payload.lat.toFixed(4)}, ${payload.lon.toFixed(4)})`;
      } else {
        payload.province_id = Number(selectedProvId);
        payload.district_id = Number(selectedDistId);
        payload.location_id = selectedLocId ? Number(selectedLocId) : undefined;
      }

      const res = await requestPrediction(payload);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to complete prediction request.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const getRiskBadge = (risk?: string) => {
    switch (risk) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'MODERATE':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
      default:
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
          <BrainCircuit className="w-5 h-5 text-emerald-400" />
          <span>Real AI Landslide Prediction Engine</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Select an administrative boundary or coordinate. The backend collects authentic real-time DHM/Open-Meteo rainfall telemetry and Copernicus DEM terrain features before executing the trained ML model.
        </p>
      </div>

      {/* Cascading Selection Form */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <MapPin className="w-4 h-4 text-blue-400" />
            <span>Select Administrative Hierarchy (Nepal)</span>
          </div>
          <button
            onClick={() => setUseCustomCoords(!useCustomCoords)}
            className="text-xs text-emerald-400 hover:underline"
          >
            {useCustomCoords ? '← Switch to Province/District Selection' : '+ Use Custom GPS Coordinates'}
          </button>
        </div>

        {!useCustomCoords ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1: Province */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                1. Province (7 Provinces)
              </label>
              <select
                value={selectedProvId}
                onChange={(e) => setSelectedProvId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                {provinces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title_en} {p.title_ne ? `(${p.title_ne})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: District */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                2. District (77 Districts)
              </label>
              <select
                value={selectedDistId}
                onChange={(e) => setSelectedDistId(e.target.value ? Number(e.target.value) : '')}
                disabled={districts.length === 0}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title_en} {d.title_ne ? `(${d.title_ne})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 3: Location */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                3. Monitored Location / DHM Station
              </label>
              <select
                value={selectedLocId}
                onChange={(e) => setSelectedLocId(e.target.value ? Number(e.target.value) : '')}
                disabled={locations.length === 0}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.title} {loc.elevation ? `(${loc.elevation}m)` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Latitude (° N) [Nepal Bounds: 26.34 - 30.45]
              </label>
              <input
                type="number"
                step="0.0001"
                placeholder="e.g. 27.9521"
                value={customLat}
                onChange={(e) => setCustomLat(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Longitude (° E) [Nepal Bounds: 80.05 - 88.20]
              </label>
              <input
                type="number"
                step="0.0001"
                placeholder="e.g. 85.6812"
                value={customLon}
                onChange={(e) => setCustomLon(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Model Selection & Execution Button */}
        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3 text-xs">
            <span className="text-slate-400">ML Model Algorithm:</span>
            <label className="flex items-center space-x-1.5 text-white cursor-pointer">
              <input
                type="radio"
                name="model"
                value="XGBoost"
                checked={selectedModel === 'XGBoost'}
                onChange={() => setSelectedModel('XGBoost')}
                className="text-emerald-500 focus:ring-0"
              />
              <span className="font-semibold">XGBoost (Recommended)</span>
            </label>
            <label className="flex items-center space-x-1.5 text-white cursor-pointer">
              <input
                type="radio"
                name="model"
                value="Random Forest"
                checked={selectedModel === 'Random Forest'}
                onChange={() => setSelectedModel('Random Forest')}
                className="text-emerald-500 focus:ring-0"
              />
              <span>Random Forest</span>
            </label>
          </div>

          <button
            onClick={handleGetPrediction}
            disabled={loading || (!useCustomCoords && !selectedDistId)}
            className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-lg shadow-emerald-900/40 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processing Real Data...</span>
              </>
            ) : (
              <>
                <BrainCircuit className="w-4 h-4" />
                <span>GET REAL AI PREDICTION</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Multi-stage loading progress display */}
      {loading && (
        <div className="p-4 rounded-xl bg-slate-900/80 border border-emerald-500/30 flex items-center space-x-3 animate-pulse">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-mono text-emerald-400">{loadingStep}</span>
        </div>
      )}

      {/* Error / Data Unavailable Display */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-200 space-y-1">
          <div className="font-bold flex items-center space-x-1.5 text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <span>REAL PREDICTION UNAVAILABLE</span>
          </div>
          <p>{error}</p>
        </div>
      )}

      {/* Result Card (When prediction is available) */}
      {result && (
        <div className="space-y-4">
          {result.prediction_status === 'UNAVAILABLE' ? (
            /* Explicit Data / Model Unavailable Notification */
            <div className="p-6 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-3">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                <AlertTriangle className="w-5 h-5" />
                <span>REAL PREDICTION UNAVAILABLE – REQUIRED DATA/MODEL NOT AVAILABLE</span>
              </div>
              <p className="text-xs text-slate-300">
                {result.message || 'The system could not retrieve the required real-time rainfall observations or DEM elevation parameters for this point.'}
              </p>
              {result.missing_inputs && (
                <div className="text-xs text-slate-400">
                  <span>Missing required components: </span>
                  <strong className="text-amber-300">{result.missing_inputs.join(', ')}</strong>
                </div>
              )}
              <div className="text-[11px] text-slate-500 font-mono">
                No synthetic or guessed values are generated in accordance with scientific validation standards.
              </div>
            </div>
          ) : (
            /* Authentic AI Prediction Layout */
            <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono text-[10px] font-bold">
                      ● {result.data_status} DATA
                    </span>
                    <span className="text-slate-400 text-xs">•</span>
                    <span className="text-xs text-slate-400 font-mono">ID: {result.prediction_id}</span>
                  </div>
                  <h3 className="text-xl font-extrabold text-white mt-1">{result.location}</h3>
                  <p className="text-xs text-slate-400">
                    {result.district}, {result.province} • Coordinates: {result.coordinates?.lat.toFixed(4)}°N, {result.coordinates?.lon.toFixed(4)}°E
                  </p>
                </div>

                <div className="text-right font-mono text-xs text-slate-400">
                  <div className="flex items-center md:justify-end space-x-1.5 text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{result.prediction_time_npt}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Model: <strong className="text-white">{result.model}</strong> ({result.model_version})
                  </div>
                </div>
              </div>

              {/* Centerpiece: Probability & Risk Level */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="p-5 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold block">
                    AI Landslide Probability
                  </span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-4xl font-black font-mono text-white tracking-tight">
                      {result.probability_percentage}
                    </span>
                    <span className={`px-3 py-1 rounded-md text-xs font-extrabold uppercase border ${getRiskBadge(result.risk_level)}`}>
                      {result.risk_level} RISK
                    </span>
                  </div>

                  {/* Previous Comparison Delta */}
                  {result.previous_comparison && (
                    <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-500">Previous: {result.previous_comparison.previous_percentage}</span>
                      <div className="flex items-center space-x-1">
                        {result.previous_comparison.change_percentage_points.startsWith('+') ? (
                          <TrendingUp className="w-3.5 h-3.5 text-red-400" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        <span className={result.previous_comparison.change_percentage_points.startsWith('+') ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                          {result.previous_comparison.change_percentage_points}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Top Factors Breakdown */}
                <div className="space-y-2">
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold block">
                    Top Contributing Factors (Model Feature Importance)
                  </span>
                  {result.top_contributing_factors?.map((factor, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/60 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-white">{idx + 1}. {factor.label}</span>
                        <span className="text-slate-400 ml-2">({factor.description})</span>
                      </div>
                      <span className="font-mono text-emerald-400 font-bold">
                        {(factor.importance_weight * 100).toFixed(1)}% weight
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Environmental Features Full Matrix */}
              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold block mb-2">
                  Exact Real Environmental Input Features
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">24h Rainfall</span>
                    <strong className="text-cyan-400 font-mono text-sm">{result.features?.rainfall_24h} mm</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">3-Day Rain</span>
                    <strong className="text-cyan-400 font-mono text-sm">{result.features?.rainfall_3day} mm</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">7-Day Rain</span>
                    <strong className="text-cyan-400 font-mono text-sm">{result.features?.rainfall_7day} mm</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Antecedent</span>
                    <strong className="text-cyan-400 font-mono text-sm">{result.features?.antecedent_rainfall} mm</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Elevation</span>
                    <strong className="text-white font-mono text-sm">{result.features?.elevation} m</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Terrain Slope</span>
                    <strong className="text-white font-mono text-sm">{result.features?.slope}°</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Aspect</span>
                    <strong className="text-white font-mono text-sm">{result.features?.aspect}°</strong>
                  </div>
                </div>
              </div>

              {/* Early Warning Trigger Notice */}
              {result.alert_triggered && (
                <div className="p-4 rounded-lg bg-red-950/40 border border-red-500/40 flex items-center space-x-3 text-xs text-red-200">
                  <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
                  <div>
                    <strong className="text-red-300 block font-semibold">
                      ⚠ HIGH / CRITICAL RISK LEVEL REACHED
                    </strong>
                    <span>
                      An automated early warning advisory record has been registered into the active alerts log. AI indicates elevated landslide susceptibility.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
