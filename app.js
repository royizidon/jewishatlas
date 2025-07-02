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

  // DEFINE createPopupTemplate FUNCTION FIRST
  const createPopupTemplate = () => {
    return {
      title: "{eng_name}",
      content: [{
        type: "text",
        text: `
          <div style="
            background-color: white;
            border-radius: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            padding: 0;
            margin: 0;
            max-width: 400px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            overflow: hidden;
          ">
            
            <!-- Photo Section (if photo exists) -->
            <div style="width: 100%; height: 200px; background-image: url({expression/has-photo}); background-size: cover; background-position: center; background-repeat: no-repeat; display: {expression/has-photo ? 'block' : 'none'};"></div>
            
            <!-- Header Section -->
            <div style="padding: 20px 20px 15px 20px;">
              <h2 style="
                color: #2C3E50;
                font-size: 20px;
                font-weight: 600;
                margin: 0 0 8px 0;
                line-height: 1.3;
              ">{eng_name}</h2>
              
              <div style="
                display: inline-block;
                background-color: #E8F4FD;
                color: #2980B9;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 15px;
              ">{main_category}</div>
            </div>

            <!-- Content Section -->
            <div style="padding: 0 20px 15px 20px;">
              
              <!-- Address -->
              <div style="margin-bottom: 12px;">
                <div style="
                  color: #7F8C8D;
                  font-size: 12px;
                  font-weight: 500;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  margin-bottom: 4px;
                ">📍 ADDRESS</div>
                <div style="
                  color: #2C3E50;
                  font-size: 14px;
                  line-height: 1.4;
                ">{Address}, {city}</div>
              </div>

              <!-- Description (if exists) -->
              <div style="margin-bottom: 12px; display: {expression/has-description ? 'block' : 'none'};">
                <div style="
                  color: #7F8C8D;
                  font-size: 12px;
                  font-weight: 500;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  margin-bottom: 4px;
                ">ℹ️ ABOUT</div>
                <div style="
                  color: #2C3E50;
                  font-size: 14px;
                  line-height: 1.5;
                ">{expression/has-description}</div>
              </div>

              <!-- Fees & Hours (if exists) -->
              <div style="margin-bottom: 12px; display: {expression/has-fees-hours ? 'block' : 'none'};">
                <div style="
                  color: #7F8C8D;
                  font-size: 12px;
                  font-weight: 500;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  margin-bottom: 4px;
                ">🕐 HOURS & FEES</div>
                <div style="
                  color: #2C3E50;
                  font-size: 14px;
                  line-height: 1.5;
                ">{expression/has-fees-hours}</div>
              </div>

            </div>

            <!-- Action Buttons -->
            <div style="padding: 20px; background-color: #F8F9FA; border-top: 1px solid #E9ECEF;">
              
              <!-- Primary Search Button -->
              <a href="{expression/google-search-url}" target="_blank" style="display: block; background-color: #4575B4; color: white; text-decoration: none; padding: 15px; border-radius: 8px; text-align: center; font-weight: bold; font-size: 16px; margin-bottom: 15px;">
                🔍 Search for Details
              </a>

              <!-- Navigation Buttons Row -->
              <div style="margin-bottom: 15px;">
                <a href="{expression/google-maps-url}" target="_blank" style="display: inline-block; width: 48%; background-color: #34A853; color: white; text-decoration: none; padding: 12px 8px; border-radius: 6px; text-align: center; font-weight: bold; font-size: 14px; margin-right: 4%;">
                  📍 Google Maps
                </a>
                <a href="{expression/waze-url}" target="_blank" style="display: inline-block; width: 48%; background-color: #33CCFF; color: white; text-decoration: none; padding: 12px 8px; border-radius: 6px; text-align: center; font-weight: bold; font-size: 14px;">
                  🚗 Waze
                </a>
              </div>

              <!-- Feedback Section -->
              <div style="text-align: center; padding: 12px; background-color: white; border-radius: 6px; border: 1px solid #E0E0E0;">
                <div style="color: #666; font-size: 13px; margin-bottom: 6px;">💬 Got feedback?</div>
                <a href="{expression/feedback-url}" target="_blank" style="color: #4575B4; text-decoration: none; font-weight: bold; font-size: 14px;">
                  Fill our form →
                </a>
              </div>
            </div>
          </div>
        `
      }],
      
      // Expression functions for dynamic content
      expressionInfos: [
        // Check if photo exists and display it
        {
          name: "has-photo",
          title: "Photo Section",
          returnType: "string",
          expression: `
            var photoUrl = $feature.photo;
            if (photoUrl != null && photoUrl != "" && photoUrl != " ") {
              return photoUrl;
            } else {
              return "";
            }
          `
        },
        
        // Check if description exists and display it
        {
          name: "has-description", 
          title: "Description Section",
          returnType: "string",
          expression: `
            var desc = $feature.description;
            if (desc != null && desc != "" && desc != " ") {
              return desc;
            } else {
              return "";
            }
          `
        },
        
        // Check if fees/hours exists and display it
        {
          name: "has-fees-hours",
          title: "Fees and Hours Section", 
          returnType: "string",
          expression: `
            var feesHours = $feature.fees_opening_hours;
            if (feesHours != null && feesHours != "" && feesHours != " ") {
              return feesHours;
            } else {
              return "";
            }
          `
        },
        
        // Google Search URL
        {
          name: "google-search-url",
          title: "Google Search URL",
          expression: `
            return "https://www.google.com/search?q=" + $feature.eng_name + " " + $feature.Address;
          `
        },
        
        // Google Maps Navigation URL
        {
          name: "google-maps-url",
          title: "Google Maps URL",
          expression: `
            return "https://www.google.com/maps/dir/?api=1&destination=" + $feature.lat + "," + $feature.lon;
          `
        },
        
        // Waze Navigation URL
        {
          name: "waze-url",
          title: "Waze URL",
          expression: `
            return "https://waze.com/ul?ll=" + $feature.lat + "," + $feature.lon + "&navigate=yes";
          `
        },
        
        // Feedback Form URL
        {
          name: "feedback-url",
          title: "Feedback URL",
          expression: `
            return "https://docs.google.com/forms/d/e/1FAIpQLSeVWy9b_hWAk2qjTvabxsuQl-Lr1ewUY4CRVT6kTQGt7egSag/viewform?usp=pp_url&entry.1424782895=" + $feature.id;
          `
        }
      ]
    };
  };

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