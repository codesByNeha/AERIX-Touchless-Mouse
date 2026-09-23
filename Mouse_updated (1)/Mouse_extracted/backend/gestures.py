import math
from time import monotonic

from .config import (
    PINCH_THRESHOLD, CLICK_COOLDOWN, GESTURE_STABLE_FRAMES,
    SELECT_DRAG_PINCH_THRESHOLD, MOTION_DEADZONE,
    OPEN_PALM_SWIPE_SECONDS,
    OPEN_PALM_SWIPE_DISTANCE,
)


def distance(a, b):
    return math.hypot(a.x - b.x, a.y - b.y)


def finger_up(lm, tip, pip, mcp=None, wrist=0):
    """Rotation-tolerant extended-finger test using reach and PIP angle."""
    if mcp is None:
        mcp = pip - 1
    tip_pt, pip_pt, mcp_pt, wrist_pt = lm[tip], lm[pip], lm[mcp], lm[wrist]
    reach = distance(tip_pt, wrist_pt) > distance(pip_pt, wrist_pt) * 1.025
    first = (mcp_pt.x - pip_pt.x, mcp_pt.y - pip_pt.y)
    second = (tip_pt.x - pip_pt.x, tip_pt.y - pip_pt.y)
    first_length = math.hypot(*first)
    second_length = math.hypot(*second)
    if first_length == 0 or second_length == 0:
        return False
    # A straight PIP joint is near 180 degrees (cosine near -1). This is
    # stable under image rotation, unlike comparing raw landmark Y values.
    cosine = (first[0] * second[0] + first[1] * second[1]) / (first_length * second_length)
    return reach and cosine < -0.55


def finger_engaged(lm, tip, pip, wrist=0):
    """Return whether a finger is extended from the palm enough to pinch.

    A person normally bends the last finger joint while touching the thumb.
    ``finger_up`` correctly rejects that as a *move* pose, but using it as a
    pinch prerequisite made legitimate clicks disappear.  Palm reach keeps a
    folded fingertip beside the thumb from being mistaken for a pinch while
    allowing the natural bend at the fingertip.
    """
    return distance(lm[tip], lm[wrist]) > distance(lm[pip], lm[wrist]) * 1.025


def fingers_crossed(lm):
    """Practical crossed-finger test: fingertip order reverses past the PIPs."""
    pip_dx, pip_dy = lm[6].x - lm[10].x, lm[6].y - lm[10].y
    tip_dx, tip_dy = lm[8].x - lm[12].x, lm[8].y - lm[12].y
    if abs(pip_dx) >= abs(pip_dy):
        return pip_dx * tip_dx < -0.0004
    return pip_dy * tip_dy < -0.0004


class GestureClassifier:
    def __init__(self):
        self.last_gesture = "none"
        self.stable_count = 0
        self.last_action_time = 0.0
        # A pinch is one discrete action, not a stream of repeated clicks.
        # This is reset as soon as the pinch pose ends.
        self.active_discrete_action = None
        self.prev_x = None
        self.prev_y = None
        self.palm_started_at = None
        self.palm_origin = None
        self.palm_swipe_fired = False
        self.crossed_fired = False
        self.debug_state = {}

    def _reset_palm(self):
        self.palm_started_at = None
        self.palm_origin = None
        self.palm_swipe_fired = False

    def _palm_gesture(self, wrist, now):
        if self.palm_started_at is None:
            self.palm_started_at = now
            self.palm_origin = (wrist.x, wrist.y)
        elapsed = now - self.palm_started_at
        horizontal = wrist.x - self.palm_origin[0]
        self.debug_state.update({
            "palm_elapsed": elapsed,
            "palm_horizontal_distance": horizontal,
        })
        if (not self.palm_swipe_fired and elapsed <= OPEN_PALM_SWIPE_SECONDS
                and abs(horizontal) >= OPEN_PALM_SWIPE_DISTANCE):
            self.palm_swipe_fired = True
            return "tab_next" if horizontal > 0 else "tab_previous"
        # Open palms are reserved for browser swipes. Holding one still is
        # intentionally inert and can never change the Safety Lock state.
        return "palm"

    def classify(self, lm, hand_name="Right"):
        index = finger_up(lm, 8, 6, 5)
        middle = finger_up(lm, 12, 10, 9)
        ring = finger_up(lm, 16, 14, 13)
        pinky = finger_up(lm, 20, 18, 17)
        wrist = lm[0]
        now = monotonic()
        self.debug_state = {
            "fingers": {"I": index, "M": middle, "R": ring, "P": pinky},
            "crossed": False,
        }

        if self.prev_x is None:
            delta_x, delta_y = 0.0, 0.0
        else:
            delta_x, delta_y = wrist.x - self.prev_x, wrist.y - self.prev_y
        self.prev_x, self.prev_y = wrist.x, wrist.y
        if abs(delta_x) < MOTION_DEADZONE:
            delta_x = 0.0
        if abs(delta_y) < MOTION_DEADZONE:
            delta_y = 0.0

        thumb_index = distance(lm[4], lm[8])
        thumb_middle = distance(lm[4], lm[12])
        index_middle = distance(lm[8], lm[12])
        select_drag = (
            thumb_index < SELECT_DRAG_PINCH_THRESHOLD
            and thumb_middle < SELECT_DRAG_PINCH_THRESHOLD
            and index_middle < SELECT_DRAG_PINCH_THRESHOLD
        )
        self.debug_state["distances"] = {
            "thumb_index": thumb_index,
            "thumb_middle": thumb_middle,
            "index_middle": index_middle,
            "select_drag": select_drag,
        }
        self.debug_state["select_drag_distances"] = {
            "thumb_index": thumb_index,
            "thumb_middle": thumb_middle,
            "index_middle": index_middle,
        }

        # A folded middle fingertip near the thumb should never steal an index
        # pinch. The movement pose is explicit and must stay above the pinch
        # threshold before it can be considered a click.
        index_only = (
            index and not middle and not ring and not pinky
            and thumb_index >= PINCH_THRESHOLD
        )
        middle_only = (
            middle and not index and not ring and not pinky
        )
        two_finger = index and middle and not ring and not pinky
        open_palm = index and middle and ring and pinky
        crossed = two_finger and fingers_crossed(lm)
        self.debug_state["crossed"] = crossed

        # A click is defined by the engaged pinch finger and an exclusive
        # thumb distance, not by forcing every other finger to be folded.
        # Requiring a perfectly straight pinching finger caused real pinches
        # to fall through to move/scroll/lock classifications.
        index_pinch = (
            finger_engaged(lm, 8, 6)
            and thumb_index < PINCH_THRESHOLD
            and thumb_middle >= PINCH_THRESHOLD
        )
        middle_pinch = (
            finger_engaged(lm, 12, 10)
            and thumb_middle < PINCH_THRESHOLD
            and thumb_index >= PINCH_THRESHOLD
        )
        double_click_candidate = (
            index and middle and not ring and not pinky
            and thumb_index < PINCH_THRESHOLD
            and thumb_middle < PINCH_THRESHOLD
        )

        if select_drag:
            self._reset_palm(); self.crossed_fired = False
            gesture = "select_drag"
        elif not index and not middle and not ring and not pinky:
            self._reset_palm(); self.crossed_fired = False
            gesture = "lock"
        elif open_palm:
            self.crossed_fired = False
            gesture = self._palm_gesture(wrist, now)
        elif index and pinky and not middle and not ring:
            self._reset_palm(); self.crossed_fired = False
            gesture = "zoom"
        elif index and middle and ring and not pinky:
            self._reset_palm(); self.crossed_fired = False
            gesture = "hscroll"
        elif index_only:
            self._reset_palm(); self.crossed_fired = False
            gesture = "move"
        elif index_pinch and hand_name == "Right":
            self._reset_palm(); self.crossed_fired = False
            gesture = "left_click"
        elif middle_pinch and hand_name == "Right":
            self._reset_palm(); self.crossed_fired = False
            gesture = "right_click"
        elif index_pinch and hand_name == "Left":
            self._reset_palm(); self.crossed_fired = False
            gesture = "right_click"
        elif middle_pinch and hand_name == "Left":
            self._reset_palm(); self.crossed_fired = False
            gesture = "left_click"
        elif double_click_candidate:
            self._reset_palm(); self.crossed_fired = False
            gesture = "double_click"
        elif crossed:
            self._reset_palm()
            gesture = "crossed_hold" if self.crossed_fired else "browser_back"
            self.crossed_fired = True
        elif two_finger:
            self._reset_palm(); self.crossed_fired = False
            gesture = "scroll"
        elif middle_only:
            self._reset_palm(); self.crossed_fired = False
            gesture = "move"
        elif index:
            self._reset_palm(); self.crossed_fired = False
            gesture = "move"
        else:
            self._reset_palm(); self.crossed_fired = False
            gesture = "none"

        if gesture == self.last_gesture:
            self.stable_count += 1
        else:
            self.last_gesture, self.stable_count = gesture, 1
        if gesture not in {"left_click", "right_click", "double_click"}:
            self.active_discrete_action = None
        self.debug_state["stable_count"] = self.stable_count
        confidence = min(1.0, self.stable_count / GESTURE_STABLE_FRAMES)
        return gesture, confidence, delta_x, delta_y

    def reset_motion(self):
        self.prev_x = self.prev_y = None
        self._reset_palm(); self.crossed_fired = False

    def action_allowed(self, action):
        """Allow one click per pinch, while retaining the click cooldown."""
        if action == self.active_discrete_action:
            return False
        now = monotonic()
        if now - self.last_action_time >= CLICK_COOLDOWN:
            self.last_action_time = now
            self.active_discrete_action = action
            return True
        return False
