import { Lock, Unlock, Wifi } from "lucide-react";

function Topbar({ locked, mode, onLock, systemStatus }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">CONTROL CENTER</p>
        <h1>Touch-Free Mouse Control</h1>
      </div>

      <div className="topbar-actions">
        <div className="mode-badge">
          <span className="small-dot"></span>
          {mode} Mode
        </div>

        <div className="system-badge">
          <Wifi size={15} />
          {systemStatus}
        </div>

        <button
          className={`lock-button ${locked ? "locked" : ""}`}
          onClick={onLock}
        >
          {locked ? <Unlock size={17} /> : <Lock size={17} />}

          {locked ? "Unlock Control" : "Safety Lock"}
        </button>
      </div>
    </header>
  );
}

export default Topbar;