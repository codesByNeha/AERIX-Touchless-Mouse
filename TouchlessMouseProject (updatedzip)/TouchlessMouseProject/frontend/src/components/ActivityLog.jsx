import {
  MousePointer2,
  MousePointerClick,
  MoveDown,
  Hand,
} from "lucide-react";

function ActivityIcon({ action }) {
  if (action.toLowerCase().includes("click")) {
    return <MousePointerClick size={16} />;
  }

  if (action.toLowerCase().includes("scroll")) {
    return <MoveDown size={16} />;
  }

  if (action.toLowerCase().includes("drag")) {
    return <Hand size={16} />;
  }

  return <MousePointer2 size={16} />;
}

function ActivityLog({ activities }) {
  return (
    <div className="activity-card">
      <div className="section-heading">
        <div>
          <span className="section-label">SYSTEM ACTIVITY</span>
          <h3>Recent Actions</h3>
        </div>

        <span className="activity-live">
          ● Live
        </span>
      </div>

      <div className="activity-list">
        {activities.map((item, index) => (
          <div className="activity-item" key={`${item.action}-${index}`}>
            <div className="activity-icon">
              <ActivityIcon action={item.action} />
            </div>

            <div className="activity-info">
              <strong>{item.action}</strong>
              <span>Gesture detected</span>
            </div>

            <time>{item.time}</time>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ActivityLog;