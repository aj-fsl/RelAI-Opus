import axios from "axios";

const axiosAgent = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080",
  timeout: 100000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ---- Request Interceptor ----
axiosAgent.interceptors.request.use(
  (config) => {
    // Example: attach token later
    // const token = localStorage.getItem("token");
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }

    console.log(
      `[API REQUEST] ${config.method?.toUpperCase()} ${config.url}`
    );

    return config;
  },
  (error) => Promise.reject(error)
);

// ---- Response Interceptor ----
axiosAgent.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    console.error("[API ERROR]", error?.response || error);

    // Centralized error handling
    if (error.response?.status === 401) {
      // logout / redirect later
    }

    return Promise.reject(error);
  }
);

export default axiosAgent;
