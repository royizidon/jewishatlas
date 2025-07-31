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

  // DEFINE createPopupTemplate FUNCTION WITH GEOMETRY-BASED COORDINATES
  // DEFINE createPopupTemplate FUNCTION WITH IMPROVED DESIGN
// DEFINE createPopupTemplate FUNCTION WITH IMPROVED DESIGN
const createPopupTemplate = () => {
  return {
    title: "{eng_name}",
    content: [{
      type: "text",
      text: `
        <div style="
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          border-radius: 20px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          padding: 28px;
          margin: -8px;
	  width: calc(100% + 16px);
          box-shadow: 
            0 20px 60px rgba(0,0,0,0.12),
            0 8px 25px rgba(0,0,0,0.08),
            0 0 0 1px rgba(255,255,255,0.9);
          overflow: hidden;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        ">
          
          <!-- Category Label -->
          <div style="
            text-align: left;
            margin-bottom: 24px;
            color: #667eea;
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            display: flex;
            align-items: center;
            gap: 8px;
          ">
            <i class="fas fa-tag" style="font-size: 12px; opacity: 0.8;"></i>
            {main_category}
          </div>

          <!-- Google Search Button -->
          <a href="{expression/google-search-url}" target="_blank" style="
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            background: linear-gradient(135deg, #4285f4 0%, #34a853 100%);
            color: white;
            text-decoration: none;
            padding: 16px 24px;
            border-radius: 14px;
            text-align: center;
            font-weight: 600;
            font-size: 14px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 
              0 8px 20px rgba(66, 133, 244, 0.25),
              0 2px 8px rgba(66, 133, 244, 0.15);
            border: none;
            cursor: pointer;
            position: relative;
            overflow: hidden;
          " onmouseover="this.style.transform='translateY(-2px) scale(1.02)'; this.style.boxShadow='0 12px 30px rgba(66, 133, 244, 0.35), 0 4px 12px rgba(66, 133, 244, 0.2)'" onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 8px 20px rgba(66, 133, 244, 0.25), 0 2px 8px rgba(66, 133, 244, 0.15)'"
          >
            <i class="fas fa-search" style="font-size: 14px;"></i>
            Search on Google
          </a>
        </div>
      `
    }],
    
    // Expression for Google Search URL
    expressionInfos: [
      {
        name: "google-search-url",
        title: "Google Search URL",
        returnType: "string",
        expression: `
          return "https://www.google.com/search?q=" + $feature.eng_name + " " + $feature.Address;
        `
      }
    ]
  };
};
  const map = new Map({ basemap: "topo-vector" });
  const view = new MapView({
    container: "viewDiv",
    map,
    center: [16, 50],
    zoom: 6,
    ui: { components: [] }
  });
  
  console.log("*** MAP AND VIEW CREATED ***");
  console.log("View object:", view);
  
  view.ui.add(new Zoom({ view }),   { position: "bottom-right" });
  view.ui.add(new Locate({ view }), { position: "bottom-right" });
  view.ui.add(new Home({ view }),   { position: "bottom-right" });



// Create and configure the Search widget
const search = new Search({
  view: view,
  allPlaceholder: "Search landmarks or places...",
  includeDefaultSources: true,
  locationEnabled: false,
  popupEnabled: true,
  resultGraphicEnabled: true,
  sources: []
});

// Add the search widget to the top-right of the view
view.ui.add(search, {
  position: "top-right",
  index: 0
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
      type: "simple-marker", style: "circle", size: 6,
      color: "#888", outline: { color: "#fff", width: 1 }
    },
    uniqueValueInfos: [
      { value: "Featured", symbol: { type:"simple-marker", style:"circle", size:6, color:"#f39c12", outline:{color:"#fff",width:1} } },
      { value: "Synagogue", symbol: { type:"simple-marker", style:"circle", size:6, color:"#5DADE2", outline:{color:"#fff",width:1} } },
      { value: "Heritage", symbol: { type:"simple-marker", style:"circle", size:6, color:"#EC7063", outline:{color:"#fff",width:1} } },
      { value: "Kosher Restaurant", symbol: { type:"simple-marker", style:"circle", size:8, color:"#58D68D", outline:{color:"#fff",width:1} } },
      { value: "Community", symbol: { type:"simple-marker", style:"circle", size:6, color:"#F5B041", outline:{color:"#fff",width:1} } }
    ]
  });

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
    
    return symbolMap[category] || { type:"simple-marker", style:"circle", size:6, color:"#888", outline:{color:"#fff",width:1} };
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
    });

    const graphics = features.map(feature => {
      const point = new Point({
        x: feature.geometry.x,
        y: feature.geometry.y,
        spatialReference: view.spatialReference
      });

      const symbol = getSymbolForCategory(feature.attributes.main_category);

      return new Graphic({
        geometry: point,
        attributes: feature.attributes,
        symbol: symbol,
        popupTemplate: createPopupTemplate()
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
      
      try {
        const center = view.center;
        const features = await loadDynamicPoints(center);
        await createDynamicLayer(features);
        console.log("Loaded " + features.length + " dynamic points");
      } catch (error) {
        console.error("Error loading dynamic points:", error);
      } finally {
        loadingDynamic = false;
      }
    } else if (newZoom <= ZOOM_THRESHOLD && dynamicLayer) {
      map.remove(dynamicLayer);
      dynamicLayer = null;
      console.log("Removed dynamic layer");
    }
  });

  // Click handler for popups
  view.on("click", async event => {
    try {
      const { results } = await view.hitTest(event);
      
      // Check if dynamicLayer exists before comparing
      if (dynamicLayer) {
        const hit = results.find(r => r.graphic && r.graphic.layer === dynamicLayer);
        if (hit) {
          view.popup.open({
            features: [hit.graphic],
            location: event.mapPoint
          });
          return; // Exit early to prevent checking other layers
        }
      }
      
      // If no dynamic layer hit, check global layer
      const globalHit = results.find(r => r.graphic && r.graphic.layer === globalLayer);
      if (globalHit) {
        view.popup.open({
          features: [globalHit.graphic],
          location: event.mapPoint
        });
      }
    } catch (error) {
      console.error("Error handling click:", error);
    }
  });

globalLayer.when(() => {
  view.goTo(globalLayer.fullExtent).catch(console.error);
  
  // Add the landmarks layer as a search source
  const landmarksSource = {
    layer: globalLayer,
    searchFields: ["eng_name", "Address", "city"],
    displayField: "eng_name",
    exactMatch: false,
    outFields: ["*"],
    name: "Jewish Landmarks",
    placeholder: "e.g., Rabbi Itzhak Huri Synagogue",
    maxResults: 6,
    maxSuggestions: 8,
    suggestionsEnabled: true,
    minSuggestCharacters: 2
  };
  
  search.sources.unshift(landmarksSource);
  console.log("Search widget configured with landmarks layer");
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