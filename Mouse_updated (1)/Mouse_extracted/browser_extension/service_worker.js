const API = "http://127.0.0.1:8000/api/safety/inspect";
const cache = new Map();
const TTL_MS = 30000;
let apiQueue = Promise.resolve();

function postInOrder(url) {
  const request = apiQueue.then(() => fetch(API, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }), signal: AbortSignal.timeout(4000) }));
  apiQueue = request.then(() => undefined, () => undefined);
  return request;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "inspect-target") return;
  const url = message.url;
  if (typeof url !== "string" || url.length > 4096) {
    console.warn("[Touchless Protection] Invalid target message", url);
    sendResponse({ url, allowed: null, risk: "unknown", reason: "Unable to inspect target" });
    return;
  }

  if (!url) {
    console.info("[Touchless Protection] Hover left link; clearing FastAPI click target");
    postInOrder(null)
      .then(response => console.info("[Touchless Protection] FastAPI target clear:", response.status))
      .catch(error => console.warn("[Touchless Protection] Could not clear target:", error.message))
      .finally(() => sendResponse({ url: "", allowed: true, risk: "unknown" }));
    return true;
  }

  const previous = cache.get(url);
  const hasCachedResult = !!previous && Date.now() - previous.time < TTL_MS;
  if (hasCachedResult) {
    console.info("[Touchless Protection] Cached result found; refreshing FastAPI click target:", url);
  } else {
    console.info("[Touchless Protection] POST /api/safety/inspect:", url);
  }

  // Even on a service-worker cache hit, wait for FastAPI to arm its existing
  // click gate before telling the page that this target is safe to click.
  (async () => {
    try {
      const response = await postInOrder(url);
      if (!response.ok) throw new Error(`FastAPI returned ${response.status}`);
      const result = await response.json();
      if (typeof result.allowed !== "boolean") throw new Error("FastAPI returned no allow/block decision");
      cache.set(url, { time: Date.now(), result });
      if (cache.size > 128) {
        for (const [key, value] of cache) if (Date.now() - value.time >= TTL_MS) cache.delete(key);
      }
      console.info("[Touchless Protection] FastAPI response:", url, result,
        result.cached ? "(backend cache hit)" : "(new model evaluation)");
      sendResponse({ url, ...result });
    } catch (error) {
      console.error("[Touchless Protection] Inspection request failed:", url, error.message);
      // Reuse a recent decision only if the server is temporarily unavailable.
      // The content script still blocks while no definitive result is available.
      if (hasCachedResult) {
        sendResponse({ url, ...previous.result, cached: true, backendUpdated: false });
      } else {
        sendResponse({ url, allowed: null, risk: "unknown", reason: "Unable to inspect target" });
      }
    }
  })();
  return true;
});
