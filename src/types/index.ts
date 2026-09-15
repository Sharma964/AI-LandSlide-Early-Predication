export interface Province {
  id: number;
  title: string;
  title_en: string;
  title_ne: string;
  code: string;
  centroid: [number, number]; // [lon, lat]
  bbox: number[];
}

export interface District {
  id: number;
  province_id: number;
  title: string;
  title_en: string;
  title_ne: string;
  code: string;
  centroid: [number, number]; // [lon, lat]
  bbox: number[];
}

export interface LocationItem {
  id: number;
  district_id: number;
  province_id: number;
  title: string;
  location_type: 'DISTRICT_HQ' | 'DHM_STATION' | 'MUNICIPALITY';
  lat: number;
  lon: number;
  elevation: number | null;
}

export interface TopFactor {
  feature: string;
  label: string;
  importance_weight: number;
  value: number;
  description: string;
}

export interface PreviousComparison {
  previous_probability: number;
  previous_percentage: string;
  previous_time: string;
  previous_risk: string;
  change_percentage_points: string;
}

export interface PredictionResult {
  prediction_id: string;
  prediction_status: 'REAL' | 'UNAVAILABLE';
  location?: string;
  district?: string;
  province?: string;
  coordinates?: { lat: number; lon: number };
  probability?: number;
  probability_percentage?: string;
  risk_level?: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  model?: string;
  model_version?: string;
  data_status?: 'LIVE' | 'RECENT' | 'CACHED' | 'DATA UNAVAILABLE';
  prediction_time_npt?: string;
  features?: {
    rainfall_24h: number;
    rainfall_3day: number;
    rainfall_7day: number;
    antecedent_rainfall: number;
    elevation: number;
    slope: number;
    aspect: number;
  };
  top_contributing_factors?: TopFactor[];
  previous_comparison?: PreviousComparison | null;
  alert_triggered?: boolean;
  dhm_station?: any;
  error_code?: string;
  message?: string;
  missing_inputs?: string[];
  disclaimer?: string;
}

export interface StoredPrediction {
  prediction_id: string;
  timestamp_npt: string;
  province: string;
  district: string;
  location: string;
  coordinates: [number, number];
  rainfall_24h: number;
  elevation: number;
  slope: number;
  model: string;
  probability: number;
  probability_percentage: string;
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  data_status: string;
  top_factors?: TopFactor[];
}

export interface AlertItem {
  id: number;
  alert_id: string;
  prediction_id: string;
  province: string;
  district: string;
  location: string;
  risk_level: 'HIGH' | 'CRITICAL';
  probability: number;
  probability_percentage: string;
  rainfall_24h: number;
  status: 'ACTIVE' | 'MONITORING' | 'RESOLVED';
  created_at_npt: string;
  resolved_at_npt?: string | null;
  advisory_notes: string;
  coordinates?: [number, number] | null;
  slope?: number;
  elevation?: number;
  model?: string;
}

export interface DashboardStats {
  total_provinces: number;
  total_districts: number;
  locations_monitored: number;
  total_predictions_made: number;
  high_risk_locations: number;
  critical_risk_locations: number;
  active_alerts: number;
  latest_prediction: any | null;
  model_status: 'TRAINED' | 'NOT TRAINED';
  data_status: 'LIVE' | 'RECENT' | 'UNAVAILABLE';
  nepal_time: string;
  disclaimer: string;
}

export interface ModelMetricsSummary {
  status: string;
  version?: string;
  trained_at_utc?: string;
  features?: string[];
  models?: {
    [modelName: string]: {
      accuracy: number;
      precision: number;
      recall: number;
      f1_score: number;
      roc_auc: number;
      cv_mean_roc_auc: number;
      cv_mean_accuracy: number;
      cv_mean_f1: number;
      confusion_matrix: number[][];
      feature_importance: { [feat: string]: number };
      trained_samples: number;
      test_samples: number;
    }
  };
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  full_name: string;
  province?: string;
  district?: string;
  role: 'Disaster Response Officer' | 'Geotechnical Researcher' | 'Citizen / Public' | string;
  organization?: string;
  created_at_npt?: string;
}

export interface AuthResponse {
  status: string;
  message?: string;
  user: UserProfile;
  token: string;
}

export interface AlertNotification {
  id: number;
  alert_id: string;
  recipient_email: string;
  recipient_name: string;
  province?: string;
  district?: string;
  subject: string;
  status: 'SENT' | 'FAILED';
  details?: string;
  sent_at_npt: string;
}
