import { useEffect, useRef, useState } from "react";

const actionClass = { left_click: "left", right_click: "right", double_click: "double", scroll: "wheel", hscroll: "wheel", zoom: "zoom" };

export default function AERIXMouse3D({ gesture, locked }) {
  const previous = useRef("none");
  const [action, setAction] = useState("");
  useEffect(() => {
    if (gesture !== previous.current && actionClass[gesture]) {
      setAction(actionClass[gesture]);
      const timer = window.setTimeout(() => setAction(""), gesture === "double_click" ? 420 : 320);
      previous.current = gesture;
      return () => window.clearTimeout(timer);
    }
    previous.current = gesture;
  }, [gesture]);
  return <section className={`aerix-hero ${locked ? "aerix-locked" : ""}`}>
    <div className="aerix-copy"><span className="section-label">TOUCHLESS PRECISION</span><h1>Move through air.<br/><em>Command with intent.</em></h1><p>Real-time gestures become seamless computer control.</p></div>
    <div className={`aerix-stage action-${action}`}><i className="aerix-trail t1"/><i className="aerix-trail t2"/><i className="aerix-trail t3"/><i className="aerix-ring"/><div className="aerix-mouse"><b className="aerix-body"/><b className="aerix-button left-button"/><b className="aerix-button right-button"/><b className="aerix-seam"/><b className="aerix-wheel"><i/></b><b className="aerix-led"/><b className="aerix-base"/></div><span className="aerix-lock">⌑ LOCKED</span></div>
    <div className="aerix-signal"><i/> {gesture && gesture !== "none" ? `Gesture detected · ${gesture.replaceAll("_", " ")}` : "Awaiting gesture signal"}</div>
  </section>;
}
