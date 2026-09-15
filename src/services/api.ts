import {
  Province, District, LocationItem, PredictionResult,
  StoredPrediction, AlertItem, DashboardStats, ModelMetricsSummary,
  UserProfile, AuthResponse, AlertNotification
} from '../types';

const BASE_URL = '/api';

export async function fetchProvinces(): Promise<Province[]> {
  const res = await fetch(`${BASE_URL}/provinces`);
  if (!res.ok) throw new Error('Failed to fetch provinces');
  return res.json();
}

export async function fetchDistricts(provinceId?: number): Promise<District[]> {
  const url = provinceId ? `${BASE_URL}/districts?province_id=${provinceId}` : `${BASE_URL}/districts`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch districts');
  return res.json();
}

export async function fetchLocations(districtId?: number, provinceId?: number): Promise<LocationItem[]> {
  const params = new URLSearchParams();
  if (districtId) params.append('district_id', districtId.toString());
  if (provinceId) params.append('province_id', provinceId.toString());
  const res = await fetch(`${BASE_URL}/locations?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch locations');
  return res.json();
}

export async function requestPrediction(payload: {
  province_id?: number;
  district_id?: number;
  location_id?: number;
  province_name?: string;
  district_name?: string;
  location_name?: string;
  lat?: number;
  lon?: number;
  model_name?: string;
}): Promise<PredictionResult> {
  const res = await fetch(`${BASE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function fetchPredictionHistory(filters?: {
  province?: string;
  district?: string;
  risk_level?: string;
  model?: string;
  limit?: number;
}): Promise<StoredPrediction[]> {
  const params = new URLSearchParams();
  if (filters?.province) params.append('province', filters.province);
  if (filters?.district) params.append('district', filters.district);
  if (filters?.risk_level) params.append('risk_level', filters.risk_level);
  if (filters?.model) params.append('model', filters.model);
  if (filters?.limit) params.append('limit', filters.limit.toString());

  const res = await fetch(`${BASE_URL}/predictions/history?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

export async function fetchPredictionTrends(locationName?: string): Promise<any[]> {
  const url = locationName ? `${BASE_URL}/predictions/trends?location_name=${encodeURIComponent(locationName)}` : `${BASE_URL}/predictions/trends`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch trends');
  return res.json();
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${BASE_URL}/dashboard/stats`);
  if (!res.ok) throw new Error('Failed to fetch dashboard stats');
  return res.json();
}

export async function fetchAlerts(status?: string): Promise<AlertItem[]> {
  const url = status ? `${BASE_URL}/alerts?status=${status}` : `${BASE_URL}/alerts`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

export async function updateAlertStatus(alertId: string, status: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/alerts/${alertId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error('Failed to update alert');
  return res.json();
}

export async function fetchModelMetrics(): Promise<ModelMetricsSummary> {
  const res = await fetch(`${BASE_URL}/model/metrics`);
  if (!res.ok) throw new Error('Failed to fetch model metrics');
  return res.json();
}

export async function retrainModel(): Promise<any> {
  const res = await fetch(`${BASE_URL}/model/train`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to retrain model');
  return res.json();
}

export async function fetchMapRiskFeatures(): Promise<any> {
  const res = await fetch(`${BASE_URL}/map/risk`);
  if (!res.ok) throw new Error('Failed to fetch map risk');
  return res.json();
}

export async function fetchMapRainStations(): Promise<any> {
  const res = await fetch(`${BASE_URL}/map/stations`);
  if (!res.ok) throw new Error('Failed to fetch rain stations');
  return res.json();
}

export async function fetchMapHistoricalIncidents(): Promise<any> {
  const res = await fetch(`${BASE_URL}/map/incidents`);
  if (!res.ok) throw new Error('Failed to fetch incidents');
  return res.json();
}

export async function fetchNepalBoundary(): Promise<any> {
  const res = await fetch(`${BASE_URL}/map/nepal-boundary`);
  if (!res.ok) throw new Error('Failed to fetch Nepal boundary');
  return res.json();
}

export async function fetchProvincesGeoJSON(): Promise<any> {
  const res = await fetch(`${BASE_URL}/map/provinces-geojson`);
  if (!res.ok) throw new Error('Failed to fetch provinces GeoJSON');
  return res.json();
}

export async function fetchSourcesHealth(): Promise<any> {
  const res = await fetch(`${BASE_URL}/sources`);
  if (!res.ok) throw new Error('Failed to fetch sources');
  return res.json();
}

export async function fetchSettings(): Promise<any> {
  const res = await fetch(`${BASE_URL}/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateSettings(settings: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

// ==========================================
// User Authentication & Session Management
// ==========================================
const AUTH_TOKEN_KEY = 'nepal_landslide_auth_token';
const AUTH_USER_KEY = 'nepal_landslide_auth_user';

export function getStoredAuth(): { user: UserProfile | null; token: string | null } {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const userStr = localStorage.getItem(AUTH_USER_KEY);
    const user = userStr ? JSON.parse(userStr) : null;
    return { user, token };
  } catch {
    return { user: null, token: null };
  }
}

export function saveStoredAuth(user: UserProfile, token: string) {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.error('Failed to persist auth:', e);
  }
}

export function clearStoredAuth() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  } catch (e) {
    console.error('Failed to clear auth:', e);
  }
}

export async function loginUser(payload: { username_or_email: string; password: string }): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Login failed. Please verify credentials.');
  }
  saveStoredAuth(data.user, data.token);
  return data;
}

export async function signupUser(payload: {
  username: string;
  email: string;
  password: string;
  full_name: string;
  province?: string;
  district?: string;
  role?: string;
  organization?: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Signup failed. Please try again.');
  }
  saveStoredAuth(data.user, data.token);
  return data;
}

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  const { token } = getStoredAuth();
  if (!token) return null;
  try {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      clearStoredAuth();
      return null;
    }
    const data = await res.json();
    return data.user;
  } catch {
    return null;
  }
}

export async function fetchAlertNotifications(limit = 50): Promise<AlertNotification[]> {
  const res = await fetch(`${BASE_URL}/alerts/notifications?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch alert notifications');
  return res.json();
}

export async function sendTestAlertEmail(recipient_email: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/alerts/test-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient_email })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to dispatch test email.');
  }
  return data;
}

export async function broadcastAlertEmail(alertId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/alerts/${alertId}/broadcast-email`, {
    method: 'POST'
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to broadcast alert email.');
  }
  return data;
}

export async function fetchRegisteredUsers(): Promise<{ total_users: number; users: UserProfile[] }> {
  const res = await fetch(`${BASE_URL}/auth/users`);
  if (!res.ok) throw new Error('Failed to fetch registered users');
  return res.json();
}

export async function triggerDistrictRefresh(): Promise<any> {
  const res = await fetch(`${BASE_URL}/predict/refresh-all`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to trigger district refresh');
  return res.json();
}

export async function fetchDistrictRefreshStatus(): Promise<{
  is_running: boolean;
  progress: number;
  total: number;
  current_district: string | null;
  last_completed_at: string | null;
  updated_count: number;
  error: string | null;
}> {
  const res = await fetch(`${BASE_URL}/predict/refresh-status`);
  if (!res.ok) throw new Error('Failed to fetch refresh status');
  return res.json();
}

