import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../contexts/useAuth";
import { ensureFreshSession } from "../lib/api/client";
import { SOCKET_URL } from "../lib/api/serverUrl";

/** Any event handler, whatever its payload (each event has its own) */
type SocketHandler = (...args: never[]) => void;
type ListenerFor = Parameters<Socket["on"]>[1];

export const useSocket = () => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) return;

    // Auth travels in the httpOnly cookie, same as the voice socket in useVoice
    const socketInstance = io(
      SOCKET_URL,
      {
        withCredentials: true,
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        // Re-evaluated before every (re)connect: an expired access cookie is
        // refreshed first instead of the server turning the socket away.
        auth: (cb) => {
          void ensureFreshSession().finally(() => cb({}));
        },
      },
    );

    socketInstance.on("connect", () => {
      setIsConnected(true);
      console.log("🔌 WebSocket connected");
    });

    socketInstance.on("disconnect", (reason) => {
      setIsConnected(false);
      console.log("🔌 WebSocket disconnected");
      // Server-initiated close (expired token, logout): retry only while signed in
      if (reason === "io server disconnect") {
        setTimeout(() => {
          void ensureFreshSession().then((signedIn) => {
            if (signedIn && socketInstance.disconnected && !socketInstance.active) {
              socketInstance.connect();
            }
          });
        }, 1000);
      }
    });

    socketInstance.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
    });

    socketRef.current = socketInstance;
    // The socket is created here (an outside system); publishing it to the screen is this effect's job
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(socketInstance);

    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
        socketRef.current = null;
      }
    };
  }, [user]);

  const emit = useCallback(
    (event: string, data?: unknown) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit(event, data);
      } else {
        console.warn(`Cannot emit ${event}: socket not connected`);
      }
    },
    [isConnected],
  );

  const on = useCallback((event: string, handler: SocketHandler) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler as ListenerFor);
    }
  }, []);

  const off = useCallback(
    (event: string, handler?: SocketHandler) => {
      if (socketRef.current) {
        socketRef.current.off(event, handler as ListenerFor | undefined);
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
