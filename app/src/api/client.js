import axios from 'axios';
import useUserStore from '../store/userStore';

// FIND YOUR LOCAL IP (e.g., 192.168.1.X)
export const BASE_URL = 'http://192.168.0.181:8000';
export const WS_URL = 'ws://192.168.0.181:8000';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Supabase JWT to every request automatically
client.interceptors.request.use((config) => {
  const session = useUserStore.getState().session;
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// ============ API FUNCTIONS ============

export const fetchProfile = async () => {
  const response = await client.get('/profile');
  return response.data;
};

export const addWalletMoney = async (amount) => {
  const response = await client.post('/wallet/add', { amount });
  return response.data;
};

export const confirmEnrollment = async () => {
  const response = await client.post('/confirm_enrollment');
  return response.data;
};

export const fetchTrips = async () => {
  const response = await client.get('/trips');
  return response.data;
};

export const gateAccess = async (stationName, faceData = null) => {
  const payload = { station_name: stationName };
  if (faceData) payload.face_data = faceData;
  const response = await client.post('/gate/access', payload);
  return response.data;
};

export default client;
