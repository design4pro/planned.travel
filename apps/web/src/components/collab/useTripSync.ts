import { useEffect, useRef, useState } from "react";
import type { ChangeResource, Presence, ServerMessage } from "@planned/shared";

interface Options {
  tripId: string;
  /** Called when a collaborator mutates trip data (LWW: refetch to converge). */
  onChange?: (resource: ChangeResource) => void;
}

/**
 * Open a Hibernation WebSocket to the trip's TripRoom DO and track presence.
 * Same-origin cookies authenticate the upgrade (no token juggling). Reconnects
 * with backoff and pings every 25s to keep the idle connection warm.
 */
export function useTripSync({ tripId, onChange }: Options) {
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<Presence[]>([]);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/api/trips/${encodeURIComponent(tripId)}/sync`;
    let ws: WebSocket | null = null;
    let ping: ReturnType<typeof setInterval> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closedByUs = false;

    const connect = () => {
      ws = new WebSocket(url);
      ws.onopen = () => {
        setConnected(true);
        ping = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        }, 25000);
      };
      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(typeof ev.data === "string" ? ev.data : "") as ServerMessage;
        } catch {
          return;
        }
        if (msg.type === "presence") setPresence(msg.users);
        else if (msg.type === "hello") setPresence([msg.you]);
        else if (msg.type === "change") onChangeRef.current?.(msg.resource);
      };
      ws.onclose = () => {
        setConnected(false);
        if (ping) {
          clearInterval(ping);
          ping = null;
        }
        if (!closedByUs) retry = setTimeout(connect, 2000);
      };
      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          /* ignore */
        }
      };
    };

    connect();
    return () => {
      closedByUs = true;
      if (ping) clearInterval(ping);
      if (retry) clearTimeout(retry);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, [tripId]);

  return { connected, presence };
}
