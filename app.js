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

// -------- Map & View -------- 
const map = new Map({ basemap: "topo-vector" });

const view = new MapView({
  container: "viewDiv",
  map,
  center: [15, 52],
  zoom: 5.5,
  ui: { components: [] }
});

// keep UI clear of header
const headerH = document.getElementById('appHeader')?.offsetHeight || 95;
view.padding = { top: headerH };
window.addEventListener('resize', () => {
  const h = document.getElementById('appHeader')?.offsetHeight || 95;
  view.padding = { ...view.padding, top: h };
});

// -------- Popup Template: compact desktop, full mobile, working Google Maps + Waze --------
const createPopupTemplate = () => ({
  title: "{eng_name}", // use ArcGIS header title on desktop
  content: function (feature) {
    // --- helpers ---
    function isWebMercatorWkid(wkid) {
      return wkid === 3857 || wkid === 102100 || wkid === 102113 || wkid === 900913;
    }
    function getPointFromGeometry(geom) {
      if (!geom) return null;
      if (geom.type === "point") return geom;
      if (geom.extent?.center) return geom.extent.center;
      if (geom.centroid) return geom.centroid;
      return null;
    }
    function toLatLon(point) {
      if (!point) return [null, null];
      const wkid = point.spatialReference?.wkid;
      if (wkid === 4326) return [Number(point.y), Number(point.x)];
      if (isWebMercatorWkid(wkid)) {
        const lon = point.x * 180 / 20037508.34;
        const latRad = point.y * Math.PI / 20037508.34;
        const lat = (180 / Math.PI) * (2 * Math.atan(Math.exp(latRad)) - Math.PI / 2);
        return [lat, lon];
      }
      return [Number(point.y), Number(point.x)];
    }
    function buildLabel(a) {
      return [a.eng_name, a.Address, a.city].filter(Boolean).join(", ");
    }
    function buildNavLinks(graphic, attrs) {
  // ----- get destination (lat,lon in WGS84) -----
  function isWM(wkid){ return wkid===3857 || wkid===102100 || wkid===102113 || wkid===900913; }
  function getPoint(g){ if (!g) return null; if (g.type==="point") return g; if (g.extent?.center) return g.extent.center; return g.centroid || null; }
  const pt = getPoint(graphic.geometry);

  let lat=null, lon=null;
  if (pt) {
    const wkid = pt.spatialReference?.wkid;
    if (wkid === 4326) { lat = Number(pt.y); lon = Number(pt.x); }
    else if (isWM(wkid)) {
      lon = pt.x * 180 / 20037508.34;
      const yRad = pt.y * Math.PI / 20037508.34;
      lat = (180/Math.PI) * (2 * Math.atan(Math.exp(yRad)) - Math.PI/2);
    } else { lat = Number(pt.y); lon = Number(pt.x); } // best effort
  }
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);

  // ----- build a clean label as fallback -----
  const label = [attrs.eng_name, attrs.Address, attrs.city].filter(Boolean).join(", ") || "Destination";
  const encLabel = encodeURIComponent(label);

  // ----- Google Maps (universal) -----
  const gmaps = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${lat.toFixed(6)},${lon.toFixed(6)}&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${encLabel}&travelmode=driving`;

  // ----- Waze (use HTTPS universal link everywhere) -----
  // Works on iOS/Android/desktop and avoids the "black screen" from the custom scheme.
  const waze = hasCoords
    ? `https://waze.com/ul?ll=${lat.toFixed(6)},${lon.toFixed(6)}&navigate=yes&z=16`
    : `https://waze.com/ul?q=${encLabel}&navigate=yes&z=16`;

  return { gmaps, waze };
}


    // Attributes
    const a = feature.graphic.attributes || {};
    const name = a.eng_name || "Location";
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
    let html = `
      <style>
        /* Remove default action bar to save space */
        .esri-popup__actions { display: none !important; }
        /* Trim default padding and avoid horizontal scroll */
        .esri-popup__content { padding: 0 !important; overflow-x: hidden !important; }

        /* Desktop: show ArcGIS header, hide our large photo/title, compact width, keep tabs visible */
        @media (min-width: 769px) {
          .esri-popup__main-container { width: 560px !important; max-width: 560px !important; border-radius: 12px !important; }
          .show-on-mobile { display: none !important; }
          .enhanced-popup-container { width: 100%; }
          .popup-category { padding: 8px 16px 8px; }
          .category-badge { font-size: 11px; padding: 3px 10px; }
          .popup-tabs { position: sticky; top: 0; z-index: 1; }
          .popup-content-wrapper { max-height: 56vh; overflow: auto; -webkit-overflow-scrolling: touch; }
          .tab-button { font-size: 14px; padding: 10px 12px; }
          .info-value { font-size: 14px; }
          /* Clamp long text so user sees some content without scrolling forever */
          .clamp-4 { display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
        }

        /* Mobile: hide ArcGIS header, use our photo/title block full width */
        @media (max-width: 768px) {
          .esri-popup__header { display: none !important; }
          .esri-popup__main-container { width: 100vw !important; max-width: 100vw !important; border-radius: 12px 12px 0 0 !important; }
          .esri-popup__content { max-height: calc(100vh - 120px) !important; overflow:auto !important; }
        }

        /* Common UI */
        .popup-image { width: 100%; height: 190px; background-size: cover; background-position: center; position: relative; }
        .popup-image-overlay { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,.7), transparent); padding: 16px; }
        .popup-image-title { color: #fff; font-size: 20px; font-weight: 700; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,.4); }
        .mobile-title { padding: 12px 16px; }
        .popup-title { color: #2C3E50; font-size: 20px; font-weight: 600; margin: 0; }
        .popup-category { padding: 0 16px 8px; }
        .category-badge { display: inline-block; background: #eef5ff; color: #3367d6; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: .4px; }
        .popup-tabs { display: flex; background: #F8F9FA; border-top: 1px solid #E9ECEF; border-bottom: 1px solid #E9ECEF; }
        .tab-button { flex: 1; background: transparent; border: none; padding: 12px 16px; cursor: pointer; font-weight: 600; font-size: 14px; color: #6C757D; border-bottom: 3px solid transparent; transition: .2s; }
        .tab-button:hover { background: #F2F4F6; }
        .tab-button.active { background: #fff; color: #2C3E50; border-bottom-color: #4575B4; }
        .tab-content { display: none; padding: 16px; }
        .tab-content.active { display: block; }
        .info-section { margin-bottom: 12px; }
        .info-label { color: #7F8C8D; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; margin-bottom: 6px; }
        .info-value { color: #2C3E50; font-size: 15px; line-height: 1.45; }
        .primary-button { display: block; background: #4575B4; color: #fff; text-decoration: none; padding: 12px; border-radius: 8px; text-align: center; font-weight: 600; font-size: 15px; margin-top: 12px; box-shadow: 0 2px 8px rgba(69,117,180,.25); }
        .nav-button { display: block; color: #fff; text-decoration: none; padding: 14px; border-radius: 10px; font-weight: 600; font-size: 16px; text-align: center; margin-bottom: 10px; }
        .nav-button.google-maps { background: #34A853; box-shadow: 0 3px 10px rgba(52,168,83,.3); }
        .nav-button.waze { background: #33CCFF; box-shadow: 0 3px 10px rgba(51,204,255,.3); }
        .nav-info { margin-top: 14px; padding-top: 12px; border-top: 1px solid #E9ECEF; text-align: center; color: #6C757D; font-size: 13px; }
      </style>
    `;

    // Mobile-only photo + title (avoid duplicate title on desktop)
    if (photo && photo.trim()) {
      html += `
        <div class="popup-image show-on-mobile" style="background-image:url('${photo.replace(/'/g, "&#39;")}')">
          <div class="popup-image-overlay"><h2 class="popup-image-title">${name}</h2></div>
        </div>`;
    } else {
      // If no photo, still show a small title on mobile (desktop uses ArcGIS header)
      html += `<div class="mobile-title show-on-mobile"><h2 class="popup-title">${name}</h2></div>`;
    }

    // Category + Tabs
    html += `
      <div class="popup-category"><span class="category-badge">${category}</span></div>
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
          ${description?.trim() ? `<div class="info-section"><div class="info-label">ℹ️ About</div><div class="info-value clamp-4">${description}</div></div>` : ""}
          ${hours?.trim() ? `<div class="info-section"><div class="info-label">🕒 Hours & Fees</div><div class="info-value clamp-4">${hours}</div></div>` : ""}
          <a href="${googleSearchUrl}" 
class="primary-button">🔍 Search for More Details</a>
  ${siteUrl ? `<a href="${siteUrl}" class="primary-button site-link">🌐 Visit website</a>` : ""}
        </div>

        <div class="tab-content" data-content="navigate">
          <div style="text-align:center;margin-bottom:14px;color:#6C757D;font-size:14px;">Get directions from your current location:</div>
          <a class="nav-button google-maps" target="_blank" rel="noopener">📍 Directions via Google Maps</a>
          <a class="nav-button waze" target="_blank" rel="noopener">🚗 Directions via Waze</a>
          <div class="nav-info">Opens your preferred navigation app</div>
        </div>

        <div class="tab-content" data-content="feedback">
          <div style="text-align:center;">
            <div style="font-size:42px;margin-bottom:10px;">💬</div>
            <h3 style="color:#2C3E50;font-size:18px;font-weight:600;margin:0 0 10px;">Help us improve!</h3>
            <p style="color:#6C757D;font-size:14px;line-height:1.6;margin:0 0 16px;">Found an issue? Have updates to share?</p>
            <a href="${feedbackUrl}" target="_blank" rel="noopener" class="primary-button" style="background:linear-gradient(135deg,#667eea,#764ba2);">✏️ Submit Feedback</a>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Build nav links after DOM exists
    const { gmaps, waze } = buildNavLinks(feature.graphic, a);
    container.querySelector(".nav-button.google-maps")?.setAttribute("href", gmaps);
    container.querySelector(".nav-button.waze")?.setAttribute("href", waze);


// === Open same tab on mobile, new tab on desktop ===
const isMobile = window.matchMedia("(max-width: 768px)").matches;

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
/*
  function applyPopupLayout() {
    const mobile = window.innerWidth <= 768;
    view.popup.dockEnabled = mobile;
    view.popup.dockOptions = {
      position: mobile ? "bottom-right" : "top-right",
      breakpoint: mobile ? false : true,
      buttonEnabled: false
    };
  }
*/
function applyPopupLayout() {
  const mobile = window.innerWidth <= 768;

  view.popup.dockEnabled = true;  // always dock, mobile and desktop
  view.popup.dockOptions = {
    position: mobile ? "bottom-right" : "top-right",
    breakpoint: false,             // never undock on wide screens
    buttonEnabled: false           // no toggle button
  };

  // Optional: shift map center away from popup (only on desktop)
  if (!mobile) {
    view.popup.alignment = "top-right"; // ensures better positioning
  }
}

  applyPopupLayout();
  window.addEventListener("resize", applyPopupLayout);

  // Keep uncollapsed
  view.popup.watch("collapsed", (c) => { if (c) view.popup.collapsed = false; });
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

// Modern mobile detection
function isMobileDevice() {
  return window.matchMedia("(max-width: 768px)").matches ||
         /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

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
      if (centerOnFirst && !hasInitiallyCentered && isMobileDevice()) {
        view.goTo({ center: [longitude, latitude], zoom: 15 }, { duration: 800, easing: "ease-in-out" })
          .then(() => { hasInitiallyCentered = true; })
          .catch(() => {});
      }
    },
    () => {},
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
  if (tracking || !("geolocation" in navigator)) return;

  tracking = true;
  locateBtn.classList.add("is-tracking");
  locateBtn.setAttribute("aria-pressed", "true");
  locateBtn.title = "Click to center / Long press to stop";

  // Get first fix immediately (center on first for mobile)
  updateLocation(true);

  // Continuous updates via watchPosition
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
      }
    },
    (err) => { console.warn("Geolocation error:", err); },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
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

// Add pulsing animation CSS
const style = document.createElement('style');
style.textContent = `
  .esri-icon-locate.is-tracking {
    animation: pulse 2s infinite;
    color: #4285F4;
  }
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.6; }
    100% { opacity: 1; }
  }
`;
document.head.appendChild(style);

// Button click handler
locateBtn.addEventListener("click", () => {
  if (!tracking) {
    startLocationTracking();
  } else {
    centerOnLocation(); // user-requested center; map moves only on click
  }
});

// Long press to stop (mobile + desktop)
let pressTimer;
locateBtn.addEventListener("mousedown", () => {
  if (tracking) {
    pressTimer = setTimeout(() => { stopLocationTracking(); }, 1000);
  }
});
locateBtn.addEventListener("mouseup", () => { clearTimeout(pressTimer); });
locateBtn.addEventListener("mouseleave", () => { clearTimeout(pressTimer); });
locateBtn.addEventListener("touchstart", () => {
  if (tracking) {
    pressTimer = setTimeout(() => { stopLocationTracking(); }, 1000);
  }
}, { passive: true });
locateBtn.addEventListener("touchend", () => { clearTimeout(pressTimer); });

// Add button to UI
view.ui.add(locateBtn, { position: "bottom-right", index: 2 });

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
  if (!isMobileDevice() || !("geolocation" in navigator)) return;

  setTimeout(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "geolocation" }).then(result => {
        if (result.state === "granted") {
          startLocationTracking();
        } else if (result.state === "prompt") {
          // Attempt to start; will prompt the user
          startLocationTracking();
        } else {
          console.log("Mobile: Location permission denied");
        }
      }).catch(() => {
        // Permissions API not available - try to start anyway
        startLocationTracking();
      });
    } else {
      startLocationTracking();
    }
  }, 1500); // slight delay to ensure map ready
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
  const isMobile = window.innerWidth <= 768;

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

  // -------- Dynamic points via proxy --------
  async function loadDynamicPoints() {
    try {
      const extent = view.extent;
      const wgs84Extent = projection.project(extent, new SpatialReference({ wkid: 4326 }));
      const geometryObj = {
        xmin: wgs84Extent.xmin, ymin: wgs84Extent.ymin,
        xmax: wgs84Extent.xmax, ymax: wgs84Extent.ymax,
        spatialReference: { wkid: 4326 }
      };
      const requestBody = new URLSearchParams({
        f: "json", where: "1=1", outFields: "*",
        geometry: JSON.stringify(geometryObj),
        geometryType: "esriGeometryEnvelope",
        spatialRel: "esriSpatialRelIntersects",
        returnGeometry: "true", maxRecordCount: 500
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
    layer.graphics.forEach((g) => { g.visible = !category || g.attributes.main_category === category; });
  }

  let loadingDynamic = false;
  view.watch("zoom", async (z) => {
    if (z > ZOOM_THRESHOLD && !loadingDynamic) {
      loadingDynamic = true;
      try { await createDynamicLayer(await loadDynamicPoints()); }
      catch (e) { console.error("Dynamic load error:", e); }
      finally { loadingDynamic = false; }
    } else if (z <= ZOOM_THRESHOLD && dynamicLayer) {
      map.remove(dynamicLayer); dynamicLayer = null;
    }
  });

  // clicks: prefer dynamic layer when present
  view.on("click", async (event) => {
    try {
      const { results } = await view.hitTest(event);
      if (dynamicLayer) {
        const hit = results.find((r) => r.graphic && r.graphic.layer === dynamicLayer);
        if (hit) { view.popup.open({ features: [hit.graphic], location: event.mapPoint }); return; }
      }
      const globalHit = results.find((r) => r.graphic && r.graphic.layer === globalLayer);
      if (globalHit) view.popup.open({ features: [globalHit.graphic], location: event.mapPoint });
    } catch (error) { console.error("Error handling click:", error); }
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