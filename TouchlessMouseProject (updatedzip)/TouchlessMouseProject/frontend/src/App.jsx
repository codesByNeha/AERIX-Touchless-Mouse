import { useEffect, useRef, useState } from "react";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import ClickSafetyPanel from "./components/ClickSafetyPanel";
import MouseCursor3D from "./components/MouseCursor3D";

import Dashboard from "./pages/Dashboard";
import Gestures from "./pages/Gestures";
import Calibration from "./pages/Calibration";
import Settings from "./pages/Settings";

function App() {
  const [page, setPage] = useState("dashboard");

  const [locked, setLocked] = useState(true);
  const [sensitivity, setSensitivity] = useState(65);
  const [adaptive, setAdaptive] = useState(true);

  const [systemStatus, setSystemStatus] = useState("Connecting");
  const [mode, setMode] = useState("Gesture");
  const [calibration, setCalibration] = useState({
    active: false,
    points: 0,
    complete: false,
    error: null,
  });

  const [stats, setStats] = useState({
    fps: 0,
    latency: 0,
    confidence: 0,
    gesture: "none",
  });

  const [activities, setActivities] = useState([]);
  const [clickSafety, setClickSafety] = useState({ status: "LIMITED", warning: null });
  const lastGesture = useRef("none");
  const lockRequestPending = useRef(false);

  const addActivity = (action) => {
    setActivities((previous) => [
      {
        action,
        time: "Just now",
      },
      ...previous.slice(0, 4),
    ]);
  };

  const applyBackendStatus = (status) => {
    setLocked(status.locked);
    setMode(status.mode ?? "gesture");
    if (status.calibration) {
      setCalibration(status.calibration);
    }
    if (status.click_safety) {
      setClickSafety(status.click_safety);
    }
    setStats({
      fps: status.fps ?? 0,
      latency: status.latency_ms ?? 0,
      confidence: Math.round((status.confidence ?? 0) * 100),
      gesture: status.gesture ?? "none",
    });
  };

  useEffect(() => {
    let socket;
    let reconnectTimer;
    let disposed = false;

    fetch("/api/status")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to load backend status");
        }

        return response.json();
      })
      .then((status) => {
        if (!disposed) {
          applyBackendStatus(status);
        }
      })
      .catch(() => {
        if (!disposed) {
          setSystemStatus("Backend unavailable");
        }
      });

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

      socket.onopen = () => {
        if (!disposed) {
          setSystemStatus("Connected");
        }
      };

      socket.onmessage = (event) => {
        const status = JSON.parse(event.data);

        if (disposed) {
          return;
        }

        applyBackendStatus(status);

        if (
          status.gesture &&
          status.gesture !== "none" &&
          status.gesture !== lastGesture.current
        ) {
          addActivity(status.gesture.replaceAll("_", " "));
        }

        lastGesture.current = status.gesture ?? "none";
      };

      socket.onclose = () => {
        if (!disposed) {
          setSystemStatus("Reconnecting");
          reconnectTimer = window.setTimeout(connect, 1500);
        }
      };

      socket.onerror = () => socket.close();
    };

    connect();

    return () => {
      disposed = true;
      window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  useEffect(() => {
    let previousUrl;
    const reportHoveredLink = (event) => {
      const link = event.target.closest?.("a[href]");
      const url = link?.href ?? null;
      if (url === previousUrl) return;
      previousUrl = url;
      fetch("/api/safety/target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      }).catch(() => {});
    };
    document.addEventListener("pointermove", reportHoveredLink, { passive: true });
    return () => document.removeEventListener("pointermove", reportHoveredLink);
  }, []);

  const dismissSafetyWarning = async () => {
    try {
      const response = await fetch("/api/safety/dismiss", { method: "POST" });
      if (response.ok) setClickSafety(await response.json());
    } catch {
      // The warning remains visible if the backend cannot confirm dismissal.
    }
  };

  const handleLock = async () => {
    if (lockRequestPending.current) {
      return;
    }

    lockRequestPending.current = true;

    try {
      const response = await fetch("/api/lock", { method: "POST" });

      if (!response.ok) {
        throw new Error("Unable to update safety lock");
      }

      const status = await response.json();
      setLocked(status.locked);
    } catch {
      setSystemStatus("Backend unavailable");
    } finally {
      lockRequestPending.current = false;
    }
  };

  const updateCalibration = async (endpoint) => {
    try {
      const response = await fetch(endpoint, { method: "POST" });

      if (!response.ok) {
        throw new Error("Unable to update calibration");
      }

      const status = await response.json();
      setCalibration(status);
    } catch {
      setCalibration((previous) => ({
        ...previous,
        error: "The backend is unavailable. Start it and try again.",
      }));
    }
  };

  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return (
          <Dashboard
            locked={locked}
            onLock={handleLock}
            sensitivity={sensitivity}
            setSensitivity={setSensitivity}
            adaptive={adaptive}
            setAdaptive={setAdaptive}
            stats={stats}
            activities={activities}
          />
        );

      case "gestures":
        return <Gestures />;

      case "calibration":
        return (
          <Calibration
            calibration={calibration}
            onStart={() => updateCalibration("/api/calibrate")}
            onConfirm={() => updateCalibration("/api/calibrate/point")}
            onReset={() => updateCalibration("/api/calibrate/reset")}
          />
        );

      case "settings":
        return (
          <Settings
            sensitivity={sensitivity}
            setSensitivity={setSensitivity}
            adaptive={adaptive}
            setAdaptive={setAdaptive}
            systemStatus={systemStatus}
            setSystemStatus={setSystemStatus}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="app">
      <MouseCursor3D />

      <Sidebar
        page={page}
        setPage={setPage}
      />

      <main className="main-content">

        <Topbar
          locked={locked}
          mode={mode}
          onLock={handleLock}
          systemStatus={systemStatus}
        />

        <ClickSafetyPanel safety={clickSafety} onDismiss={dismissSafetyWarning} />

        {renderPage()}

      </main>

    </div>
  );
}

export default App;
