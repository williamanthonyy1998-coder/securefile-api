import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 15000,
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("sf_token");

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        if (typeof window !== "undefined") {
            const match = window.location.pathname.match(/^\/t\/([^/?#]+)/i);
            const tenant = localStorage.getItem("securefile_tenant") || (match?.[1] ? decodeURIComponent(match[1]).trim().toLowerCase() : "");
            if (tenant) config.headers["X-Tenant-Slug"] = tenant;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    },
);

api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        const silent = error.config?.headers?.["X-Silent-Alert"] === "true" || error.config?.headers?.get?.("X-Silent-Alert") === "true";
        const message = String(error.response?.data?.error || error.message || "Request failed.").trim();
        if (message && !silent && typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("sf:alert", {
                detail: { type: "error", message },
            }));
        }
        if (error.response?.status === 401) {
            localStorage.removeItem("sf_token");
            localStorage.removeItem("sf_email");
            localStorage.removeItem("sf_display_name");
            localStorage.removeItem("sf_user_id");
            localStorage.removeItem("sf_role");
            localStorage.removeItem("sf_addons");
            localStorage.removeItem("sf_plan");
            localStorage.removeItem("sf_avatar_url");
            localStorage.removeItem("sf_sidebar_items");

            window.dispatchEvent(new CustomEvent("sf:auth-expired", {
                detail: { message: error.response?.data?.error || "Your session is no longer active. You have been logged out." },
            }));
        }

        return Promise.reject(error);
    },
);

export default api;
