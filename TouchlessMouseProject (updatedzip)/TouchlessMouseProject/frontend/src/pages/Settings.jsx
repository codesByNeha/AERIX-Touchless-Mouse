import {
  Camera,
  SlidersHorizontal,
  Zap,
  Monitor,
  ShieldCheck,
} from "lucide-react";

function Settings({
  sensitivity,
  setSensitivity,
  adaptive,
  setAdaptive,
  systemStatus,
  setSystemStatus,
}) {
  return (
    <section className="page-section">

      <div className="page-heading">

        <div>

          <span className="section-label">
            CONFIGURATION
          </span>

          <h2>
            System Settings
          </h2>

          <p>
            Configure camera, hand tracking and safety
            preferences.
          </p>

        </div>

      </div>


      <div className="settings-grid">


        {/* CAMERA */}

        <div className="settings-card">

          <div className="settings-card-heading">

            <div className="settings-icon">
              <Camera size={20} />
            </div>

            <div>

              <span className="section-label">
                INPUT
              </span>

              <h3>
                Camera
              </h3>

            </div>

          </div>


          <label>
            Camera Device
          </label>

          <select defaultValue="default">

            <option value="default">
              Default Camera
            </option>

            <option value="camera-1">
              Camera 01
            </option>

            <option value="camera-2">
              Camera 02
            </option>

          </select>


          <div className="setting-status">

            <span className="status-indicator"></span>

            Camera ready for hand tracking

          </div>

        </div>



        {/* SENSITIVITY */}

        <div className="settings-card">

          <div className="settings-card-heading">

            <div className="settings-icon">
              <SlidersHorizontal size={20} />
            </div>

            <div>

              <span className="section-label">
                CURSOR
              </span>

              <h3>
                Sensitivity
              </h3>

            </div>

          </div>


          <div className="settings-slider-row">

            <span>
              Movement sensitivity
            </span>

            <strong>
              {Math.round(sensitivity)}%
            </strong>

          </div>


          <input
            className="settings-range"
            type="range"
            min="30"
            max="200"
            value={sensitivity}
            onChange={(e) =>
              setSensitivity(
                Number(e.target.value)
              )
            }
          />


          <div className="setting-description">

            <Zap size={15} />

            Adjust how much index-finger movement
            affects cursor movement.

          </div>

        </div>



        {/* SAFETY */}

        <div className="settings-card">

          <div className="settings-card-heading">

            <div className="settings-icon">
              <ShieldCheck size={20} />
            </div>

            <div>

              <span className="section-label">
                SAFETY
              </span>

              <h3>
                Safety Controls
              </h3>

            </div>

          </div>


          <div className="setting-row">

            <div>

              <strong>
                Adaptive Sensitivity
              </strong>

              <p>
                Automatically adjust cursor response.
              </p>

            </div>


            <button
              className={`switch ${
                adaptive
                  ? "switch-on"
                  : ""
              }`}
              onClick={() =>
                setAdaptive(!adaptive)
              }
            >

              <span></span>

            </button>

          </div>


          <div className="setting-row">

            <div>

              <strong>
                Hand Gesture Engine
              </strong>

              <p>
                Enable real-time hand recognition.
              </p>

            </div>


            <button
              className={`switch ${
                systemStatus === "Active"
                  ? "switch-on"
                  : ""
              }`}
              onClick={() =>
                setSystemStatus(
                  systemStatus === "Active"
                    ? "Paused"
                    : "Active"
                )
              }
            >

              <span></span>

            </button>

          </div>

        </div>



        {/* SYSTEM INFORMATION */}

        <div className="settings-card">

          <div className="settings-card-heading">

            <div className="settings-icon">
              <Monitor size={20} />
            </div>

            <div>

              <span className="section-label">
                SYSTEM
              </span>

              <h3>
                System Information
              </h3>

            </div>

          </div>


          <div className="system-info-grid">

            <div>

              <span>
                Control Mode
              </span>

              <strong>
                Hand Gestures
              </strong>

            </div>


            <div>

              <span>
                Tracking
              </span>

              <strong>
                MediaPipe
              </strong>

            </div>


            <div>

              <span>
                Camera
              </span>

              <strong>
                OpenCV
              </strong>

            </div>


            <div>

              <span>
                Mouse
              </span>

              <strong>
                PyAutoGUI
              </strong>

            </div>

          </div>

        </div>


      </div>

    </section>
  );
}

export default Settings;