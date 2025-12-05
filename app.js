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
    bottom: 20px;
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
    animation: slideUp 0.3s ease-out;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Auto-remove after duration
  setTimeout(() => {
    toast.style.animation = 'slideDown 0.3s ease-in';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Add CSS animations for toast
if (!document.querySelector('style[data-toast-css]')) {
  const style = document.createElement('style');
  style.setAttribute('data-toast-css', 'true');
  style.textContent = `
    @keyframes slideUp {
      from { 
        transform: translateX(-50%) translateY(100px); 
        opacity: 0; 
      }
      to { 
        transform: translateX(-50%) translateY(0); 
        opacity: 1; 
      }
    }
    @keyframes slideDown {
      from { 
        transform: translateX(-50%) translateY(0); 
        opacity: 1; 
      }
      to { 
        transform: translateX(-50%) translateY(100px); 
        opacity: 0; 
      }
    }
  `;
  document.head.appendChild(style);
}

// ========================================
// PART 1: Shared Geolocation Utilities
// ========================================

const GeoUtils = {
  // Web Mercator WKID values (different representations of same projection)
  WEB_MERCATOR_WKIDS: [3857, 102100, 102113, 900913],
  
  /**
   * Check if a WKID is Web Mercator (used by many map services)
   */
  isWebMercatorWkid(wkid) {
    return this.WEB_MERCATOR_WKIDS.includes(wkid);
  },

  /**
   * Extract a Point geometry from various geometry types
   * Handles: point, polygon (via centroid), envelope (via center)
   */
  getPointFromGeometry(geom) {
    if (!geom) return null;
    if (geom.type === "point") return geom;
    if (geom.extent?.center) return geom.extent.center;
    if (geom.centroid) return geom.centroid;
    return null;
  },

  /**
   * Convert any projected point to WGS84 [latitude, longitude]
   * Handles Web Mercator & WGS84 natively; attempts best-effort for others
   * @returns {[number, number]} [lat, lon] or [null, null] if invalid
   */
  toLatLon(point) {
    if (!point) return [null, null];

    const wkid = point.spatialReference?.wkid;

    // Already WGS84
    if (wkid === 4326) {
      return [Number(point.y), Number(point.x)];
    }

    // Web Mercator → WGS84 (Spherical Mercator)
    if (this.isWebMercatorWkid(wkid)) {
      const metersPerDegree = 20037508.34;
      const lon = (point.x * 180) / metersPerDegree;
      const latRad = (point.y * Math.PI) / metersPerDegree;
      const lat = (180 / Math.PI) * (2 * Math.atan(Math.exp(latRad)) - Math.PI / 2);
      return [lat, lon];
    }

    // Fallback: assume point.y is lat, point.x is lon
    return [Number(point.y), Number(point.x)];
  },

  /**
   * Format coordinates to fixed decimal places
   * @param {number} value
   * @param {number} decimals - default 6
   * @returns {string}
   */
  formatCoord(value, decimals = 6) {
    return Number(value).toFixed(decimals);
  },

  /**
   * Build a clean label from address components
   * Filters out null/empty values and joins with comma
   */
  buildLabel(components) {
    return components.filter(Boolean).join(", ");
  }
};

// ========================================
// PART 2: Cached Mobile Detection
// ========================================

const DeviceInfo = {
  // Cache the computed value
  _isMobile: null,
  _mediaQuery: null,

  /**
   * Initialize device detection and listen for changes
   * Call this once on app startup
   */
  init() {
    this._mediaQuery = window.matchMedia("(max-width: 768px)");
    this._isMobile = this._mediaQuery.matches;

    // Listen for orientation changes & resize
    this._mediaQuery.addEventListener("change", () => {
      this._isMobile = this._mediaQuery.matches;
    });

    return this._isMobile;
  },

  /**
   * Get cached mobile status
   * @returns {boolean}
   */
  isMobile() {
    // If init() wasn't called, do it now (fallback)
    if (this._isMobile === null) {
      this.init();
    }
    return this._isMobile;
  },

  /**
   * Alternative: user-agent check (for cases where matchMedia is unreliable)
   * More comprehensive than matchMedia alone
   */
  isMobileUserAgent() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  },

  /**
   * Comprehensive check: use both methods
   */
  isMobileComprehensive() {
    return this.isMobile() || this.isMobileUserAgent();
  }
};

// ========================================
// PART 3: Safe Geolocation Watch Manager
// ========================================

// NOTE: This app uses direct navigator.geolocation calls.
// See startLocationTracking() for the custom location tracking implementation.

// ========================================
// PART 4: Usage Examples in Your App
// ========================================

// NOTE: All geolocation is handled inside the require() block below.
// The custom location tracking system (startLocationTracking, etc.)
// is the only geolocation system used in this app.

require([
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/layers/GraphicsLayer",
  "esri/renderers/UniqueValueRenderer",
  "esri/widgets/Search",
  "esri/widgets/Home",
  "esri/widgets/Zoom",
  "esri/Graphic",
  "esri/geometry/Point",
  "esri/PopupTemplate",                // ok to keep though not used directly
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
  Home,
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

// Initialize device detection (cache mobile status)
DeviceInfo.init();

// -------- Map & View -------- 
const map = new Map({ basemap: "topo-vector" });

const view = new MapView({
  container: "viewDiv",
  map,
  center: [15, 52],
  zoom: 5.5,
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

// -------- Popup Template: compact desktop, full mobile, working Google Maps + Waze --------
const createPopupTemplate = () => ({
  title: null, // use ArcGIS header title on desktop
  content: function (feature) {
     // Detect mobile here — must be inside the function
       const isMobile = DeviceInfo.isMobile();

    // --- helpers ---




   function buildNavLinks(graphic, attrs) {
  // Extract point (handles point / polygon / centroid)
  const pt = GeoUtils.getPointFromGeometry(graphic.geometry);

  // Convert to lat/lon in WGS84
  const [lat, lon] = GeoUtils.toLatLon(pt);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);

  // Build clean label fallback
  const label = GeoUtils.buildLabel([
    attrs.name,
    attrs.Address || attrs.address,
    attrs.city
  ]) || "Destination";

  const encLabel = encodeURIComponent(label);

  // Google Maps URL
  const gmaps = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${lat.toFixed(6)},${lon.toFixed(6)}&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${encLabel}&travelmode=driving`;

  // Waze URL
  const waze = hasCoords
    ? `https://waze.com/ul?ll=${lat.toFixed(6)},${lon.toFixed(6)}&navigate=yes&z=16`
    : `https://waze.com/ul?q=${encLabel}&navigate=yes&z=16`;

  return { gmaps, waze };
}


    // Attributes
    const a = feature.graphic.attributes || {};
    const name = a.name || "Location";
    const category = a.category || a.main_category || "Place";
    const address = a.address || "";
    const city = a.city || "";
    const fullAddress =
  (address && city && address.includes(city))
    ? address                     // address already contains city/country → keep as is
    : [address, city].filter(Boolean).join(", ") || "Not available";

    const description = a.description || "";
    const hours = a.fees_opening_hours || "";
    const photo = a.photo || "";
    const id = a.id || a.OBJECTID || "";
   // Normalize website URL (supports fields: website / Website / link)
   function normalizeUrl(u){
    if (!u) return "";
    const s = String(u).trim();
    return /^https?:\/\//i.test(s) ? s : `https://${s}`;
   }
   const siteUrl = normalizeUrl(a.website || a.Website || a.link || "");


    // Other links
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent([name, category, fullAddress].filter(Boolean).join(" "))}`;

    const feedbackUrl = `https://docs.google.com/forms/d/e/1FAIpQLSeVWy9b_hWAk2qjTvabxsuQl-Lr1ewUY4CRVT6kTQGt7egSag/viewform?usp=pp_url&entry.1424782895=${encodeURIComponent(id)}`;

    // Container
    const container = document.createElement("div");
    container.className = "enhanced-popup-container";

    // HTML (desktop compact; mobile full)

let html = ``;

// Image first (on all devices)
if (photo && photo.trim()) {
  html += `
    <div class="popup-image"
      style="background-image:url('${photo.replace(/'/g, "&#39;")}')"></div>
  `;
}

// Title below image
html += `<h2 class="popup-title">${name}</h2>`;




// Category + Tabs
html += `
  <div class="popup-category">
    <span class="category-badge">${category}</span>
  </div>

  <div class="popup-tabs">
    <button class="tab-button active" data-tab="info">📍 Info</button>
    <button class="tab-button" data-tab="navigate">🧭 Navigate</button>
    <button class="tab-button" data-tab="feedback">💬 Feedback</button>
  </div>

  <div class="popup-content-wrapper">
    <div class="tab-content active" data-content="info">
      <div class="info-section">
        <div class="info-label">📍 Address</div>
        <div class="info-value">${fullAddress}</div>
      </div>

      ${description?.trim() ? `
      <div class="info-section">
        <div class="info-label">ℹ️ About</div>
        <div class="info-value clamp-4">${description}</div>
      </div>` : ""}

      ${hours?.trim() ? `
      <div class="info-section">
        <div class="info-label">🕒 Hours & Fees</div>
        <div class="info-value clamp-4">${hours}</div>
      </div>` : ""}

      <a href="${googleSearchUrl}" class="primary-button">
        🔍 Search for More Details
      </a>

      ${siteUrl ? `<a href="${siteUrl}" class="primary-button site-link">🌐 Visit website</a>` : ""}
    </div>

    <div class="tab-content" data-content="navigate">
      <div class="nav-info-top">Get directions from your current location:</div>
      <a class="nav-button google-maps" target="_blank" rel="noopener">
        📍 Directions via Google Maps
      </a>
      <a class="nav-button waze" target="_blank" rel="noopener">
        🚗 Directions via Waze
      </a>
      <div class="nav-info">Opens your preferred navigation app</div>
    </div>

    <div class="tab-content" data-content="feedback">
      <div class="feedback-block">
        <div class="feedback-emoji">💬</div>
        <h3 class="feedback-title">Help us improve!</h3>
        <p class="feedback-text">Found an issue? Have updates to share?</p>
        <a href="${feedbackUrl}" target="_blank" rel="noopener" class="primary-button feedback-submit">
          ✏️ Submit Feedback
        </a>
      </div>
    </div>
  </div>
`;
  

    container.innerHTML = html;
// Prevent popup UI clicks from triggering map clicks
["click", "mousedown", "mouseup", "touchstart", "touchend"].forEach(evt => {
  container.addEventListener(evt, (e) => {
    e.stopPropagation();
  }, { passive: false });
});

// Add static close button
const closeBtn = document.createElement("button");
closeBtn.className = "custom-close-btn";
closeBtn.textContent = "✕";
closeBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();  // ← CRITICAL: Stop event from bubbling
  console.log("✕ Close button clicked");
  view.popup.close();
  view.popup.clear();
  view.popup.visible = false;
});

container.appendChild(closeBtn);


    // Build nav links after DOM exists
    const { gmaps, waze } = buildNavLinks(feature.graphic, a);
    container.querySelector(".nav-button.google-maps")?.setAttribute("href", gmaps);
    container.querySelector(".nav-button.waze")?.setAttribute("href", waze);


// === Open same tab on mobile, new tab on desktop ===

const links = [
  container.querySelector(".nav-button.google-maps"),
  container.querySelector(".nav-button.waze"),
  // include this line if you want the search button too:
   container.querySelector('.primary-button[href*="google.com/search"]'),
  container.querySelector('.primary-button[href*="docs.google.com/forms"]'),
  container.querySelector('.site-link') // ← WEBSITE BUTTON
].filter(Boolean);

links.forEach((a) => {
  if (isMobile) {
    a.setAttribute("target", "_self");     // more reliable than removing
    a.removeAttribute("rel");
  } else {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener");
  }
});


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

    return container;
  },
  outFields: ["*"]
});


// -------- Popup behavior (valid docking; no duplicate title; compact desktop) --------
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

// Reapply layout on window resize
window.addEventListener("resize", () => {
  applyPopupLayout();
});

// Force popup to stay uncollapsed
view.popup.watch("collapsed", (collapsed) => {
  if (collapsed) view.popup.collapsed = false;
});

// Watch popup visibility to fix layout and z-index
view.popup.watch("visible", (visible) => {
  if (!visible) return;


  // On small screens, shift center upward to reveal popup
  if (view.widthBreakpoint === "xsmall") {
    setTimeout(() => {
      const center = view.center.clone();
      center.y += 0.15;
      view.goTo(center, { animate: false }).catch(() => {});
    }, 250);
  }

});

/*
view.popup.watch("visible", (visible) => {
  if (visible) {
    setTimeout(() => {
      const popupEl = document.querySelector(".esri-popup__main-container");
      if (popupEl && !popupEl.querySelector(".custom-close-btn")) {
        const closeBtn = document.createElement("button");
        closeBtn.className = "custom-close-btn";
        closeBtn.innerHTML = "✕";
       
        closeBtn.addEventListener("click", () => {
          view.popup.close();
        });
        popupEl.appendChild(closeBtn);
      }
    }, 100);
  }
});
*/

});




// -------- Optimized Location Tracking with Smart Movement Detection --------

// Animated radar style with colorful gradient rings (keep your symbol)
const locationSymbol = {
  type: "picture-marker",
  url: "data:image/svg+xml;base64," + btoa(`
    <svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="centerGrad">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#4285F4;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1967D2;stop-opacity:1" />
        </radialGradient>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#4285F4;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#34A853;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#4285F4;stop-opacity:1" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r="25" fill="none" stroke="url(#ringGrad)" stroke-width="3" opacity="0.3">
        <animate attributeName="r" from="12" to="35" dur="2.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="0.9" to="0" dur="2.5s" repeatCount="indefinite"/>
        <animate attributeName="stroke-width" from="4" to="1" dur="2.5s" repeatCount="indefinite"/>
      </circle>
      <circle cx="40" cy="40" r="18" fill="none" stroke="url(#ringGrad)" stroke-width="3" opacity="0.5">
        <animate attributeName="r" from="12" to="35" dur="2.5s" begin="0.6s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="0.9" to="0" dur="2.5s" begin="0.6s" repeatCount="indefinite"/>
        <animate attributeName="stroke-width" from="4" to="1" dur="2.5s" begin="0.6s" repeatCount="indefinite"/>
      </circle>
      <circle cx="40" cy="40" r="12" fill="none" stroke="url(#ringGrad)" stroke-width="3" opacity="0.7">
        <animate attributeName="r" from="12" to="35" dur="2.5s" begin="1.2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="0.9" to="0" dur="2.5s" begin="1.2s" repeatCount="indefinite"/>
        <animate attributeName="stroke-width" from="4" to="1" dur="2.5s" begin="1.2s" repeatCount="indefinite"/>
      </circle>
      <filter id="shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
      </filter>
      <circle cx="40" cy="40" r="12" fill="url(#centerGrad)" stroke="#fff" stroke-width="4" filter="url(#shadow)"/>
      <circle cx="40" cy="40" r="6" fill="#fff">
        <animate attributeName="r" from="5" to="7" dur="1s" repeatCount="indefinite" values="5;7;5" />
      </circle>
    </svg>
  `),
  width: "40px",
  height: "40px"
};

// Create graphics layer for location marker
const locationLayer = new GraphicsLayer({ title: "User Location", listMode: "hide" });
map.add(locationLayer);

// Location tracking state
let locationGraphic = null;
let tracking = false;
let lastPosition = null;
let hasInitiallyCentered = false;
let watchId = null;
let lastUpdateTs = 0;

// Throttle & distance filter knobs
const THROTTLE_MS  = 10000;  // ≥ 10s between accepted updates
const MIN_MOVE_M   = 10;     // ≥ 10 m movement required
const MAX_STALE_MS = 60000;  // force an update at least every 60s (even if not moving)

// Haversine distance in meters
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Update location marker (update geometry only; no map movement, no layer refresh)
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
    locationGraphic.geometry = point; // ← only geometry changes
  }

  lastPosition = { lat: latitude, lon: longitude };
  // console.log(`Location updated: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
}

// One-time fetch (no map movement unless first time)
function updateLocation(centerOnFirst = false) {
  if (!("geolocation" in navigator)) return;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      updateLocationMarker(latitude, longitude);

      // Center map only on first location in mobile
      if (centerOnFirst && !hasInitiallyCentered && DeviceInfo.isMobile()) {
        view.goTo({ center: [longitude, latitude], zoom: 15 }, { duration: 800, easing: "ease-in-out" })
          .then(() => { hasInitiallyCentered = true; })
          .catch(() => {});
      }
    },
    (err) => {
      // Handle errors from getCurrentPosition
      let errorMsg = "Location error";
      if (err.code === err.PERMISSION_DENIED) {
        errorMsg = "Location permission denied. Enable in Settings.";
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        errorMsg = "GPS signal unavailable. Try outdoors.";
      } else if (err.code === err.TIMEOUT) {
        errorMsg = "Location request timed out.";
      }
      console.warn("⚠️ " + errorMsg, err.message || err);
      showToast("⚠️ " + errorMsg);  // ← SHOW TO USER
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
  );
}

// Center map on current location (only when user clicks button)
function centerOnLocation() {
  if (!lastPosition) { updateLocation(); return; }
  view.goTo({
    center: [lastPosition.lon, lastPosition.lat],
    zoom: Math.max(view.zoom || 3, 15)
  }, { duration: 800, easing: "ease-in-out" }).catch(() => {});
}

// Start location tracking (watchPosition + throttle + distance filter)
// Marker updates only; map stays put unless user centers.
function startLocationTracking() {
  console.log("🔍 startLocationTracking() called");
  
  if (tracking) {
    console.warn("⚠️ Tracking already active");
    return;
  }
  
  if (!("geolocation" in navigator)) {
    console.error("❌ CRITICAL: Geolocation API not available in navigator");
    console.error("   Navigator keys:", Object.keys(navigator).filter(k => k.includes('geo')));
    showToast("⚠️ Location not supported on this device");
    return;
  }

  console.log("✅ Geolocation API found in navigator");
  console.log("✅ Starting location tracking...");
  tracking = true;
  locateBtn.classList.add("is-tracking");
  locateBtn.setAttribute("aria-pressed", "true");
  locateBtn.title = "Click to center / Long press to stop";

  // Get first fix immediately (center on first for mobile)
  console.log("📍 Calling updateLocation(true) for initial fix...");
  updateLocation(true);

  // Continuous updates via watchPosition
  console.log("👁️ Starting watchPosition...");
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      const now = Date.now();

      const timeOk  = (now - lastUpdateTs) >= THROTTLE_MS;
      const distOk  = !lastPosition || haversineMeters(lastPosition.lat, lastPosition.lon, latitude, longitude) >= MIN_MOVE_M;
      const staleOk = (now - lastUpdateTs) >= MAX_STALE_MS;

      if (timeOk && (distOk || staleOk)) {
        updateLocationMarker(latitude, longitude); // ← only marker moves
        lastUpdateTs = now;
        console.log(`✅ Location updated: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      } else {
        console.log(`ℹ️ GPS update ignored: timeOk=${timeOk}, distOk=${distOk}, staleOk=${staleOk}`);
      }
    },
    (err) => { 
      console.error("❌ watchPosition error, code:", err.code, "message:", err.message);
      let errorMsg = "Location error";
      if (err.code === err.PERMISSION_DENIED) {
        errorMsg = "Location permission denied. Enable in Settings.";
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        errorMsg = "GPS signal unavailable. Try outdoors with clear sky.";
      } else if (err.code === err.TIMEOUT) {
        errorMsg = "Location request timed out.";
      }
      console.warn("⚠️ " + errorMsg, err.message || err);
      showToast("⚠️ " + errorMsg);  // ← SHOW TO USER
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
  
  console.log("✅ watchPosition started, watchId:", watchId);
}

// Stop location tracking
function stopLocationTracking() {
  if (!tracking) return;

  tracking = false;
  locateBtn.classList.remove("is-tracking");
  locateBtn.setAttribute("aria-pressed", "false");
  locateBtn.title = "Show my location";

  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }

  // Optional: keep the marker visible after stopping. If you prefer to remove it, uncomment:
  // if (locationGraphic) { locationLayer.remove(locationGraphic); locationGraphic = null; }

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

// Debug: Log button element
console.log("🔘 Button created:", locateBtn);

// --- Long press state variable (MUST be before any listeners!) ---
let pressTimer = null;



// Button click handler - MAIN EVENT
locateBtn.addEventListener("click", (event) => {
  console.log("🔘 CLICK event fired!", event.type, event.target);
  event.preventDefault();
  event.stopPropagation();
  
  console.log("📍 tracking state:", tracking);
  if (!tracking) {
    console.log("📍 Starting location tracking from button click...");
    startLocationTracking();
  } else {
    console.log("🎯 Centering on current location...");
    centerOnLocation();
  }
}, false);

// Touch support for iOS - MERGED touchend handler
// Combines: tap detection + long-press clearing
locateBtn.addEventListener("touchend", (event) => {
  console.log("👆 TOUCHEND event fired!", event.type);
  event.preventDefault();
  event.stopPropagation();
  
  // Check if this was a long-press
  const wasLongPress = pressTimer !== null;
  
  // Clear the long-press timer
  clearTimeout(pressTimer);
  pressTimer = null;
  
  console.log("👆 TOUCHEND - wasLongPress:", wasLongPress);
  
  // If NOT a long-press, treat as normal tap
  if (!wasLongPress) {
    console.log("📍 Touch recognized as regular click (not long-press)");
    console.log("📍 tracking state:", tracking);
    if (!tracking) {
      console.log("📍 Starting location tracking from touch...");
      startLocationTracking();
    } else {
      console.log("🎯 Centering on current location from touch...");
      centerOnLocation();
    }
  } else {
    console.log("⏱️ Long-press detected - tracking already stopped");
  }
}, { passive: false });



// MOUSE handlers (desktop)
locateBtn.addEventListener("mousedown", (event) => {
  console.log("🖱️ MOUSEDOWN event fired");
  if (tracking) {
    pressTimer = setTimeout(() => {
      console.log("⏱️ Long press timeout - stopping tracking");
      stopLocationTracking();
    }, 1000);
  }
});

locateBtn.addEventListener("mouseup", () => {
  console.log("🖱️ MOUSEUP event fired");
  clearTimeout(pressTimer);
  pressTimer = null;
});

locateBtn.addEventListener("mouseleave", () => {
  console.log("🖱️ MOUSELEAVE event fired");
  clearTimeout(pressTimer);
  pressTimer = null;
});

// TOUCH handlers (iOS long-press detection)
locateBtn.addEventListener("touchstart", (event) => {
  console.log("👆 TOUCHSTART event fired");
  if (tracking) {
    pressTimer = setTimeout(() => {
      console.log("⏱️ Long touch timeout - stopping tracking");
      stopLocationTracking();
    }, 1000);
  }
}, { passive: true });

// Add button to UI
console.log("🔘 Adding button to view.ui...");
view.ui.add(locateBtn, { position: "bottom-right", index: 2 });
console.log("🔘 Button added to view.ui");

// Pause/resume watch when tab visibility changes (battery saver)
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

// Auto-start on mobile (respect permissions)
view.when(() => {
  console.log("✅ view.when() fired - checking location permissions");
  
  if (!DeviceInfo.isMobile() || !("geolocation" in navigator)) {
    console.log("⏭️ Skipping auto-start: mobile=" + DeviceInfo.isMobile() + ", geolocation=" + ("geolocation" in navigator));
    return;
  }

  console.log("🔍 Mobile device detected, checking permissions in 3.5 seconds...");
  
  setTimeout(() => {
    console.log("📍 Checking geolocation permissions (iOS 14+ compatible)...");
    
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "geolocation" })
        .then(result => {
          console.log("✅ Permission state query successful:", result.state);
          if (result.state === "granted") {
            console.log("✅ Permission granted - starting location tracking");
            startLocationTracking();
          } else if (result.state === "prompt") {
            console.log("🔔 Permission prompt - will prompt user on first location access");
            // Will prompt user when they tap button
          } else if (result.state === "denied") {
            console.log("❌ Location permission denied by user");
            showToast("⚠️ Location permission denied. Enable in Settings.");
          }
        })
        .catch((err) => {
          console.log("⚠️ Permissions API query failed, falling back to direct access:", err.message);
          // Fallback - don't auto-start, let user tap button
        });
    } else {
      console.log("ℹ️ Permissions API not available, will request on user tap");
    }
  }, 3500);  // ← INCREASED: 2500ms → 3500ms for iOS 14+ compatibility
});

// Make functions global if needed
window.startLocationTracking = startLocationTracking;
window.updateLocation = updateLocation;
window.centerOnLocation = centerOnLocation;


  // -------- Other UI widgets --------
  view.ui.add(new Zoom({ view }), { position: "bottom-right", index: 0 });
  view.ui.add(new Home({ view }), { position: "bottom-right", index: 1 });


/* === Basemap control: Toggle on mobile, Gallery on desktop === */
function mountBasemapControl() {
  const isMobile = DeviceInfo.isMobile();

  // remove existing control cleanly
  if (window.__bmControl) {
    view.ui.remove(window.__bmControl);
    // destroy inner content if it was an Expand (desktop)
    window.__bmControl.content?.destroy?.();
    window.__bmControl.destroy?.();
    window.__bmControl = null;
  }

  if (isMobile) {
    // Mobile: simple toggle (topo-vector ↔ satellite)
    const toggle = new BasemapToggle({
      view,
      nextBasemap: "satellite"   // change to "hybrid" if you want labels
    });
    view.ui.add(toggle, { position: "bottom-left", index: 0 });
   // mark it as "mobile" so CSS can target it
   toggle.when(() => toggle.container?.classList.add("bm-toggle--mobile"));

    window.__bmControl = toggle;

  } else {
    // Desktop: full gallery in an Expand
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

// mount once and also on resize (debounced)
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
    allPlaceholder: "Find a landmark or address..."
  });
// Disable popup opening from search results
search.popupEnabled = false;

search.resultGraphicEnabled = false;


  // -------- Renderer --------
  const globalRenderer = new UniqueValueRenderer({
    field: "main_category",
    defaultSymbol: { type: "simple-marker", style: "circle", size: 7, color: "#888", outline: { color: "#fff", width: 1 } },
    uniqueValueInfos: [
      { value: "Highlights",        symbol: { type: "simple-marker", style: "circle", size: 7, color: "#f39c12", outline: { color: "#fff", width: 1 } } },
      { value: "Synagogue",         symbol: { type: "simple-marker", style: "circle", size: 7, color: "#5DADE2", outline: { color: "#fff", width: 1 } } },
      { value: "Heritage",          symbol: { type: "simple-marker", style: "circle", size: 7, color: "#EC7063", outline: { color: "#fff", width: 1 } } },
      { value: "Kosher Restaurant", symbol: { type: "simple-marker", style: "circle", size: 7, color: "#58D68D", outline: { color: "#fff", width: 1 } } },
      { value: "Community",         symbol: { type: "simple-marker", style: "circle", size: 7, color: "#8b5cf6", outline: { color: "#fff", width: 1 } } }
    ]
  });

  // -------- Layers --------
  const ZOOM_THRESHOLD = 8;
  let dynamicLayer = null;
  let currentFilter = "";

  const globalLayer = new FeatureLayer({
    url: window.LANDMARKS_SERVICE_URL,
    outFields: ["*"],
    popupTemplate: createPopupTemplate(),
    renderer: globalRenderer
  });
  map.add(globalLayer);

  // ensure projection is loaded before we project extents
  projection.load().catch(console.error);



function getQueryExtent(extent) {
  // Do NOT shrink when zoomed in close
  if (view.zoom >= 13) return extent;

  // Shrink only on medium/large extents
  const factor = 0.7;
  const dx = (extent.xmax - extent.xmin) * (1 - factor) / 2;
  const dy = (extent.ymax - extent.ymin) * (1 - factor) / 2;

  return {
    xmin: extent.xmin + dx,
    ymin: extent.ymin + dy,
    xmax: extent.xmax - dx,
    ymax: extent.ymax - dy,
    spatialReference: extent.spatialReference
  };
}



async function loadDynamicPoints(maxPoints) {
  try {
    const extent = view.extent;
    const wgs84Extent = projection.project(extent, new SpatialReference({ wkid: 4326 }));

// shrink the extent to reduce request size
const queryExtent = getQueryExtent(wgs84Extent);

const geometryObj = {
  xmin: queryExtent.xmin,
  ymin: queryExtent.ymin,
  xmax: queryExtent.xmax,
  ymax: queryExtent.ymax,
  spatialReference: { wkid: 4326 }
};

    const requestBody = new URLSearchParams({
      f: "json",
      where: "1=1",
      outFields: "name,category,address,city,description,fees_opening_hours,photo,id,ObjectId,website,main_category",

      geometry: JSON.stringify(geometryObj),
      geometryType: "esriGeometryEnvelope",
      spatialRel: "esriSpatialRelIntersects",
      returnGeometry: "true",
      resultRecordCount: maxPoints,       // 👈 CONTROL HERE
      maxRecordCount: maxPoints           // 👈 ALSO HERE TO BE SAFE
    });

    const response = await fetch(window.LANDMARKS_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: requestBody
    });

    if (!response.ok) throw new Error("HTTP " + response.status);

    const data = await response.json();
    return data.features || [];

  } catch (err) {
    console.error("Error loading dynamic points:", err);
    return [];
  }
}

  function getSymbolForCategory(category) {
    const symbolMap = {
      "Featured":          { type: "simple-marker", style: "circle", size: 7, color: "#f39c12", outline: { color: "#fff", width: 1 } },
      "Synagogue":         { type: "simple-marker", style: "circle", size: 7, color: "#5DADE2", outline: { color: "#fff", width: 1 } },
      "Heritage":          { type: "simple-marker", style: "circle", size: 7, color: "#EC7063", outline: { color: "#fff", width: 1 } },
      "Kosher Restaurant": { type: "simple-marker", style: "circle", size: 7, color: "#58D68D", outline: { color: "#fff", width: 1 } },
      "Community":         { type: "simple-marker", style: "circle", size: 7, color: "#8b5cf6", outline: { color: "#fff", width: 1 } }
    };
    return symbolMap[category] || { type: "simple-marker", style: "circle", size: 7, color: "#888", outline: { color: "#fff", width: 1 } };
  }

  async function createDynamicLayer(features) {
    if (dynamicLayer) { map.remove(dynamicLayer); dynamicLayer = null; }
    if (!features.length) return;

    dynamicLayer = new GraphicsLayer({ title: "Dynamic Landmarks" });
    const graphics = features.map((f) => new Graphic({
      geometry: new Point({ x: f.geometry.x, y: f.geometry.y, spatialReference: view.spatialReference }),
      attributes: f.attributes,
      symbol: getSymbolForCategory(f.attributes.main_category),
      popupTemplate: createPopupTemplate()
    }));
    dynamicLayer.addMany(graphics);
    if (currentFilter) applyFilterToGraphicsLayer(dynamicLayer, currentFilter);
    map.add(dynamicLayer);
  }
function applyFilterToGraphicsLayer(layer, category) {
  if (!layer || !layer.graphics) return;
  layer.graphics.forEach((g) => {
    g.visible = !category || g.attributes.main_category === category;
  });
}

let loadingDynamic = false;
let dynamicReady = true; 




// ===== IMPROVED: Extent-key anti-spam system =====
let lastDynZoom = null;
let lastDynKey = null;
let dynTimer = null;
let lastDynLoadTime = 0;           // ← NEW: throttle successive loads
const MIN_LOAD_INTERVAL = 2000;     // ← NEW: wait 2s between loads

function getExtentKey(extent) {
  const decimals = DeviceInfo.isMobile() ? 0 : 2;  // ← CHANGED: 0 decimals for mobile (much coarser)
  const multiplier = Math.pow(10, decimals);
  
  return [
    Math.round(extent.xmin * multiplier) / multiplier,
    Math.round(extent.ymin * multiplier) / multiplier,
    Math.round(extent.xmax * multiplier) / multiplier,
    Math.round(extent.ymax * multiplier) / multiplier
  ].join(",");
}


/// Unified dynamic loader
async function loadDynamicForView() {
  // NOTE: Do NOT set dynamicReady=false here
  // Clicks should work even while layer is loading
  // loadingDynamic controls the load process only

  const zoomLevel = view.zoom;
  let maxPoints = 0;

  // Mobile gets fewer points for faster hitTest & rendering
  if (DeviceInfo.isMobile()) {
    if (zoomLevel >= 13) maxPoints = 150;  // ← Reduced from 300
    else if (zoomLevel >= 10) maxPoints = 100;  // ← Reduced from 200
    else if (zoomLevel >= 8) maxPoints = 50;   // ← Reduced from 100
  } else {
    // Desktop can handle more features
    if (zoomLevel >= 13) maxPoints = 300;
    else if (zoomLevel >= 10) maxPoints = 200;
    else if (zoomLevel >= 8) maxPoints = 100;
  }

  if (maxPoints === 0) {
    if (dynamicLayer) {
      map.remove(dynamicLayer);
      dynamicLayer = null;
    }
    return;
  }

  if (loadingDynamic) {
    return;  // Already loading, skip
  }
  loadingDynamic = true;

  try {
    const features = await loadDynamicPoints(maxPoints);
    await createDynamicLayer(features);

    // Re-apply filter AFTER dynamic layer loads
    if (currentFilter) {
      applyFilterToGraphicsLayer(dynamicLayer, currentFilter);
    }
    
    lastDynLoadTime = Date.now();  // ← NEW: record load time

  } catch (e) {
    console.error("Dynamic load error:", e);

  } finally {
    loadingDynamic = false;
    // NOTE: dynamicReady is no longer used in click handler
    // Clicks work regardless of load state
  }
}
// new code 041225
// ============================================================
// MAPBOX-STYLE THROTTLE FOR DYNAMIC LAYER LOADING
// ============================================================



let lastExtentCenter = null;
let lastExtentZoom = null;
let settleTimer = null;



function needsReload(extent, zoom) {
  const cx = (extent.xmin + extent.xmax) / 2;
  const cy = (extent.ymin + extent.ymax) / 2;

  // First time → always reload
  if (!lastExtentCenter) {
    lastExtentCenter = { cx, cy };
    lastExtentZoom = zoom;
    return true;
  }

  // Zoom changed → reload
  if (zoom !== lastExtentZoom) {
    lastExtentZoom = zoom;
    lastExtentCenter = { cx, cy };
    return true;
  }

  // Movement threshold = 5% of screen width
  const dx = Math.abs(cx - lastExtentCenter.cx);
  const dy = Math.abs(cy - lastExtentCenter.cy);
  const threshold = (extent.xmax - extent.xmin) * 0.01;

  if (dx > threshold || dy > threshold) {
    lastExtentCenter = { cx, cy };
    return true;
  }

  return false;
}


view.watch("extent", () => {
  clearTimeout(settleTimer);

  // Wait for user to finish moving the map
  settleTimer = setTimeout(() => {
    // Skip if map is still moving (inertia)
    if (view.interacting || view.animating) return;

    // Only reload if enough movement or zoom change
    if (!needsReload(view.extent, view.zoom)) return;

    // Load now
    loadDynamicForView();
  }, 150);
});


/// === MOBILE-SAFE POPUP OPENING FUNCTION ===
// ✅ FIX: Add this BEFORE the click handler
async function openPopupSafely(features, location) {
  if (!features || !Array.isArray(features) || features.length === 0) {
    console.warn("⚠️ No features to display");
    return;
  }

  // Step 1: Just open directly - duplicate prevention handles the rest
  console.log("📂 Opening popup with", features.length, "feature(s)");
  view.popup.open({
    features,
    location
  });

  // Step 2: Force visible (iOS quirk)
  setTimeout(() => { view.popup.visible = true; }, 20);
  console.log("✅ Popup opened successfully");
}

/// === MOBILE-SAFE CLICK HANDLER ===
// ✅ FIX: Changed "click" to "immediate-click"
// ✅ FIX: Added debounce and hitTest timeout

// Prevent duplicate popups on same feature
let lastPopupId = null;
let lastPopupTime = 0;

let lastClickTime = 0;
let hitTestPending = false;

view.on("immediate-click", async (event) => {
  try {
    // ✅ FIX #1: Debounce rapid clicks
    const now = Date.now();
    if (now - lastClickTime < 300 || hitTestPending) {
      console.log("⏭️ Click ignored - debounce");
      return;
    }
    lastClickTime = now;
    hitTestPending = true;

    console.log(`📍 Click event at ${event.mapPoint.x.toFixed(4)}, ${event.mapPoint.y.toFixed(4)}`);

    // Larger tolerance on mobile (fingers are bigger than cursors!)
    const tolerance = DeviceInfo.isMobile() ? 22 : 12;
    console.log(`🎯 hitTest tolerance: ${tolerance}px (mobile: ${DeviceInfo.isMobile()})`);
    
    // ✅ FIX #2: Add hitTest timeout
    const startTime = Date.now();
    const { results } = await Promise.race([
      view.hitTest(event, { tolerance }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('hitTest timeout')), 1000)
      )
    ]).catch(() => {
      console.warn("⚠️ hitTest timed out");
      return { results: [] };
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ hitTest completed in ${duration}ms with ${results.length} hits`);

    // ✅ FIX #3 & #4: Use safe popup opening function
    // Try dynamic layer first
    if (dynamicLayer) {
      const hit = results.find(r => r.graphic?.layer === dynamicLayer);
      if (hit?.graphic) {
        const hitGraphic = hit.graphic;
        
        // Prevent double-popup on same feature within 500ms (iOS synthetic clicks at 410-480ms)
        const now2 = Date.now();
        if (lastPopupId === hitGraphic.attributes.id && (now2 - lastPopupTime) < 500) {
          console.log("⏭️ Duplicate popup suppressed (dynamic layer)");
          return;
        }
        lastPopupId = hitGraphic.attributes.id;
        lastPopupTime = now2;
        
        console.log("✅ Found dynamic layer graphic");
        await openPopupSafely([hitGraphic], event.mapPoint);
        return;
      }
    }

    // Fallback to global layer
    const globalHit = results.find(r => r.graphic?.layer === globalLayer);
    if (globalHit?.graphic) {
      const hitGraphic = globalHit.graphic;
      
      // Prevent double-popup on same feature within 500ms (iOS synthetic clicks at 410-480ms)
      const now2 = Date.now();
      if (lastPopupId === hitGraphic.attributes.id && (now2 - lastPopupTime) < 500) {
        console.log("⏭️ Duplicate popup suppressed (global layer)");
        return;
      }
      lastPopupId = hitGraphic.attributes.id;
      lastPopupTime = now2;
      
      console.log("✅ Found global layer graphic");
      await openPopupSafely([hitGraphic], event.mapPoint);
    } else {
      console.log("❌ No hits found (tried both layers)");
    }

  } catch (error) {
    console.error("❌ Error handling click:", error);
  } finally {
    // ✅ FIX #5: Use finally block to ensure hitTestPending resets
    hitTestPending = false;
  }
});

  // -------- Filters UI (render + wire) --------
  const filterDiv = document.getElementById("filterContainer");
  if (!filterDiv) console.warn("[filters] #filterContainer not found");
  const categories = [
    { name: "All",          cat: "" },
    { name: "Highlight",    cat: "Highlights" },
    { name: "Synagogues",   cat: "Synagogue" },
    { name: "Heritage",     cat: "Heritage" },
    { name: "Kosher Food",  cat: "Kosher Restaurant" },
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

    const wireFilters = () => {
      const buttons = filterDiv.querySelectorAll(".filterBtn");
      buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const cat = btn.dataset.cat || "";
          currentFilter = cat;

          // server-side filter
          globalLayer.definitionExpression = cat ? `main_category='${cat.replace(/'/g, "''")}'` : "";

          // client-side filter
          if (dynamicLayer) applyFilterToGraphicsLayer(dynamicLayer, cat);

          // UI state
          buttons.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          filterDiv.classList.toggle("filtered", !!cat);

clearTimeout(dynTimer);
dynTimer = setTimeout(() => {
  loadDynamicForView();
}, 600);

        });
      });
    };
    wireFilters();
  }

  // global layer → search + zoom
  globalLayer.when(() => {
    view.goTo(globalLayer.fullExtent).catch(console.error);
    search.sources.unshift({
      layer: globalLayer,
      searchFields: ["eng_name"],
      displayField: "eng_name",
      exactMatch: false,
      outFields: ["*"],
      name: "Jewish Landmarks",
      placeholder: "e.g., Mikveh Israel"
    });
  });
});

// ---- Wire header buttons ----
document.addEventListener("DOMContentLoaded", () => {
  const wire = (id, href, label) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (label) el.textContent = label;
    if (el.tagName.toLowerCase() === "a") el.setAttribute("href", href);
    else el.addEventListener("click", () => { window.location.href = href; });
  };
  wire("uploadBtn", "upload.html", "Upload Your Site");
  wire("wallBtn", "wall.html", "The Wall");
  wire("aboutBtn", "about.html", "About");
});