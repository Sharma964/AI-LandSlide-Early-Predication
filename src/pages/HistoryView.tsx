import React, { useState, useEffect } from 'react';
import { StoredPrediction } from '../types';
import { fetchPredictionHistory } from '../services/api';
import {
  History, Filter, Download, Search, RefreshCw, AlertTriangle
} from 'lucide-react';

export const HistoryView: React.FC = () => {
  const [predictions, setPredictions] = useState<StoredPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [provinceFilter, setProvinceFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await fetchPredictionHistory({
        province: provinceFilter || undefined,
        district: districtFilter || undefined,
        risk_level: riskFilter || undefined,
        model: modelFilter || undefined,
        limit: 100
      });
      setPredictions(data);
    } catch (e) {
      console.error('Failed to load history:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [provinceFilter, districtFilter, riskFilter, modelFilter]);

  const exportCSV = () => {
    if (predictions.length === 0) return;
    const headers = ['Prediction ID', 'Timestamp NPT', 'Province', 'District', 'Location', 'Probability (%)', 'Risk Level', '24h Rain (mm)', 'Elevation (m)', 'Slope (deg)', 'Model', 'Data Status'];
    const rows = predictions.map(p => [
      p.prediction_id,
      p.timestamp_npt,
      `"${p.province}"`,
      `"${p.district}"`,
      `"${p.location}"`,
      (p.probability * 100).toFixed(2),
      p.risk_level,
      p.rainfall_24h,
      p.elevation,
      p.slope,
      p.model,
      p.data_status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nepal_landslide_predictions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'CRITICAL': return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'HIGH': return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      case 'MODERATE': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      default: return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
            <History className="w-5 h-5 text-emerald-400" />
            <span>Prediction Audit History & Records</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Permanent database audit log of real ML inferences executed with actual telemetry.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={loadHistory}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            title="Refresh History"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
          <button
            onClick={exportCSV}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-white flex items-center space-x-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div>
          <label className="block text-slate-400 mb-1">Province Search</label>
          <input
            type="text"
            placeholder="e.g. Bagmati"
            value={provinceFilter}
            onChange={(e) => setProvinceFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-1">District Search</label>
          <input
            type="text"
            placeholder="e.g. Sindhupalchok"
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Risk Classification</label>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Risk Tiers</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MODERATE">MODERATE</option>
            <option value="LOW">LOW</option>
          </select>
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Model Algorithm</label>
          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Models</option>
            <option value="XGBoost">XGBoost</option>
            <option value="Random Forest">Random Forest</option>
          </select>
        </div>
      </div>

      {/* Predictions Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Date / Time (NPT)</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">District / Prov</th>
                <th className="py-3 px-4">Probability</th>
                <th className="py-3 px-4">Risk Level</th>
                <th className="py-3 px-4">24h Rain</th>
                <th className="py-3 px-4">Slope</th>
                <th className="py-3 px-4">Model</th>
                <th className="py-3 px-4">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {predictions.length > 0 ? (
                predictions.map((p) => (
                  <tr key={p.prediction_id} className="hover:bg-slate-800/40 transition font-sans">
                    <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {p.timestamp_npt}
                    </td>
                    <td className="py-3 px-4 font-medium text-white">
                      {p.location}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {p.district}, {p.province}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {p.probability_percentage}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${getRiskBadge(p.risk_level)}`}>
                        {p.risk_level}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-cyan-400">
                      {p.rainfall_24h} mm
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {p.slope}°
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {p.model}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-400 text-[10px]">
                      {p.data_status}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No predictions found matching current filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
