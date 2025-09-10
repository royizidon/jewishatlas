  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'index.html';
  });

document.getElementById('aboutBtn')?.addEventListener('click', () => {
  window.location.href = 'about.html';
});

document.getElementById('wallBtn')?.addEventListener('click', () => {
  window.location.href = 'wall.html';
});



  // (Optional) wire About / The Wall if you want them to navigate too:
  // document.getElementById('aboutBtn').addEventListener('click', () => location.href='about.html');
  // document.getElementById('wallBtn').addEventListener('click',  () => location.href='wall.html');


// ========= CONFIG =========

const FEATURE_URL =
  "https://services-eu1.arcgis.com/FckSU1kja7wbnBnq/arcgis/rest/services/JewishAtlas_Submissions_20250902_083008/FeatureServer/0";

// OSM/Nominatim endpoints (no key)
const NOMINATIM_SUGGEST = (q) =>
  `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`;

const NOMINATIM_GEOCODE = (q) =>
  `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(q)}`;

const NOMINATIM_REVERSE = (lat, lon) =>
  `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lon}`;

async function reverseGeocodeOSM(lat, lon) {
  const r = await fetch(NOMINATIM_REVERSE(lat, lon), { headers: { Accept: "application/json" } });
  const j = await r.json();
  const a = j.address || {};
  return {
    full: j.display_name || "",
    city: a.city || a.town || a.village || a.hamlet || "",
    postal: a.postcode || "",
    country: a.country || "",
  };
}

// ========= Helpers =========
const $ = (id) => document.getElementById(id);
const submitBtn = $("submitBtn");
const statusEl = $("status");
let chosen = null; // { full, city, postal, country, lon, lat }

function setStatus(kind, msg) {
  statusEl.style.display = "block";
  statusEl.style.padding = "8px 12px";
  statusEl.style.borderRadius = "6px";
  statusEl.style.fontSize = "14px";
  statusEl.style.marginTop = "8px";
  
  if (kind === "ok") {
    statusEl.style.backgroundColor = "#f0fdf4";
    statusEl.style.color = "#166534";
    statusEl.style.border = "1px solid #bbf7d0";
  } else if (kind === "err") {
    statusEl.style.backgroundColor = "#fef2f2";
    statusEl.style.color = "#dc2626";
    statusEl.style.border = "1px solid #fecaca";
  } else if (kind === "info") {
    statusEl.style.backgroundColor = "#f8fafc";
    statusEl.style.color = "#475569";
    statusEl.style.border = "1px solid #e2e8f0";
  }
  statusEl.textContent = msg;
}

function clearStatus() {
  statusEl.style.display = "none";
  statusEl.textContent = "";
}

function canSubmit() {
  return $("type").value && !!chosen;
}

function updateSubmit() {
  submitBtn.disabled = !canSubmit();
}

// ========= ArcGIS setup (NO KEY) =========
require([
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/widgets/Search",
  "esri/widgets/Zoom",
  "esri/widgets/Home",
  "esri/widgets/Locate",
  "esri/Graphic",
  "esri/geometry/support/webMercatorUtils",
  "esri/layers/WebTileLayer",
  "esri/Basemap"
], (
  Map, MapView, FeatureLayer, Search, Zoom, Home, Locate, Graphic, webMercatorUtils, WebTileLayer, Basemap
) => {
  // CARTO Positron (light) + label overlay - no key
  const cartoLight = new WebTileLayer({
    urlTemplate: "https://{subDomain}.basemaps.cartocdn.com/light_all/{level}/{col}/{row}.png",
    subDomains: ["a","b","c","d"],
    copyright: "© OpenStreetMap contributors, © CARTO"
  });
  const cartoLabels = new WebTileLayer({
    urlTemplate: "https://{subDomain}.basemaps.cartocdn.com/light_only_labels/{level}/{col}/{row}.png",
    subDomains: ["a","b","c","d"],
    opacity: 1
  });

const map = new Map({ basemap: "osm" });

  const view = new MapView({
    container: "viewDiv",
    map,
    center: [12, 50],
    zoom: 5,
    ui: { components: ["attribution"] } // we place our own buttons
  });

  // Keep popup expanded on phones if used
  view.when(() => {
    view.popup.collapseEnabled = false;
    view.popup.dockEnabled = true;
    view.popup.dockOptions = { position: "bottom-center", breakpoint: false, buttonEnabled: false };
    view.popup.watch("visible", v => { if (v) view.popup.collapsed = false; });
  });

  // Your public layer (read + write if public editing is enabled)
  const globalLayer = new FeatureLayer({ url: FEATURE_URL, outFields: ["*"] });
  map.add(globalLayer);

  // Marker for selected address
  const marker = new Graphic({
    symbol: { type: "simple-marker", style: "circle", size: 10, color: "#4f46e5", outline: { color: "white", width: 1.5 } }
  });
  view.graphics.add(marker);

  // Helper: set marker, reverse-geocode, fill the form, zoom a bit
  async function pickPoint(lon, lat) {
    try {
      // reverse-geocode with OSM/Nominatim (no key)
      const info = await reverseGeocodeOSM(lat, lon);

      chosen = { ...info, lon, lat };
      $("selectedAddress").value = info.full || `Dropped pin: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;

      marker.geometry = { type: "point", longitude: lon, latitude: lat };
      view.goTo({ center: [lon, lat], zoom: Math.max(view.zoom, 16) }, { duration: 400 });

      updateSubmit();
      setStatus("info", "Location selected on map.");
    } catch (err) {
      console.error(err);
      setStatus("err", "Couldn't get an address for that point.");
    }
  }

  // Pick on map tap/click (desktop & mobile)
  view.on("click", (event) => {
    const { longitude, latitude } = event.mapPoint;
    pickPoint(longitude, latitude);
  });

  // ---------- Search widget: ONLY OSM, top-center via #searchDock ----------
  const search = new Search({
    view,
    container: "searchDock", // put it in our centered dock
    includeDefaultSources: false,
    searchMultipleSourcesEnabled: false, // hide source dropdown
    popupEnabled: false,
    maxSuggestions: 8,
    allPlaceholder: "Search address…",
    locationEnabled: false,
    sources: [
      {
        name: "Address (OSM)",
        placeholder: "Search address or tap the map",
        getSuggestions: async (params) => {
          const q = params.suggestTerm.trim();
          if (!q) return [];
          const r = await fetch(NOMINATIM_SUGGEST(q), { headers: { "Accept": "application/json" }});
          const items = await r.json();
          return items.map((it, i) => ({ key: i, text: it.display_name, sourceIndex: params.sourceIndex }));
        },
        getResults: async (params) => {
          const q = (params.suggestResult && params.suggestResult.text) || params.searchTerm;
          if (!q) return [];
          const r = await fetch(NOMINATIM_GEOCODE(q), { headers: { "Accept": "application/json" }});
          const [it] = await r.json();
          if (!it) return [];
          const cityVal = it.address.city || it.address.town || it.address.village || it.address.hamlet || "";
          return [{
            name: it.display_name,
            feature: new Graphic({ geometry: { type: "point", longitude: +it.lon, latitude: +it.lat } }),
            attributes: {
              address_full: it.display_name,
              city: cityVal,
              postal: it.address.postcode || "",
              country: it.address.country || ""
            }
          }];
        }
      }
    ]
  });

  // ---- Buttons at bottom-left ----
  const locate = new Locate({ view, useHeadingEnabled: false });
  const home   = new Home({ view });
  const zoom   = new Zoom({ view });

  // When the user taps the Location button, grab coords → reverse-geocode → fill the form
  locate.on("locate", async (e) => {
    try {
      const { latitude: lat, longitude: lon } = e.position.coords;
      const info = await reverseGeocodeOSM(lat, lon);

      chosen = { ...info, lon, lat };
      $("selectedAddress").value = info.full || "Address selected";

      // drop/refresh the marker and zoom in a bit
      marker.geometry = { type: "point", longitude: lon, latitude: lat };
      view.goTo({ center: [lon, lat], zoom: Math.max(view.zoom, 16) }, { duration: 500 });

      updateSubmit();
      setStatus("info", "Location captured from device.");
    } catch (err) {
      console.error(err);
      setStatus("err", "Couldn't get an address for your location.");
    }
  });

  view.ui.add(locate, { position: "bottom-left", index: 0 });
  view.ui.add(home,   { position: "bottom-left", index: 1 });
  view.ui.add(zoom,   { position: "bottom-left", index: 2 });
  view.ui.move("attribution", "bottom-right"); // attribution below buttons

  // Accept a picked suggestion
  search.on("select-result", ({ result }) => handleResult(result));

  function handleResult(result) {
    // OSM result only
    const full    = result.attributes?.address_full || result.name || "";
    const city    = result.attributes?.city || "";
    const postal  = result.attributes?.postal || "";
    const country = result.attributes?.country || "";
    const geo     = result.feature.geometry;
    const p       = { lon: geo.longitude ?? geo.x, lat: geo.latitude ?? geo.y };

    chosen = { full, city, postal, country, lon: p.lon, lat: p.lat };
    $("selectedAddress").value = chosen.full || "Address selected";
    marker.geometry = { type: "point", longitude: chosen.lon, latitude: chosen.lat };
    view.goTo({ center: [chosen.lon, chosen.lat], zoom: Math.max(view.zoom, 16) }, { duration: 500 });

    updateSubmit();
  }

  // Re-validate on input
  document.addEventListener("input", updateSubmit);

  // Submit handler (adds feature + optional attachment) – relies on public editing
  $("addForm").addEventListener("submit", onSubmit);

  async function onSubmit(e) {
  e.preventDefault(); 
  clearStatus();
  if (!canSubmit()) { 
    setStatus("err","Please fill required fields and select an address."); 
    return; 
  }
  submitBtn.disabled = true;

  // ADDED: read optional email + keep your comments value
  const email = (document.getElementById('contactEmail')?.value || '').trim();
  const baseComments = $("comments").value.trim();

  const attrs = {
    eng_name: $("siteName").value.trim(),
    main_category: $("type").value,
    description: $("desc").value.trim(),
    preservation_status: $("preservation").value || "",
    Address: chosen.full || "",
    city: chosen.city || "",
    country: chosen.country || "",
    postal: chosen.postal || "",
    comments: baseComments,
    status: "pending"
  };

  // ADDED: set the ArcGIS field exactly named "Email" only if user provided it
  if (email) {
    attrs.Email = email;
  }
const sitePhone  = (document.getElementById('sitePhone')?.value  || '').trim();
let   siteWebsite= (document.getElementById('siteWebsite')?.value|| '').trim();
const siteEmail  = (document.getElementById('siteEmail')?.value  || '').trim();

if (sitePhone)  attrs.phone = sitePhone;

// normalize website to include protocol if user omitted it
if (siteWebsite) {
  if (!/^https?:\/\//i.test(siteWebsite)) siteWebsite = 'https://' + siteWebsite;
  attrs.website = siteWebsite;
}

if (siteEmail)  attrs.site_email = siteEmail;


attrs.enterdate = Date.now();
  try {
    const oid = await addFeature({ lon: chosen.lon, lat: chosen.lat, attrs });
    const file = $("photoFile").files?.[0] || null;
    if (file) {
      const finalFile = file.type.startsWith("image/") ? await maybeDownscale(file) : file;
      await addAttachment(oid, finalFile);
    }
    setStatus("ok", "Thank you! Your submission was received for review.");
    $("addForm").reset();
    $("selectedAddress").value = "No address selected yet";
    chosen = null; 
    marker.geometry = null;
  } catch (err) {
    console.error(err);
    setStatus("err", "Submission failed. Ensure the layer allows public Add & Add Attachment, or use a server proxy.");
  } finally {
    updateSubmit();
  }
}

});

// ========= REST helpers (no auth; assumes public editing enabled) =========
async function addFeature({ lon, lat, attrs }) {
  const features = [{
    geometry: { x: lon, y: lat, spatialReference: { wkid: 4326 } },
    attributes: attrs
  }];
  const res = await fetch(`${FEATURE_URL}/addFeatures`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ f: "json", features: JSON.stringify(features) })
  });
  const json = await res.json();
  const r = json?.addResults?.[0];
  if (!r?.success) throw new Error("addFeatures failed");
  return r.objectId;
}

async function addAttachment(objectId, file) {
  const form = new FormData();
  form.set("f", "json");
  form.set("attachment", file, file.name || "photo");
  const res = await fetch(`${FEATURE_URL}/${objectId}/addAttachment`, { method: "POST", body: form });
  const json = await res.json();
  if (!json?.addAttachmentResult?.success) throw new Error("addAttachment failed");
  return json.addAttachmentResult.objectId;
}

// ========= Utilities =========
async function maybeDownscale(file, maxDim = 1600, quality = 0.86) {
  if (!file.type.startsWith("image/")) return file;
  const img = new Image();
  const url = URL.createObjectURL(file);
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const { width, height } = img;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  if (scale >= 1) { URL.revokeObjectURL(url); return file; }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", quality));
  URL.revokeObjectURL(url);
  return new File([blob], (file.name || "photo").replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}

// Mobile viewport height fix (iOS/Android)
(function() {
  function setVH() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
  
  window.addEventListener('load', setVH);
  window.addEventListener('resize', setVH);
  setVH(); // Set immediately
})();