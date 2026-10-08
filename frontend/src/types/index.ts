export interface Hospital {
  hospital_id: string;
  name: string;
  latitude: number;
  longitude: number;
  location: string;
  total_capacity: number;
  minimum_safety_stock: number;
  current_stock: number;
  consumption_rate: number;
  incoming_replenishment: number;
  status: 'normal' | 'warning' | 'critical';
  stock_trend: 'rising' | 'stable' | 'declining';
  hours_to_shortage: number | null;
}

export interface ForecastPoint {
  hours_ahead: number;
  predicted_stock: number;
  timestamp: string;
}

export interface Prediction {
  prediction_id: string;
  hospital_id: string;
  hospital_name: string;
  current_stock: number;
  safety_stock: number;
  projected_hourly_depletion?: number;
  predicted_consumption_rate?: number;
  hours_to_shortage: number | null;
  shortage_predicted?: boolean;
  model_type?: string;
  model_version?: string;
  confidence_metadata: {
    r2_score?: number;
    sample_count?: number;
    method?: string;
  };
  forecast_points: ForecastPoint[];
  created_at: string;
}

export interface Recommendation {
  recommendation_id: string;
  source_hospital_id: string;
  source_hospital_name: string;
  destination_hospital_id: string;
  destination_hospital_name: string;
  quantity: number;
  estimated_transport_minutes: number;
  urgency: 'routine' | 'low' | 'medium' | 'high' | 'critical';
  score: number;
  status: 'proposed' | 'approved' | 'cancelled' | 'in_transit' | 'completed';
  explanation: string;
  source_current_stock: number;
  destination_current_stock: number;
  destination_hours_to_shortage?: number;
  created_at: string;
}

export interface Transfer {
  transfer_id: string;
  recommendation_id: string;
  source_hospital_id: string;
  source_hospital_name: string;
  destination_hospital_id: string;
  destination_hospital_name: string;
  quantity: number;
  status: 'proposed' | 'approved' | 'in_transit' | 'completed' | 'cancelled';
  dispatched_at: string | null;
  completed_at: string | null;
  estimated_transport_minutes: number;
  created_at: string;
}

export interface SimulationStatus {
  running: boolean;
  paused?: boolean;
  simulation_run_id: string;
  simulation_time?: string;
  simulated_time?: string;
  current_tick?: number;
  real_start_time?: string;
  tick_seconds?: number;
  minutes_per_real_second?: number;
  emergency_active?: boolean;
  emergency_hospital_id?: string | null;
  active_transfers?: number;
  events_count?: number;
}

export interface SimulationEvent {
  event_id: string;
  simulation_run_id: string;
  timestamp: string;
  event_type: 'tick' | 'threshold_breach' | 'emergency_surge' | 'recommendation_generated' | 'transfer_approved' | 'transfer_dispatched' | 'transfer_completed' | 'stock_replenished' | 'simulation_started' | 'simulation_paused' | 'simulation_resumed' | 'simulation_reset' | 'return_normal' | string;
  hospital_id?: string;
  hospital_name?: string;
  details: Record<string, any>;
  ledger_hash?: string;
}

export interface ModelEvaluation {
  evaluation_id: string;
  simulation_run_id: string;
  model_version?: string;
  evaluation_timestamp: string;
  mae: number;
  rmse: number;
  sample_count: number;
  shortage_detection_accuracy?: number;
  lead_time_hours_avg?: number;
  details?: Record<string, any>;
}

export interface Analytics {
  total_hospitals: number;
  total_stock: number;
  hospitals_at_risk: number;
  active_recommendations: number;
  predicted_shortages: number;
  total_transfers_completed: number;
  total_transfers_active: number;
  evaluation?: ModelEvaluation;
  hospital_summaries: Array<{
    hospital_id: string;
    name: string;
    current_stock: number;
    safety_stock: number;
    consumption_rate: number;
    hours_to_shortage: number | null;
    status: 'normal' | 'warning' | 'critical';
  }>;
}

export interface ResourceReading {
  hospital_id: string;
  timestamp: string;
  stock_level: number;
  consumption_rate: number;
  incoming_replenishment: number;
}
