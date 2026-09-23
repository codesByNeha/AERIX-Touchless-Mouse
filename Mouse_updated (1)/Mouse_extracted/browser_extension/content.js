console.log("[Touchless Protection] content.js LOADED");
(() => {
  const results = new Map();
  const requested = new Set();
  let lastUrl = null;
  let bannerHost;
  let banner;

  function linkFor(node) {
    const element = node instanceof Element ? node : node?.parentElement;
    return element?.closest("a[href]") || null;
  }

  function threatIntelligenceFor(result) {
    const nested = result?.threat_intelligence || {};
    return {
      ...nested,
      phishtank: nested.phishtank ?? result?.phishtank,
      virustotal: nested.virustotal ?? result?.virustotal,
    };
  }

  function showWarning(result, pending = false) {
    if (!bannerHost) {
      bannerHost = document.createElement("div");
      bannerHost.setAttribute("popover", "manual");
      bannerHost.setAttribute("aria-live", "assertive");
      bannerHost.style.setProperty("all", "initial", "important");
      bannerHost.style.setProperty("position", "fixed", "important");
      bannerHost.style.setProperty("inset", "12px 0 auto", "important");
      bannerHost.style.setProperty("width", "100vw", "important");
      bannerHost.style.setProperty("display", "flex", "important");
      bannerHost.style.setProperty("justify-content", "center", "important");
      bannerHost.style.setProperty("z-index", "2147483647", "important");
      bannerHost.style.setProperty("margin", "0", "important");
      bannerHost.style.setProperty("padding", "0", "important");
      bannerHost.style.setProperty("border", "0", "important");
      bannerHost.style.setProperty("background", "transparent", "important");
      bannerHost.style.setProperty("overflow", "visible", "important");
      bannerHost.style.setProperty("pointer-events", "none", "important");
      bannerHost.style.setProperty("visibility", "visible", "important");
      bannerHost.style.setProperty("opacity", "1", "important");
      const shadow = bannerHost.attachShadow({ mode: "closed" });
      banner = document.createElement("div");
      banner.setAttribute("role", "alert");
      banner.style.setProperty("all", "initial", "important");
      banner.style.setProperty("display", "block", "important");
      banner.style.setProperty("box-sizing", "border-box", "important");
      banner.style.setProperty("max-width", "90vw", "important");
      banner.style.setProperty("padding", "14px 18px", "important");
      banner.style.setProperty("background", "#7f1d1d", "important");
      banner.style.setProperty("color", "#fff", "important");
      banner.style.setProperty("border", "2px solid #fecaca", "important");
      banner.style.setProperty("border-radius", "8px", "important");
      banner.style.setProperty("font", "600 14px/1.45 system-ui, sans-serif", "important");
      banner.style.setProperty("text-align", "left", "important");
      banner.style.setProperty("white-space", "pre-line", "important");
      banner.style.setProperty("box-shadow", "0 4px 18px #0008", "important");
      banner.style.setProperty("overflow-wrap", "anywhere", "important");
      shadow.appendChild(banner);
    }

    const root = document.documentElement;
    if (!root) {
      document.addEventListener("DOMContentLoaded", () => showWarning(result, pending), { once: true });
      return;
    }
    if (!bannerHost.isConnected) root.appendChild(bannerHost);
    if (typeof bannerHost.showPopover === "function" && !bannerHost.matches(":popover-open")) {
      try {
        bannerHost.showPopover();
      } catch (_) {
        bannerHost.removeAttribute("popover");
      }
    } else if (typeof bannerHost.showPopover !== "function") {
      bannerHost.removeAttribute("popover");
    }

    if (pending) {
      banner.textContent = "CHECKING LINK SAFETY... Navigation is paused until inspection finishes.";
    } else {
      const risk = String(result.risk || "suspicious").toUpperCase();
      const confidence = result.ai_detected && Number.isFinite(result.confidence)
        ? ` Local ML model score (not a calibrated probability): ${Math.round(result.confidence * 100)}%.`
        : "";
      const intel = threatIntelligenceFor(result);
      const vtMalicious = Number(intel.virustotal?.malicious ?? 0);
      if (vtMalicious > 0) {
        banner.textContent = "⚠️ Potentially Dangerous Link\n\nVirusTotal detected malicious activity associated with this URL.\n\nNavigation prevented for your safety.";
      } else {
      const sources = [];
      if (intel.phishtank?.matched) sources.push("PhishTank");
      if ((intel.virustotal?.malicious || 0) > 0 || (intel.virustotal?.suspicious || 0) > 0) sources.push("VirusTotal");
      if (result.ai_detected) sources.push("local ML");
      if (!sources.length) sources.push("URL analysis");
      banner.textContent = `${risk} LINK BLOCKED: ${result.reason || "Potentially dangerous URL"}.${confidence} Source: ${sources.join(", ")}. Navigation blocked.`;
      }
    }
    console.info("[Touchless Protection] Warning displayed:", {
      visible: bannerHost.matches(":popover-open") || getComputedStyle(bannerHost).display !== "none",
      virustotalMalicious: Number(threatIntelligenceFor(result).virustotal?.malicious ?? 0),
      message: banner.textContent,
    });
    clearTimeout(bannerHost.hideTimer);
    const visibleHost = bannerHost;
    bannerHost.hideTimer = setTimeout(() => {
      if (visibleHost === bannerHost) {
        if (typeof visibleHost.hidePopover === "function" && visibleHost.matches(":popover-open")) {
          visibleHost.hidePopover();
        }
        visibleHost.remove();
        bannerHost = null;
        banner = null;
      }
    }, 5000);
  }

  function requestInspection(url, refreshBackendTarget = false) {
    if (!url || requested.has(url)) return;
    const result = results.get(url);
    if (!refreshBackendTarget && result && Date.now() - result.time < 30000 && typeof result.allowed === "boolean") {
      console.info("[Touchless Protection] Content cache:", url, result.allowed ? "ALLOW" : "BLOCK", result.reason);
      return;
    }
    requested.add(url);
    console.info("[Touchless Protection] Detected hovered link:", url);
    chrome.runtime.sendMessage({ type: "inspect-target", url }, response => {
      requested.delete(url);
      if (chrome.runtime.lastError) {
        console.error("[Touchless Protection] Extension message failed:", chrome.runtime.lastError.message);
        return;
      }
      if (!response || response.url !== url) {
        console.error("[Touchless Protection] Missing/mismatched inspection response for:", url, response);
        return;
      }
      console.info("[Touchless Protection] Inspection result received:", url, response);
      if (typeof response.allowed === "boolean") {
        const inspected = {
          time: Date.now(), allowed: response.allowed, risk: response.risk,
          confidence: response.confidence, ai_detected: response.ai_detected,
          reason: response.reason, threat_intelligence: threatIntelligenceFor(response),
          virustotal: response.virustotal, phishtank: response.phishtank,
        };
        results.set(url, inspected);
        if (!inspected.allowed) {
          console.info("[Touchless Protection] Unsafe hover result; showing warning:", {
            risk: inspected.risk,
            virustotal: inspected.threat_intelligence.virustotal,
          });
          showWarning(inspected);
        }
      }
    });
  }

  function inspect(url) {
    if (url === lastUrl) return;
    lastUrl = url;
    if (!url) {
      console.info("[Touchless Protection] Pointer is over non-link content");
      chrome.runtime.sendMessage({ type: "inspect-target", url: "" }, () => {
        if (chrome.runtime.lastError) console.warn("[Touchless Protection] Target clear message failed:", chrome.runtime.lastError.message);
      });
      return;
    }
    requestInspection(url, true);
  }

  function handleHover(event) {
  const url = linkFor(event.target)?.href || "";

  if (url) {
    console.log("[Touchless Protection] HOVER DETECTED:", url);
  }

  inspect(url);
}

document.addEventListener("mouseover", handleHover, {
  passive: true,
  capture: true
});

document.addEventListener("mousemove", handleHover, {
  passive: true,
  capture: true
});
  function interceptIfUnverified(event) {
    const anchor = linkFor(event.target);
    if (!anchor) return;
    const url = anchor.href;
    const result = results.get(url);
    const fresh = result && Date.now() - result.time < 30000;

    if (fresh && result.allowed === true) {
      console.info("[Touchless Protection] Click allowed from cached safe result:", event.type, url);
      return;
    }

    // The original implementation let clicks through when inspection was
    // pending or failed. Cancel at capture time; never wait on network inside
    // this event. The user can retry once a safe result is cached.
    event.preventDefault();
    event.stopImmediatePropagation();
    console.warn("[Touchless Protection] Click intercepted:", {
      event: event.type,
      url,
      cachedResult: fresh ? result.allowed : "pending/unknown",
      defaultPrevented: event.defaultPrevented,
      reason: fresh && result.allowed === false ? result.reason : "inspection pending or unavailable",
    });
    if (fresh && result.allowed === false) showWarning(result);
    else showWarning({}, true);
    requestInspection(url);
  }

  // OS-generated PyAutoGUI mouse input still creates browser DOM events. The
  // extension cannot stop the OS click itself, but can cancel link activation.
  for (const eventName of ["click", "auxclick", "contextmenu"]) {
    document.addEventListener(eventName, interceptIfUnverified, true);
  }
})();
