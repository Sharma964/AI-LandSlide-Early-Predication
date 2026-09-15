import React, { useState, useEffect } from 'react';
import { AlertItem, AlertNotification } from '../types';
import { fetchAlerts, updateAlertStatus, broadcastAlertEmail, fetchAlertNotifications } from '../services/api';
import {
  AlertOctagon, CheckCircle2, Clock, ShieldAlert,
  ChevronRight, RefreshCw, Filter, Mail, Send, AlertTriangle,
  History, UserCheck
} from 'lucide-react';

export const AlertsView: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [broadcastingId, setBroadcastingId] = useState<string | null>(null);
  const [broadcastMsg, setBroadcastMsg] = useState<{ id: string; text: string; success: boolean } | null>(null);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await fetchAlerts(filterStatus || undefined);
      setAlerts(data);
    } catch (e) {
      console.error('Failed to load alerts:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const data = await fetchAlertNotifications(50);
      setNotifications(data);
    } catch (e) {
      console.error('Failed to load email notifications:', e);
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    loadNotifications();
  }, [filterStatus]);

  const handleStatusChange = async (alertId: string, newStatus: string) => {
    try {
      await updateAlertStatus(alertId, newStatus);
      await loadAlerts();
    } catch (e) {
      console.error('Failed to update alert:', e);
    }
  };

  const handleBroadcastEmail = async (alertId: string) => {
    setBroadcastingId(alertId);
    setBroadcastMsg(null);
    try {
      const res = await broadcastAlertEmail(alertId);
      setBroadcastMsg({
        id: alertId,
        text: res.message || 'Gmail alert broadcast complete!',
        success: true
      });
      await loadNotifications();
    } catch (err: any) {
      setBroadcastMsg({
        id: alertId,
        text: err.message || 'Failed to dispatch broadcast email.',
        success: false
      });
    } finally {
      setBroadcastingId(null);
    }
  };

  const getRiskBadge = (risk: string) => {
    return risk === 'CRITICAL'
      ? 'bg-red-500/20 text-red-400 border-red-500/40'
      : 'bg-orange-500/20 text-orange-400 border-orange-500/40';
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'ACTIVE': return 'bg-red-600 text-white animate-pulse';
      case 'MONITORING': return 'bg-amber-600 text-white';
      default: return 'bg-slate-700 text-slate-300';
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
            <AlertOctagon className="w-5 h-5 text-amber-400" />
            <span>Early Warning Advisories & Active Alerts</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Automated alerts registered when real model inference crosses High or Critical risk thresholds.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="MONITORING">MONITORING</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>
          <button
            onClick={loadAlerts}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {alerts.length > 0 ? (
          alerts.map((a) => (
            <div
              key={a.alert_id}
              className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${getStatusBadge(a.status)}`}>
                    {a.status}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${getRiskBadge(a.risk_level)}`}>
                    {a.risk_level} RISK
                  </span>
                  <h3 className="text-base font-bold text-white">{a.location}</h3>
                  <span className="text-xs text-slate-400">({a.district}, {a.province})</span>
                </div>
                <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{a.created_at_npt}</span>
                </div>
              </div>

              <p className="text-xs text-slate-200">
                {a.advisory_notes}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Landslide Probability</span>
                  <strong className="text-white text-sm">{a.probability_percentage}</strong>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">24h Rainfall</span>
                  <strong className="text-cyan-400 text-sm">{a.rainfall_24h} mm</strong>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Slope</span>
                  <strong className="text-white text-sm">{a.slope || 'N/A'}°</strong>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Algorithm</span>
                  <strong className="text-white text-sm">{a.model || 'XGBoost'}</strong>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2 text-slate-500 font-mono">
                  <span>Alert ID: {a.alert_id}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleBroadcastEmail(a.alert_id)}
                    disabled={broadcastingId === a.alert_id}
                    className="px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 transition shadow-sm flex items-center space-x-1.5 disabled:opacity-50"
                    title={`Send urgent Gmail alerts to all users registered in ${a.district}, ${a.province}`}
                  >
                    <Mail className={`w-3.5 h-3.5 ${broadcastingId === a.alert_id ? 'animate-bounce text-emerald-400' : ''}`} />
                    <span>{broadcastingId === a.alert_id ? 'Broadcasting...' : 'Broadcast to Gmail'}</span>
                  </button>

                  {a.status !== 'RESOLVED' && (
                    <button
                      onClick={() => handleStatusChange(a.alert_id, 'RESOLVED')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700 transition"
                    >
                      Mark Resolved
                    </button>
                  )}
                  {a.status === 'ACTIVE' && (
                    <button
                      onClick={() => handleStatusChange(a.alert_id, 'MONITORING')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-amber-600 text-slate-300 hover:text-white border border-slate-700 transition"
                    >
                      Set to Monitoring
                    </button>
                  )}
                </div>
              </div>

              {broadcastMsg && broadcastMsg.id === a.alert_id && (
                <div className={`p-2.5 rounded-lg text-xs flex items-center space-x-2 ${
                  broadcastMsg.success
                    ? 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/50 border border-rose-500/40 text-rose-300'
                }`}>
                  {broadcastMsg.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{broadcastMsg.text}</span>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="p-12 text-center text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
            No early warnings recorded. When predictions cross High or Critical thresholds, they are automatically logged here.
          </div>
        )}
      </div>

      {/* Dispatched Email Delivery Audit Log */}
      <div className="mt-8 pt-6 border-t border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <History className="w-4 h-4 text-emerald-400" />
              <span>Gmail Dispatches & Targeted Notification Log</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Live audit record of alert messages dispatched to citizens and response officers by Province and District.
            </p>
          </div>
          <button
            onClick={loadNotifications}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs flex items-center space-x-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingNotifications ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh Log</span>
          </button>
        </div>

        {notifications.length > 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[10px] uppercase">
                  <tr>
                    <th className="px-4 py-2.5">Time (NPT)</th>
                    <th className="px-4 py-2.5">Recipient</th>
                    <th className="px-4 py-2.5">Target Location</th>
                    <th className="px-4 py-2.5">Subject / Alert</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {notifications.map((n) => (
                    <tr key={n.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                        {n.sent_at_npt}
                      </td>
                      <td className="px-4 py-2.5 text-white">
                        <div className="font-sans font-semibold">{n.recipient_name || 'User'}</div>
                        <div className="text-[10px] text-slate-400">{n.recipient_email}</div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-300 font-sans">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-emerald-400">
                          {n.district || 'Any'}, {n.province || 'Nepal'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-300 max-w-xs truncate font-sans" title={n.subject}>
                        {n.subject}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          n.status === 'SENT'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        }`}>
                          {n.status}
                        </span>
                        {n.details && (
                          <div className="text-[9px] text-slate-500 mt-0.5 max-w-[140px] truncate" title={n.details}>
                            {n.details}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-500 bg-slate-900/60 border border-slate-800 rounded-xl">
            No Gmail alerts have been dispatched yet. When predictions cross High/Critical thresholds or when you test notifications, delivery records will appear here.
          </div>
        )}
      </div>
    </div>
  );
};
