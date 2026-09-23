import {
  Lock,
  ZoomIn,
  MoveHorizontal,
  Scroll,
  MousePointerClick,
  MousePointer2,
  ShieldAlert,
  Grip,
} from "lucide-react";

function Gestures() {
  const gestures = [
    { id: "1", gesture: "Fist (all four fingers folded)", action: "lock", description: "Hold briefly to toggle Safety Lock once. Release before locking or unlocking again.", icon: Lock },
    { id: "2", gesture: "Index + pinky extended (rock sign)", action: "zoom", description: "Move hand up to zoom in or down to zoom out.", icon: ZoomIn },
    { id: "3", gesture: "Index + middle + ring extended; pinky folded", action: "hscroll", description: "Move hand left or right for horizontal scrolling.", icon: MoveHorizontal },
    { id: "4", gesture: "Two fingers: index + middle extended (V sign)", action: "scroll", description: "Move immediately up or down for vertical scrolling.", icon: Scroll },
    { id: "5", gesture: "Thumb touches index and middle together", action: "double_click", description: "Double click at the current cursor position.", icon: MousePointerClick },
    { id: "6", gesture: "Right hand: thumb + index pinch", action: "left_click", description: "Left click.", icon: MousePointerClick },
    { id: "7", gesture: "Right hand: thumb + middle pinch", action: "right_click", description: "Right click.", icon: MousePointerClick },
    { id: "8", gesture: "Left hand: thumb + index pinch", action: "right_click", description: "Right click.", icon: MousePointerClick },
    { id: "9", gesture: "Left hand: thumb + middle pinch", action: "left_click", description: "Left click.", icon: MousePointerClick },
    { id: "10", gesture: "Index finger extended", action: "move", description: "Move the calibrated cursor with the index fingertip.", icon: MousePointer2 },
    { id: "11", gesture: "Thumb + index + middle pinch", action: "select_drag", description: "Pinch thumb, index, and middle fingers to select. Hold for about 0.5 seconds to start dragging. Move while maintaining the pinch, then release to drop.", icon: Grip },
    { id: "12", gesture: "Open palm, quick swipe right", action: "tab_next", description: "Switch to the next browser tab (Ctrl + Tab), once per swipe.", icon: MoveHorizontal },
    { id: "13", gesture: "Open palm, quick swipe left", action: "tab_previous", description: "Switch to the previous browser tab (Ctrl + Shift + Tab), once per swipe.", icon: MoveHorizontal },
    { id: "14", gesture: "Crossed index + middle fingers", action: "browser_back", description: "Go back in the browser (Alt + Left), once each time the crossed pose is made.", icon: MousePointer2 },
  ];

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <span className="section-label">HAND GESTURE ENGINE</span>
          <h2>Gesture Controls</h2>
          <p>Hand gestures used to control the mouse in real time.</p>
        </div>
      </div>

      <div className="gesture-table-wrapper">
        <table className="gesture-table">
          <thead>
            <tr>
              <th>#</th><th>Hand Gesture</th><th>Action</th><th>Description</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {gestures.map((gesture) => {
              const Icon = gesture.icon;
              return (
                <tr key={gesture.id}>
                  <td className="gesture-number">{gesture.id}</td>
                  <td><div className="gesture-name"><div className="gesture-table-icon"><Icon size={17} /></div><span>{gesture.gesture}</span></div></td>
                  <td><code className="gesture-action-code">{gesture.action}</code></td>
                  <td className="gesture-description">{gesture.description}</td>
                  <td><span className="gesture-enabled"><span></span>Enabled</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="gesture-note">
        <ShieldAlert size={18} />
        <div>
          <strong>Safety behaviour</strong>
          <p>If no hand is detected for 5 or more frames, the system force-releases drag and resets gesture tracking.</p>
        </div>
      </div>
    </section>
  );
}

export default Gestures;
