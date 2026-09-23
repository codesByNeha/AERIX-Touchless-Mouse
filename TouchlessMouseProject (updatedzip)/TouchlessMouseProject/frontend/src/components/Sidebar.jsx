import {
  LayoutDashboard,
  Hand,
  Crosshair,
  Settings,
  MousePointer2,
  Sparkles,
} from "lucide-react";

function Sidebar({ page, setPage }) {
  const menu = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "gestures",
      label: "Gestures",
      icon: Hand,
    },
    {
      id: "calibration",
      label: "Calibration",
      icon: Crosshair,
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  return (
    <aside className="sidebar">
      <div className="logo-section">
        <div className="logo-icon">
          <MousePointer2 size={22} />
        </div>

        <div>
          <h2>AERIX</h2>
          <span>Control Beyond Touch</span>
        </div>
      </div>

      <div className="nav-title">CONTROL CENTER</div>

      <nav>
        {menu.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${
                page === item.id ? "nav-active" : ""
              }`}
              onClick={() => setPage(item.id)}
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <Sparkles size={17} />

        <div>
          <strong>AI Engine</strong>
          <p>Ready for interaction</p>
        </div>

        <span className="online-dot"></span>
      </div>
    </aside>
  );
}

export default Sidebar;
