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
  "esri/widgets/Home",
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

    function buildNavLinks(graphic, attrs) {
      const pt = GeoUtils.getPointFromGeometry(graphic.geometry);
      const [lat, lon] = GeoUtils.toLatLon(pt);
      const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);

      const label = GeoUtils.buildLabel([
        attrs.name,
        attrs.Address || attrs.address,
        attrs.city
      ]) || "Destination";

      const encLabel = encodeURIComponent(label);

      const gmaps = hasCoords
        ? `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${lat.toFixed(6)},${lon.toFixed(6)}&travelmode=driving`
        : `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${encLabel}&travelmode=driving`;

      const waze = hasCoords
        ? `https://waze.com/ul?ll=${lat.toFixed(6)},${lon.toFixed(6)}&navigate=yes&z=16`
        : `https://waze.com/ul?q=${encLabel}&navigate=yes&z=16`;

      return { gmaps, waze };
    }

    const a = feature.graphic.attributes || {};
    const name = a.name || "Location";
    const category = a.category || a.main_category || "Place";
    const address = a.address || "";
    const city = a.city || "";
    const fullAddress =
      (address && city && address.includes(city))
        ? address
        : [address, city].filter(Boolean).join(", ") || "Not available";

    const description = a.description || "";
    const hours = a.fees_opening_hours || "";
    const photo = a.photo || "";
    const id = a.id || a.OBJECTID || "";

    function normalizeUrl(u){
      if (!u) return "";
      const s = String(u).trim();
      return /^https?:\/\//i.test(s) ? s : `https://${s}`;
    }
    const siteUrl = normalizeUrl(a.website || a.Website || a.link || "");

    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent([name, category, fullAddress].filter(Boolean).join(" "))}`;
    const feedbackUrl = `https://docs.google.com/forms/d/e/1FAIpQLSeVWy9b_hWAk2qjTvabxsuQl-Lr1ewUY4CRVT6kTQGt7egSag/viewform?usp=pp_url&entry.1424782895=${encodeURIComponent(id)}`;

    const container = document.createElement("div");
    container.className = "enhanced-popup-container";

    let html = ``;

    if (photo && photo.trim()) {
      html += `
        <div class="popup-image"
          style="background-image:url('${photo.replace(/'/g, "&#39;")}')"></div>
      `;
    }

    html += `<h2 class="popup-title">${name}</h2>`;

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

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.className = "custom-close-btn";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.popup.close();
      view.popup.clear();
      view.popup.visible = false;
    });
    container.appendChild(closeBtn);

    // Build nav links
    const { gmaps, waze } = buildNavLinks(feature.graphic, a);
    container.querySelector(".nav-button.google-maps")?.setAttribute("href", gmaps);
    container.querySelector(".nav-button.waze")?.setAttribute("href", waze);

    // Open same tab on mobile, new tab on desktop
    const links = [
      container.querySelector(".nav-button.google-maps"),
      container.querySelector(".nav-button.waze"),
      container.querySelector('.primary-button[href*="google.com/search"]'),
      container.querySelector('.primary-button[href*="docs.google.com/forms"]'),
      container.querySelector('.site-link')
    ].filter(Boolean);

    links.forEach((a) => {
      if (isMobile) {
        a.setAttribute("target", "_self");
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
        view.goTo({ center: [longitude, latitude], zoom: 14 }, { duration: 800, easing: "ease-in-out" })
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
  if (!lastPosition) { updateLocation(); return; }
  view.goTo({
    center: [lastPosition.lon, lastPosition.lat],
    zoom: Math.max(view.zoom || 3, 15)
  }, { duration: 800, easing: "ease-in-out" }).catch(() => {});
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
  
  const wasLongPress = pressTimer !== null;
  clearTimeout(pressTimer);
  pressTimer = null;
  
  if (!wasLongPress) {
    if (!tracking) {
      startLocationTracking();
    } else {
      centerOnLocation();
    }
  }
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
    pressTimer = setTimeout(() => {
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

// Auto-start on mobile
view.when(() => {
  if (!DeviceInfo.isMobile() || !("geolocation" in navigator)) return;

  setTimeout(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "geolocation" })
        .then(result => {
          if (result.state === "granted") {
            startLocationTracking();
          } else if (result.state === "denied") {
            showToast("⚠️ Location permission denied. Enable in Settings.");
          }
        })
        .catch(() => {});
    }
  }, 3500);
});

window.startLocationTracking = startLocationTracking;
window.updateLocation = updateLocation;
window.centerOnLocation = centerOnLocation;


  // -------- Other UI widgets --------
  view.ui.add(new Zoom({ view }), { position: "bottom-right", index: 0 });
  view.ui.add(new Home({ view }), { position: "bottom-right", index: 1 });


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
    allPlaceholder: "Search a landmark or address..."
  });
  search.popupEnabled = false;
  search.resultGraphicEnabled = false;


  // -------- Renderer --------
  const globalRenderer = new UniqueValueRenderer({
    field: "main_category",
    defaultSymbol: { type: "simple-marker", style: "circle", size: 7, color: "#888", outline: { color: "#fff", width: 1 } },
    visualVariables: [{
      type: "size",
      valueExpression: "$view.scale",
      stops: [
        { scale: 591657527, size: 3 },
        { scale: 144447,    size: 5 },
        { scale: 18055,     size: 8 }
      ]
    }],
    uniqueValueInfos: [
      { value: "Synagogue",         symbol: { type: "simple-marker", style: "circle", color: "#5DADE2", outline: { color: "#fff", width: 1 } } },
      { value: "Heritage",          symbol: { type: "simple-marker", style: "circle", color: "#EC7063", outline: { color: "#fff", width: 1 } } },
      { value: "Kosher Restaurant", symbol: { type: "simple-marker", style: "circle", color: "#58D68D", outline: { color: "#fff", width: 1 } } },
      { value: "Community",         symbol: { type: "simple-marker", style: "circle", color: "#8b5cf6", outline: { color: "#fff", width: 1 } } }
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
          { value: "Community",         symbol: { type: "simple-marker", style: "circle", size: 24, color: [139, 92, 246, 0.75],  outline: { color: "#fff", width: 1.5 } } }
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
// WELCOME POPUP – Bilingual (EN / HE)
// ========================================
view.when(() => {
  if (localStorage.getItem("ja_welcome_dismissed") === "1") return;

  const isMobile = window.matchMedia("(max-width: 640px)").matches;

  // ---------- Language detection ----------
  const langs = navigator.languages?.length
    ? navigator.languages
    : [navigator.language || ""];
  const isHebrew = langs.some((l) => String(l).toLowerCase().startsWith("he"));

  // ---------- Copy ----------
  const t = isHebrew
    ? {
        dir: "rtl",
        align: "right",
        closeSide: "left",
        title: "ברוכים הבאים לאטלס היהודי",
        subtitle: "המפה שמחברת עבר, הווה ועתיד — אלפי אתרי מורשת יהודית במקום אחד.",
        tips: [
          "הגדילו את המפה כדי לגלות אתרים",
          "סננו לפי קטגוריה: בתי כנסת · מורשת · אוכל כשר · קהילה",
          "חפשו עיר או יעד כדי להתחיל לתכנן ביקור",
        ],
        cta: "המפה",
        brick: "הקדישו לבנה",
        upload: "הוסיפו אתר למפה",
        hint: "",
        tagline: "שומרים על הזיכרון. בונים את המפה.",
        dontShow: "אל תציגו שוב",
      }
    : {
        dir: "ltr",
        align: "left",
        closeSide: "right",
        title: "Welcome to The Jewish Atlas",
        subtitle:
          "Explore thousands of Jewish heritage sites around the world — and plan your next visit.",
        tips: [
          "🗺️ Zoom in anywhere to discover sites nearby",
          "🗂️ Filter by category: synagogues · heritage · kosher food · community",
          "🔍 Search any city to start planning your trip",
        ],
        cta: "Start Exploring",
        brick: "Dedicate a Brick",
        upload: "Upload a Site",
        hint: isMobile ? "" : `<span style="color:#999; font-weight:400;"> — help us grow</span>`,
        tagline: "Preserve memory. Build the map.",
        dontShow: "Don't show this again",
      };

  // ---------- Overlay ----------
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,0.35);
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 280ms ease;
    padding: 16px;
  `;

  // ---------- Card ----------
  const card = document.createElement("div");
  card.style.cssText = `
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.18);
    padding: ${isMobile ? "24px 20px 18px" : "36px 40px 28px"};
    max-width: ${isMobile ? "360px" : "460px"};
    width: 100%;
    position: relative;
    text-align: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    direction: ${t.dir};
    transform: scale(0.96);
    opacity: 0;
    transition: transform 280ms ease, opacity 280ms ease;
    max-height: 85vh;
    overflow: auto;
  `;

  // ---------- Build tips HTML ----------
  const tipPadSide = t.dir === "rtl" ? "right" : "left";

  const tipsHtml = t.tips
    .map(
      (tip) =>
        `<li style="margin-bottom: 8px; padding-${tipPadSide}: 4px;">${tip}</li>`
    )
    .join("");

  // ---------- Card content ----------
  card.innerHTML = `
    <button id="welcomeClose" style="
      position: absolute; top: 6px; ${t.closeSide}: 6px;
      background: none; border: none;
      min-width: 44px; min-height: 44px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; color: #999; cursor: pointer;
      border-radius: 10px;
    " aria-label="Close" type="button">✕</button>

    <h2 style="
      margin: 0 0 8px;
      font-size: ${isMobile ? "20px" : "23px"};
      font-weight: 700;
      color: #1a1a1a;
    ">${t.title}</h2>

    <p style="
      margin: 0 0 18px;
      font-size: ${isMobile ? "13.5px" : "14.5px"};
      color: #555;
      line-height: 1.55;
    ">${t.subtitle}</p>

    <ul style="
      list-style: none;
      padding: 0;
      margin: 0 0 22px;
      text-align: ${t.align};
      font-size: ${isMobile ? "13px" : "14px"};
      color: #444;
      line-height: 1.65;
    ">${tipsHtml}</ul>

    <button id="welcomeExplore" style="
      display: block;
      width: 100%;
      padding: ${isMobile ? "15px 0" : "13px 0"};
      min-height: 44px;
      background: #3b5998;
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      margin-bottom: 14px;
      transition: background 200ms ease;
    " type="button">${t.cta}</button>

    <div style="
      font-size: 13px;
      margin-bottom: 14px;
      color: #3b5998;
      line-height: 1.5;
    ">
      <a href="/wall.html" style="color:#3b5998; text-decoration:none; font-weight:600;">${t.brick}</a>
      <span style="color:#ccc; margin: 0 8px;">·</span>
      <a href="/upload.html" style="color:#3b5998; text-decoration:none; font-weight:600;">${t.upload}</a>
      ${t.hint}
    </div>

    <p style="
      margin: 0 0 14px;
      font-size: 12.5px;
      color: #888;
      font-style: italic;
      letter-spacing: 0.2px;
    ">${t.tagline}</p>

    <label style="
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-size: 12.5px;
      color: #999;
      cursor: pointer;
      padding: 8px 0;
      user-select: none;
    ">
      <input type="checkbox" id="welcomeDontShow"
        style="width: 18px; height: 18px; accent-color: #3b5998; cursor: pointer;">
      ${t.dontShow}
    </label>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // ---------- Animate in ----------
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      card.style.transform = "scale(1)";
      card.style.opacity = "1";
    });
  });

  // ---------- Close logic ----------
  function closeWelcome() {
    if (card.querySelector("#welcomeDontShow")?.checked) {
      localStorage.setItem("ja_welcome_dismissed", "1");
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

  // Hover effect only on hover-capable devices
  if (window.matchMedia("(hover: hover)").matches) {
    const btn = card.querySelector("#welcomeExplore");
    btn.addEventListener("mouseenter", () => (btn.style.background = "#2d4373"));
    btn.addEventListener("mouseleave", () => (btn.style.background = "#3b5998"));
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

      // Check globalLayer only
      const hit = results.find(r => r.graphic?.layer === globalLayer);
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

  // global layer → search + zoom
  globalLayer.when(() => {
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