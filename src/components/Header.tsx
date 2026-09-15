import React from 'react';
import { NptClock } from './NptClock';
import { RefreshCw, Bell, ShieldCheck, Activity, User, LogIn, LogOut } from 'lucide-react';
import { UserProfile } from '../types';

interface HeaderProps {
  activeAlertsCount: number;
  dataStatus: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  onNavigateAlerts: () => void;
  user: UserProfile | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeAlertsCount,
  dataStatus,
  onRefresh,
  isRefreshing,
  onNavigateAlerts,
  user,
  onOpenAuth,
  onSignOut
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left Branding */}
        <div className="flex items-center space-x-3">
          <div className="relative w-11 h-11 rounded-xl overflow-hidden shadow-lg border border-cyan-500/40 ring-1 ring-cyan-500/20 bg-slate-950 flex-shrink-0 flex items-center justify-center">
            <img
              src="/logo.jpg"
              alt="Nepal AI Landslide System Logo"
              className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold tracking-tight text-white flex items-center">
                AI Landslide Early Warning System
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/40 uppercase font-mono font-semibold">
                  Nepal
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Department of Hydrology & Meteorology / BIPAD Telemetry • ML Research Framework
            </p>
          </div>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center space-x-3">
          {/* Data Status Pill */}
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs">
            <Activity className={`w-3.5 h-3.5 ${dataStatus === 'LIVE' ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className="text-slate-400">Data:</span>
            <span className={`font-semibold ${dataStatus === 'LIVE' ? 'text-emerald-400' : 'text-amber-400'}`}>
              ● {dataStatus}
            </span>
          </div>

          {/* Real NPT Live Clock */}
          <NptClock />

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 hover:text-white transition shadow-sm disabled:opacity-50"
            title="Refresh telemetry & rerun predictions"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>

          {/* Alerts Bell */}
          <button
            onClick={onNavigateAlerts}
            className="relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition"
            title="View Active Early Warnings"
          >
            <Bell className="w-4 h-4 text-amber-400" />
            {activeAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold font-mono animate-bounce">
                {activeAlertsCount}
              </span>
            )}
          </button>

          {/* User Auth / Guest Status */}
          {user ? (
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-700">
              <div
                className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700"
                title={`${user.full_name} (${user.role}) - ${user.organization || 'Nepal User'}`}
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-slate-950 uppercase shadow">
                  {user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-semibold text-white leading-none truncate max-w-[120px]">
                    {user.full_name}
                  </div>
                  <div className="text-[10px] text-emerald-400 leading-none mt-0.5 truncate max-w-[120px]">
                    {user.role}
                  </div>
                </div>
              </div>
              <button
                onClick={onSignOut}
                className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-700/60 text-slate-400 hover:text-rose-300 transition"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-700">
              <button
                onClick={onOpenAuth}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-medium transition shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
              <span
                className="hidden xl:inline-block px-2 py-1 rounded bg-slate-800 text-[10px] text-slate-400 border border-slate-700"
                title="Guest Mode: full unrestricted prediction access without logging in"
              >
                Guest Mode
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
