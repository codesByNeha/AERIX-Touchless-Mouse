import { Lock, ShieldCheck, Unlock } from "lucide-react";

function SafetyLock({ locked, onLock }) {
  return (
    <div className={`safety-card ${locked ? "safety-locked" : ""}`}>
      <div className="safety-icon">
        {locked ? <Lock size={23} /> : <ShieldCheck size={23} />}
      </div>

      <div className="safety-content">
        <span className="section-label">SAFETY CONTROL</span>

        <h3>
          {locked ? "Mouse Control Locked" : "Mouse Control Active"}
        </h3>

        <p>
          {locked
            ? "Gesture actions are temporarily disabled."
            : "Gesture commands can currently control the cursor."}
        </p>
      </div>

      <button className="safety-toggle" onClick={onLock}>
        {locked ? (
          <>
            <Unlock size={16} />
            Unlock
          </>
        ) : (
          <>
            <Lock size={16} />
            Lock
          </>
        )}
      </button>
    </div>
  );
}

export default SafetyLock;