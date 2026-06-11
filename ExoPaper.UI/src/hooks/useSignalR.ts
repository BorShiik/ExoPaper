import { useEffect, useRef } from "react";
import * as signalR from "@microsoft/signalr";
import { useAppStore } from "../stores/appStore";

/**
 * Connects to the ExoPaper SignalR hub, dispatches events to the Zustand store and
 * exposes the live connection (for streaming RAG answers). Auto-reconnects.
 */
export function useSignalR() {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const setConnected = useAppStore((s) => s.setConnected);
  const setConnection = useAppStore((s) => s.setConnection);
  const addEvent = useAppStore((s) => s.addEvent);

  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl("/hubs/exopaper")
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Information)
      .build();

    connectionRef.current = connection;
    setConnection(connection);

    connection.on("ReceiveEvent", (eventType: string, payloadJson: string) => {
      addEvent({
        id: crypto.randomUUID(),
        eventType,
        payload: payloadJson,
        timestamp: new Date(),
      });
    });

    connection.on("ReceivePlanetEvent", (eventType: string, payloadJson: string) => {
      addEvent({
        id: crypto.randomUUID(),
        eventType: `planet:${eventType}`,
        payload: payloadJson,
        timestamp: new Date(),
      });
    });

    connection.onreconnecting(() => setConnected(false));
    connection.onreconnected(() => setConnected(true));
    connection.onclose(() => setConnected(false));

    connection
      .start()
      .then(() => {
        setConnected(true);
        console.log("[SignalR] Connected to ExoPaperHub");
      })
      .catch((err) => {
        console.error("[SignalR] Connection failed:", err);
        setConnected(false);
      });

    // An open WebSocket blocks the browser's back/forward cache (bfcache). Release it when the
    // page is hidden and re-establish it when the page is restored, so navigation stays instant.
    const handlePageHide = () => {
      connection.stop().catch(() => {});
    };
    const handlePageShow = () => {
      if (connection.state === signalR.HubConnectionState.Disconnected) {
        connection
          .start()
          .then(() => setConnected(true))
          .catch(() => setConnected(false));
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      setConnection(null);
      connection.stop();
    };
  }, [setConnected, setConnection, addEvent]);

  return connectionRef;
}
