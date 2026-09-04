import axios from "axios";

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000",
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 15000,
});


// ==========================================
// Request Interceptor
// ==========================================

apiClient.interceptors.request.use(
    (config) => {

        const token = localStorage.getItem("erp_token");

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },

    (error) => {
        return Promise.reject(error);
    }
);


// ==========================================
// Response Interceptor
// ==========================================

apiClient.interceptors.response.use(
    (response) => {
        return response;
    },

    (error) => {

        // Backend didn't respond
        if (!error.response) {
            console.error("Network error:", error.message);

            return Promise.reject({
                success: false,
                message: "Unable to connect to the backend server.",
                originalError: error,
            });
        }


        const status = error.response.status;
        const data = error.response.data;


        // Unauthorized
        if (status === 401) {

            console.warn("Authentication failed.");

            localStorage.removeItem("erp_token");
            localStorage.removeItem("erp_user");

            // Don't force redirect here.
            // AuthContext / Router will handle navigation.
        }


        return Promise.reject({
            success: false,
            status,
            message:
                data?.message ||
                "Something went wrong while communicating with the server.",
            data,
            originalError: error,
        });
    }
);


export default apiClient;
