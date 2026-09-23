function StatCard({ icon, label, value, unit, description }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>

      <div className="stat-content">
        <span>{label}</span>

        <div className="stat-value">
          <strong>{value}</strong>
          {unit && <small>{unit}</small>}
        </div>

        <p>{description}</p>
      </div>
    </div>
  );
}

export default StatCard;