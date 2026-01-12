// API Configuration
export const API_URL = import.meta.env.VITE_API_URL;
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

// Helper function for API calls
export const apiUrl = (endpoint: string) => `${API_URL}${endpoint}`;

// Helper function to get full URL for uploaded files (avatars, images, etc.)
export const getFileUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  // If already a full URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // If relative path, prepend API_URL
  return `${API_URL}${path}`;
};
