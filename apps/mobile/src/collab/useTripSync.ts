import { useEffect, useRef, useState } from "react";
import type { ChangeResource, Presence, ServerMessage } from "@planned/shared";

export function tripSyncUrl(baseUrl: string, tripId: string, token: string): string {
  const origin = baseUrl.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://").replace(/\/$/, "");
  return `${origin}/api/trips/${encodeURIComponent(tripId)}/sync?access_token=${encodeURIComponent(token)}`;
}

export function useTripSync(options: {
  baseUrl: string;
  tripId: string;
  getToken: () => string | null;
  onChange?: (resource: ChangeResource) => void;
}) {
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<Presence[]>([]);
  const onChange = useRef(options.onChange);
  onChange.current = options.onChange;

  useEffect(() => {
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let ping: ReturnType<typeof setInterval> | undefined;
    let stopped = false;

    function connect() {
      const token = options.getToken();
      if (!token) return;
      socket = new WebSocket(tripSyncUrl(options.baseUrl, options.tripId, token));
      socket.onopen = () => {
        setConnected(true);
        ping = setInterval(() => socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ type: "ping" })), 25_000);
      };
      socket.onmessage = (event) => {
        let message: ServerMessage;
        try { message = JSON.parse(String(event.data)) as ServerMessage; } catch { return; }
        if (message.type === "hello") setPresence([message.you]);
        if (message.type === "presence") setPresence(message.users);
        if (message.type === "change") onChange.current?.(message.resource);
      };
      socket.onclose = () => {
        setConnected(false);
        if (ping) clearInterval(ping);
        if (!stopped) retry = setTimeout(connect, 2_000);
      };
      socket.onerror = () => socket?.close();
    }

    connect();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      if (ping) clearInterval(ping);
      socket?.close();
    };
  }, [options.baseUrl, options.getToken, options.tripId]);

  return { connected, presence };
}
