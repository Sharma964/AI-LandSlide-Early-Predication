import React, { useState, useEffect } from 'react';
import { fetchSettings, updateSettings, sendTestAlertEmail } from '../services/api';
import { Settings, Save, CheckCircle2, ShieldAlert, Sliders, Info, Mail, Send, Key, Eye, EyeOff, AlertTriangle } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [preferredModel, setPreferredModel] = useState('XGBoost');
  const [refreshMinutes, setRefreshMinutes] = useState(10);
  const [lowThreshold, setLowThreshold] = useState(0.25);
  const [modThreshold, setModThreshold] = useState(0.50);
  const [highThreshold, setHighThreshold] = useState(0.75);

  // Gmail SMTP States
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpEmail, setSmtpEmail] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpSenderName, setSmtpSenderName] = useState('Nepal AI Landslide Early Warning System');
  const [smtpEnabled, setSmtpEnabled] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Test Email States
  const [testRecipient, setTestRecipient] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings().then((s) => {
      if (s.preferred_model) setPreferredModel(s.preferred_model);
      if (s.auto_refresh_minutes) setRefreshMinutes(Number(s.auto_refresh_minutes));
      if (s.low_threshold) setLowThreshold(Number(s.low_threshold));
      if (s.mod_threshold) setModThreshold(Number(s.mod_threshold));
      if (s.high_threshold) setHighThreshold(Number(s.high_threshold));
      if (s.smtp_host) setSmtpHost(s.smtp_host);
      if (s.smtp_port) setSmtpPort(Number(s.smtp_port));
      if (s.smtp_email) {
        setSmtpEmail(s.smtp_email);
        if (!testRecipient) setTestRecipient(s.smtp_email);
      }
      if (s.smtp_password) setSmtpPassword(s.smtp_password);
      if (s.smtp_sender_name) setSmtpSenderName(s.smtp_sender_name);
      if (s.smtp_enabled !== undefined) setSmtpEnabled(s.smtp_enabled === 'true');
    });
  }, []);

  const handleSendTestEmail = async () => {
    if (!testRecipient.trim()) {
      setTestResult({ success: false, message: 'Please provide a recipient email address.' });
      return;
    }
    setSendingTest(true);
    setTestResult(null);
    try {
      // First save current settings to backend so test uses current credentials
      await updateSettings({
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_email: smtpEmail,
        smtp_password: smtpPassword,
        smtp_sender_name: smtpSenderName,
        smtp_enabled: smtpEnabled
      });

      const res = await sendTestAlertEmail(testRecipient.trim());
      setTestResult({ success: true, message: res.message || 'Test email dispatched successfully! Please check your inbox.' });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Failed to dispatch test email.' });
    } finally {
      setSendingTest(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await updateSettings({
        preferred_model: preferredModel,
        auto_refresh_minutes: refreshMinutes,
        low_threshold: lowThreshold,
        mod_threshold: modThreshold,
        high_threshold: highThreshold,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_email: smtpEmail,
        smtp_password: smtpPassword,
        smtp_sender_name: smtpSenderName,
        smtp_enabled: smtpEnabled
      });
      setMessage('System and Gmail SMTP configuration saved successfully.');
    } catch (e: any) {
      console.error('Settings save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
          <Settings className="w-5 h-5 text-emerald-400" />
          <span>System & Threshold Configuration</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Customize risk classification breakpoints, default inference algorithms, and refresh cycles.
        </p>
      </div>

      {message && (
        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-200 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-6 shadow-sm">
        {/* Preferred Algorithm */}
        <div>
          <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-2">
            Default Machine Learning Algorithm
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className={`p-3 rounded-lg border cursor-pointer flex items-center space-x-3 ${
              preferredModel === 'XGBoost' ? 'bg-emerald-500/10 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}>
              <input
                type="radio"
                name="preferred"
                value="XGBoost"
                checked={preferredModel === 'XGBoost'}
                onChange={() => setPreferredModel('XGBoost')}
                className="text-emerald-500 focus:ring-0"
              />
              <div>
                <strong className="block text-white">XGBoost Classifier</strong>
                <span className="text-[11px] text-slate-400">Extreme Gradient Boosted Decision Trees</span>
              </div>
            </label>

            <label className={`p-3 rounded-lg border cursor-pointer flex items-center space-x-3 ${
              preferredModel === 'Random Forest' ? 'bg-emerald-500/10 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}>
              <input
                type="radio"
                name="preferred"
                value="Random Forest"
                checked={preferredModel === 'Random Forest'}
                onChange={() => setPreferredModel('Random Forest')}
                className="text-emerald-500 focus:ring-0"
              />
              <div>
                <strong className="block text-white">Random Forest Classifier</strong>
                <span className="text-[11px] text-slate-400">Ensemble of 120 decorrelated decision trees</span>
              </div>
            </label>
          </div>
        </div>

        {/* Auto Refresh Cadence */}
        <div>
          <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-2">
            Telemetry Auto-Refresh Interval
          </label>
          <select
            value={refreshMinutes}
            onChange={(e) => setRefreshMinutes(Number(e.target.value))}
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            <option value={5}>Every 5 minutes</option>
            <option value={10}>Every 10 minutes (Recommended)</option>
            <option value={15}>Every 15 minutes</option>
            <option value={30}>Every 30 minutes</option>
          </select>
        </div>

        {/* Configurable Risk Thresholds */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <div className="flex items-center space-x-2 text-xs font-semibold text-white uppercase tracking-wider">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>Configurable Prototype Risk Thresholds</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <label className="text-slate-400 block mb-1">Low / Moderate Threshold</label>
              <input
                type="number"
                step="0.05"
                min="0.10"
                max="0.40"
                value={lowThreshold}
                onChange={(e) => setLowThreshold(parseFloat(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-white font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Default: 0.25 (25%)</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <label className="text-slate-400 block mb-1">Moderate / High Threshold</label>
              <input
                type="number"
                step="0.05"
                min="0.30"
                max="0.70"
                value={modThreshold}
                onChange={(e) => setModThreshold(parseFloat(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-white font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Default: 0.50 (50%)</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <label className="text-slate-400 block mb-1">High / Critical Threshold</label>
              <input
                type="number"
                step="0.05"
                min="0.60"
                max="0.95"
                value={highThreshold}
                onChange={(e) => setHighThreshold(parseFloat(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-white font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Default: 0.75 (75%)</span>
            </div>
          </div>
        </div>

        {/* Gmail Alert Dispatch Configuration */}
        <div className="space-y-4 pt-6 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold text-white uppercase tracking-wider">
              <Mail className="w-4 h-4 text-emerald-400" />
              <span>Gmail Alert Dispatch Configuration (Province & District-Wise)</span>
            </div>
            <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={smtpEnabled}
                onChange={(e) => setSmtpEnabled(e.target.checked)}
                className="rounded text-emerald-500 focus:ring-0"
              />
              <span>Enable Email Warnings</span>
            </label>
          </div>

          <p className="text-xs text-slate-400">
            Configure the Gmail account used by the system to dispatch automated high & critical early warning messages to citizens and response officers registered in affected provinces & districts.
          </p>

          {/* Quick Help Guide for Gmail App Password */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2 text-slate-300">
            <div className="flex items-center space-x-2 text-amber-400 font-semibold">
              <Key className="w-4 h-4 shrink-0" />
              <span>How to configure Gmail SMTP with a Google App Password:</span>
            </div>
            <ol className="list-decimal pl-5 space-y-1 text-[11px] text-slate-400">
              <li>Open your Google Account at <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-emerald-400 underline">myaccount.google.com/security</a>.</li>
              <li>Ensure <strong>2-Step Verification</strong> is turned ON.</li>
              <li>Search for or go to <strong>App passwords</strong> (<a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-emerald-400 underline">myaccount.google.com/apppasswords</a>).</li>
              <li>Create a new App Password named <em>Nepal Landslide Alert</em> and copy the generated 16-character key below.</li>
            </ol>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Gmail Sender Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="email"
                  value={smtpEmail}
                  onChange={(e) => setSmtpEmail(e.target.value)}
                  placeholder="yourdisasteralerts@gmail.com"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Google 16-Character App Password
              </label>
              <div className="relative">
                <Key className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full pl-9 pr-10 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Sender Display Name
              </label>
              <input
                type="text"
                value={smtpSenderName}
                onChange={(e) => setSmtpSenderName(e.target.value)}
                placeholder="Nepal Landslide Early Warning Center"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  SMTP Host
                </label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  SMTP Port
                </label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Diagnostic Test Email Dispatcher */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400">
              <Send className="w-4 h-4" />
              <span>Verify Gmail Connection (Send Live Test Email)</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="recipient@gmail.com for test alert"
                className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={sendingTest}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center space-x-1.5"
              >
                <Send className={`w-3.5 h-3.5 ${sendingTest ? 'animate-spin' : ''}`} />
                <span>{sendingTest ? 'Dispatching...' : 'Dispatch Test Alert'}</span>
              </button>
            </div>

            {testResult && (
              <div className={`p-3 rounded-lg text-xs flex items-start space-x-2 ${
                testResult.success
                  ? 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/50 border border-rose-500/40 text-rose-200'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Protection Note */}
        <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-500/20 text-xs text-slate-400 flex items-center space-x-2">
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            Strict Data Honesty Policy: Users cannot manually alter computed prediction probabilities. Only category classification thresholds and notification channels are configurable.
          </span>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow flex items-center space-x-2"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </form>
    </div>
  );
};
