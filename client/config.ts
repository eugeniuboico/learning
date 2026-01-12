// API Configuration
export const API_URL = import.meta.env.VITE_API_URL;
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

// Helper function for API calls
export const apiUrl = (endpoint: string) => `${API_URL}${endpoint}`;
