import { useEffect, useRef, useState } from "react";
import { Camera, Circle, Maximize2, Minimize2 } from "lucide-react";

function CameraPreview({ locked }) {
  const [streamReady, setStreamReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenMessage, setFullscreenMessage] = useState("");
  const cardRef = useRef(null);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === cardRef.current);
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  const toggleFullscreen = async () => {
    const card = cardRef.current;
    if (!card || !document.fullscreenEnabled) {
      setFullscreenMessage("Fullscreen is not available in this browser.");
      return;
    }

    try {
      if (document.fullscreenElement === card) {
        await document.exitFullscreen();
      } else {
        await card.requestFullscreen();
      }
      setFullscreenMessage("");
    } catch {
      setFullscreenMessage("Could not enter fullscreen. Please try again.");
    }
  };

  return (
    <div className="camera-card" ref={cardRef}>
      <div className="card-header">
        <div>
          <span className="section-label">LIVE INPUT</span>
          <h3>Camera Feed</h3>
        </div>

        <div className={`camera-status ${locked ? "offline" : ""}`}>
          <Circle size={9} fill="currentColor" />
          {locked ? "Paused" : "Live"}
        </div>
      </div>

      <div className="camera-screen">
        <img
          className="camera-feed"
          src="/api/video-feed"
          alt="Live hand-tracking camera feed"
          onLoad={() => setStreamReady(true)}
          onError={() => setStreamReady(false)}
        />

        <div className="camera-grid"></div>

        {!streamReady && (
          <div className="camera-placeholder">
            <Camera size={46} />
            <h4>{locked ? "Control Locked" : "Camera Ready"}</h4>
            <p>Waiting for the backend camera feed...</p>
          </div>
        )}

        <div className="camera-corner top-left"></div>
        <div className="camera-corner top-right"></div>
        <div className="camera-corner bottom-left"></div>
        <div className="camera-corner bottom-right"></div>

        <button
          className="fullscreen-button"
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit camera fullscreen" : "View camera fullscreen"}
          title={isFullscreen ? "Exit fullscreen (Esc)" : "View camera fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>

        <div className="camera-overlay">
          <span>CAM 01</span>
          <span>640 × 480</span>
        </div>

        {fullscreenMessage && (
          <div className="fullscreen-message" role="status">
            {fullscreenMessage}
          </div>
        )}
      </div>
    </div>
  );
}

export default CameraPreview;
