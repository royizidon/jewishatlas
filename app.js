require([
  "esri/Map", "esri/views/MapView",
  "esri/layers/FeatureLayer", "esri/layers/GraphicsLayer", "esri/renderers/UniqueValueRenderer",
  "esri/widgets/Search", "esri/widgets/Locate", "esri/widgets/Home", "esri/widgets/Zoom",
  "esri/Graphic", "esri/geometry/Point", "esri/PopupTemplate", "esri/geometry/projection", "esri/geometry/SpatialReference"
], (
  Map, MapView,
  FeatureLayer, GraphicsLayer, UniqueValueRenderer,
  Search, Locate, Home, Zoom,
  Graphic, Point, PopupTemplate, projection, SpatialReference
) => {

  console.log("*** REQUIRE BLOCK STARTED ***");
  console.log("Map inside require:", typeof Map);
  console.log("MapView inside require:", typeof MapView);

  const map = new Map({ basemap: "topo-vector" });
  const view = new MapView({
    container: "viewDiv",
    map,
    center: [15, 52],
    zoom: 5.5,
    ui: { components: [] }
  });
  
  console.log("*** MAP AND VIEW CREATED ***");
  console.log("View object:", view);
  
  view.ui.add(new Zoom({ view }),   { position: "bottom-right" });
  view.ui.add(new Locate({ view }), { position: "bottom-right" });
  view.ui.add(new Home({ view }),   { position: "bottom-right" });
  
  // ... rest of your code

  const search = new Search({
    view,
    container: "searchContainer",
    includeDefaultSources: true,
    allPlaceholder: "Find a landmark or address..."
  });

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

  const globalRenderer = new UniqueValueRenderer({
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

  const dynamicRenderer = new UniqueValueRenderer({
    field: "main_category",
    defaultSymbol: {
      type: "simple-marker", style: "square", size: 12,
      color: "#FF0000", outline: { color: "#FFFFFF", width: 3 }
    },
    uniqueValueInfos: [
      { value: "Featured", symbol: { type:"simple-marker", style:"square", size:12, color:"#FF0000", outline:{color:"#FFFFFF",width:3} } },
      { value: "Synagogue", symbol: { type:"simple-marker", style:"square", size:12, color:"#FF0000", outline:{color:"#FFFFFF",width:3} } },
      { value: "Heritage", symbol: { type:"simple-marker", style:"square", size:12, color:"#FF0000", outline:{color:"#FFFFFF",width:3} } },
      { value: "Kosher Restaurant", symbol: { type:"simple-marker", style:"square", size:12, color:"#FF0000", outline:{color:"#FFFFFF",width:3} } },
      { value: "Community", symbol: { type:"simple-marker", style:"square", size:12, color:"#FF0000", outline:{color:"#FFFFFF",width:3} } }
    ]
  });

  const ZOOM_THRESHOLD = 8;
  let dynamicLayer = null;
  let currentFilter = "";
  
  const globalLayer = new FeatureLayer({
    url: window.LANDMARKS_SERVICE_URL,
    outFields: ["*"],
    popupTemplate: {
      title: "{eng_name}",
      content: "{description}"
    },
    renderer: globalRenderer
  });
  
  map.add(globalLayer);

  async function loadDynamicPoints(center) {
    try {
      console.log("Fetching from:", window.LANDMARKS_PROXY_URL);
      console.log("Center:", center.longitude, center.latitude);
      
      const extent = view.extent;
      console.log("Original extent (Web Mercator):", extent);
      
      const wgs84Extent = projection.project(extent, new SpatialReference({ wkid: 4326 }));
      console.log("Converted extent (WGS84):", wgs84Extent);
      
      const geometryObj = {
        xmin: wgs84Extent.xmin,
        ymin: wgs84Extent.ymin,
        xmax: wgs84Extent.xmax,
        ymax: wgs84Extent.ymax,
        spatialReference: { wkid: 4326 }
      };
      
      const requestBody = new URLSearchParams({
        f: "json",
        where: "1=1",
        outFields: "*",
        geometry: JSON.stringify(geometryObj),
        geometryType: "esriGeometryEnvelope",
        spatialRel: "esriSpatialRelIntersects",
        returnGeometry: "true",
        maxRecordCount: 500
      });
      
      console.log("Geometry object:", geometryObj);
      
      const response = await fetch(window.LANDMARKS_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: requestBody
      });
      
      console.log("Response status:", response.status);
      
      if (!response.ok) {
        throw new Error("HTTP error! status: " + response.status);
      }
      
      const data = await response.json();
      console.log("Response data:", data);
      console.log("Features count:", data.features ? data.features.length : 0);
      
      if (data.features && data.features.length > 0) {
        console.log("First feature:", data.features[0]);
        
        // Show coordinates of all features to see where they are
        console.log("Feature locations:");
        data.features.slice(0, 5).forEach((feature, i) => {
          console.log(`Feature ${i+1}: x=${feature.geometry.x}, y=${feature.geometry.y}`);
        });
        
        // Calculate extent of returned features
        const coords = data.features.map(f => ({ x: f.geometry.x, y: f.geometry.y }));
        const minX = Math.min(...coords.map(c => c.x));
        const maxX = Math.max(...coords.map(c => c.x));
        const minY = Math.min(...coords.map(c => c.y));
        const maxY = Math.max(...coords.map(c => c.y));
        
        console.log("Returned features extent:");
        console.log(`  X range: ${minX} to ${maxX}`);
        console.log(`  Y range: ${minY} to ${maxY}`);
        console.log("Current view extent:", wgs84Extent);
      }
      
      return data.features || [];
    } catch (error) {
      console.error("Error loading dynamic points:", error);
      return [];
    }
  }

  // Helper function to get symbol based on category (same as global layer)
  function getSymbolForCategory(category) {
    const symbolMap = {
      "Featured": { type:"simple-marker", style:"circle", size:8, color:"#f39c12", outline:{color:"#fff",width:1} },
      "Synagogue": { type:"simple-marker", style:"circle", size:8, color:"#5DADE2", outline:{color:"#fff",width:1} },
      "Heritage": { type:"simple-marker", style:"circle", size:8, color:"#EC7063", outline:{color:"#fff",width:1} },
      "Kosher Restaurant": { type:"simple-marker", style:"circle", size:8, color:"#58D68D", outline:{color:"#fff",width:1} },
      "Community": { type:"simple-marker", style:"circle", size:8, color:"#F5B041", outline:{color:"#fff",width:1} }
    };
    
    return symbolMap[category] || { type:"simple-marker", style:"circle", size:8, color:"#888", outline:{color:"#fff",width:1} };
  }

  async function createDynamicLayer(features) {
    if (dynamicLayer) {
      map.remove(dynamicLayer);
      dynamicLayer = null;
    }

    if (features.length === 0) return;

    console.log("Creating dynamic layer with", features.length, "features");

    dynamicLayer = new GraphicsLayer({
      title: "Dynamic Landmarks"
      // Remove renderer - we'll set symbols individually
    });

    const graphics = features.map(feature => {
      // The geometry is already in the correct spatial reference (from outSR parameter)
      const point = new Point({
        x: feature.geometry.x,
        y: feature.geometry.y,
        spatialReference: view.spatialReference
      });

      // Get the appropriate symbol for this feature's category
      const symbol = getSymbolForCategory(feature.attributes.main_category);

      return new Graphic({
        geometry: point,
        attributes: feature.attributes,
        symbol: symbol,  // Apply symbol directly to graphic
        popupTemplate: {
          title: "{eng_name}",
          content: "{description}"
        }
      });
    });

    dynamicLayer.addMany(graphics);

    if (currentFilter) {
      applyFilterToGraphicsLayer(dynamicLayer, currentFilter);
    }

    map.add(dynamicLayer);
    console.log("Dynamic layer added to map with", graphics.length, "graphics");
    
    // Log first few graphics to verify coordinates and symbols
    if (graphics.length > 0) {
      console.log("First graphic coordinates:", graphics[0].geometry.x, graphics[0].geometry.y);
      console.log("First graphic category:", graphics[0].attributes.main_category);
      console.log("First graphic symbol:", graphics[0].symbol);
    }
  }

  function applyFilterToGraphicsLayer(layer, category) {
    if (!layer || !layer.graphics) return;
    
    layer.graphics.forEach(graphic => {
      const shouldShow = !category || graphic.attributes.main_category === category;
      graphic.visible = shouldShow;
    });
  }

  let loadingDynamic = false;
  
  view.watch("zoom", async (newZoom) => {
    if (newZoom > ZOOM_THRESHOLD && !loadingDynamic) {
      loadingDynamic = true;
      console.log("Loading dynamic points...");
      
      const center = view.center;
      const features = await loadDynamicPoints(center);
      await createDynamicLayer(features);
      
      loadingDynamic = false;
      console.log("Loaded " + features.length + " dynamic points");
    } else if (newZoom <= ZOOM_THRESHOLD && dynamicLayer) {
      map.remove(dynamicLayer);
      dynamicLayer = null;
      console.log("Removed dynamic layer");
    }
  });

  globalLayer.when(() => {
    view.goTo(globalLayer.fullExtent).catch(console.error);

    search.sources.unshift({
      layer:        globalLayer,
      searchFields: ["eng_name"],
      displayField: "eng_name",
      exactMatch:   false,
      outFields:    ["*"],
      name:         "Jewish Landmarks",
      placeholder:  "e.g., Mikveh Israel"
    });

    filterDiv.querySelectorAll(".filterBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const cat = btn.dataset.cat;
        currentFilter = cat;
        
        globalLayer.definitionExpression = cat ? "main_category='" + cat + "'" : "";
        
        if (dynamicLayer) {
          applyFilterToGraphicsLayer(dynamicLayer, cat);
        }
        
        filterDiv.classList.toggle("filtered", !!cat);
        filterDiv.querySelectorAll(".filterBtn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
  });

});