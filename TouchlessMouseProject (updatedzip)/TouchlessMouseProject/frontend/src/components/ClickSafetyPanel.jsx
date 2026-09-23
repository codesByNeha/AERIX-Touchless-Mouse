function ClickSafetyPanel({ safety, onDismiss }) {
  const warning = safety?.warning;

  return (
    <>
      <div className={`click-safety-status ${safety?.status === "ACTIVE" ? "is-active" : "is-limited"}`}>
        <span></span>
        AI Protection: {safety?.status ?? "LIMITED"}
      </div>
      {warning && (
        <aside className="click-safety-warning" role="alert">
          <div className="warning-title">⚠ DANGER</div>
          <strong>Potentially unsafe click detected.</strong>
          <p>Reason: {warning.reason}</p>
          <button onClick={onDismiss}>Dismiss</button>
        </aside>
      )}
    </>
  );
}

export default ClickSafetyPanel;
