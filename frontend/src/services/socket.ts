import { io, Socket } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

let socket: Socket | null = null;

export function connectSocket(accessToken: string) {
    if (socket?.connected) {
        return socket;
    }

    socket = io(API_URL, {
        auth: {
            token: accessToken,
        },
        transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
        console.log("[Socket.IO] Connected:", socket?.id);
    });

    socket.on("connect_error", (error) => {
        console.error("[Socket.IO] Connection error:", error.message);
    });

    socket.on("disconnect", (reason) => {
        console.log("[Socket.IO] Disconnected:", reason);
    });

    return socket;
}

export function getSocket() {
    return socket;
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
