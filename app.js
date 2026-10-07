/**
 * ============================================================
 *  Gate Application — Main Logic
 * ============================================================
 *
 *  STATE MACHINE (in-memory only, resets on every page load)
 *  ─────────────
 *  initial              → User sees only "SUBSCRIBE FIRST"
 *  subscription_started → YouTube tab opened, waiting for return
 *  return_detected      → User came back — brief transition
 *  unlocked             → Access button is visible and usable
 *
 *  Every page load / refresh starts at "initial".
 *  The state only advances during the current browser session
 *  and is never persisted.
 *
 * ============================================================
 */

(function () {
  "use strict";

  // ── Validate configuration ──────────────────────────────────
  function validateConfig() {
    const errors = [];

    if (
      !CONFIG.YOUTUBE_SUBSCRIBE_URL ||
      typeof CONFIG.YOUTUBE_SUBSCRIBE_URL !== "string" ||
      CONFIG.YOUTUBE_SUBSCRIBE_URL === "YOUR_YOUTUBE_CHANNEL_OR_SUBSCRIBE_URL"
    ) {
      errors.push(
        "YouTube URL is not configured. Open config.js and set YOUTUBE_SUBSCRIBE_URL."
      );
    }

    if (
      !CONFIG.GOOGLE_DRIVE_URL ||
      typeof CONFIG.GOOGLE_DRIVE_URL !== "string" ||
      CONFIG.GOOGLE_DRIVE_URL === "YOUR_GOOGLE_DRIVE_URL"
    ) {
      errors.push(
        "Google Drive URL is not configured. Open config.js and set GOOGLE_DRIVE_URL."
      );
    }

    // Basic URL shape check
    [CONFIG.YOUTUBE_SUBSCRIBE_URL, CONFIG.GOOGLE_DRIVE_URL].forEach((url) => {
      try {
        if (url && !url.startsWith("YOUR_")) new URL(url);
      } catch {
        errors.push(`Invalid URL detected: "${url}". Please provide a valid URL.`);
      }
    });

    return errors;
  }

  // ── DOM references ──────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const card = $(".gate-card");
  const icon = $(".gate-icon");
  const title = $(".gate-title");
  const desc = $(".gate-desc");
  const stepDots = document.querySelectorAll(".step-dot");
  const subscribeWrap = $(".subscribe-wrap");
  const accessWrap = $(".access-wrap");
  const btnSubscribe = $(".btn-subscribe");
  const btnAccess = $(".btn-access");
  const waitingIndicator = $(".waiting-indicator");
  const successBadge = $(".success-badge");
  const errorBanner = $(".error-banner");

  // ── State management (in-memory only) ───────────────────────
  const VALID_STATES = ["initial", "subscription_started", "return_detected", "unlocked"];
  let currentState = "initial";

  /**
   * Cooldown guard — prevents the return-detection from firing
   * immediately after window.open() (browsers sometimes bounce
   * focus/visibility events right after opening a new tab).
   */
  let subscribeClickedAt = 0;       // timestamp of last subscribe click
  let pageWentHidden = false;       // true once the tab actually lost focus
  const COOLDOWN_MS = 3000;         // ignore return events for 3 s after click

  // ── Render function — maps state → UI ───────────────────────
  function render() {
    // Step dots
    stepDots.forEach((dot) => {
      dot.classList.remove("active", "complete");
    });

    // Hide everything first
    waitingIndicator.classList.remove("active");
    successBadge.classList.remove("active");
    subscribeWrap.classList.remove("visible");
    subscribeWrap.classList.add("hidden");
    accessWrap.classList.remove("visible");
    accessWrap.classList.add("hidden");

    switch (currentState) {
      case "initial":
        icon.textContent = "🔒";
        title.textContent = "Subscribe to Continue";
        desc.textContent =
          "Subscribe to our YouTube channel to unlock your exclusive access.";
        subscribeWrap.classList.remove("hidden");
        subscribeWrap.classList.add("visible");
        stepDots[0].classList.add("active");
        break;

      case "subscription_started":
        icon.textContent = "⏳";
        title.textContent = "Waiting for You…";
        desc.textContent =
          "Subscribe to the channel on YouTube, then come back to this tab.";
        waitingIndicator.classList.add("active");
        stepDots[0].classList.add("complete");
        stepDots[1].classList.add("active");
        break;

      case "return_detected":
      case "unlocked":
        card.classList.add("unlocked");
        icon.textContent = "✅";
        title.textContent = "Access Unlocked";
        desc.textContent = "You're all set — click below to get your content.";
        successBadge.classList.add("active");
        accessWrap.classList.remove("hidden");
        accessWrap.classList.add("visible");
        stepDots[0].classList.add("complete");
        stepDots[1].classList.add("complete");
        stepDots[2].classList.add("complete");
        break;
    }
  }

  function transitionTo(newState) {
    if (!VALID_STATES.includes(newState)) return;
    // Only allow forward transitions
    const cur = VALID_STATES.indexOf(currentState);
    const next = VALID_STATES.indexOf(newState);
    if (next <= cur) return;

    currentState = newState;
    render();
  }

  // ── Event: Subscribe button click ───────────────────────────
  function handleSubscribeClick() {
    subscribeClickedAt = Date.now();
    pageWentHidden = false;

    // The native <a> tag with target="_blank" handles opening the URL reliably
    transitionTo("subscription_started");
  }

  // ── Event: User returns to the page ─────────────────────────
  function handleReturn() {
    if (currentState !== "subscription_started") return;

    // Guard 1: page must have actually gone hidden/blurred first
    if (!pageWentHidden) return;

    // Guard 2: must be past the cooldown window
    if (Date.now() - subscribeClickedAt < COOLDOWN_MS) return;

    transitionTo("return_detected");
    // Move to unlocked after a brief visual moment
    setTimeout(() => transitionTo("unlocked"), 400);
  }

  // ── Track when the page actually leaves focus ───────────────
  function handlePageHidden() {
    if (currentState === "subscription_started") {
      pageWentHidden = true;
    }
  }

  // ── Event: Access button click ──────────────────────────────
  function handleAccessClick() {
    window.location.href = CONFIG.GOOGLE_DRIVE_URL;
  }

  // ── Bind browser lifecycle events ───────────────────────────
  function bindReturnDetection() {
    // visibilitychange — primary standard event across desktop and mobile
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        handlePageHidden();
      } else if (document.visibilityState === "visible") {
        handleReturn();
      }
    });

    // blur & pagehide — reliably catch tab departure and mobile app switches
    window.addEventListener("blur", handlePageHidden);
    window.addEventListener("pagehide", handlePageHidden);

    // focus & pageshow — reliably catch reactivation from tab switch or mobile bfcache
    window.addEventListener("focus", handleReturn);
    window.addEventListener("pageshow", handleReturn);
  }

  // ── Initialise ──────────────────────────────────────────────
  function init() {
    // Check config
    const configErrors = validateConfig();
    if (configErrors.length > 0) {
      errorBanner.textContent = configErrors.join(" ");
      errorBanner.classList.add("active");
      btnSubscribe.removeAttribute("href");
      btnSubscribe.style.pointerEvents = "none";
      btnSubscribe.style.opacity = "0.4";
      btnSubscribe.style.cursor = "not-allowed";
    } else {
      btnSubscribe.href = CONFIG.YOUTUBE_SUBSCRIBE_URL;
    }

    // Clear any old persisted state from previous version
    try { localStorage.removeItem("yt_gate_state"); } catch {}

    // Wire up buttons
    btnSubscribe.addEventListener("click", handleSubscribeClick);
    btnAccess.addEventListener("click", handleAccessClick);

    // Always start at initial — render first frame
    render();

    // Listen for tab return
    bindReturnDetection();
  }

  // Wait for DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
