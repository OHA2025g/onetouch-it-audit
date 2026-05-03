import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { BACKEND_URL } from "@/api";

export default function useAlertSocket(onAlert) {
  const wsRef = useRef(null);
  const reconnectRef = useRef(0);

  useEffect(() => {
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      const token = localStorage.getItem("auth_token");
      if (!token) return;
      const url = `${BACKEND_URL.replace(/^http/, "ws")}/api/ws/alerts?token=${encodeURIComponent(token)}`;
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;
        ws.onopen = () => { reconnectRef.current = 0; };
        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (data.type === "ccm_alert") {
              const a = data.alert;
              const sevColor = a.severity === "Critical" ? "🔴" : a.severity === "High" ? "🟠" : "🟡";
              toast(`${sevColor} ${a.severity}: ${a.title}`, {
                description: `Control: ${a.control_code} · Real-time alert`,
                duration: 8000,
              });
              if (onAlert) onAlert(a);
            }
          } catch {}
        };
        ws.onclose = () => {
          if (stopped) return;
          // backoff reconnect
          reconnectRef.current = Math.min(reconnectRef.current + 1, 6);
          setTimeout(connect, 1000 * Math.pow(2, reconnectRef.current));
        };
        ws.onerror = () => { try { ws.close(); } catch {} };
      } catch {}
    };

    connect();
    return () => {
      stopped = true;
      if (wsRef.current) try { wsRef.current.close(); } catch {}
    };
  }, [onAlert]);
}
