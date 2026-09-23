import { useState } from "react";
import {
  Crosshair,
  CheckCircle2,
  Camera,
  RotateCcw,
} from "lucide-react";

function Calibration({ calibration, onStart, onConfirm, onReset }) {
  const [streamReady, setStreamReady] = useState(false);
  const step = calibration.points ?? 0;

  const points = [
    "Top Left",
    "Top Right",
    "Bottom Right",
    "Bottom Left",
  ];

  const handleCalibration = () => {
    if (calibration.active) {
      onConfirm();
    } else if (!calibration.complete) {
      onStart();
    }
  };

  const resetCalibration = () => {
    onReset();
  };

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <span className="section-label">SYSTEM SETUP</span>
          <h2>Camera Calibration</h2>
          <p>
            Calibrate the hand tracking area for accurate cursor movement.
          </p>
        </div>

        <div className="calibration-progress">
          {step}/4 Points
        </div>
      </div>

      <div className="calibration-layout">
        <div className="calibration-camera">
          <div className="card-header">
            <div>
              <span className="section-label">CALIBRATION AREA</span>
              <h3>Position your hand</h3>
            </div>

            <Camera size={20} />
          </div>

          <div className="calibration-screen">
            <img
              className="camera-feed"
              src="/api/video-feed"
              alt="Live calibration camera feed"
              onLoad={() => setStreamReady(true)}
              onError={() => setStreamReady(false)}
            />

            <div className="calibration-grid"></div>

            <div className={`calibration-point point-tl ${step === 0 && calibration.active ? "active" : ""}`}></div>
            <div className={`calibration-point point-tr ${step === 1 && calibration.active ? "active" : ""}`}></div>
            <div className={`calibration-point point-br ${step === 2 && calibration.active ? "active" : ""}`}></div>
            <div className={`calibration-point point-bl ${step === 3 && calibration.active ? "active" : ""}`}></div>

            <div className="calibration-center">
              <Crosshair size={46} />

              <strong>
                {calibration.complete
                  ? "Calibration Complete"
                  : !calibration.active
                  ? "Ready to Calibrate"
                  : `Move to ${calibration.current_point}`}
              </strong>

              <span>
                {calibration.complete
                  ? "Your tracking area is ready."
                  : streamReady
                  ? "Follow the highlighted point, then confirm it."
                  : "Waiting for the backend camera feed..."}
              </span>
            </div>
          </div>

          <button
            className="primary-button calibration-button"
            onClick={handleCalibration}
            disabled={calibration.complete}
          >
            {calibration.complete ? (
              <>
                <CheckCircle2 size={18} />
                Calibration Complete
              </>
            ) : (
              <>
                <Crosshair size={18} />
                {calibration.active ? "Confirm Point" : "Start Calibration"}
              </>
            )}
          </button>
        </div>

        <div className="calibration-info">
          <div className="info-card">
            <span className="section-label">HOW IT WORKS</span>

            <h3>Four-point calibration</h3>

            <p>
              Place your hand at each highlighted point. The system will map
              your camera space to the screen coordinates.
            </p>

            <div className="calibration-steps">
              {points.map((point, index) => (
                <div
                  className={`calibration-step ${
                    index < step ? "completed" : ""
                  } ${index === step ? "current" : ""}`}
                  key={point}
                >
                  <div className="step-number">
                    {index < step ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      index + 1
                    )}
                  </div>

                  <div>
                    <strong>{point}</strong>
                    <span>
                      {index < step
                        ? "Completed"
                        : calibration.active && index === step
                        ? "Current point"
                        : "Waiting"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {calibration.error && (
              <p className="calibration-error">{calibration.error}</p>
            )}

            <button
              className="secondary-button full-width"
              onClick={resetCalibration}
            >
              <RotateCcw size={16} />
              Recalibrate
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Calibration;
