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
  SpatialReference
) {
  console.log("*** REQUIRE BLOCK STARTED ***");

  // -------- Popup Template --------
  const createPopupTemplate = () => ({
    title: "{eng_name}",
    content: [{
      type: "text",
      text: `
        <div style="background:#fff;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:400px;box-shadow:0 4px 20px rgba(0,0,0,.1);overflow:hidden;">
          <div style="width:100%;height:200px;background-image:url({expression/has-photo});background-size:cover;background-position:center;display:{expression/has-photo ? 'block' : 'none'};"></div>
          <div style="padding:20px 20px 15px;">
            <h2 style="color:#2C3E50;font-size:20px;font-weight:600;margin:0 0 8px;line-height:1.3;">{eng_name}</h2>
            <div style="display:inline-block;background:#E8F4FD;color:#2980B9;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:.5px;margin-bottom:15px;">{main_category}</div>
          </div>

          <div style="display:flex;background:#F8F9FA;border-bottom:1px solid #E9ECEF;margin:0 20px;border-radius:8px 8px 0 0;">
            <button onclick="showTab(event, 'info-tab')" class="tab-button active" style="flex:1;background:none;border:none;padding:12px 16px;cursor:pointer;font-weight:600;font-size:14px;color:#2C3E50;background:#fff;border-bottom:2px solid #4575B4;">📍 Info</button>
            <button onclick="showTab(event, 'navigate-tab')" class="tab-button" style="flex:1;background:none;border:none;padding:12px 16px;cursor:pointer;font-weight:600;font-size:14px;color:#6C757D;background:#F8F9FA;">🧭 Navigate</button>
            <button onclick="showTab(event, 'feedback-tab')" class="tab-button" style="flex:1;background:none;border:none;padding:12px 16px;cursor:pointer;font-weight:600;font-size:14px;color:#6C757D;background:#F8F9FA;border-radius:0 8px 0 0;">💬 Feedback</button>
          </div>

          <div style="padding:20px;background:#fff;">
            <div id="info-tab" class="tab-content" style="display:block;">
              <div style="margin-bottom:12px;">
                <div style="color:#7F8C8D;font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">📍 ADDRESS</div>
                <div style="color:#2C3E50;font-size:14px;line-height:1.4;">{Address}, {city}</div>
              </div>
              <div style="margin-bottom:12px;display:{expression/has-description ? 'block' : 'none'};">
                <div style="color:#7F8C8D;font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">ℹ️ ABOUT</div>
                <div style="color:#2C3E50;font-size:14px;line-height:1.5;">{expression/has-description}</div>
              </div>
              <div style="margin-bottom:12px;display:{expression/has-fees-hours ? 'block' : 'none'};">
                <div style="color:#7F8C8D;font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">🕐 HOURS & FEES</div>
                <div style="color:#2C3E50;font-size:14px;line-height:1.5;">{expression/has-fees-hours}</div>
              </div>
              <a href="{expression/google-search-url}" target="_blank" style="display:block;background:#4575B4;color:#fff;text-decoration:none;padding:12px;border-radius:8px;text-align:center;font-weight:bold;font-size:14px;margin-top:15px;">🔍 Search for More Details</a>
            </div>

            <div id="navigate-tab" class="tab-content" style="display:none;">
              <div style="text-align:center;margin-bottom:20px;"><div style="color:#6C757D;font-size:14px;margin-bottom:15px;">Choose your preferred navigation app:</div></div>
              <div style="margin-bottom:15px;">
                <a href="{expression/google-maps-url}" target="_blank" style="display:block;width:100%;background:#34A853;color:#fff;text-decoration:none;padding:15px;border-radius:8px;text-align:center;font-weight:bold;font-size:16px;margin-bottom:12px;box-sizing:border-box;">📍 Open in Google Maps</a>
                <a href="{expression/waze-url}" target="_blank" style="display:block;width:100%;background:#33CCFF;color:#fff;text-decoration:none;padding:15px;border-radius:8px;text-align:center;font-weight:bold;font-size:16px;box-sizing:border-box;">🚗 Open in Waze</a>
              </div>
            </div>

            <div id="feedback-tab" class="tab-content" style="display:none;">
              <div style="text-align:center;">
                <div style="color:#6C757D;font-size:16px;margin-bottom:15px;line-height:1.5;">💬 Help us improve!<br>Share your experience or suggest updates to this location.</div>
                <a href="{expression/feedback-url}" target="_blank" style="display:inline-block;background:#4575B4;color:#fff;text-decoration:none;padding:15px 25px;border-radius:8px;font-weight:bold;font-size:16px;box-shadow:0 2px 8px rgba(69,117,180,.3);">📝 Fill Feedback Form</a>
              </div>
            </div>
          </div>

          <script>
            function showTab(evt, tabName) {
              var i, tabcontent, tablinks;
              tabcontent = document.getElementsByClassName("tab-content");
              for (i=0; i<tabcontent.length; i++) { tabcontent[i].style.display = "none"; }
              tablinks = document.getElementsByClassName("tab-button");
              for (i=0; i<tablinks.length; i++) {
                tablinks[i].style.backgroundColor = "#F8F9FA";
                tablinks[i].style.color = "#6C757D";
                tablinks[i].style.borderBottom = "none";
              }
              document.getElementById(tabName).style.display = "block";
              evt.currentTarget.style.backgroundColor = "white";
              evt.currentTarget.style.color = "#2C3E50";
              evt.currentTarget.style.borderBottom = "2px solid #4575B4";
            }
          </script>
        </div>
      `
    }],
    expressionInfos: [
      { name: "has-photo", returnType: "string", expression: `var u=$feature.photo; return (u && u.trim()!="")?u:"";` },
      { name: "has-description", returnType: "string", expression: `var d=$feature.description; return (d && d.trim()!="")?d:"";` },
      { name: "has-fees-hours", returnType: "string", expression: `var h=$feature.fees_opening_hours; return (h && h.trim()!="")?h:"";` },
      { name: "google-search-url", returnType: "string", expression: `return "https://www.google.com/search?q="+$feature.eng_name+" "+$feature.Address;` },
      {
        name: "google-maps-url", returnType: "string",
        expression: `
          var g=Geometry($feature); var lat,lon;
          if (g.spatialReference.wkid==3857){lon=g.x/20037508.34*180; lat=g.y/20037508.34*180; lat=180/PI()*(2*Atan(Exp(lat*PI()/180))-PI()/2);}
          else if (g.spatialReference.wkid==4326){lat=g.y; lon=g.x;} else {lat=g.y; lon=g.x;}
          return "https://www.google.com/maps/dir/?api=1&destination="+lat+","+lon;`
      },
      {
        name: "waze-url", returnType: "string",
        expression: `
          var g=Geometry($feature); var lat,lon;
          if (g.spatialReference.wkid==3857){lon=g.x/20037508.34*180; lat=g.y/20037508.34*180; lat=180/PI()*(2*Atan(Exp(lat*PI()/180))-PI()/2);}
          else if (g.spatialReference.wkid==4326){lat=g.y; lon=g.x;} else {lat=g.y; lon=g.x;}
          return "https://waze.com/ul?ll="+lat+","+lon+"&navigate=yes";`
      },
      { name: "feedback-url", returnType: "string",
        expression: `return "https://docs.google.com/forms/d/e/1FAIpQLSeVWy9b_hWAk2qjTvabxsuQl-Lr1ewUY4CRVT6kTQGt7egSag/viewform?usp=pp_url&entry.1424782895="+$feature.id;`
      }
    ]
  });

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



// -------- Optimized Location Tracking with Smart Movement Detection --------
const locationSymbol = {
  type: "simple-marker",
  style: "circle",
  size: 14,
  color: "#FFD166",
  outline: { color: "#ffffff", width: 3 }
};

// Create graphics layer for location marker
const locationLayer = new GraphicsLayer({ title: "User Location" });
map.add(locationLayer);

// Location tracking variables
let locationGraphic = null;
let tracking = false;
let goToHandle = null;

// watchPosition variables for smart tracking
let watchId = null;
let lastFix = null;
let lastGoToTs = 0;
const MIN_MOVE_M = 35;     // ignore GPS jitter under 35 meters
const MIN_GOTO_MS = 5000;  // don't re-center more than once per 5 seconds
let userInteractedAt = 0;

// Modern mobile detection
function isMobileDevice() {
  return window.matchMedia("(max-width: 768px)").matches || 
         /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Check permissions status if available
async function checkLocationPermission() {
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const status = await navigator.permissions.query({ name: "geolocation" });
      return status.state; // 'granted', 'denied', 'prompt'
    }
  } catch (error) {
    console.log("Permissions API not available");
  }
  return "unknown";
}

// Calculate distance between two points in meters
function distMeters(a, b) {
  const toRad = (d) => d * Math.PI / 180;
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const x = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Update location marker on map with conflict prevention
function updateLocationMarker(latitude, longitude) {
  const point = new Point({
    longitude: longitude,
    latitude: latitude,
    spatialReference: { wkid: 4326 }
  });
  
  // Remove existing location graphic
  if (locationGraphic) {
    locationLayer.remove(locationGraphic);
  }
  
  // Create new location graphic
  locationGraphic = new Graphic({
    geometry: point,
    symbol: locationSymbol
  });
  
  locationLayer.add(locationGraphic);
  
  // Cancel any in-flight navigation to prevent conflicts
  if (goToHandle) {
    try {
      goToHandle.cancel();
    } catch (e) {
      // Ignore cancel errors
    }
  }
  
  // Center map on location
  goToHandle = view.goTo({
    center: [longitude, latitude],
    zoom: Math.max(view.zoom || 3, 12)
  }).catch(() => {}); // Ignore navigation errors
}

// Handle watchPosition updates with movement filtering
function onPosition(pos) {
  const { latitude: lat, longitude: lon, accuracy } = pos.coords;
  const now = Date.now();
  
  console.log(`Location update: ${lat}, ${lon} (accuracy: ${accuracy}m)`);
  
  // Don't recenter if user recently interacted with map
  if (now - userInteractedAt < 15000) {
    console.log("Skipping recenter - user recently interacted");
    return;
  }
  
  // Movement and time throttling to prevent GPS jitter
  if (lastFix) {
    const moved = distMeters(lastFix, { lat, lon });
    const timeSinceLastGoTo = now - lastGoToTs;
    
    if (moved < MIN_MOVE_M && timeSinceLastGoTo < MIN_GOTO_MS) {
      console.log(`Skipping update - moved only ${moved.toFixed(1)}m, last update ${timeSinceLastGoTo}ms ago`);
      return;
    }
    
    console.log(`Significant movement detected: ${moved.toFixed(1)}m`);
  }
  
  updateLocationMarker(lat, lon);
  lastFix = { lat, lon, accuracy };
  lastGoToTs = now;
}

// Get current location once (for initial positioning)
function getCurrentLocation() {
  if (!("geolocation" in navigator)) {
    showNotification("Geolocation is not supported by this browser.", "error");
    return;
  }
  
  console.log("Requesting one-time location...");
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      console.log(`One-time location: ${latitude}, ${longitude}`);
      updateLocationMarker(latitude, longitude);
    },
    (error) => {
      console.error("Location error:", error);
      handleLocationError(error);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    }
  );
}

// Handle location errors with appropriate user feedback
function handleLocationError(error) {
  let errorMessage = "";
  
  switch(error.code) {
    case error.PERMISSION_DENIED:
      errorMessage = "Location access denied. Please enable location access in your browser settings.";
      // On mobile, show gentle prompt for permission
      if (isMobileDevice()) {
        setTimeout(() => showLocationPrompt(), 1000);
      }
      break;
    case error.POSITION_UNAVAILABLE:
      errorMessage = "Location information is currently unavailable.";
      break;
    case error.TIMEOUT:
      errorMessage = "Location request timed out. Please try again.";
      break;
    default:
      errorMessage = "An unknown location error occurred.";
      break;
  }
  
  showNotification(errorMessage, "error");
}

// Show notification helper with accessibility and duplicate prevention
let notificationTimeout = null;
function showNotification(message, type = "info") {
  // Remove existing notification
  const existing = document.getElementById("ja-notification");
  if (existing) existing.remove();
  
  // Clear existing timeout
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
  }
  
  const notification = document.createElement('div');
  notification.id = "ja-notification";
  notification.setAttribute("role", "alert");
  notification.setAttribute("aria-live", "polite");
  
  const bgColor = type === "error" ? "#e74c3c" : "#2C3E50";
  
  notification.style.cssText = `
    position: fixed;
    top: ${(document.getElementById('appHeader')?.offsetHeight || 95) + 10}px;
    left: 50%;
    transform: translateX(-50%);
    background: ${bgColor};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 90%;
    text-align: center;
  `;
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  notificationTimeout = setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

// Show location permission prompt (prevent duplicates)
function showLocationPrompt() {
  if (document.getElementById("ja-location-prompt")) return;
  
  const prompt = document.createElement('div');
  prompt.id = "ja-location-prompt";
  prompt.style.cssText = `
    position: fixed;
    top: ${(document.getElementById('appHeader')?.offsetHeight || 95) + 10}px;
    left: 50%;
    transform: translateX(-50%);
    background: #2C3E50;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 90%;
    text-align: center;
  `;
  
  prompt.innerHTML = `
    📍 Enable location to find nearby Jewish landmarks
    <button class="ja-enable-btn" style="margin-left: 10px; background: #4575B4; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
      Enable
    </button>
    <button class="ja-skip-btn" style="margin-left: 5px; background: transparent; color: white; border: 1px solid white; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
      Skip
    </button>
  `;
  
  document.body.appendChild(prompt);
  
  // Add event listeners
  prompt.querySelector('.ja-enable-btn').onclick = () => {
    prompt.remove();
    getCurrentLocation();
  };
  
  prompt.querySelector('.ja-skip-btn').onclick = () => {
    prompt.remove();
  };
  
  // Auto-remove after 8 seconds
  setTimeout(() => {
    if (prompt.parentElement) {
      prompt.remove();
    }
  }, 8000);
}

// Show tracking consent prompt
function showTrackingPrompt() {
  if (document.getElementById("ja-tracking-prompt")) return;
  
  const prompt = document.createElement('div');
  prompt.id = "ja-tracking-prompt";
  prompt.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: #4575B4;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 90%;
    text-align: center;
  `;
  
  prompt.innerHTML = `
    ✨ Track your location as you explore?
    <button class="ja-track-yes" style="margin-left: 10px; background: white; color: #4575B4; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-weight: bold;">
      Yes
    </button>
    <button class="ja-track-no" style="margin-left: 5px; background: transparent; color: white; border: 1px solid white; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
      No thanks
    </button>
  `;
  
  document.body.appendChild(prompt);
  
  prompt.querySelector('.ja-track-yes').onclick = () => {
    prompt.remove();
    startLocationTracking();
  };
  
  prompt.querySelector('.ja-track-no').onclick = () => {
    prompt.remove();
  };
  
  // Auto-remove after 6 seconds
  setTimeout(() => {
    if (prompt.parentElement) {
      prompt.remove();
    }
  }, 6000);
}

// Start location tracking using watchPosition
function startLocationTracking() {
  if (tracking || !("geolocation" in navigator)) return;
  
  console.log("Starting location tracking...");
  tracking = true;
  locateTrackBtn.classList.add("is-tracking");
  locateTrackBtn.setAttribute("aria-pressed", "true");
  locateTrackBtn.title = "Stop location tracking";
  
  // Get immediate location for quick feedback
  getCurrentLocation();
  
  // Start continuous tracking with watchPosition
  watchId = navigator.geolocation.watchPosition(
    onPosition,
    handleLocationError,
    { 
      enableHighAccuracy: true, 
      timeout: 15000, 
      maximumAge: 10000 
    }
  );
  
  console.log("Location tracking started with watchPosition");
}

// Stop location tracking
function stopLocationTracking() {
  if (!tracking) return;
  
  console.log("Stopping location tracking...");
  tracking = false;
  locateTrackBtn.classList.remove("is-tracking");
  locateTrackBtn.setAttribute("aria-pressed", "false");
  locateTrackBtn.title = "Start location tracking";
  
  // Clear watchPosition
  if (watchId != null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  
  // Remove location graphic
  if (locationGraphic) {
    locationLayer.remove(locationGraphic);
    locationGraphic = null;
  }
  
  // Reset tracking state
  lastFix = null;
  lastGoToTs = 0;
  
  console.log("Location tracking stopped");
}

// Create the locate/track button
const locateTrackBtn = document.createElement("button");
locateTrackBtn.className = "esri-widget esri-widget--button esri-interactive esri-icon-locate";
locateTrackBtn.title = "Start location tracking";
locateTrackBtn.setAttribute("aria-label", "Location tracking");
locateTrackBtn.setAttribute("aria-pressed", "false");

// Button click handler
locateTrackBtn.addEventListener("click", () => {
  console.log("Location button clicked, tracking:", tracking);
  if (!tracking) {
    startLocationTracking();
  } else {
    stopLocationTracking();
  }
});

// Add button to UI
view.ui.add(locateTrackBtn, { position: "bottom-right", index: 2 });

// Track user interactions to prevent auto-centering during manual navigation
["drag", "mouse-wheel", "pointer-down"].forEach(evt =>
  view.on(evt, () => { 
    userInteractedAt = Date.now();
    console.log("User interaction detected - pausing auto-center");
  })
);

// Smart auto-start logic based on permissions and device type
view.when(async () => {
  // Wait for map to fully load
  setTimeout(async () => {
    const permissionStatus = await checkLocationPermission();
    
    if (permissionStatus === "granted") {
      // Permission already granted - show location and offer tracking
      console.log("Location permission granted - showing location");
      getCurrentLocation();
      
      // If on mobile, offer continuous tracking after showing location
      if (isMobileDevice()) {
        setTimeout(() => {
          if (locationGraphic) {
            showTrackingPrompt();
          }
        }, 2000);
      }
    } else if (permissionStatus === "prompt" && isMobileDevice()) {
      // Permission can be requested - show gentle prompt on mobile
      console.log("Mobile device detected - showing location prompt");
      showLocationPrompt();
    } else if (permissionStatus === "denied") {
      // Permission denied - don't prompt again, just log
      console.log("Location permission previously denied");
    } else {
      // Unknown permission state
      if (isMobileDevice()) {
        console.log("Mobile device detected - showing location prompt");
        showLocationPrompt();
      } else {
        console.log("Desktop device detected - location available via button");
      }
    }
  }, 1000);
});

// Handle tab visibility changes for battery optimization
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    console.log("Tab hidden - pausing location tracking");
    if (watchId != null) { 
      navigator.geolocation.clearWatch(watchId); 
      watchId = null; 
    }
  } else if (tracking && watchId == null) {
    console.log("Tab visible - resuming location tracking");
    watchId = navigator.geolocation.watchPosition(
      onPosition,
      handleLocationError,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }
});

// Make functions global for inline event handlers
window.startLocationTracking = startLocationTracking;
window.getCurrentLocation = getCurrentLocation;




// -------- Popup behavior --------
// Replace your existing popup configuration with this:
view.when(() => {
  // Enhanced popup configuration for mobile
  view.popup.dockEnabled = true;
  view.popup.collapseEnabled = false;
  
  // Check if mobile/tablet
  const isMobile = window.innerWidth <= 768;
  
  view.popup.dockOptions = {
    position: isMobile ? "bottom" : "top-left",
    breakpoint: false, // Always dock
    buttonEnabled: false
  };

  // Force full screen on mobile
  if (isMobile) {
    view.popup.set({
      dockEnabled: true,
      dockOptions: {
        position: "bottom",
        breakpoint: false,
        buttonEnabled: false
      }
    });
  }

  // If it ever collapses, immediately uncollapse it
  view.popup.watch("collapsed", (isCollapsed) => {
    if (isCollapsed) view.popup.collapsed = false;
  });

  // Handle window resize to adjust popup behavior
  window.addEventListener('resize', () => {
    const isMobileNow = window.innerWidth <= 768;
    view.popup.dockOptions = {
      position: isMobileNow ? "bottom" : "top-left",
      breakpoint: false,
      buttonEnabled: false
    };
  });
});
  // -------- Other UI widgets --------
  view.ui.add(new Zoom({ view }), { position: "bottom-right", index: 0 });
  view.ui.add(new Home({ view }), { position: "bottom-right", index: 1 });

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
    defaultSymbol: { type: "simple-marker", style: "circle", size: 8, color: "#888", outline: { color: "#fff", width: 1 } },
    uniqueValueInfos: [
      { value: "Highlights",        symbol: { type: "simple-marker", style: "circle", size: 8, color: "#f39c12", outline: { color: "#fff", width: 1 } } },
      { value: "Synagogue",         symbol: { type: "simple-marker", style: "circle", size: 8, color: "#5DADE2", outline: { color: "#fff", width: 1 } } },
      { value: "Heritage",          symbol: { type: "simple-marker", style: "circle", size: 8, color: "#EC7063", outline: { color: "#fff", width: 1 } } },
      { value: "Kosher Restaurant", symbol: { type: "simple-marker", style: "circle", size: 8, color: "#58D68D", outline: { color: "#fff", width: 1 } } },
      { value: "Community",         symbol: { type: "simple-marker", style: "circle", size: 8, color: "#F5B041", outline: { color: "#fff", width: 1 } } }
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
      "Featured":          { type: "simple-marker", style: "circle", size: 8, color: "#f39c12", outline: { color: "#fff", width: 1 } },
      "Synagogue":         { type: "simple-marker", style: "circle", size: 8, color: "#5DADE2", outline: { color: "#fff", width: 1 } },
      "Heritage":          { type: "simple-marker", style: "circle", size: 8, color: "#EC7063", outline: { color: "#fff", width: 1 } },
      "Kosher Restaurant": { type: "simple-marker", style: "circle", size: 8, color: "#58D68D", outline: { color: "#fff", width: 1 } },
      "Community":         { type: "simple-marker", style: "circle", size: 8, color: "#F5B041", outline: { color: "#fff", width: 1 } }
    };
    return symbolMap[category] || { type: "simple-marker", style: "circle", size: 8, color: "#888", outline: { color: "#fff", width: 1 } };
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