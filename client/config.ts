// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

// Helper function for API calls
export const apiUrl = (endpoint: string) => `${API_URL}${endpoint}`;
