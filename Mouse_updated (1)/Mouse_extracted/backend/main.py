import asyncio
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path

import cv2
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .config import (
    CAMERA_INDEX,
    FRAME_WIDTH,
    FRAME_HEIGHT,
    DEFAULT_MODE,
    SCROLL_SENSITIVITY,
    HSCROLL_SENSITIVITY,
    ZOOM_SENSITIVITY,
    HAND_LOST_FRAMES,
    SELECT_DRAG_HOLD_SECONDS,
    CLICK_CONFIDENCE_THRESHOLD,
    CLICK_DEBUG_LOG_INTERVAL_SECONDS,
)

from .hand_tracker import HandTracker
from .gestures import GestureClassifier
from .mouse_controller import MouseController
from .mouse_controller import motion_to_wheel_steps
from .adaptive_sensitivity import AdaptiveSensitivity
from .calibration import Calibration
from .click_safety import ClickSafety


PROJECT_ROOT = Path(__file__).resolve().parent.parent
LEGACY_FRONTEND_DIR = PROJECT_ROOT / "Aeris"
MODERN_FRONTEND_DIR = PROJECT_ROOT / "modern-frontend"
if not MODERN_FRONTEND_DIR.is_dir():
    MODERN_FRONTEND_DIR = (
    PROJECT_ROOT.parent.parent
    / "TouchlessMouseProject (updatedzip)"
    / "TouchlessMouseProject"
    / "frontend"
    / "src"
    )


class AppState:

    def __init__(self):

        self.mode = DEFAULT_MODE

        # Safety lock ON when application starts
        self.locked = True

        self.running = False

        self.gesture = "none"
        self.hand_name = "Unknown"

        self.confidence = 0.0
        self.fps = 0.0
        self.latency = 0.0

        self.sensitivity = AdaptiveSensitivity()
        self.calibration = Calibration()

        self.tracker = None
        self.classifier = GestureClassifier()
        self.mouse = MouseController()
        self.click_safety = ClickSafety()

        self.camera = None
        self.thread = None
        self.frame_lock = threading.Lock()
        self.latest_frame = None
        self.latest_index = None

        # Counts consecutive frames with no hand detected, so we
        # can release drag / stop stuck actions if the hand leaves
        # frame instead of leaving the mouse button held down.
        self.hand_lost_count = 0
        self.lock_pose_active = False
        self.last_debug_gesture = None
        self.last_debug_log_time = 0.0
        self.action_gesture_display = None
        self.action_gesture_display_until = 0.0
        # A three-finger pinch first selects, then becomes a held drag only
        # after its configured hold duration.
        self.drag_candidate = False
        self.pinch_start_time = None

    def log_gesture_debug(self, gesture, hand_name, confidence):
        """Throttle terminal diagnostics to a useful rate while still exposing click state."""
        if not hasattr(self, "last_debug_gesture"):
            self.last_debug_gesture = None
        if not hasattr(self, "last_debug_log_time"):
            self.last_debug_log_time = 0.0
        now = time.monotonic()
        if gesture == self.last_debug_gesture and now - self.last_debug_log_time < CLICK_DEBUG_LOG_INTERVAL_SECONDS:
            return

        self.last_debug_log_time = now
        self.last_debug_gesture = gesture
        debug = self.classifier.debug_state
        fingers = debug.get("fingers", {})
        distances = debug.get("distances", {})
        select_distances = debug.get("select_drag_distances", {})
        lines = [
            "GESTURE DEBUG:",
            f"hand={hand_name}",
            f"detected_gesture={gesture}",
            f"confidence={confidence:.2f}",
            f"thumb_index_distance={distances.get('thumb_index', 0.0):.3f}",
            f"thumb_middle_distance={distances.get('thumb_middle', 0.0):.3f}",
            f"select_drag_distance={select_distances.get('index_middle', 0.0):.3f}",
            f"stable_count={debug.get('stable_count', 0)}",
            "fingers=" + " ".join(
                f"{name}:{int(fingers.get(name, False))}"
                for name in ("I", "M", "R", "P")
            ),
        ]
        if any(key in debug for key in ("palm_elapsed", "palm_horizontal_distance")):
            lines.extend([
                f"palm_elapsed={debug.get('palm_elapsed', 0.0):.2f}",
                f"palm_horizontal_distance={debug.get('palm_horizontal_distance', 0.0):.3f}",
            ])
        click_status = debug.get("click_status")
        if click_status:
            lines.append(f"click_accepted={str(click_status.get('accepted', False)).lower()}")
            lines.append(f"click_reason={click_status.get('reason', 'n/a')}")
        if fingers.get("I") and fingers.get("M"):
            lines.append(f"crossed={debug.get('crossed', False)}")
        print("\n".join(lines))

    def dispatch_discrete_action(self, gesture, confidence, hand_name):
        """Dispatch one stable pinch action without consuming cooldown on movement."""
        if not hasattr(self, "click_safety"):
            self.click_safety = ClickSafety()
        if gesture not in {"left_click", "right_click", "double_click"}:
            return False

        if confidence < CLICK_CONFIDENCE_THRESHOLD:
            self.classifier.debug_state["click_status"] = {
                "accepted": False,
                "reason": f"insufficient confidence ({confidence:.2f} < {CLICK_CONFIDENCE_THRESHOLD:.2f})",
            }
            self.log_gesture_debug(gesture, hand_name, confidence)
            return False

        if not self.classifier.action_allowed(gesture):
            self.classifier.debug_state["click_status"] = {
                "accepted": False,
                "reason": "cooldown active",
            }
            self.log_gesture_debug(gesture, hand_name, confidence)
            return False

        print("CLICK DETECTED → ANALYZING")
        decision = self.click_safety.evaluate_click()
        if not decision.allowed:
            self.click_safety.block(decision)
            self.classifier.debug_state["click_status"] = {
                "accepted": False,
                "reason": decision.reason or "suspicious target",
            }
            print("DANGEROUS → CLICK BLOCKED")
            print(f"{hand_name} hand -> BLOCKED {gesture}: {decision.reason}")
            self.log_gesture_debug(gesture, hand_name, confidence)
            return False

        print("SAFE → CLICK ALLOWED")
        self.classifier.debug_state["click_status"] = {"accepted": True, "reason": "normal desktop target"}

        try:
            if gesture == "left_click":
                self.mouse.left_click()
                action_name = "LEFT CLICK"
            elif gesture == "right_click":
                self.mouse.right_click()
                action_name = "RIGHT CLICK"
            else:
                self.mouse.double_click()
                action_name = "DOUBLE CLICK"
        except Exception as exc:
            self.classifier.debug_state["click_status"] = {
                "accepted": False,
                "reason": f"pyautogui exception: {type(exc).__name__}: {exc}",
            }
            print(f"PyAutoGUI {gesture} failed: {type(exc).__name__}: {exc}")
            self.log_gesture_debug(gesture, hand_name, confidence)
            return False

        print(f"{hand_name} hand -> {action_name}")
        self.log_gesture_debug(gesture, hand_name, confidence)
        return True

    def update_select_drag(self, confidence, hand_name):
        """Click once at stable pinch, then hold only after the pinch persists."""
        if not hasattr(self, "click_safety"):
            self.click_safety = ClickSafety()
        if confidence < 1.0:
            return False

        now = time.monotonic()
        if not self.drag_candidate:
            print("CLICK DETECTED → ANALYZING")
            decision = self.click_safety.evaluate_click()
            if not decision.allowed:
                self.click_safety.block(decision)
                print("DANGEROUS → CLICK BLOCKED")
                print(f"{hand_name} hand -> BLOCKED SELECT: {decision.reason}")
                return False
            print("SAFE → CLICK ALLOWED")
            self.mouse.left_click()
            self.drag_candidate = True
            self.pinch_start_time = now
            print(f"{hand_name} hand -> SELECT")
            return True

        if now - self.pinch_start_time >= SELECT_DRAG_HOLD_SECONDS:
            self.mouse.begin_drag()
        return True

    def reset_select_drag(self):
        """Release an active drag and discard an incomplete pinch candidate."""
        if self.drag_candidate or self.mouse.dragging:
            self.mouse.release()
        self.drag_candidate = False
        self.pinch_start_time = None

    # =========================================================
    # START CAMERA
    # =========================================================

    def start(self):

        if self.running:
            return

        print("Starting AI Gesture Mouse...")

        # Initialize MediaPipe
        self.tracker = HandTracker()

        # Open HP Wide Vision HD Camera
        self.camera = cv2.VideoCapture(
            CAMERA_INDEX,
            cv2.CAP_MSMF
        )

        if not self.camera.isOpened():

            self.camera.release()

            raise RuntimeError(
                "Could not open HP Wide Vision HD Camera."
            )

        self.camera.set(
            cv2.CAP_PROP_FRAME_WIDTH,
            FRAME_WIDTH
        )

        self.camera.set(
            cv2.CAP_PROP_FRAME_HEIGHT,
            FRAME_HEIGHT
        )

        self.running = True

        self.thread = threading.Thread(
            target=self.camera_loop,
            daemon=True
        )

        self.thread.start()

        print("Camera started successfully.")

    # =========================================================
    # CAMERA LOOP
    # =========================================================

    def camera_loop(self):

        last_time = time.perf_counter()

        try:

            while self.running:

                # -------------------------------------------------
                # READ CAMERA
                # -------------------------------------------------

                ok, frame = self.camera.read()

                if not ok:
                    continue

                # -------------------------------------------------
                # MIRROR CAMERA
                #
                # This makes the camera behave like a mirror.
                # -------------------------------------------------

                frame = cv2.flip(frame, 1)

                start_time = time.perf_counter()

                # -------------------------------------------------
                # MEDIA PIPE
                # -------------------------------------------------

                result = self.tracker.process(frame)

                self.gesture = "none"
                self.hand_name = "Unknown"
                self.confidence = 0.0

                # =================================================
                # HAND DETECTED
                # =================================================

                if result.hand_landmarks:

                    self.hand_lost_count = 0

                    hand = result.hand_landmarks[0]

                    # -------------------------------------------------
                    # DETERMINE PHYSICAL HAND
                    # -------------------------------------------------

                    hand_name = "Unknown"

                    if (
                        result.handedness
                        and len(result.handedness) > 0
                    ):

                        detected_name = (
                            result.handedness[0][0].category_name
                        )

                        # Because the input image is mirrored,
                        # MediaPipe's label is reversed.
                        #
                        # MediaPipe Left -> Physical Right
                        # MediaPipe Right -> Physical Left

                        if detected_name == "Left":

                            hand_name = "Right"

                        elif detected_name == "Right":

                            hand_name = "Left"

                        else:

                            hand_name = detected_name

                    self.hand_name = hand_name

                    # -------------------------------------------------
                    # DRAW HAND
                    # -------------------------------------------------

                    self.tracker.draw(
                        frame,
                        result
                    )

                    # -------------------------------------------------
                    # CLASSIFY GESTURE
                    #
                    # IMPORTANT:
                    # We pass hand_name so left/right click can
                    # automatically adapt.
                    # -------------------------------------------------

                    gesture, confidence, delta_x, delta_y = (
                        self.classifier.classify(
                            hand,
                            hand_name
                        )
                    )

                    # Tab/back are intentionally one-frame action events.
                    # Keep their names visible long enough for the MJPEG
                    # overlay and WebSocket UI to prove recognition.
                    if gesture in {"tab_next", "tab_previous", "browser_back"}:
                        self.action_gesture_display = gesture
                        self.action_gesture_display_until = time.monotonic() + 0.6
                    if time.monotonic() < self.action_gesture_display_until:
                        self.gesture = self.action_gesture_display
                    else:
                        self.gesture = gesture
                    self.confidence = confidence
                    self.log_gesture_debug(gesture, hand_name, confidence)

                    # Index fingertip is used both for calibration and
                    # regular cursor movement, even while controls are locked.
                    index = hand[8]

                    with self.frame_lock:
                        self.latest_index = (index.x, index.y)

                    # =================================================
                    # MOUSE CONTROL
                    # =================================================

                    # Releasing the three-finger pinch always ends its
                    # candidate state and safely drops an active drag.
                    if gesture != "select_drag":
                        self.reset_select_drag()

                    # Calibration is needed only to map hand coordinates to
                    # cursor coordinates. Wheel events target the active
                    # application at the existing cursor position, so they
                    # remain available without a saved calibration.
                    if (
                        not self.locked
                        and not self.calibration.active
                    ):

                        # -------------------------------------------------
                        # MOVE CURSOR
                        # -------------------------------------------------

                        if gesture == "select_drag":

                            if self.calibration.transform is not None:
                                cursor_point = self.calibration.map_point(
                                    index.x,
                                    index.y
                                )

                                if cursor_point is not None:
                                    cursor_x, cursor_y = cursor_point
                                    self.mouse.move(cursor_x, cursor_y)

                            # This deliberately does not use action_allowed:
                            # after drag begins, every pinch frame must keep
                            # cursor movement and the held button responsive.
                            self.update_select_drag(confidence, hand_name)

                        elif (
                            gesture == "move"
                            and self.calibration.transform is not None
                        ):

                            cursor_point = self.calibration.map_point(
                                index.x,
                                index.y
                            )

                            if cursor_point is not None:
                                cursor_x, cursor_y = cursor_point
                                self.mouse.move(cursor_x, cursor_y)

                        # Browser commands are emitted once by the gesture
                        # classifier, so they must not be cooldown-gated.
                        elif gesture == "tab_next":
                            self.mouse.next_tab()

                        elif gesture == "tab_previous":
                            self.mouse.previous_tab()

                        elif gesture == "browser_back":
                            self.mouse.browser_back()

                        # -------------------------------------------------
                        # CONTINUOUS ACTIONS (scroll / hscroll / zoom)
                        #
                        # These are driven by per-frame hand motion, so
                        # they are NOT cooldown-gated like clicks -
                        # gating them would make scrolling/zooming feel
                        # choppy (one tick every 0.35s instead of smooth).
                        # A confidence check still keeps a just-changed
                        # gesture from firing on a single noisy frame.
                        # -------------------------------------------------

                        elif gesture == "scroll" and confidence >= 1.0:

                            # Moving hand UP -> scroll up (positive)
                            amount = motion_to_wheel_steps(
                                -delta_y, SCROLL_SENSITIVITY
                            )
                            if amount:
                                self.mouse.scroll(amount)

                        elif gesture == "hscroll" and confidence >= 1.0:

                            amount = motion_to_wheel_steps(
                                delta_x, HSCROLL_SENSITIVITY
                            )
                            if amount:
                                self.mouse.hscroll(amount)

                        elif gesture == "zoom" and confidence >= 1.0:

                            # Moving hand UP -> zoom in (positive)
                            if delta_y != 0.0:
                                self.mouse.zoom(
                                    -delta_y * ZOOM_SENSITIVITY
                                )

                        # -------------------------------------------------
                        # DISCRETE ACTIONS (clicks)
                        #
                        # Cooldown-gated so a held pinch doesn't fire the
                        # same click 30 times a second.
                        # -------------------------------------------------

                        elif gesture in {"left_click", "right_click", "double_click"}:
                            self.dispatch_discrete_action(
                                gesture, confidence, hand_name
                            )

                    # =================================================
                    # SAFETY LOCK
                    # =================================================

                    if gesture != "lock":
                        self.lock_pose_active = False

                    if (
                        gesture == "lock"
                        and confidence >= 1.0
                        and not self.lock_pose_active
                    ):
                        self.lock_pose_active = True
                        self.locked = not self.locked

                        if self.locked:
                            self.mouse.release()

                        print(
                            "Mouse:",
                            "LOCKED"
                            if self.locked
                            else "UNLOCKED"
                        )

                # =================================================
                # HAND LOST SAFETY
                #
                # If the hand drops out of frame (moved out of view,
                # bad lighting, occlusion) mid-drag or mid-scroll,
                # don't leave the mouse button stuck down or the
                # gesture state confused when the hand reappears.
                # =================================================

                else:

                    with self.frame_lock:
                        self.latest_index = None

                    self.last_debug_gesture = None

                    self.hand_lost_count += 1

                    if self.hand_lost_count == HAND_LOST_FRAMES:

                        self.reset_select_drag()

                        self.mouse.reset_tracking()

                        self.classifier.reset_motion()
                        self.lock_pose_active = False

                        self.gesture = "none"

                        self.hand_name = "Unknown"

                        print(
                            "Hand lost -> released drag, "
                            "reset gesture state"
                        )

                # =================================================
                # FPS
                # =================================================

                current_time = time.perf_counter()

                delta = current_time - last_time

                last_time = current_time

                if delta > 0:

                    current_fps = 1.0 / delta

                    self.fps = (
                        0.9 * self.fps
                        + 0.1 * current_fps
                    )

                # =================================================
                # LATENCY
                # =================================================

                self.latency = (
                    time.perf_counter()
                    - start_time
                ) * 1000

                # =================================================
                # DISPLAY INFORMATION
                # =================================================

                cv2.putText(
                    frame,
                    f"Mode: {self.mode.upper()}",
                    (20, 35),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (255, 255, 255),
                    2
                )

                cv2.putText(
                    frame,
                    f"Hand: {self.hand_name}",
                    (20, 70),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (255, 255, 255),
                    2
                )

                cv2.putText(
                    frame,
                    f"Gesture: {self.gesture}",
                    (20, 105),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (255, 255, 255),
                    2
                )

                cv2.putText(
                    frame,
                    f"Confidence: {self.confidence:.2f}",
                    (20, 140),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (255, 255, 255),
                    2
                )

                cv2.putText(
                    frame,
                    f"FPS: {self.fps:.1f}",
                    (20, 175),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (255, 255, 255),
                    2
                )

                cv2.putText(
                    frame,
                    f"Latency: {self.latency:.1f} ms",
                    (20, 210),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (255, 255, 255),
                    2
                )

                # -------------------------------------------------
                # SAFETY STATUS
                # -------------------------------------------------

                safety_text = (
                    "LOCKED"
                    if self.locked
                    else "UNLOCKED"
                )

                cv2.putText(
                    frame,
                    f"Safety: {safety_text}",
                    (20, 245),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (255, 255, 255),
                    2
                )

                # Keep an annotated copy for the browser's MJPEG stream.
                with self.frame_lock:
                    self.latest_frame = frame.copy()

        finally:

            # =====================================================
            # CLEANUP
            # =====================================================

            if self.camera:

                self.camera.release()

            if self.tracker:

                self.tracker.close()

            self.mouse.release()

            print("Camera stopped.")

    # =========================================================
    # STOP APPLICATION
    # =========================================================

    def stop(self):

        self.running = False

        self.mouse.release()


# =============================================================
# GLOBAL APPLICATION STATE
# =============================================================

state = AppState()


# =============================================================
# FASTAPI LIFESPAN
# =============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):

    try:

        state.start()

    except Exception as exc:

        print(
            f"Startup warning: {exc}"
        )

    yield

    state.stop()


# =============================================================
# FASTAPI APPLICATION
# =============================================================

app = FastAPI(
    title="AI Gesture Mouse API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================
# FRONTEND
# =============================================================

app.mount(
    "/static",
    StaticFiles(directory=LEGACY_FRONTEND_DIR),
    name="static"
)
app.mount(
    "/modern-static",
    StaticFiles(directory=MODERN_FRONTEND_DIR),
    name="modern-static"
)


# =============================================================
# HOME PAGE
# =============================================================

@app.get("/", response_class=FileResponse)
def index():
    return FileResponse(LEGACY_FRONTEND_DIR / "index.html")


@app.get("/link-test", response_class=FileResponse)
def link_safety_test_page():
    """Serve the temporary page used to test browser extension link checks."""
    return FileResponse(LEGACY_FRONTEND_DIR / "link-test.html")


# =============================================================
# STATUS API
# =============================================================

@app.get("/api/status")
def status():

    return {

        "mode": state.mode,

        "hand": state.hand_name,

        "gesture": state.gesture,

        "confidence": round(
            state.confidence,
            3
        ),

        "fps": round(
            state.fps,
            1
        ),

        "latency_ms": round(
            state.latency,
            1
        ),

        "locked": state.locked,

        "sensitivity": round(
            state.sensitivity.value,
            2
        ),

        "calibration":
            state.calibration.status(),

        "click_safety":
            state.click_safety.status()
    }


class SafetyInspectRequest(BaseModel):
    url: str | None = Field(default=None, max_length=4096)


@app.post("/api/safety/inspect")
def inspect_external_url(payload: SafetyInspectRequest):
    """Inspect one browser-reported URL and arm the existing click gate."""
    if not payload.url:
        state.click_safety.report_target(None)
        return {"allowed": True, "risk": "unknown", "reason": "No link target"}
    return state.click_safety.inspect_url(payload.url.strip())


@app.post("/api/safety/target")
def report_safety_target(payload: dict):
    """Receive only the link currently hovered in this application's UI."""
    state.click_safety.report_target(payload.get("url"))
    return state.click_safety.status()


@app.post("/api/safety/dismiss")
def dismiss_safety_warning():
    state.click_safety.dismiss()
    return state.click_safety.status()


@app.post("/api/safety/test-click/{target}")
def test_safety_click(target: str):
    """Run a harmless UI test through the same click-safety decision gate."""
    targets = {
        "safe": "http://127.0.0.1:8000/#safe-test-passed",
        "danger": "safety-test://simulated-phishing",
    }
    if target not in targets:
        return {"error": "Unknown safety test target"}

    print("CLICK DETECTED → ANALYZING")
    state.click_safety.report_target(targets[target])
    decision = state.click_safety.evaluate_click()
    if decision.allowed:
        print("SAFE → CLICK ALLOWED")
    else:
        state.click_safety.block(decision)
        print("DANGEROUS → CLICK BLOCKED")
    return {"allowed": decision.allowed, "reason": decision.reason, "click_safety": state.click_safety.status()}


# =============================================================
# MODE API
# =============================================================

@app.post("/api/mode/{mode}")
def set_mode(mode: str):

    mode = mode.lower()

    if mode not in {
        "gesture",
        "voice",
        "hybrid"
    }:

        return {
            "error":
            "mode must be gesture, voice, or hybrid"
        }

    state.mode = mode

    return {
        "mode": state.mode
    }


# =============================================================
# LOCK API
# =============================================================

@app.post("/api/lock")
def toggle_lock():

    state.locked = not state.locked

    if state.locked:

        state.mouse.release()

    return {
        "locked": state.locked
    }


# =============================================================
# SENSITIVITY API
# =============================================================

@app.post("/api/sensitivity/{direction}")
def sensitivity(direction: str):

    if direction == "increase":

        state.sensitivity.increase()

    elif direction == "decrease":

        state.sensitivity.decrease()

    else:

        return {
            "error":
            "direction must be increase or decrease"
        }

    return {
        "sensitivity":
        state.sensitivity.value
    }


# =============================================================
# CALIBRATION API
# =============================================================

@app.post("/api/calibrate")
def calibrate():

    state.calibration.start()

    return state.calibration.status()


@app.post("/api/calibrate/point")
def capture_calibration_point():

    with state.frame_lock:
        index_point = state.latest_index

    return state.calibration.capture(index_point)


@app.post("/api/calibrate/reset")
def reset_calibration():

    state.calibration.reset()

    return state.calibration.status()


# =============================================================
# VIDEO STREAM
# =============================================================

def video_frames():

    while state.running:

        with state.frame_lock:
            frame = (
                state.latest_frame.copy()
                if state.latest_frame is not None
                else None
            )

        if frame is None:
            time.sleep(0.05)
            continue

        ok, encoded = cv2.imencode(
            ".jpg",
            frame,
            [cv2.IMWRITE_JPEG_QUALITY, 85]
        )

        if ok:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + encoded.tobytes()
                + b"\r\n"
            )

        time.sleep(0.03)


@app.get("/api/video-feed")
def video_feed():

    return StreamingResponse(
        video_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


# =============================================================
# WEBSOCKET
# =============================================================

@app.websocket("/ws")
async def websocket(websocket: WebSocket):

    await websocket.accept()

    try:

        while True:

            await websocket.send_json({

                "mode":
                    state.mode,

                "hand":
                    state.hand_name,

                "gesture":
                    state.gesture,

                "confidence":
                    round(
                        state.confidence,
                        3
                    ),

                "fps":
                    round(
                        state.fps,
                        1
                    ),

                "latency_ms":
                    round(
                        state.latency,
                        1
                    ),

                "locked":
                    state.locked,

                "sensitivity":
                    round(
                        state.sensitivity.value,
                        2
                    ),

                "calibration":
                    state.calibration.status(),

                "click_safety":
                    state.click_safety.status()
            })

            await asyncio.sleep(0.25)

    except WebSocketDisconnect:

        pass
