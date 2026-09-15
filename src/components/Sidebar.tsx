import React from 'react';
import {
  LayoutDashboard, Map, BrainCircuit, History,
  MapPin, Cpu, Database, AlertOctagon, FileText, Settings
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'map'
  | 'predict'
  | 'history'
  | 'admin'
  | 'model'
  | 'sources'
  | 'alerts'
  | 'reports'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  modelStatus: string;
  activeAlertsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  modelStatus,
  activeAlertsCount
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'map', label: 'Nepal GIS Risk Map', icon: Map },
    { id: 'predict', label: 'AI Prediction', icon: BrainCircuit, badge: 'REAL ML' },
    { id: 'history', label: 'Prediction History', icon: History },
    { id: 'admin', label: 'Provinces & Districts', icon: MapPin, meta: '7 / 77' },
    { id: 'model', label: 'AI Model (RF/XGB)', icon: Cpu, badge: modelStatus },
    { id: 'sources', label: 'Data Sources & Health', icon: Database },
    { id: 'alerts', label: 'Alerts & Early Warnings', icon: AlertOctagon, count: activeAlertsCount },
    { id: 'reports', label: 'Research Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 min-h-[calc(100vh-61px)]">
      <nav className="p-3 space-y-1 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id as NavTab)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                {item.meta && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {item.meta}
                  </span>
                )}
                {item.badge && (
                  <span
                    className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                      item.badge === 'TRAINED'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : item.badge === 'REAL ML'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {item.count !== undefined && item.count > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-bold">
                    {item.count}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Footer metadata */}
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 space-y-1">
        <div className="flex justify-between items-center font-mono">
          <span>Model Engine:</span>
          <span className="text-emerald-400 font-semibold">scikit-learn & XGBoost</span>
        </div>
        <div className="flex justify-between items-center font-mono">
          <span>Precision Rule:</span>
          <span className="text-slate-400">Zero Synthetic Bias</span>
        </div>
      </div>
    </aside>
  );
};
