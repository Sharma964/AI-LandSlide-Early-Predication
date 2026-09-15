import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';

import { Dashboard } from './pages/Dashboard';
import { MapView } from './pages/MapView';
import { PredictionView } from './pages/PredictionView';
import { HistoryView } from './pages/HistoryView';
import { AdministrativeView } from './pages/AdministrativeView';
import { ModelView } from './pages/ModelView';
import { DataSourcesView } from './pages/DataSourcesView';
import { AlertsView } from './pages/AlertsView';
import { ReportsView } from './pages/ReportsView';
import { SettingsView } from './pages/SettingsView';

import {
  fetchDashboardStats, fetchPredictionHistory, fetchAlerts,
  getStoredAuth, clearStoredAuth
} from './services/api';
import { DashboardStats, StoredPrediction, AlertItem, UserProfile } from './types';
import { AuthModal } from './components/AuthModal';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentPredictions, setRecentPredictions] = useState<StoredPrediction[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<AlertItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Authentication State (Guests operate without restriction)
  const [user, setUser] = useState<UserProfile | null>(() => getStoredAuth().user);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const handleSignOut = () => {
    clearStoredAuth();
    setUser(null);
  };

  const loadGlobalData = async () => {
    setIsRefreshing(true);
    try {
      const [s, preds, alts] = await Promise.all([
        fetchDashboardStats(),
        fetchPredictionHistory({ limit: 10 }),
        fetchAlerts('ACTIVE')
      ]);
      setStats(s);
      setRecentPredictions(preds);
      setActiveAlerts(alts);
    } catch (e) {
      console.error('Failed to load global data:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadGlobalData();
    const interval = setInterval(loadGlobalData, 60000); // 1-minute telemetry poll
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Inter',sans-serif]">
      {/* 1. Top Header with Live NPT Clock & Auth Identity */}
      <Header
        activeAlertsCount={activeAlerts.length}
        dataStatus={stats?.data_status || 'LIVE'}
        onRefresh={loadGlobalData}
        isRefreshing={isRefreshing}
        onNavigateAlerts={() => setActiveTab('alerts')}
        user={user}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onSignOut={handleSignOut}
      />

      {/* 3. Main Workspace Layout */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          modelStatus={stats?.model_status || 'TRAINED'}
          activeAlertsCount={activeAlerts.length}
        />

        {/* Content View Container */}
        <main className="flex-1 min-w-0 bg-slate-950/60 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <Dashboard
              stats={stats}
              recentPredictions={recentPredictions}
              activeAlerts={activeAlerts}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'map' && (
            <MapView
              onSelectLocationForPrediction={() => setActiveTab('predict')}
            />
          )}

          {activeTab === 'predict' && <PredictionView />}

          {activeTab === 'history' && <HistoryView />}

          {activeTab === 'admin' && (
            <AdministrativeView
              onSelectDistrictForPrediction={() => setActiveTab('predict')}
            />
          )}

          {activeTab === 'model' && <ModelView />}

          {activeTab === 'sources' && <DataSourcesView />}

          {activeTab === 'alerts' && <AlertsView />}

          {activeTab === 'reports' && (
            <ReportsView latestPrediction={stats?.latest_prediction} />
          )}

          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* 4. Authentication Modal (Login / Signup / Guest Mode) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(newUser) => setUser(newUser)}
      />
    </div>
  );
};

export default App;
