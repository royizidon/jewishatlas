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

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));

  function httpUrl(value, allowBareDomain = false) {
    const input = String(value ?? "").trim();
    if (!input) return "";
    try {
      const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(input);
      const url = new URL(allowBareDomain && !hasScheme ? `https://${input.replace(/^\/\//, "")}` : input);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  const createPopupTemplate = () => ({
    title: "",
    outFields: ["id", "main_category", "eng_name"],
    content: (feature) => {
      const attrs = feature.graphic.attributes || {};
      const id = attrs.id ?? attrs.OBJECTID ?? "";
      const container = document.createElement("div");
      container.className = "jppi-landmark";
      container.textContent = "Loading…";

      fetch(`https://api.jewishatlas.org/api/landmarks/points/${encodeURIComponent(id)}`)
        .then(response => {
          if (!response.ok) throw new Error(`Landmark fetch failed: ${response.status}`);
          return response.json();
        })
        .then(full => {
          const name = full.eng_name || full.name || attrs.eng_name || "Location";
          const category = full.main_category || attrs.main_category || "";
          const addressParts = [full.address, full.city, full.country]
            .map(value => String(value ?? "").trim())
            .filter(Boolean);
          const address = addressParts.filter((part, index) =>
            !addressParts.slice(0, index).some(previous =>
              previous.toLowerCase().includes(part.toLowerCase())
            )
          ).join(", ");
          const description = String(full.description ?? "").trim();
          const photo = httpUrl(full.photo);
          const website = httpUrl(full.website || full.Website || full.link, true);
          const google = `https://www.google.com/search?q=${encodeURIComponent([name, address].filter(Boolean).join(" "))}`;

          container.innerHTML = `
            ${photo ? `<a class="jppi-landmark__photo" href="${escapeHtml(photo)}" target="_blank" rel="noopener" aria-label="Open full-size photo">
              <img alt="${escapeHtml(name)}">
            </a>` : ""}
            <div class="jppi-landmark__body">
              ${category ? `<div class="jppi-landmark__badge">${escapeHtml(category)}</div>` : ""}
              ${address ? `<section>
                <h3>Address</h3>
                <p>${escapeHtml(address)}</p>
              </section>` : ""}
              ${description ? `<section>
                <h3>About</h3>
                <p>${escapeHtml(description)}</p>
              </section>` : ""}
              <div class="jppi-landmark__links">
                <a href="${escapeHtml(google)}" target="_blank" rel="noopener">
                  <i class="fas fa-search" aria-hidden="true"></i>Search on Google
                </a>
                ${website ? `<a href="${escapeHtml(website)}" target="_blank" rel="noopener">
                  <i class="fas fa-globe" aria-hidden="true"></i>Visit Website
                </a>` : ""}
              </div>
            </div>
          `;

          if (photo) {
            const photoLink = container.querySelector(".jppi-landmark__photo");
            const image = photoLink.querySelector("img");
            image.addEventListener("error", () => photoLink.remove(), { once: true });
            image.src = photo;
          }
        })
        .catch(() => {
          container.textContent = "Could not load details. Please try again.";
        });

      return container;
    }
  });

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