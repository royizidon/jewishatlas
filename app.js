// --- Keep map below fixed header ---
(function () {
  function setHeaderHeight() {
    const h = document.getElementById("appHeader")?.offsetHeight || 95;
    document.documentElement.style.setProperty("--header-h", h + "px");
  }
  window.addEventListener("load", setHeaderHeight);
  window.addEventListener("resize", setHeaderHeight);
})();

// Catch uncaught errors early
window.addEventListener("error", (e) => console.error("[window.error]", e.message, e.error));

// ========================================
// TOAST NOTIFICATION SYSTEM
// ========================================

function showToast(message, duration = 3000) {
  // Remove existing toast
  const existing = document.querySelector('[data-toast]');
  if (existing) existing.remove();
  
  // Create toast element
  const toast = document.createElement("div");
  toast.setAttribute('data-toast', 'true');
  toast.style.cssText = `
    position: fixed;
    top: calc(var(--header-h) + 25px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    z-index: 10000;
    font-size: 14px;
    font-weight: 500;
    max-width: 90%;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    animation: fadeIn 0.3s ease-out;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Auto-remove after duration
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-in';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ========================================
// FULL-SCREEN IMAGE LIGHTBOX
// ========================================

function openImageLightbox(src, altText = "") {
  if (!src) return;

  // Fully tear down any existing lightbox before opening a new one. A bare
  // .remove() would leave its popstate/keydown/focusin listeners attached.
  // window.__jaLightboxForceClose is set by the previous instance below; it
  // returns true if that instance had pushed a history entry that hasn't
  // been consumed by Back yet. history.replaceState can't "remove" the
  // extra entry a second pushState would add, so instead of pushing again
  // we inherit that same entry below — one open lightbox "session", however
  // many photos get swapped in it, costs exactly one Back step.
  let inheritedHistoryEntry = false;
  if (typeof window.__jaLightboxForceClose === "function") {
    inheritedHistoryEntry = window.__jaLightboxForceClose();
  }

  const LB_STATE_KEY = "jaLightbox";
  const previouslyFocused = document.activeElement;
  const previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  const overlay = document.createElement("div");
  overlay.setAttribute("data-lightbox", "true");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", altText || "Photo");
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 20000;
    background: rgba(0, 0, 0, 0.92);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 200ms ease;
    overflow: hidden;
    touch-action: none;
  `;

  const imgWrap = document.createElement("div");
  imgWrap.style.cssText = `
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
  `;

  const img = document.createElement("img");
  img.src = src;
  img.alt = altText || "";
  img.draggable = false;
  img.style.cssText = `
    max-width: 92%;
    max-height: 92%;
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.5);
    opacity: 0;
    transform: scale(0.96);
    transition: transform 200ms ease, opacity 200ms ease;
    user-select: none;
    -webkit-user-drag: none;
    will-change: transform;
  `;

  const spinner = document.createElement("div");
  spinner.setAttribute("aria-hidden", "true");
  spinner.style.cssText = `
    position: absolute;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 3px solid rgba(255,255,255,0.25);
    border-top-color: #fff;
    animation: lbSpin 0.8s linear infinite;
  `;
  if (!document.querySelector('style[data-lightbox-css]')) {
    const s = document.createElement("style");
    s.setAttribute("data-lightbox-css", "true");
    s.textContent = `@keyframes lbSpin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(s);
  }

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("aria-label", "Close photo");
  closeBtn.style.cssText = `
    position: fixed;
    top: max(16px, env(safe-area-inset-top));
    right: max(16px, env(safe-area-inset-right));
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: none;
    background: rgba(255,255,255,0.15);
    color: #fff;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20001;
  `;

  // -------- Loading / error state --------
  let loaded = false;
  img.addEventListener("load", () => {
    loaded = true;
    spinner.remove();
    img.style.opacity = "1";
  });
  img.addEventListener("error", () => {
    spinner.remove();
    const errMsg = document.createElement("div");
    errMsg.textContent = "Couldn't load this photo.";
    errMsg.style.cssText = "color:#ccc; font-size:14px; text-align:center; padding:16px;";
    imgWrap.appendChild(errMsg);
  });

  // -------- Pinch-zoom / double-tap-zoom / pan --------
  // Implemented manually (rather than relying on native pinch-zoom) because
  // the map page's viewport typically disables browser pinch-zoom, so the
  // lightbox needs its own.
  let scale = 1, tx = 0, ty = 0;
  const MIN_SCALE = 1, MAX_SCALE = 4;
  const pointers = new Map();
  let pinchStartDist = 0, pinchStartScale = 1;
  let panStart = null; // {x, y, tx, ty}
  let lastTapTime = 0, lastTapX = 0, lastTapY = 0;

  function applyTransform(withTransition) {
    img.style.transition = withTransition
      ? "transform 200ms ease, opacity 200ms ease"
      : "opacity 200ms ease";
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function clampPan() {
    // Keep the image from being dragged entirely off-screen once zoomed.
    // offsetWidth/offsetHeight are the image's unscaled layout box (CSS
    // transform doesn't affect them); getBoundingClientRect() would already
    // include the current `scale`, and multiplying by scale again would
    // double-apply it and allow dragging the image far past its edges.
    const baseW = img.offsetWidth;
    const baseH = img.offsetHeight;
    const maxX = Math.max(0, (baseW * scale - baseW) / 2);
    const maxY = Math.max(0, (baseH * scale - baseH) / 2);
    tx = Math.min(maxX, Math.max(-maxX, tx));
    ty = Math.min(maxY, Math.max(-maxY, ty));
  }

  function resetZoom(withTransition) {
    scale = 1; tx = 0; ty = 0;
    applyTransform(withTransition);
  }

  function zoomAt(clientX, clientY, targetScale) {
    const rect = img.getBoundingClientRect();
    const cx = clientX - (rect.left + rect.width / 2);
    const cy = clientY - (rect.top + rect.height / 2);
    const ratio = targetScale / scale;
    tx = cx - (cx - tx) * ratio;
    ty = cy - (cy - ty) * ratio;
    scale = targetScale;
    clampPan();
    applyTransform(true);
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  // Tap/gesture tracking, kept separate from panStart (which is only used
  // for the pan math and gets set any time scale > 1, including on a tap
  // that never moves — relying on it to detect "did the user move" would
  // wrongly disqualify a clean double-tap while already zoomed in).
  let downX = 0, downY = 0, movedPastTapThreshold = false, hadMultiTouch = false;

  img.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    img.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStartDist = dist(a, b);
      pinchStartScale = scale;
      panStart = null;
      hadMultiTouch = true;
    } else if (pointers.size === 1) {
      downX = e.clientX;
      downY = e.clientY;
      movedPastTapThreshold = false;
      hadMultiTouch = false;
      if (scale > 1) {
        panStart = { x: e.clientX, y: e.clientY, tx, ty };
      }
    }
  });

  img.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const newDist = dist(a, b);
      if (pinchStartDist > 0) {
        scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchStartScale * (newDist / pinchStartDist)));
        clampPan();
        applyTransform(false);
      }
    } else if (pointers.size === 1) {
      // Track movement regardless of zoom level — panStart only exists
      // when scale > 1, so gating this on it meant a drag at scale === 1
      // never disqualified itself as a tap, however far it moved.
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 10) {
        movedPastTapThreshold = true;
      }
      if (panStart) {
        tx = panStart.tx + (e.clientX - panStart.x);
        ty = panStart.ty + (e.clientY - panStart.y);
        clampPan();
        applyTransform(false);
      }
    }
  });

  function endPointer(e, wasCancelled) {
    // A "tap" is a gesture that only ever had one pointer down, didn't move
    // far, and actually completed (pointerup) rather than being cancelled
    // by the browser (pointercancel — e.g. the OS took over the gesture, or
    // an incoming call/notification interrupted it). A cancelled gesture is
    // not a real tap and must never count toward the double-tap counter:
    // otherwise an interrupted touch now could combine with a later,
    // unrelated tap to trigger an unwanted zoom toggle.
    const wasSingleTap = !wasCancelled && pointers.size === 1 && !hadMultiTouch && !movedPastTapThreshold;
    pointers.delete(e.pointerId);
    panStart = null;

    if (pointers.size === 0) {
      pinchStartDist = 0;
      if (scale < 1.02) {
        resetZoom(true);
      } else {
        clampPan();
        applyTransform(true);
      }

      // Double-tap to toggle zoom in/out, at any current scale.
      if (wasSingleTap) {
        const now = Date.now();
        const moved = Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY);
        if (now - lastTapTime < 300 && moved < 30) {
          zoomAt(e.clientX, e.clientY, scale > 1 ? 1 : 2.5);
          lastTapTime = 0;
        } else {
          lastTapTime = now;
          lastTapX = e.clientX;
          lastTapY = e.clientY;
        }
      } else if (wasCancelled) {
        // Don't let a cancelled gesture arm the double-tap window either —
        // a stray later tap shouldn't pair up with it.
        lastTapTime = 0;
      }
    }
  }
  img.addEventListener("pointerup", (e) => endPointer(e, false));
  img.addEventListener("pointercancel", (e) => endPointer(e, true));

  // -------- Close handling (history-aware, see below) --------
  let closedByPopState = false;
  let historyEntryPushed = false;
  let isClosed = false;
  // Separate from isClosed: that only flips once teardown() actually runs,
  // but the history.back() branch below is asynchronous (it waits for the
  // popstate event to fire teardown). Without this guard, rapid repeated
  // close triggers (double-tapping ✕, mashing Escape, tapping the backdrop
  // and then ✕ before the first back() resolves) would each call
  // history.back() again, sending the browser back multiple real steps
  // instead of just closing the lightbox once.
  let closeRequested = false;

  function detachGlobalListeners() {
    window.removeEventListener("popstate", onPopState);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("focusin", onFocusIn);
    document.body.style.overflow = previousBodyOverflow;
    if (window.__jaLightboxForceClose === forceClose) {
      window.__jaLightboxForceClose = null;
    }
  }

  function teardown() {
    if (isClosed) return;
    isClosed = true;
    detachGlobalListeners();
    overlay.style.opacity = "0";
    img.style.transform += " scale(0.97)";
    setTimeout(() => {
      overlay.remove();
      if (previouslyFocused?.focus) previouslyFocused.focus();
    }, 200);
  }

  // Used only when a NEW lightbox is about to replace this one without the
  // user going through Close/Escape/back (see the top of this function).
  // Removes listeners and the DOM node immediately (no animation — it's
  // being replaced). Deliberately leaves the history entry alone: there is
  // no API to pop/remove a pushed entry other than Back itself, so the new
  // lightbox below inherits this entry (see inheritedHistoryEntry) rather
  // than pushing a second one on top of it.
  function forceClose() {
    if (isClosed) return false;
    isClosed = true;
    detachGlobalListeners();
    overlay.remove();
    return historyEntryPushed && !closedByPopState;
  }

  function onPopState() {
    closedByPopState = true;
    teardown();
  }

  // Close via UI (✕, backdrop tap, Escape): if we pushed a history entry
  // for this lightbox, go back through it so the entry is consumed instead
  // of left dangling — this is what makes the mobile back gesture / hardware
  // back button close the lightbox instead of leaving the page.
  function requestClose() {
    if (closeRequested || isClosed) return;
    closeRequested = true;
    if (historyEntryPushed && !closedByPopState) {
      history.back();
    } else {
      teardown();
    }
  }

  function onKeyDown(e) {
    if (e.key === "Escape") requestClose();
  }

  // Minimal focus trap: closeBtn is the only focusable element in the
  // dialog, so if focus ever lands outside the overlay (e.g. Tab cycling
  // past it into the map controls behind it), pull it straight back.
  function onFocusIn(e) {
    if (!overlay.contains(e.target)) {
      closeBtn.focus();
    }
  }

  // The backdrop click target can be either the overlay itself or imgWrap
  // (the full-size flex container centering the photo) — imgWrap covers
  // the whole overlay, so a tap anywhere outside the image but still over
  // the letterboxed area hits imgWrap, not overlay. Checking only
  // `e.target === overlay` missed that, making most backdrop taps no-ops.
  overlay.addEventListener("click", (e) => {
    if ((e.target === overlay || e.target === imgWrap) && scale === 1) requestClose();
  });
  closeBtn.addEventListener("click", (e) => { e.stopPropagation(); requestClose(); });
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("focusin", onFocusIn);
  window.addEventListener("popstate", onPopState);
  window.__jaLightboxForceClose = forceClose;

  if (inheritedHistoryEntry) {
    // Reuse the entry the previous (just-replaced) lightbox already pushed,
    // instead of pushing a second one on top of it.
    historyEntryPushed = true;
  } else {
    try {
      history.pushState({ [LB_STATE_KEY]: true }, "");
      historyEntryPushed = true;
    } catch (_) {
      // pushState can fail in rare embedded contexts; lightbox still works,
      // just without the back-button integration.
    }
  }

  // Stop these from bubbling to the map underneath
  ["click", "mousedown", "mouseup", "touchstart", "touchend"].forEach(evt => {
    overlay.addEventListener(evt, e => e.stopPropagation(), { passive: false });
  });

  // iOS Safari can still rubber-band/bounce the page behind a fixed overlay
  // even with body overflow hidden (touch-action: none isn't fully honored
  // on some iOS versions for this). Explicitly block default touchmove on
  // the backdrop as a safety net; our pinch/pan logic runs on Pointer
  // Events, which keep firing regardless of this preventDefault.
  overlay.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

  imgWrap.appendChild(spinner);
  imgWrap.appendChild(img);
  overlay.appendChild(imgWrap);
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);
  closeBtn.focus();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      if (loaded) img.style.opacity = "1";
      img.style.transform = "scale(1)";
    });
  });
}

// Add CSS animations for toast
if (!document.querySelector('style[data-toast-css]')) {
  const style = document.createElement('style');
  style.setAttribute('data-toast-css', 'true');
  style.textContent = `
    @keyframes slideUp {
      from { transform: translateX(-50%) translateY(100px); opacity: 0; }
      to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    @keyframes slideDown {
      from { transform: translateX(-50%) translateY(0); opacity: 1; }
      to { transform: translateX(-50%) translateY(100px); opacity: 0; }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// ========================================
// PART 1: Shared Geolocation Utilities
// ========================================

const GeoUtils = {
  WEB_MERCATOR_WKIDS: [3857, 102100, 102113, 900913],
  
  isWebMercatorWkid(wkid) {
    return this.WEB_MERCATOR_WKIDS.includes(wkid);
  },

  getPointFromGeometry(geom) {
    if (!geom) return null;
    if (geom.type === "point") return geom;
    if (geom.extent?.center) return geom.extent.center;
    if (geom.centroid) return geom.centroid;
    return null;
  },

  toLatLon(point) {
    if (!point) return [null, null];

    const wkid = point.spatialReference?.wkid;

    if (wkid === 4326) {
      return [Number(point.y), Number(point.x)];
    }

    if (this.isWebMercatorWkid(wkid)) {
      const metersPerDegree = 20037508.34;
      const lon = (point.x * 180) / metersPerDegree;
      const latRad = (point.y * Math.PI) / metersPerDegree;
      const lat = (180 / Math.PI) * (2 * Math.atan(Math.exp(latRad)) - Math.PI / 2);
      return [lat, lon];
    }

    return [Number(point.y), Number(point.x)];
  },

  formatCoord(value, decimals = 6) {
    return Number(value).toFixed(decimals);
  },

  buildLabel(components) {
    return components.filter(Boolean).join(", ");
  }
};

// ========================================
// PART 2: Cached Mobile Detection
// ========================================

const DeviceInfo = {
  _isMobile: null,
  _mediaQuery: null,

  init() {
    this._mediaQuery = window.matchMedia("(max-width: 768px)");
    this._isMobile = this._mediaQuery.matches;

    this._mediaQuery.addEventListener("change", () => {
      this._isMobile = this._mediaQuery.matches;
    });

    return this._isMobile;
  },

  isMobile() {
    if (this._isMobile === null) {
      this.init();
    }
    return this._isMobile;
  },

  isMobileUserAgent() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  },

  isMobileComprehensive() {
    return this.isMobile() || this.isMobileUserAgent();
  }
};

// ========================================
// MAIN APP
// ========================================

require([
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/layers/GraphicsLayer",
  "esri/renderers/UniqueValueRenderer",
  "esri/widgets/Search",
  "esri/widgets/Zoom",
  "esri/Graphic",
  "esri/geometry/Point",
  "esri/PopupTemplate",
  "esri/geometry/projection",
  "esri/geometry/SpatialReference",
  "esri/widgets/BasemapGallery",
  "esri/widgets/Expand",
  "esri/widgets/BasemapToggle",

], function (
  Map,
  MapView,
  FeatureLayer,
  GraphicsLayer,
  UniqueValueRenderer,
  Search,
  Zoom,
  Graphic,
  Point,
  PopupTemplate,
  projection,
  SpatialReference,
  BasemapGallery,
  Expand,
  BasemapToggle
) {
  console.log("*** REQUIRE BLOCK STARTED ***");

  // Links coming from the Hebrew landing page
  const pageParams = new URLSearchParams(window.location.search);
  const cameFromGuide = pageParams.get("from") === "he-guide";
  const deepLinkPlace = (pageParams.get("place") || "").trim();

// Initialize device detection
DeviceInfo.init();

// -------- Map & View -------- 
const map = new Map({ basemap: "topo-vector" });

// Random starting cities (desktop)
const startCities = [
  { name: "Paris",       center: [2.35, 48.86] },
  { name: "London",      center: [-0.12, 51.51] },
  { name: "New York",    center: [-73.99, 40.75] },
  { name: "Jerusalem",   center: [35.22, 31.78] },
  { name: "Berlin",      center: [13.40, 52.52] },
  { name: "Buenos Aires",center: [-58.38, -34.60] },
  { name: "Budapest",    center: [19.04, 47.50] },
  { name: "Prague",      center: [14.42, 50.08] },
  { name: "Amsterdam",   center: [4.90, 52.37] },
  { name: "Rome",        center: [12.50, 41.89] },
  { name: "Boston",       center: [-71.06, 42.36] },
  { name: "Los Angeles",  center: [-118.24, 34.05] },
];
const startCity = startCities[Math.floor(Math.random() * startCities.length)];
const startCenter = DeviceInfo.isMobile() ? [2.35, 48.86] : startCity.center;


const view = new MapView({
  container: "viewDiv",
  map,
  center: startCenter,
  zoom: 12,
  ui: { components: [] }
});

view.popup.autoOpenEnabled = false;

// keep UI clear of header
const headerH = document.getElementById('appHeader')?.offsetHeight || 95;
view.padding = { top: headerH };
window.addEventListener('resize', () => {
  const h = document.getElementById('appHeader')?.offsetHeight || 95;
  view.padding = { ...view.padding, top: h };
});

// -------- Popup Template --------
const createPopupTemplate = () => ({
  title: null,
  content: function (feature) {
    const isMobile = DeviceInfo.isMobile();
    const a = feature.graphic.attributes || {};
    const id = a.id || a.OBJECTID || "";
    const category = a.main_category || "Place";

    const container = document.createElement("div");
    container.className = "enhanced-popup-container";

    // Close button. Appended to the container as a normal child. It stays
    // at the top-right when the popup opens; if the content is scrolled all
    // the way down it may scroll up with it, but tapping the map also closes
    // the popup, so there's always a way out.
    const closeBtn = document.createElement("button");
    closeBtn.className = "custom-close-btn";
    closeBtn.type = "button";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.popup.close();
      view.popup.clear();
      view.popup.visible = false;
    });
    container.appendChild(closeBtn);

    // Loading state — append as a node so we DON'T re-parse the container
    // via innerHTML, which would wipe the close button's click listener.
    const loadingEl = document.createElement("div");
    loadingEl.className = "popup-loading";
    loadingEl.style.cssText = "padding: 24px; text-align: center; color: #888;";
    loadingEl.textContent = "Loading...";
    container.appendChild(loadingEl);

    // Fetch full record from Render API
    fetch(`https://api.jewishatlas.org/api/landmarks/points/${id}`)
      .then(r => {
        // Without this, a non-2xx response (404/500) whose body still
        // happens to parse as JSON (e.g. an error object) would flow into
        // .then(full => ...) as if it were a real record, instead of
        // hitting .catch() and showing the "Could not load details" state.
        if (!r.ok) throw new Error(`Landmark fetch failed: ${r.status}`);
        return r.json();
      })
      .then(full => {
        // Escape text before it goes into innerHTML (prevents HTML/script
        // injection from API data). Raw values below are kept unescaped so
        // URL-building (encodeURIComponent) stays correct.
        const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({
          "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));

        const name = full.eng_name?.trim() || full.name || full.full_name || "Location";
        const cat = full.main_category || category;
        const address = full.address || "";
        const city = full.city || "";
        const fullAddress = (address && city && address.includes(city))
          ? address
          : [address, city].filter(Boolean).join(", ") || "Not available";
        const description = full.description || "";
        const hours = full.fees_opening_hours || "";
        const photo = full.photo || "";

        function normalizeUrl(u) {
          if (!u) return "";
          const s = String(u).trim();
          // Reject anything that carries an explicit non-http(s) scheme
          // (e.g. javascript:, data:) to prevent href-based injection.
          if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s)) return "";
          return /^https?:\/\//i.test(s) ? s : `https://${s}`;
        }
        const siteUrl = normalizeUrl(full.website || full.Website || full.link || "");

        const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent([name, cat, fullAddress].filter(Boolean).join(" "))}`;
        const feedbackUrl = `https://docs.google.com/forms/d/e/1FAIpQLSeVWy9b_hWAk2qjTvabxsuQl-Lr1ewUY4CRVT6kTQGt7egSag/viewform?usp=pp_url&entry.1424782895=${encodeURIComponent(id)}`;

        // Build nav links
        const pt = GeoUtils.getPointFromGeometry(feature.graphic.geometry);
        const [lat, lon] = GeoUtils.toLatLon(pt);
        const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
        const label = GeoUtils.buildLabel([name, address, city]) || "Destination";
        const encLabel = encodeURIComponent(label);
        const gmaps = hasCoords
          ? `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${lat.toFixed(6)},${lon.toFixed(6)}&travelmode=driving`
          : `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${encLabel}&travelmode=driving`;
        const waze = hasCoords
          ? `https://waze.com/ul?ll=${lat.toFixed(6)},${lon.toFixed(6)}&navigate=yes&z=16`
          : `https://waze.com/ul?q=${encLabel}&navigate=yes&z=16`;

        // Everything here goes inside the scrollable body, kept separate
        // from the close button so the button never scrolls with it.
        let html = `<div class="popup-scroll-body">`;

        if (photo?.trim()) {
          html += `<div class="popup-image" data-full-img="${escapeHtml(photo.trim())}" style="background-image:url('${escapeHtml(photo.trim())}');cursor:pointer;"></div>`;
        }

        html += `<h2 class="popup-title">${escapeHtml(name)}</h2>`;
        html += `
          <div class="popup-category">
            <span class="category-badge">${escapeHtml(cat)}</span>
          </div>
          <div class="popup-tabs">
            <button class="tab-button active" data-tab="info">Info</button>
            <button class="tab-button" data-tab="navigate">Navigate</button>
            <button class="tab-button" data-tab="feedback">Feedback</button>
          </div>
          <div class="popup-content-wrapper">
            <div class="tab-content active" data-content="info">
              <div class="info-section">
                <div class="info-label">Address</div>
                <div class="info-value">${escapeHtml(fullAddress)}</div>
              </div>
              ${description?.trim() ? `
              <div class="info-section">
                <div class="info-label">About</div>
                <div class="info-value clamp-4">${escapeHtml(description)}</div>
              </div>` : ""}
              ${hours?.trim() ? `
              <div class="info-section">
                <div class="info-label">Hours & Fees</div>
                <div class="info-value clamp-4">${escapeHtml(hours)}</div>
              </div>` : ""}
              <a href="${googleSearchUrl}" class="primary-button">Search for More Details</a>
              ${siteUrl ? `<a href="${escapeHtml(siteUrl)}" class="primary-button site-link">Visit website</a>` : ""}
            </div>
            <div class="tab-content" data-content="navigate">
              <div class="nav-info-top">Get directions from your current location:</div>
              <a href="${gmaps}" class="nav-button google-maps" ${isMobile ? '' : 'target="_blank" rel="noopener"'}>Directions via Google Maps</a>
              <a href="${waze}" class="nav-button waze" ${isMobile ? '' : 'target="_blank" rel="noopener"'}>Directions via Waze</a>
              <div class="nav-info">Opens your preferred navigation app</div>
            </div>
            <div class="tab-content" data-content="feedback">
              <div class="feedback-block">
                <h3 class="feedback-title">Help us improve</h3>
                <p class="feedback-text">
                  Point ID: <strong>${escapeHtml(id)}</strong>
                </p>
                <p class="feedback-text">Found an issue or have updates to share?</p>
                <a href="${feedbackUrl}" ${isMobile ? '' : 'target="_blank" rel="noopener"'} class="primary-button feedback-submit">Submit Feedback</a>
              </div>
            </div>
          </div>
        `;
        html += `</div>`; // close .popup-scroll-body

        // Replace loading with full content. The close button is a sibling
        // of the loading element, so replacing the loading node leaves it
        // intact.
        container.querySelector(".popup-loading").outerHTML = html;

        // Tabs
        const tabButtons = container.querySelectorAll(".tab-button");
        const tabContents = container.querySelectorAll(".tab-content");
        tabButtons.forEach(btn => {
          btn.addEventListener("click", () => {
            const tab = btn.dataset.tab;
            tabButtons.forEach(b => b.classList.toggle("active", b === btn));
            tabContents.forEach(c => c.classList.toggle("active", c.dataset.content === tab));
          });
        });

        // Prevent popup clicks triggering map clicks
        ["click", "mousedown", "mouseup", "touchstart", "touchend"].forEach(evt => {
          container.addEventListener(evt, e => e.stopPropagation(), { passive: false });
        });

        // Tap/click the popup photo to view it full-screen. Also keyboard-
        // activatable (Enter/Space), since this is a plain <div>, not a
        // native button or link.
        const imgEl = container.querySelector(".popup-image");
        if (imgEl) {
          imgEl.setAttribute("role", "button");
          imgEl.setAttribute("tabindex", "0");
          imgEl.setAttribute("aria-label", `View full photo of ${name}`);
          imgEl.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openImageLightbox(imgEl.dataset.fullImg, name);
          });
          imgEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              openImageLightbox(imgEl.dataset.fullImg, name);
            }
          });
        }
      })
      .catch(() => {
        container.querySelector(".popup-loading").innerHTML =
          `<div style="padding:24px;text-align:center;color:#c00;">Could not load details. Please try again.</div>`;
      });

    return container;
  },
  outFields: ["id", "main_category"]
});


// -------- Popup behavior --------
view.when(() => {
  view.popup.collapseEnabled = false;

  function applyPopupLayout() {
    const mobile = DeviceInfo.isMobile();

    view.popup.dockEnabled = true;
    view.popup.dockOptions = {
      position: mobile ? "bottom" : "top-center",
      breakpoint: false,
      buttonEnabled: false
    };

    if (!mobile) {
      view.popup.alignment = "top-center";
    }
  }

  applyPopupLayout();

  window.addEventListener("resize", () => {
    applyPopupLayout();
  });

  view.popup.watch("collapsed", (collapsed) => {
    if (collapsed) view.popup.collapsed = false;
  });

  view.popup.watch("visible", (visible) => {
    if (!visible) return;
    if (view.widthBreakpoint === "xsmall") {
      setTimeout(() => {
        const center = view.center.clone();
        center.y += 0.15;
        view.goTo(center, { animate: false }).catch(() => {});
      }, 250);
    }
  });
});


// -------- Location Tracking --------

const locationSymbol = {
  type: "picture-marker",
  url: "data:image/svg+xml;base64," + btoa(`
    <svg width="60" height="80" viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="pinShadow" x="-40%" y="-20%" width="180%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.45"/>
        </filter>
      </defs>
      <!-- Drop shadow ellipse on ground -->
      <ellipse cx="30" cy="76" rx="10" ry="3.5" fill="#000" opacity="0.2"/>
      <!-- Pin teardrop -->
      <path d="M30 75 C30 75 6 48 6 28 C6 15.3 17 5 30 5 C43 5 54 15.3 54 28 C54 48 30 75 30 75Z"
        fill="#111111" stroke="#ffffff" stroke-width="2" filter="url(#pinShadow)"/>
      <!-- White inner circle -->
      <circle cx="30" cy="28" r="10" fill="#ffffff"/>
      <!-- Black dot in centre -->
      <circle cx="30" cy="28" r="4.5" fill="#111111"/>
    </svg>
  `),
  width: "38px",
  height: "52px",
  yoffset: "10px"
};

const locationLayer = new GraphicsLayer({ title: "User Location", listMode: "hide" });
map.add(locationLayer);

let locationGraphic = null;
let tracking = false;
let lastPosition = null;
let hasInitiallyCentered = false;
let watchId = null;
let lastUpdateTs = 0;

const THROTTLE_MS  = 10000;
const MIN_MOVE_M   = 10;
const MAX_STALE_MS = 60000;

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function updateLocationMarker(latitude, longitude) {
  const point = new Point({
    longitude,
    latitude,
    spatialReference: { wkid: 4326 }
  });

  if (!locationGraphic) {
    locationGraphic = new Graphic({ geometry: point, symbol: locationSymbol });
    locationLayer.add(locationGraphic);
  } else {
    locationGraphic.geometry = point;
  }

  lastPosition = { lat: latitude, lon: longitude };
}

function updateLocation(centerOnFirst = false) {
  if (!("geolocation" in navigator)) return;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      updateLocationMarker(latitude, longitude);

      if (centerOnFirst && !hasInitiallyCentered && DeviceInfo.isMobile()) {
        view.goTo({ center: [longitude, latitude], zoom: 17 }, { duration: 800, easing: "ease-in-out" })
          .then(() => { hasInitiallyCentered = true; })
          .catch(() => {});
      }
    },
    (err) => {
      let errorMsg = "Location error";
      if (err.code === err.PERMISSION_DENIED) {
        errorMsg = "Location permission denied. Enable in Settings.";
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        errorMsg = "GPS signal unavailable. Try outdoors.";
      } else if (err.code === err.TIMEOUT) {
        errorMsg = "Location request timed out.";
      }
      console.warn("⚠️ " + errorMsg, err.message || err);
      showToast("⚠️ " + errorMsg);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
  );
}

function centerOnLocation() {
  if (!lastPosition) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        updateLocationMarker(latitude, longitude);
        view.goTo(
          { center: [longitude, latitude], zoom: Math.max(view.zoom || 3, 17) },
          { duration: 800, easing: "ease-in-out" }
        ).catch(() => {});
      },
      () => { showToast("⚠️ Could not get location"); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    return;
  }

  view.goTo(
    { center: [lastPosition.lon, lastPosition.lat], zoom: Math.max(view.zoom || 3, 17) },
    { duration: 800, easing: "ease-in-out" }
  ).catch(() => {});
}

function startLocationTracking() {
  if (tracking) return;
  
  if (!("geolocation" in navigator)) {
    showToast("⚠️ Location not supported on this device");
    return;
  }

  tracking = true;
  locateBtn.classList.add("is-tracking");
  locateBtn.setAttribute("aria-pressed", "true");
  locateBtn.title = "Click to center / Long press to stop";

  updateLocation(true);

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      const now = Date.now();

      const timeOk  = (now - lastUpdateTs) >= THROTTLE_MS;
      const distOk  = !lastPosition || haversineMeters(lastPosition.lat, lastPosition.lon, latitude, longitude) >= MIN_MOVE_M;
      const staleOk = (now - lastUpdateTs) >= MAX_STALE_MS;

      if (timeOk && (distOk || staleOk)) {
        updateLocationMarker(latitude, longitude);
        lastUpdateTs = now;
      }
    },
    (err) => { 
      let errorMsg = "Location error";
      if (err.code === err.PERMISSION_DENIED) {
        errorMsg = "Location permission denied. Enable in Settings.";
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        errorMsg = "GPS signal unavailable. Try outdoors with clear sky.";
      } else if (err.code === err.TIMEOUT) {
        errorMsg = "Location request timed out.";
      }
      console.warn("⚠️ " + errorMsg, err.message || err);
      showToast("⚠️ " + errorMsg);
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
}

function stopLocationTracking() {
  if (!tracking) return;

  tracking = false;
  locateBtn.classList.remove("is-tracking");
  locateBtn.setAttribute("aria-pressed", "false");
  locateBtn.title = "Show my location";

  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }

  lastPosition = null;
  hasInitiallyCentered = false;
  lastUpdateTs = 0;
}

// Create locate button
const locateBtn = document.createElement("button");
locateBtn.className = "esri-widget esri-widget--button esri-interactive esri-icon-locate";
locateBtn.title = "Show my location";
locateBtn.setAttribute("aria-label", "Location tracking");
locateBtn.setAttribute("aria-pressed", "false");
locateBtn.style.cursor = "pointer";
locateBtn.style.zIndex = "1000";

let pressTimer = null;
let longPressDidFire = false;

locateBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  
  if (!tracking) {
    startLocationTracking();
  } else {
    centerOnLocation();
  }
}, false);

locateBtn.addEventListener("touchend", (event) => {
  event.preventDefault();
  event.stopPropagation();
  clearTimeout(pressTimer);
  pressTimer = null;
  if (!longPressDidFire) {
    if (!tracking) {
      startLocationTracking();
    } else {
      centerOnLocation();
    }
  }
  longPressDidFire = false;
}, { passive: false });

locateBtn.addEventListener("mousedown", (event) => {
  if (tracking) {
    pressTimer = setTimeout(() => {
      stopLocationTracking();
    }, 1000);
  }
});

locateBtn.addEventListener("mouseup", () => {
  clearTimeout(pressTimer);
  pressTimer = null;
});

locateBtn.addEventListener("mouseleave", () => {
  clearTimeout(pressTimer);
  pressTimer = null;
});

locateBtn.addEventListener("touchstart", (event) => {
  if (tracking) {
    longPressDidFire = false;
    pressTimer = setTimeout(() => {
      longPressDidFire = true;
      stopLocationTracking();
    }, 1000);
  }
}, { passive: true });

view.ui.add(locateBtn, { position: "bottom-right", index: 2 });

// Pause/resume watch when tab visibility changes
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  } else if (tracking && watchId === null) {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const now = Date.now();
        const timeOk  = (now - lastUpdateTs) >= THROTTLE_MS;
        const distOk  = !lastPosition || haversineMeters(lastPosition.lat, lastPosition.lon, latitude, longitude) >= MIN_MOVE_M;
        const staleOk = (now - lastUpdateTs) >= MAX_STALE_MS;
        if (timeOk && (distOk || staleOk)) {
          updateLocationMarker(latitude, longitude);
          lastUpdateTs = now;
        }
      },
      (err) => { console.warn("Geolocation error:", err); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }
});

// Auto-start on mobile – immediately center on user location
// Auto-start on mobile – immediately center on user location
view.when(() => {

  // If a city was requested, stay on that city
  if (deepLinkPlace) return;

  if (!DeviceInfo.isMobile() || !("geolocation" in navigator)) return;

  const kickoff = () => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "geolocation" })
        .then(result => {
          if (result.state === "granted") {
            startLocationTracking();
          } else if (result.state === "denied") {
            showToast("⚠️ Location access is disabled. Enable it in your device Settings to center the map on your position.");
          } else {
            // 'prompt' – ask the user; startLocationTracking triggers the browser dialog
            startLocationTracking();
          }
        })
        .catch(() => {
          // permissions API not supported – just try
          startLocationTracking();
        });
    } else {
      startLocationTracking();
    }
  };

  // Small delay so map tiles start loading first, then request location
  setTimeout(kickoff, 800);
});

window.startLocationTracking = startLocationTracking;
window.updateLocation = updateLocation;
window.centerOnLocation = centerOnLocation;


  // -------- Other UI widgets --------
  view.ui.add(new Zoom({ view }), { position: "bottom-right", index: 0 });


/* === Basemap control: Toggle on mobile, Gallery on desktop === */
function mountBasemapControl() {
  const isMobile = DeviceInfo.isMobile();

  if (window.__bmControl) {
    view.ui.remove(window.__bmControl);
    window.__bmControl.content?.destroy?.();
    window.__bmControl.destroy?.();
    window.__bmControl = null;
  }

  if (isMobile) {
    const toggle = new BasemapToggle({
      view,
      nextBasemap: "satellite"
    });
    view.ui.add(toggle, { position: "bottom-left", index: 0 });
    toggle.when(() => toggle.container?.classList.add("bm-toggle--mobile"));
    window.__bmControl = toggle;

  } else {
    const gallery = new BasemapGallery({ view });
    const expand = new Expand({
      view,
      content: gallery,
      expandTooltip: "Change basemap",
      expanded: false
    });
    view.ui.add(expand, { position: "bottom-right", index: 3 });
    window.__bmControl = expand;
  }
}

view.when(() => {
  mountBasemapControl();

  let _bmTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(_bmTimer);
    _bmTimer = setTimeout(mountBasemapControl, 200);
  });
});

  // -------- Search --------
  const search = new Search({
    view,
    container: "searchContainer",
    includeDefaultSources: true,
    searchMultipleSourcesEnabled: false,
    allPlaceholder: "Search a city, country or place…"
  });
  search.popupEnabled = false;
search.resultGraphicEnabled = false;
search.when(() => {
  if (search.sources && search.sources.length > 0) {
    search.sources.getItemAt(0).placeholder =
      "Search a city, country or place…";
  }

  setTimeout(() => {
    const input =
      document.querySelector("#searchContainer .esri-search__input");

    if (input) {
      input.placeholder = "Search a city, country or place…";
    }
  }, 500);

  // If the URL contains a city, open the map there.
  //
  // Coordination with the ?memory=<slug> deep link (handled in
  // memories.js): when a memory slug is present, we do NOT immediately
  // run the place search, because memories.js may fly to that person's
  // exact point instead — and two independent view.goTo() calls would
  // race, with unpredictable results. Instead we wait briefly. If
  // memories.js resolves the slug to a real point, it sets
  // window.__memoryDeepLinkClaimed = true and we skip the place search
  // entirely. If it doesn't (the slug has no map point), the timer
  // fires and we fall back to the place search as before.
  if (deepLinkPlace) {
    const runPlaceSearch = () => {
      search.search(deepLinkPlace).catch((err) => {
        console.warn(
          "Could not open deep-linked place:",
          deepLinkPlace,
          err
        );
      });
    };

    const memorySlugPresent =
      new URLSearchParams(window.location.search).get("memory");

    if (memorySlugPresent) {
      // Give memories.js up to 4s to claim the deep link. If it already
      // has by the time we check, skip entirely; otherwise poll briefly.
      let waited = 0;
      const step = 200;
      const maxWait = 4000;
      const poll = setInterval(() => {
        if (window.__memoryDeepLinkClaimed) {
          clearInterval(poll);        // memories.js won — do nothing
          return;
        }
        waited += step;
        if (waited >= maxWait) {
          clearInterval(poll);
          if (!window.__memoryDeepLinkClaimed) runPlaceSearch();
        }
      }, step);
    } else {
      runPlaceSearch();
    }
  }
});


  // -------- Renderer --------
  // Points render noticeably bigger on mobile — small circles are hard to
  // see and hard to tap accurately on a touch screen.
  const isMobileRenderer = DeviceInfo.isMobile();
  const pointOutlineWidth = isMobileRenderer ? 1.5 : 1;
  const pointSizeStops = isMobileRenderer
    ? [
        { scale: 591657527, size: 6 },
        { scale: 144447,    size: 9 },
        { scale: 18055,     size: 13 }
      ]
    : [
        { scale: 591657527, size: 3 },
        { scale: 144447,    size: 5 },
        { scale: 18055,     size: 8 }
      ];

  const globalRenderer = new UniqueValueRenderer({
    field: "main_category",
    defaultSymbol: { type: "simple-marker", style: "circle", size: isMobileRenderer ? 10 : 7, color: "#888", outline: { color: "#fff", width: pointOutlineWidth } },
    visualVariables: [{
      type: "size",
      valueExpression: "$view.scale",
      stops: pointSizeStops
    }],
    uniqueValueInfos: [
      { value: "Synagogue",         symbol: { type: "simple-marker", style: "circle", color: "#5DADE2", outline: { color: "#fff", width: pointOutlineWidth } } },
      { value: "Heritage",          symbol: { type: "simple-marker", style: "circle", color: "#EC7063", outline: { color: "#fff", width: pointOutlineWidth } } },
      { value: "Kosher Restaurant", symbol: { type: "simple-marker", style: "circle", color: "#58D68D", outline: { color: "#fff", width: pointOutlineWidth } } },
      { value: "Community",         symbol: { type: "simple-marker", style: "circle", color: "#8b5cf6", outline: { color: "#fff", width: pointOutlineWidth } } },
      { value: "Chabad",            symbol: { type: "simple-marker", style: "circle", color: "#F5B041", outline: { color: "#fff", width: pointOutlineWidth } } }
    ]
  });

  // -------- Single Layer (FeatureLayer) --------
  let currentFilter = "";

  const globalLayer = new FeatureLayer({
    url: window.LANDMARKS_SERVICE_URL,
    outFields: ["id", "main_category"],
    popupTemplate: createPopupTemplate(),
    renderer: globalRenderer,

    // -------- Clustering --------
    featureReduction: {
      type: "cluster",
      clusterRadius: "80px",
      clusterMinSize: "20px",
      clusterMaxSize: "60px",



      // Fallback cluster symbol
      symbol: {
        type: "simple-marker",
        style: "circle",
        size: 24,
        color: [100, 100, 100, 0.7],
        outline: { color: "#fff", width: 1.5 }
      },

      // Color clusters by predominant category
      renderer: {
        type: "unique-value",
        field: "main_category",
        defaultSymbol: { type: "simple-marker", style: "circle", size: 24, color: [136, 136, 136, 0.75], outline: { color: "#fff", width: 1.5 } },
        uniqueValueInfos: [
          { value: "Synagogue",         symbol: { type: "simple-marker", style: "circle", size: 24, color: [93, 173, 226, 0.75],  outline: { color: "#fff", width: 1.5 } } },
          { value: "Heritage",          symbol: { type: "simple-marker", style: "circle", size: 24, color: [236, 112, 99, 0.75],  outline: { color: "#fff", width: 1.5 } } },
          { value: "Kosher Restaurant", symbol: { type: "simple-marker", style: "circle", size: 24, color: [88, 214, 141, 0.75],  outline: { color: "#fff", width: 1.5 } } },
          { value: "Community",         symbol: { type: "simple-marker", style: "circle", size: 24, color: [139, 92, 246, 0.75],  outline: { color: "#fff", width: 1.5 } } },
          { value: "Chabad",            symbol: { type: "simple-marker", style: "circle", size: 24, color: [245, 176, 65, 0.75], outline: { color: "#fff", width: 1.5 } } }
        ]
      },

      // Aggregate: pick predominant category
      fields: [{
        name: "main_category",
        statisticType: "mode",
        onStatisticField: "main_category"
      }],

      // Popup for clusters
      popupTemplate: {
        title: "Cluster ({cluster_count} sites)",
        content: "This cluster contains {cluster_count} sites. Click or zoom in to see individual locations.",
        fieldInfos: [{
          fieldName: "cluster_count",
          format: { digitSeparator: true, places: 0 }
        }]
      }
    }
  });
  map.add(globalLayer);
  
// ========================================
// WELCOME POPUP
// ========================================
view.when(() => {
  const _cameFromInternal =
    sessionStorage.getItem("ja_from_internal") === "1";

  sessionStorage.removeItem("ja_from_internal");

  if (
    cameFromGuide ||
    deepLinkPlace ||
    localStorage.getItem("ja_welcome_v2") === "1" ||
    _cameFromInternal
  ) return;

  const isMobile = window.matchMedia("(max-width: 640px)").matches;

  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,0.4);
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 280ms ease;
    padding: 16px;
  `;

  const card = document.createElement("div");
  card.style.cssText = `
    background: #faf8f4;
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.15);
    padding: ${isMobile ? "24px 24px 20px" : "36px 40px 32px"};
    max-width: ${isMobile ? "360px" : "460px"};
    width: 100%;
    position: relative;
    text-align: center;
    font-family: 'Inter', sans-serif;
    transform: scale(0.96);
    opacity: 0;
    transition: transform 280ms ease, opacity 280ms ease;
    max-height: 90vh;
    overflow: auto;
  `;

  card.innerHTML = `
   <button id="welcomeClose" style="
      position: absolute; top: 14px; right: 14px;
      background: #f5f5f5; border: none;
      width: 24px; height: 24px;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; color: #888; cursor: pointer;
      border-radius: 50%;
    " aria-label="Close" type="button">✕</button>

    <p style="
      margin: 0 0 10px;
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #c5a47e;
    ">Jewish Atlas</p>
    <h2 style="
      margin: 0 0 8px;
      padding-top: 0;
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: ${isMobile ? "19px" : "21px"};
      font-weight: 600;
      color: #111;
      line-height: 1.15;
      letter-spacing: 0.01em;
      padding-right: 32px;
    ">A living map of Jewish heritage and memory.</h2>

    <p style="
      margin: 0 0 16px;
      font-size: ${isMobile ? "14px" : "15px"};
      color: #666;
      line-height: 1.6;
    ">Discover Jewish places and community around the world.</p>

    <ul style="
      list-style: none;
      padding: 0;
      margin: 0 0 28px;
      text-align: left;
      font-size: 14px;
      color: #555;
      line-height: 1.7;
    ">
     <li style="margin-bottom: 6px; padding-left: 4px; color: #555;">Search any city or landmark</li>
<li style="padding-left: 4px; color: #555;">Filter by synagogue, heritage, kosher food, or community</li>
    </ul>

    <button id="welcomeExplore" style="
      display: block;
      width: 100%;
      padding: 13px 0;
      min-height: 44px;
      background: #111;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-family: 'Inter', sans-serif;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      margin-bottom: 10px;
      letter-spacing: 0.02em;
      transition: opacity 200ms ease;
    " type="button">Start Exploring</button>

    <a href="dedicate.html" style="
      display: block;
      width: 100%;
      padding: 13px 0;
      min-height: 44px;
      background: #c5a47e;
      color: #0a0c0f;
      border: none;
      border-radius: 8px;
      font-family: 'Inter', sans-serif;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      margin-bottom: 24px;
      letter-spacing: 0.02em;
      text-decoration: none;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 200ms ease;
    ">Dedicate a Brick</a>

    <p style="
      margin: 0 0 16px;
      font-size: 12px;
      color: #999;
      font-style: italic;
      letter-spacing: 0.2px;
    ">Preserve memory. Build the map.</p>

    <label style="
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #888;
      cursor: pointer;
      user-select: none;
    ">
      <input type="checkbox" id="welcomeDontShow"
        style="width: 16px; height: 16px; accent-color: #111; cursor: pointer;">
      Don't show this again
    </label>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      card.style.transform = "scale(1)";
      card.style.opacity = "1";
    });
  });

  function closeWelcome() {
    if (card.querySelector("#welcomeDontShow")?.checked) {
      localStorage.setItem("ja_welcome_v2", "1");
    }
    overlay.style.opacity = "0";
    card.style.transform = "scale(0.96)";
    card.style.opacity = "0";
    setTimeout(() => overlay.remove(), 280);
  }

  card.querySelector("#welcomeClose").addEventListener("click", closeWelcome);
  card.querySelector("#welcomeExplore").addEventListener("click", closeWelcome);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeWelcome();
  });

  if (window.matchMedia("(hover: hover)").matches) {
    const explore = card.querySelector("#welcomeExplore");
    explore.addEventListener("mouseenter", () => (explore.style.opacity = "0.85"));
    explore.addEventListener("mouseleave", () => (explore.style.opacity = "1"));
  }
});


// -------- Toggle clustering by zoom level --------
  const CLUSTER_ZOOM_THRESHOLD = 12;

  globalLayer.when(() => {
    const clusterConfig = globalLayer.featureReduction;

       // Check initial zoom
    if (view.zoom >= CLUSTER_ZOOM_THRESHOLD) {
      globalLayer.featureReduction = null;
    }

    view.watch("zoom", (zoom) => {
      if (zoom >= CLUSTER_ZOOM_THRESHOLD && globalLayer.featureReduction) {
        globalLayer.featureReduction = null;
      } else if (zoom < CLUSTER_ZOOM_THRESHOLD && !globalLayer.featureReduction) {
        globalLayer.featureReduction = clusterConfig;
      }
    });
  });
  // ensure projection is loaded
  projection.load().catch(console.error);


  // -------- Click Handler (single layer only) --------
  let lastPopupId = null;
  let lastPopupTime = 0;
  let lastClickTime = 0;
  let hitTestPending = false;

  async function openPopupSafely(features, location) {
    if (!features || !Array.isArray(features) || features.length === 0) return;

    view.popup.open({ features, location });
    setTimeout(() => { view.popup.visible = true; }, 20);
  }

  view.on("immediate-click", async (event) => {
    try {
      const now = Date.now();
      if (now - lastClickTime < 300 || hitTestPending) return;
      lastClickTime = now;
      hitTestPending = true;

      const tolerance = DeviceInfo.isMobile() ? 22 : 12;
      
      const { results } = await Promise.race([
        view.hitTest(event, { tolerance }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('hitTest timeout')), 1000)
        )
      ]).catch(() => ({ results: [] }));

      // Check globalLayer OR memoriesLayer
      const hit = results.find(r => {
        const layer = r.graphic?.layer;
        return layer === globalLayer ||
               (window.__memoriesIsLayer && window.__memoriesIsLayer(layer));
      });

      // ---- Tap on empty map: dismiss an open popup ----
      if (!hit?.graphic) {
        if (view.popup.visible) {
          view.popup.close();
          view.popup.clear();
          view.popup.visible = false;
          lastPopupId = null;
        }
        return;
      }

      if (hit?.graphic) {
        const hitGraphic = hit.graphic;

        // ---- Cluster click: zoom in to expand ----
        if (hitGraphic.isAggregate) {
          view.goTo(
            { target: hitGraphic.geometry, zoom: view.zoom + 2 },
            { duration: 500, easing: "ease-in-out" }
          ).catch(() => {});
          return;
        }
        
        // ---- Individual point click: open popup ----
        const now2 = Date.now();
        if (lastPopupId === hitGraphic.attributes.id && (now2 - lastPopupTime) < 500) {
          return; // duplicate suppression
        }
        lastPopupId = hitGraphic.attributes.id;
        lastPopupTime = now2;
        
        await openPopupSafely([hitGraphic], event.mapPoint);
      }

    } catch (error) {
      console.error("Error handling click:", error);
    } finally {
      hitTestPending = false;
    }
  });

  // -------- Filters UI --------
  const filterDiv = document.getElementById("filterContainer");
  const categories = [
    { name: "All",          cat: "" },
    { name: "Synagogues",   cat: "Synagogue" },
    {name: "Kosher Food",  cat: "Kosher Restaurant" },
    { name: "Chabad",       cat: "Chabad" },
    { name: "Heritage",     cat: "Heritage" },
    { name: "Community",    cat: "Community" }
  ];

  if (filterDiv) {
    categories.forEach((o, i) => {
      const btn = document.createElement("button");
      btn.textContent = o.name;
      btn.dataset.cat = o.cat;
      btn.className = "filterBtn" + (i === 0 ? " active" : "");
      filterDiv.appendChild(btn);
    });

    const buttons = filterDiv.querySelectorAll(".filterBtn");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const cat = btn.dataset.cat || "";
        currentFilter = cat;

        // Server-side filter via definitionExpression
        globalLayer.definitionExpression = cat
          ? `main_category='${cat.replace(/'/g, "''")}'`
          : "";

        // UI state
        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        filterDiv.classList.toggle("filtered", !!cat);
      });
    });
  }

  if (typeof window.initMemoriesMode === "function") {
    window.initMemoriesMode({
      view,
      map,
      FeatureLayer,
      UniqueValueRenderer,
      Search,
      search,
      globalLayer,
      filterContainer: filterDiv,
      DeviceInfo
    });
  }           

});

// ---- Wire header buttons ----
document.addEventListener("DOMContentLoaded", () => {
  const wire = (id, href, label) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (label) el.textContent = label;
    if (el.tagName.toLowerCase() === "a") el.setAttribute("href", href);
    else el.addEventListener("click", () => { sessionStorage.setItem("ja_from_internal", "1"); window.location.href = href; });
  };
  wire("uploadBtn", "upload.html", "Upload Your Site");
  wire("wallBtn", "wall.html", "The Wall");
  wire("aboutBtn", "about.html", "About");
});