import { SlidersHorizontal, Zap } from "lucide-react";

function Sensitivity({
  sensitivity,
  setSensitivity,
  adaptive,
  setAdaptive,
}) {
  return (
    <div className="sensitivity-card">
      <div className="section-heading">
        <div>
          <span className="section-label">CURSOR CONTROL</span>
          <h3>Movement Sensitivity</h3>
        </div>

        <div className="sensitivity-value">
          {sensitivity}%
        </div>
      </div>

      <div className="slider-container">
        <SlidersHorizontal size={18} />

        <input
          type="range"
          min="0"
          max="100"
          value={sensitivity}
          onChange={(e) => setSensitivity(Number(e.target.value))}
        />

        <span>100</span>
      </div>

      <div className="sensitivity-footer">
        <div className="adaptive-control">
          <div className="adaptive-icon">
            <Zap size={15} />
          </div>

          <div>
            <strong>Adaptive Sensitivity</strong>
            <span>Automatically adjust based on movement</span>
          </div>
        </div>

        <button
          className={`switch ${adaptive ? "switch-on" : ""}`}
          onClick={() => setAdaptive(!adaptive)}
          aria-label="Toggle adaptive sensitivity"
        >
          <span></span>
        </button>
      </div>
    </div>
  );
}

export default Sensitivity;