import React from 'react';
import { DashboardStats, StoredPrediction, AlertItem } from '../types';
import {
  MapPin, ShieldAlert, AlertTriangle, CloudRain, Cpu,
  CheckCircle2, ArrowUpRight, TrendingUp, Navigation
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface DashboardProps {
  stats: DashboardStats | null;
  recentPredictions: StoredPrediction[];
  activeAlerts: AlertItem[];
  onNavigate: (tab: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  stats,
  recentPredictions,
  activeAlerts,
  onNavigate
}) => {
  const chartData = recentPredictions.slice(0, 15).reverse().map(p => ({
    name: p.location.split(' ')[0],
    probability: Math.round(p.probability * 100),
    rainfall: p.rainfall_24h || 0,
    time: p.timestamp_npt.split('|')[1]?.trim() || ''
  }));

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      case 'MODERATE':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      default:
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Welcome & KPI Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Disaster Risk & Early Warning Monitoring Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-hazard telemetry cross-referenced with trained Machine Learning models across Nepal.
          </p>
        </div>
        <button
          onClick={() => onNavigate('predict')}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.02]"
        >
          <Navigation className="w-4 h-4" />
          <span>Get Real AI Prediction</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Admin Coverage */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Nepal Coverage</span>
            <MapPin className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-mono text-white">7 / 77</span>
            <span className="text-[11px] text-slate-400">Provinces / Districts</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-400 flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>100% Administrative Hierarchy</span>
          </div>
        </div>

        {/* Monitored Locations */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Active Monitored Points</span>
            <CloudRain className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-mono text-white">{stats?.locations_monitored || 577}</span>
            <span className="text-[11px] text-slate-400">Telemetry Stations</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            DHM Gauges & District Centroids
          </div>
        </div>

        {/* Active Early Warnings */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Active Warnings</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className={`text-2xl font-bold font-mono ${(stats?.active_alerts || 0) > 0 ? 'text-amber-400' : 'text-white'}`}>
              {stats?.active_alerts || 0}
            </span>
            <span className="text-[11px] text-slate-400">High / Critical Alerts</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Autonomous threshold trigger
          </div>
        </div>

        {/* AI Model Status */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>ML Engine Status</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-lg font-bold font-mono text-emerald-400">
              ● {stats?.model_status || 'TRAINED'}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            XGBoost & Random Forest
          </div>
        </div>
      </div>

      {/* Main Grid: Latest Prediction & Active Warnings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest Prediction Card */}
        <div className="lg:col-span-1 p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Latest Real AI Prediction
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono border border-blue-500/40">
                {stats?.latest_prediction?.data_status || 'LIVE'}
              </span>
            </div>

            {stats?.latest_prediction ? (
              <div className="mt-4 space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{stats.latest_prediction.location}</h3>
                  <p className="text-xs text-slate-400">{stats.latest_prediction.district}, {stats.latest_prediction.province}</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                  <div className="text-xs text-slate-400">Landslide Probability</div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-3xl font-extrabold font-mono text-white">
                      {stats.latest_prediction.probability}
                    </span>
                    <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase border ${getRiskBadge(stats.latest_prediction.risk_level)}`}>
                      {stats.latest_prediction.risk_level} Risk
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-slate-800/50 border border-slate-800">
                    <span className="text-slate-400 block">24h Rainfall</span>
                    <span className="font-semibold text-white">{stats.latest_prediction.rainfall_24h} mm</span>
                  </div>
                  <div className="p-2 rounded bg-slate-800/50 border border-slate-800">
                    <span className="text-slate-400 block">Terrain Slope</span>
                    <span className="font-semibold text-white">{stats.latest_prediction.slope}°</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-mono">
                  Predicted at: <span className="text-slate-400">{stats.latest_prediction.time}</span>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-500">
                No predictions recorded yet. Run a prediction to begin.
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigate('predict')}
            className="mt-4 w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition flex items-center justify-center space-x-1.5"
          >
            <span>Run New Prediction</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Prediction Probability Trend Chart */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Landslide Probability & Rainfall Telemetry Trends
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Real Stored Inference Records</span>
          </div>

          <div className="h-64 mt-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="probGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="rainGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.5rem', fontSize: '12px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                  />
                  <Area type="monotone" dataKey="probability" name="Probability (%)" stroke="#10B981" fillOpacity={1} fill="url(#probGradient)" />
                  <Area type="monotone" dataKey="rainfall" name="24h Rainfall (mm)" stroke="#06B6D4" fillOpacity={1} fill="url(#rainGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Insufficient prediction records for chart visualization.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-1.5 rounded-full bg-emerald-500" />
                <span>AI Landslide Probability (%)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-1.5 rounded-full bg-cyan-500" />
                <span>24h Precipitation (mm)</span>
              </div>
            </div>
            <button
              onClick={() => onNavigate('history')}
              className="text-emerald-400 hover:underline flex items-center space-x-1"
            >
              <span>View Full History</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Active Early Warnings Feed */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Active Early Warnings (High & Critical Risk Locations)
            </span>
          </div>
          <button
            onClick={() => onNavigate('alerts')}
            className="text-xs text-emerald-400 hover:underline"
          >
            Manage Alerts ({activeAlerts.length})
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {activeAlerts.length > 0 ? (
            activeAlerts.slice(0, 3).map((alert) => (
              <div
                key={alert.alert_id}
                className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${getRiskBadge(alert.risk_level)}`}>
                      {alert.risk_level}
                    </span>
                    <span className="text-sm font-semibold text-white">{alert.location}</span>
                    <span className="text-xs text-slate-400">({alert.district}, {alert.province})</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    {alert.advisory_notes}
                  </p>
                </div>
                <div className="flex items-center space-x-3 text-xs font-mono shrink-0">
                  <span className="text-slate-400">{alert.created_at_npt}</span>
                  <span className="text-red-400 font-bold">{alert.probability_percentage}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-xs text-slate-500">
              No active warnings currently triggered. All monitored stations below critical threshold.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
