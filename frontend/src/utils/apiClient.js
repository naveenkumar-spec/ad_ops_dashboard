import axios from 'axios';

// Create axios instance with default config
const apiClient = axios.create({
  timeout: 30000, // 30 seconds default
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for better error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If timeout or network error, retry once
    if (
      !originalRequest._retry &&
      (error.code === 'ECONNABORTED' || 
       error.message.includes('timeout') ||
       error.message.includes('Network Error'))
    ) {
      originalRequest._retry = true;
      
      // Wait 2 seconds before retry (gives backend time to wake up)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return apiClient(originalRequest);
    }

    // Handle 401 unauthorized
    if (error.response?.status === 401) {
      sessionStorage.removeItem('token');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

// Helper function for API calls with custom timeout
export const apiGet = (url, options = {}) => {
  return apiClient.get(url, {
    timeout: options.timeout || 30000,
    ...options
  });
};

export const apiPost = (url, data, options = {}) => {
  return apiClient.post(url, data, {
    timeout: options.timeout || 30000,
    ...options
  });
};

export const apiPut = (url, data, options = {}) => {
  return apiClient.put(url, data, {
    timeout: options.timeout || 30000,
    ...options
  });
};

export const apiDelete = (url, options = {}) => {
  return apiClient.delete(url, {
    timeout: options.timeout || 30000,
    ...options
  });
};

export default apiClient;
