import React, { useState, useEffect } from 'react';
import {
  X, Lock, Mail, User, Building, ShieldCheck, Sparkles, AlertCircle, CheckCircle2,
  LogIn, UserPlus, ArrowRight, MapPin
} from 'lucide-react';
import { loginUser, signupUser, fetchProvinces, fetchDistricts } from '../services/api';
import { UserProfile, Province, District } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | ''>('');
  const [selectedProvinceName, setSelectedProvinceName] = useState('');
  const [selectedDistrictName, setSelectedDistrictName] = useState('');
  const [role, setRole] = useState('Disaster Response Officer');
  const [organization, setOrganization] = useState('');

  // Geographic dropdown data
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  useEffect(() => {
    fetchProvinces()
      .then(setProvinces)
      .catch((err) => console.error('Failed to load provinces for signup:', err));
  }, []);

  useEffect(() => {
    if (selectedProvinceId) {
      setLoadingDistricts(true);
      fetchDistricts(Number(selectedProvinceId))
        .then((data) => {
          setDistricts(data);
          setLoadingDistricts(false);
        })
        .catch((err) => {
          console.error('Failed to load districts:', err);
          setLoadingDistricts(false);
        });
    } else {
      setDistricts([]);
      setSelectedDistrictName('');
    }
  }, [selectedProvinceId]);

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await loginUser({
        username_or_email: usernameOrEmail,
        password: password
      });
      setSuccessMsg(res.message || 'Signed in successfully!');
      setTimeout(() => {
        onSuccess(res.user);
        onClose();
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedProvinceName) {
      setError('Please select your Province for targeted disaster warnings.');
      return;
    }
    if (!selectedDistrictName) {
      setError('Please select your District for targeted disaster warnings.');
      return;
    }
    setLoading(true);
    try {
      const res = await signupUser({
        full_name: fullName,
        username,
        email,
        password: signupPassword,
        province: selectedProvinceName,
        district: selectedDistrictName,
        role,
        organization: organization || 'Government / Academic Entity'
      });
      setSuccessMsg(res.message || 'Account created successfully!');
      setTimeout(() => {
        onSuccess(res.user);
        onClose();
      }, 600);
    } catch (err: any) {
      setError(err.message || 'Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-red-600/30 via-slate-800 to-blue-600/30 p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-950 border border-emerald-500/30 overflow-hidden flex items-center justify-center shadow">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Nepal AI Landslide System
              </h3>
              <p className="text-[11px] text-slate-400">
                User Access & Identity Management
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free Unrestricted Guest Banner */}
        <div className="bg-emerald-950/40 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-emerald-300">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Guest access is always 100% free & unblocked</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 underline flex items-center space-x-1"
          >
            <span>Skip Login</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Auth Mode Tabs */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-950/60 border-b border-slate-800">
          <button
            onClick={() => { setMode('signin'); setError(null); }}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition ${
              mode === 'signin'
                ? 'bg-slate-800 text-emerald-400 shadow border border-slate-700'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          <button
            onClick={() => { setMode('signup'); setError(null); }}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition ${
              mode === 'signup'
                ? 'bg-slate-800 text-emerald-400 shadow border border-slate-700'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Account</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Username or Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    placeholder="Enter your username or email"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs shadow-lg transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In to System</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Full Name & Title
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Username / ID
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. your_id"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Geographic Jurisdictions for Targeted Gmail Alerts */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Location for Alert Notifications</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    Province & District-Wise
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Province *
                    </label>
                    <select
                      required
                      value={selectedProvinceId}
                      onChange={(e) => {
                        const val = e.target.value;
                        const id = val ? Number(val) : '';
                        setSelectedProvinceId(id);
                        if (id) {
                          const p = provinces.find(pr => pr.id === id);
                          setSelectedProvinceName(p ? p.title_en || p.title : '');
                        } else {
                          setSelectedProvinceName('');
                        }
                        setSelectedDistrictName('');
                      }}
                      className="w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="">Select Province...</option>
                      {provinces.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title_en || p.title} ({p.title_ne || p.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      District *
                    </label>
                    <select
                      required
                      disabled={!selectedProvinceId}
                      value={selectedDistrictName}
                      onChange={(e) => setSelectedDistrictName(e.target.value)}
                      className="w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {!selectedProvinceId ? 'Select Province First' : loadingDistricts ? 'Loading Districts...' : 'Select District...'}
                      </option>
                      {districts.map((d) => (
                        <option key={d.id} value={d.title_en || d.title}>
                          {d.title_en || d.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-start space-x-2 text-[11px] text-emerald-300/90 pt-1">
                  <Mail className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <span>
                    Emergency landslide warning emails will be sent to your Gmail whenever AI models detect High or Critical hazards in your selected Province & District.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Disaster Response Officer">Disaster Response Officer</option>
                    <option value="Geotechnical Researcher">Geotechnical Researcher</option>
                    <option value="Municipal Engineer">Municipal Engineer</option>
                    <option value="Citizen / Public">Citizen / Public</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Organization
                  </label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="DHM / NDRRMA / Local Govt"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs shadow-lg transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <span>Registering...</span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create & Activate Account</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Guest Action Footer */}
          <div className="pt-3 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-white transition flex items-center justify-center space-x-1 w-full py-1.5 rounded hover:bg-slate-800/50"
            >
              <span>Or explore system in</span>
              <strong className="text-emerald-400 font-semibold underline ml-1">Guest Mode</strong>
              <span className="text-slate-500 text-[11px]">(no credentials needed)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
