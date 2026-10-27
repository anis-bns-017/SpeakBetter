import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../contexts/AuthContext";

export const useSocket = () => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) return;

    // Auth travels in the httpOnly cookie, same as the voice socket in useVoice
    const socketInstance = io(
      import.meta.env.VITE_SOCKET_URL || "http://localhost:3000/voice",
      {
        withCredentials: true,
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      },
    );

    socketInstance.on("connect", () => {
      setIsConnected(true);
      console.log("🔌 WebSocket connected");
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
      console.log("🔌 WebSocket disconnected");
    });

    socketInstance.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
        socketRef.current = null;
      }
    };
  }, [user]);

  const emit = useCallback(
    (event: string, data: any) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit(event, data);
      } else {
        console.warn(`Cannot emit ${event}: socket not connected`);
      }
    },
    [isConnected],
  );

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler);
    }
  }, []);

  const off = useCallback(
    (event: string, handler?: (...args: any[]) => void) => {
      if (socketRef.current) {
        socketRef.current.off(event, handler);
      }
    },
    [],
  );

  return {
    socket,
    isConnected,
    emit,
    on,
    off,
  };
};
