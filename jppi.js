require([
  "esri/Map", "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/renderers/UniqueValueRenderer",
  "esri/widgets/Search", "esri/widgets/Home", "esri/widgets/Zoom",
  "esri/PopupTemplate"
], (
  Map, MapView,
  FeatureLayer,
  UniqueValueRenderer,
  Search, Home, Zoom,
  PopupTemplate
) => {

  const createPopupTemplate = () => {
    return {
      title: "{eng_name}",
      outFields: ["id", "main_category", "eng_name"],
      content: (feature) => {
        const attrs = feature.graphic.attributes || {};
        const id = attrs.id || attrs.OBJECTID || "";
        const category = attrs.main_category || "";

        const container = document.createElement("div");
        container.style.cssText = "background:linear-gradient(135deg,#ffffff 0%,#f8fafc 100%);border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;padding:16px;width:100%;box-sizing:border-box;";
        container.innerHTML = `<div style="padding:24px;text-align:center;color:#888;">Loading...</div>`;

        fetch(`https://api.jewishatlas.org/api/landmarks/points/${id}`)
          .then(r => r.json())
          .then(full => {
            const engName = full.name || full.eng_name || "Unknown";
            const address = full.address || "";
            const city = full.city || "";
            const country = full.country || "";
            const cat = full.main_category || category;

            const googleUrl = `https://www.google.com/search?q=${encodeURIComponent([engName, address, city, country].filter(Boolean).join(" "))}`;

            function normalizeUrl(u) {
              if (!u) return "";
              const s = String(u).trim();
              return /^https?:\/\//i.test(s) ? s : `https://${s}`;
            }
            const siteUrl = normalizeUrl(full.website || full.Website || full.link || "");

            container.innerHTML = `
              <div style="color:#667eea;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;">
                <i class="fas fa-tag" style="font-size:11px;opacity:0.8;margin-right:6px;"></i>${cat}
              </div>
              <div style="margin-bottom:16px;padding:12px;background:rgba(255,255,255,0.7);border-radius:8px;border:1px solid rgba(0,0,0,0.05);">
                ${address ? `<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;color:#374151;font-size:13px;line-height:1.4;">
                  <i class="fas fa-map-marker-alt" style="font-size:13px;color:#667eea;margin-top:2px;"></i><span>${address}</span></div>` : ""}
                ${city ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;color:#374151;font-size:13px;">
                  <i class="fas fa-city" style="font-size:13px;color:#667eea;"></i><span>${city}</span></div>` : ""}
                ${country ? `<div style="display:flex;align-items:center;gap:8px;color:#374151;font-size:13px;">
                  <i class="fas fa-globe" style="font-size:13px;color:#667eea;"></i><span>${country}</span></div>` : ""}
              </div>
              <a href="${googleUrl}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#4285f4 0%,#34a853 100%);color:white;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:13px;width:100%;box-sizing:border-box;">
                <i class="fas fa-search" style="font-size:13px;margin-right:8px;"></i>Search on Google
              </a>
              ${siteUrl ? `<a href="${siteUrl}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0ea5e9 0%,#2563eb 100%);color:white;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:13px;width:100%;box-sizing:border-box;margin-top:10px;">
                <i class="fas fa-globe" style="font-size:13px;margin-right:8px;"></i>Visit Website
              </a>` : ""}
            `;
          })
          .catch(() => {
            container.innerHTML = `<div style="padding:24px;text-align:center;color:#c00;">Could not load details. Please try again.</div>`;
          });

        return container;
      }
    };
  };

  const map = new Map({ basemap: "topo-vector" });
  const view = new MapView({
    container: "viewDiv",
    map,
    center: [25, 45],
    zoom: 4,
    ui: { components: [] },
    popup: {
      dockEnabled: false,
      collapseEnabled: false
    }
  });

  view.ui.add(new Zoom({ view }), { position: "bottom-right" });
  view.ui.add(new Home({ view }), { position: "bottom-right" });

  const search = new Search({
    view,
    allPlaceholder: "Search landmarks or places...",
    includeDefaultSources: true,
    locationEnabled: false,
    popupEnabled: true,
    resultGraphicEnabled: true,
    sources: []
  });
  view.ui.add(search, { position: "top-right", index: 0 });

  const filterDiv = document.getElementById("filterContainer");
  const categories = [
    { name: "All",         cat: "" },
    { name: "Highlight",   cat: "Highlights" },
    { name: "Synagogues",  cat: "Synagogue" },
    { name: "Heritage",    cat: "Heritage" },
    { name: "Kosher Food", cat: "Kosher Restaurant" },
    { name: "Community",   cat: "Community" }
  ];
  categories.forEach((o, i) => {
    const btn = document.createElement("button");
    btn.textContent = o.name;
    btn.dataset.cat = o.cat;
    btn.className = "filterBtn" + (i === 0 ? " active" : "");
    filterDiv.appendChild(btn);
  });

  const globalRenderer = new UniqueValueRenderer({
    field: "main_category",
    defaultSymbol: { type: "simple-marker", style: "circle", size: 10, color: "#888", outline: { color: "#fff", width: 1 } },
    uniqueValueInfos: [
      { value: "Highlight",        symbol: { type: "simple-marker", style: "circle", size: 10, color: "#f39c12", outline: { color: "#fff", width: 1 } } },
      { value: "Synagogue",        symbol: { type: "simple-marker", style: "circle", size: 10, color: "#5DADE2", outline: { color: "#fff", width: 1 } } },
      { value: "Heritage",         symbol: { type: "simple-marker", style: "circle", size: 10, color: "#EC7063", outline: { color: "#fff", width: 1 } } },
      { value: "Kosher Restaurant", symbol: { type: "simple-marker", style: "circle", size: 10, color: "#58D68D", outline: { color: "#fff", width: 1 } } },
      { value: "Community",        symbol: { type: "simple-marker", style: "circle", size: 10, color: "#8b5cf6", outline: { color: "#fff", width: 1 } } }
    ]
  });

  let currentFilter = "";

  const globalLayer = new FeatureLayer({
    url: window.LANDMARKS_SERVICE_URL,
    outFields: ["id", "main_category", "eng_name"],
    popupTemplate: createPopupTemplate(),
    renderer: globalRenderer
  });
  map.add(globalLayer);

  view.on("click", async event => {
    try {
      const response = await view.hitTest(event, { include: [globalLayer] });
      if (!response.results.length) return;
      const hit = response.results.find(r => r.graphic?.layer === globalLayer);
      if (hit) {
        view.popup.open({
          features: [hit.graphic],
          location: hit.mapPoint || event.mapPoint
        });
      }
    } catch (error) {
      console.error("Error handling click:", error);
    }
  });

  globalLayer.when(() => {
    const landmarksSource = {
      layer: globalLayer,
      searchFields: ["eng_name"],
      displayField: "eng_name",
      exactMatch: false,
      outFields: ["id", "main_category", "eng_name"],
      name: "Jewish Landmarks",
      placeholder: "e.g., Rabbi Itzhak Huri Synagogue",
      maxResults: 6,
      maxSuggestions: 8,
      suggestionsEnabled: true,
      minSuggestCharacters: 2
    };
    search.sources.unshift(landmarksSource);
  });

  filterDiv.querySelectorAll(".filterBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.cat;
      currentFilter = cat;
      globalLayer.definitionExpression = cat ? `main_category='${cat}'` : "";
      filterDiv.querySelectorAll(".filterBtn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

});