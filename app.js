require([
  "esri/Map", "esri/views/MapView",
  "esri/layers/FeatureLayer", "esri/renderers/UniqueValueRenderer",
  "esri/widgets/Search", "esri/widgets/Locate", "esri/widgets/Home", "esri/widgets/Zoom"
], (
  Map, MapView,
  FeatureLayer, UniqueValueRenderer,
  Search, Locate, Home, Zoom
) => {

  // ─── MAP & VIEW ─────────────────────────────────────────
  const map = new Map({ basemap: "topo-vector" });
  const view = new MapView({
    container: "viewDiv",
    map,
    center: [14, 52], // Europe
    zoom: 12.3,
    ui: { components: [] }
  });

  // ─── UI BUTTONS ─────────────────────────────────────────
  view.ui.add(new Zoom({ view }),   { position: "bottom-right" });
  view.ui.add(new Locate({ view }), { position: "bottom-right" });
  view.ui.add(new Home({ view }),   { position: "bottom-right" });

  // ─── SEARCH WIDGET (in header) ─────────────────────────
  const search = new Search({
    view,
    container: "searchContainer",
    includeDefaultSources: true, // Enable default ArcGIS sources
    allPlaceholder: "Find a landmark or address…"
  });

  // ─── FILTER TOOLBAR (in header) ─────────────────────────
  const filterDiv = document.getElementById("filterContainer");
  const categories = [
    { name: "All",         cat: "" },
    { name: "Featured",    cat: "Featured" },
    { name: "Synagogues",  cat: "Synagogue" },
    { name: "Heritage",    cat: "Heritage" },
    { name: "Kosher Food", cat: "Kosher Restaurant" },
    { name: "Community",   cat: "Community" }
  ];
  categories.forEach((o,i) => {
    const btn = document.createElement("button");
    btn.textContent = o.name;
    btn.dataset.cat   = o.cat;
    btn.className     = "filterBtn" + (i===0 ? " active" : "");
    filterDiv.appendChild(btn);
  });

  // ─── RENDERER ───────────────────────────────────────────
  const renderer = new UniqueValueRenderer({
    field: "main_category",
    defaultSymbol: {
      type: "simple-marker", style: "circle", size: 8,
      color: "#888", outline: { color: "#fff", width: 1 }
    },
    uniqueValueInfos: [
      { value: "Featured", symbol: { type:"simple-marker", style:"circle", size:8, color:"#f39c12", outline:{color:"#fff",width:1} } },
      { value: "Synagogue", symbol: { type:"simple-marker", style:"circle", size:8, color:"#5DADE2", outline:{color:"#fff",width:1} } },
      { value: "Heritage", symbol: { type:"simple-marker", style:"circle", size:8, color:"#EC7063", outline:{color:"#fff",width:1} } },
      { value: "Kosher Restaurant", symbol: { type:"simple-marker", style:"circle", size:8, color:"#58D68D", outline:{color:"#fff",width:1} } },
      { value: "Community", symbol: { type:"simple-marker", style:"circle", size:8, color:"#F5B041", outline:{color:"#fff",width:1} } }
    ]
  });

  // ─── SAMPLE LAYER ───────────────────────────────────────
  const sampleFL = new FeatureLayer({
    url: window.LANDMARKS_SERVICE_URL,
    outFields: ["*"],
    popupTemplate: {
      title: "{eng_name}",
      content: "{description}"
    },
    renderer: renderer
  });
  map.add(sampleFL);

  // ─── HOOK SEARCH & FILTERS ──────────────────────────────
  sampleFL.when(() => {
    // zoom to show all
    view.goTo(sampleFL.fullExtent).catch(console.error);

    // Add your custom layer source to the existing default sources
    const customSource = {
      layer:        sampleFL,
      searchFields: ["eng_name"],
      displayField: "eng_name",
      exactMatch:   false,
      outFields:    ["*"],
      name:         "Jewish Landmarks",
      placeholder:  "e.g., Mikveh Israel"
    };

    // Add custom source to the beginning of the sources array
    search.sources.unshift(customSource);

    // wire up filters
    filterDiv.querySelectorAll(".filterBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const cat = btn.dataset.cat;
        sampleFL.definitionExpression = cat
          ? `main_category='${cat}'` : "";
        filterDiv.classList.toggle("filtered", !!cat);
        filterDiv.querySelectorAll(".filterBtn")
                 .forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
  });

});