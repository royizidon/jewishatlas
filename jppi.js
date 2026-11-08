require([
  "esri/Map", "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/renderers/UniqueValueRenderer",
  "esri/widgets/Search", "esri/widgets/Home", "esri/widgets/Zoom"
], (
  Map, MapView,
  FeatureLayer,
  UniqueValueRenderer,
  Search, Home, Zoom
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

  const landmarkDialog = document.createElement("dialog");
  landmarkDialog.className = "jppi-landmark-dialog";
  landmarkDialog.setAttribute("aria-label", "Landmark information");
  landmarkDialog.addEventListener("click", event => {
    if (event.target === landmarkDialog) landmarkDialog.close();
  });
  document.body.append(landmarkDialog);

  function openLandmark(graphic) {
    const attrs = graphic.attributes || {};
    const id = attrs.id ?? attrs.OBJECTID ?? "";
    const container = document.createElement("div");
    container.className = "jppi-landmark";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "custom-close-btn";
    closeButton.setAttribute("aria-label", "Close landmark details");
    closeButton.textContent = "✕";
    closeButton.addEventListener("click", event => {
      event.stopPropagation();
      landmarkDialog.close();
    });

    const body = document.createElement("div");
    body.className = "popup-scroll-body";
    body.tabIndex = 0;
    body.setAttribute("role", "region");
    body.setAttribute("aria-label", "Landmark information");
    body.innerHTML = '<p class="popup-status" role="status">Loading…</p>';
    container.append(closeButton, body);

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

        const hours = String(full.fees_opening_hours ?? "").trim();
        const infoSection = (label, value) => value ? `
          <section class="info-section">
            <h3 class="info-label">${label}</h3>
            <p class="info-value">${escapeHtml(value)}</p>
          </section>` : "";

        body.innerHTML = `
            ${photo ? `<button type="button" class="popup-image" aria-label="View full photo of ${escapeHtml(name)}">
              <img alt="${escapeHtml(name)}">
            </button>` : ""}
            ${category ? `<div class="popup-category"><span class="category-badge">${escapeHtml(category)}</span></div>` : ""}
            <h2 class="popup-info-heading">Info</h2>
            <div class="popup-content-wrapper">
              ${infoSection("Address", address)}
              ${infoSection("About", description)}
              ${infoSection("Hours &amp; Fees", hours)}
              <div class="popup-links">
                <a class="primary-button" href="${escapeHtml(google)}" target="_blank" rel="noopener">Search on Google</a>
                ${website ? `<a class="primary-button site-link" href="${escapeHtml(website)}" target="_blank" rel="noopener">Visit Website</a>` : ""}
              </div>
            </div>
        `;

        if (photo) {
          const photoButton = container.querySelector(".popup-image");
          const image = photoButton.querySelector("img");
          image.addEventListener("error", () => photoButton.remove(), { once: true });
          image.src = photo;
          photoButton.addEventListener("click", event => {
            event.stopPropagation();
            const dialog = document.createElement("dialog");
            dialog.className = "jppi-photo-lightbox";
            dialog.setAttribute("aria-label", `Photo of ${name}`);
            dialog.innerHTML = '<button type="button" aria-label="Close photo">×</button>';
            dialog.append(image.cloneNode());
            dialog.querySelector("button").addEventListener("click", () => dialog.close());
            dialog.addEventListener("click", event => {
              if (event.target === dialog) dialog.close();
            });
            dialog.addEventListener("close", () => dialog.remove(), { once: true });
            document.body.append(dialog);
            dialog.showModal();
          });
        }
      })
      .catch(() => {
        body.innerHTML = '<p class="popup-status" role="status">Could not load details. Please try again.</p>';
      });

    landmarkDialog.replaceChildren(container);
    if (!landmarkDialog.open) landmarkDialog.showModal();
  }

  const map = new Map({ basemap: "topo-vector" });
  const view = new MapView({
    container: "viewDiv",
    map,
    center: [25, 45],
    zoom: 4,
    ui: { components: [] },
    popupEnabled: false
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
    popupEnabled: false,
    renderer: globalRenderer
  });
  map.add(globalLayer);

  view.on("click", async event => {
    try {
      const response = await view.hitTest(event, { include: [globalLayer] });
      if (!response.results.length) return;
      const hit = response.results.find(r => r.graphic?.layer === globalLayer);
      if (hit) openLandmark(hit.graphic);
    } catch (error) {
      console.error("Error handling click:", error);
    }
  });

  search.on("select-result", event => {
    if (event.source?.layer === globalLayer && event.result?.feature) {
      openLandmark(event.result.feature);
    }
  });

  globalLayer.when(() => {
    const landmarksSource = {
      layer: globalLayer,
      popupEnabled: false,
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