import {
  Activity,
  Gauge,
  Timer,
  Target,
} from "lucide-react";

import CameraPreview from "../components/CameraPreview";
import StatCard from "../components/StatCard";
import SafetyLock from "../components/SafetyLock";
import Sensitivity from "../components/Sensitivity";
import ActivityLog from "../components/ActivityLog";
import AERIXMouse3D from "../components/AERIXMouse3D";

function Dashboard({
  locked,
  onLock,
  sensitivity,
  setSensitivity,
  adaptive,
  setAdaptive,
  stats,
  activities,
}) {
  return (
    <section className="dashboard">

      <AERIXMouse3D gesture={stats.gesture} locked={locked} />

      {/* HEADER */}

      <div className="welcome-row">

        <div>
          <span className="section-label">
            OVERVIEW
          </span>

          <h2>
            System Overview
          </h2>

          <p>
            Control your computer naturally using
            real-time hand gestures.
          </p>
        </div>


        <div
          className={`status-pill ${
            locked ? "status-locked" : ""
          }`}
        >
          <span></span>

          {locked
            ? "Safety Lock Enabled"
            : "System Active"}
        </div>

      </div>



      {/* CAMERA + STATISTICS */}

      <div className="dashboard-grid">

        <CameraPreview
          locked={locked}
        />


        <div className="stats-grid">

          <StatCard
            icon={<Activity size={20} />}
            label="TRACKING FPS"
            value={stats.fps}
            unit="FPS"
            description="Real-time tracking"
          />

          <StatCard
            icon={<Timer size={20} />}
            label="LATENCY"
            value={stats.latency}
            unit="ms"
            description="Response time"
          />

          <StatCard
            icon={<Target size={20} />}
            label="CONFIDENCE"
            value={stats.confidence}
            unit="%"
            description="Gesture accuracy"
          />

          <StatCard
            icon={<Gauge size={20} />}
            label="SENSITIVITY"
            value={sensitivity}
            unit="%"
            description="Cursor response"
          />

        </div>

      </div>



      {/* DETECTED GESTURE */}

      <div className="current-gesture">

        <div>

          <span className="section-label">
            DETECTED GESTURE
          </span>

          <h3>
            {locked
              ? "Control Locked"
              : stats.gesture}
          </h3>

        </div>


        <div className="gesture-indicator">

          <span></span>

          {locked
            ? "Paused"
            : "Tracking"}

        </div>

      </div>



      {/* HAND CONTROL STATUS */}

      <div className="hand-control-card">

        <div className="hand-control-icon">
          ✋
        </div>

        <div className="hand-control-content">

          <span className="section-label">
            CONTROL MODE
          </span>

          <h3>
            Hand Gesture Control
          </h3>

          <p>
            Mouse operations are controlled entirely
            through real-time hand gestures.
          </p>

        </div>

        <div className="hand-control-status">

          <span></span>

          HAND ONLY

        </div>

      </div>



      {/* SAFETY + SENSITIVITY */}

      <div className="control-grid">

        <SafetyLock
          locked={locked}
          onLock={onLock}
        />

        <Sensitivity
          sensitivity={sensitivity}
          setSensitivity={setSensitivity}
          adaptive={adaptive}
          setAdaptive={setAdaptive}
        />

      </div>


      {/* ACTIVITY */}

      <ActivityLog
        activities={activities}
      />

    </section>
  );
}

export default Dashboard;
