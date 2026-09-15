import React, { useState, useEffect } from 'react';
import { fetchSourcesHealth } from '../services/api';
import { Database, CheckCircle2, AlertCircle, RefreshCw, Globe, ExternalLink, ShieldCheck } from 'lucide-react';

export const DataSourcesView: React.FC = () => {
  const [sourcesData, setSourcesData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadSources = async () => {
    setLoading(true);
    try {
      const data = await fetchSourcesHealth();
      setSourcesData(data);
    } catch (e) {
      console.error('Failed to load sources health:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const sourcesList = [
    {
      id: 'bipad_portal',
      title: 'BIPAD Portal Nepal (NDRRMA / MoHA)',
      url: 'https://bipadportal.gov.np/api/v1/',
      desc: 'Official Government of Nepal disaster information portal. Ingests administrative boundaries, historical hazard-17 landslide incidents, and telemetry.',
      key: 'bipad_portal'
    },
    {
      id: 'dhm_nepal',
      title: 'Department of Hydrology & Meteorology (DHM)',
      url: 'https://dhm.gov.np/',
      desc: 'Automatic weather stations (AWS) and rainfall observation gauges across river basins (Koshi, Gandaki, Narayani, Karnali).',
      key: 'dhm_nepal'
    },
    {
      id: 'open_meteo_rain',
      title: 'NASA GPM IMERG & Open-Meteo Precipitation',
      url: 'https://open-meteo.com/',
      desc: 'Provides high-resolution satellite precipitation grids and historical archive for 24h, 3-day, 7-day, and antecedent rainfall computation.',
      key: 'open_meteo_rain'
    },
    {
      id: 'copernicus_dem',
      title: 'Copernicus & SRTM Digital Elevation Model',
      url: 'https://copernicus.eu/',
      desc: 'Provides global 30-meter topographic elevation raster. Slope and aspect are calculated using a 5-point finite-difference geodetic gradient stencil.',
      key: 'copernicus_dem'
    }
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
            <Database className="w-5 h-5 text-emerald-400" />
            <span>Real Nepal Environmental Data Connectors</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Live ping diagnostics and API connectivity status across all integrated scientific data providers.
          </p>
        </div>
        <button
          onClick={loadSources}
          disabled={loading}
          className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-white flex items-center space-x-1.5 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          <span>Ping All APIs</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sourcesList.map((src) => {
          const liveStatus = sourcesData?.sources?.[src.key];
          const isConnected = liveStatus?.status === 'CONNECTED';

          return (
            <div
              key={src.id}
              className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                    isConnected
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-red-500/20 text-red-400 border-red-500/40'
                  }`}>
                    ● {liveStatus?.status || 'TESTING...'}
                  </span>
                  {liveStatus?.latency_ms && (
                    <span className="text-[10px] font-mono text-slate-400">
                      Latency: {liveStatus.latency_ms} ms
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-white mt-3 flex items-center justify-between">
                  <span>{src.title}</span>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-500 hover:text-emerald-400"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </h3>
                <p className="text-xs text-slate-300 mt-2">
                  {src.desc}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-mono text-slate-500 flex justify-between">
                <span>Verified Status:</span>
                <span className={isConnected ? 'text-emerald-400' : 'text-amber-400'}>
                  {isConnected ? 'API Responding (HTTP 200)' : 'Degraded / Retrying'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
