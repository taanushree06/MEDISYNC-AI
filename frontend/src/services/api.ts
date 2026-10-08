import axios from 'axios';
import {
  Hospital,
  Prediction,
  Recommendation,
  Transfer,
  SimulationStatus,
  SimulationEvent,
  Analytics,
  ModelEvaluation,
  ResourceReading,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('medisync_operator_token');
  if (token) config.headers.set('X-Operator-Token', token);
  return config;
});

api.interceptors.response.use(response => response, error => {
  if (error.response?.status === 403) {
    return Promise.reject(new Error('Operator access required. Enter your token using Operator access.'));
  }
  return Promise.reject(error);
});

export const getHospitals = async (): Promise<Hospital[]> => {
  const res = await api.get('/api/v1/hospitals');
  return res.data;
};

export const getHospital = async (id: string): Promise<Hospital> => {
  const res = await api.get(`/api/v1/hospitals/${id}`);
  return res.data;
};

export const getHospitalHistory = async (id: string, limit = 100): Promise<ResourceReading[]> => {
  const res = await api.get(`/api/v1/hospitals/${id}/history`, { params: { limit } });
  return res.data;
};

export const getPredictions = async (): Promise<Prediction[]> => {
  const res = await api.get('/api/v1/predictions');
  return res.data;
};

export const getRecommendations = async (): Promise<Recommendation[]> => {
  const res = await api.get('/api/v1/recommendations');
  return res.data;
};

export const generateRecommendations = async (): Promise<Recommendation[]> => {
  const res = await api.post('/api/v1/recommendations/generate');
  return res.data;
};

export const approveRecommendation = async (recommendationId: string): Promise<Transfer> => {
  const res = await api.post(`/api/v1/recommendations/${recommendationId}/approve`);
  return res.data;
};

export const cancelRecommendation = async (recommendationId: string): Promise<{ status: string }> => {
  const res = await api.post(`/api/v1/recommendations/${recommendationId}/cancel`);
  return res.data;
};

export const getTransfers = async (): Promise<Transfer[]> => {
  const res = await api.get('/api/v1/transfers');
  return res.data;
};

export const dispatchTransfer = async (transferId: string): Promise<Transfer> => {
  const res = await api.post(`/api/v1/transfers/${transferId}/dispatch`);
  return res.data;
};

export const completeTransfer = async (transferId: string): Promise<Transfer> => {
  const res = await api.post(`/api/v1/transfers/${transferId}/complete`);
  return res.data;
};

export const getAnalytics = async (): Promise<Analytics> => {
  const res = await api.get('/api/v1/analytics');
  return res.data;
};

export const getEvaluation = async (): Promise<ModelEvaluation | null> => {
  const res = await api.get('/api/v1/evaluation');
  return res.data.evaluation ?? res.data;
};

export const getSimulationStatus = async (): Promise<SimulationStatus> => {
  const res = await api.get('/api/v1/simulation/status');
  return res.data;
};

export const startSimulation = async (): Promise<SimulationStatus> => {
  const res = await api.post('/api/v1/simulation/start');
  return res.data;
};

export const pauseSimulation = async (): Promise<SimulationStatus> => {
  const res = await api.post('/api/v1/simulation/pause');
  return res.data;
};

export const resumeSimulation = async (): Promise<SimulationStatus> => {
  const res = await api.post('/api/v1/simulation/resume');
  return res.data;
};

export const resetSimulation = async (): Promise<SimulationStatus> => {
  const res = await api.post('/api/v1/simulation/reset');
  return res.data;
};

export const triggerEmergency = async (
  hospitalId: string,
  multiplier = 3.0
): Promise<{ status: SimulationStatus; explanation: string; recommendations: Recommendation[] }> => {
  const res = await api.post('/api/v1/simulation/emergency', {
    hospital_id: hospitalId,
    multiplier,
  });
  return res.data;
};

export const getEvents = async (limit = 50): Promise<SimulationEvent[]> => {
  const res = await api.get('/api/v1/events', { params: { limit } });
  return res.data;
};

export interface BackendHealth {
  status: string;
  mongodb: boolean;
  persistent: boolean;
  storage_mode: 'mongodb' | 'mongomock' | 'unavailable';
  simulation_running: boolean;
  operator_auth_required?: boolean;
}

export const checkHealth = async (): Promise<BackendHealth> => {
  const res = await api.get('/api/health');
  return res.data;
};
