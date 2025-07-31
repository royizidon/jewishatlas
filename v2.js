// Enhanced filter button creation
const filterDiv = document.querySelector(".filter-grid");
const categories = [
  { name: "All", cat: "", icon: "fas fa-globe" },
  { name: "Featured", cat: "Featured", icon: "fas fa-star" },
  { name: "Synagogues", cat: "Synagogue", icon: "fas fa-place-of-worship" },
  { name: "Heritage", cat: "Heritage", icon: "fas fa-landmark" },
  { name: "Kosher Food", cat: "Kosher Restaurant", icon: "fas fa-utensils" },
  { name: "Community", cat: "Community", icon: "fas fa-users" }
];

categories.forEach((o, i) => {
  const btn = document.createElement("button");
  btn.innerHTML = `<i class="${o.icon}" style="margin-right: 6px;"></i>${o.name}`;
  btn.dataset.cat = o.cat;
  btn.className = "filterBtn" + (i === 0 ? " active" : "");
  filterDiv.appendChild(btn);
});

// Enhanced search widget with better configuration
const search = new Search({
  view: view,
  allPlaceholder: "🔍 Search landmarks, places, or addresses...",
  includeDefaultSources: true,
  locationEnabled: false,
  popupEnabled: true,
  resultGraphicEnabled: true,
  maxResults: 8,
  maxSuggestions: 6,
  minSuggestCharacters: 2,
  sources: []
});

// Add the search widget to the top-right with better positioning
view.ui.add(search, {
  position: "top-right",
  index: 0
});

// Enhanced search event handlers
search.on("search-start", () => {
  console.log("🔍 Search started");
  search.container.classList.add("loading");
});

search.on("search-complete", (event) => {
  console.log("✅ Search completed:", event);
  search.container.classList.remove("loading");
  
  if (event.results && event.results.length > 0) {
    const firstResult = event.results[0];
    if (firstResult.results && firstResult.results.length > 0) {
      const result = firstResult.results[0];
      console.log("📍 Selected result:", result.name);
      
      // Enhanced zoom animation for landmark results
      if (result.feature && result.feature.layer === globalLayer) {
        view.goTo({
          target: result.feature.geometry,
          zoom: 16,
          duration: 1500,
          easing: "ease-in-out"
        }).then(() => {
          // Subtle flash effect on the selected feature
          setTimeout(() => {
            view.popup.open({
              features: [result.feature],
              location: result.feature.geometry
            });
          }, 500);
        });
      }
    }
  }
});

// Enhanced globalLayer configuration
globalLayer.when(() => {
  console.log("🗺️ Layer loaded successfully");
  
  // Smooth zoom to layer extent
  view.goTo(globalLayer.fullExtent, {
    duration: 2000,
    easing: "ease-in-out"
  }).catch(console.error);
  
  // Enhanced landmarks search source
  const landmarksSource = {
    layer: globalLayer,
    searchFields: ["eng_name", "Address", "city"],
    displayField: "eng_name",
    exactMatch: false,
    outFields: ["*"],
    name: "🕍 Jewish Landmarks",
    placeholder: "e.g., Rabbi Itzhak Huri Synagogue",
    maxResults: 8,
    maxSuggestions: 10,
    suggestionsEnabled: true,
    minSuggestCharacters: 2,
    zoomScale: 5000
  };
  
  search.sources.unshift(landmarksSource);
  console.log("🔗 Search configured with landmarks layer");
});

// Enhanced filter button interactions with animations
filterDiv.addEventListener("click", (e) => {
  if (e.target.classList.contains("filterBtn")) {
    const cat = e.target.dataset.cat;
    currentFilter = cat;
    
    // Update button states with smooth transition
    filterDiv.querySelectorAll(".filterBtn").forEach(b => {
      b.classList.remove("active");
      // Add ripple effect
      const ripple = document.createElement("span");
      ripple.style.cssText = `
        position: absolute;
        border-radius: 50%;
        background: rgba(255,255,255,0.6);
        transform: scale(0);
        animation: ripple 0.6s linear;
        pointer-events: none;
      `;
    });
    
    e.target.classList.add("active");
    
    // Apply filters with smooth transition
    globalLayer.definitionExpression = cat ? `main_category='${cat}'` : "";
    
    if (dynamicLayer) {
      applyFilterToGraphicsLayer(dynamicLayer, cat);
    }
    
    // Visual feedback
    const container = document.getElementById("filterContainer");
    container.style.transform = "scale(1.02)";
    setTimeout(() => {
      container.style.transform = "scale(1)";
    }, 150);
    
    console.log(`🏷️ Filter applied: ${cat || 'All'}`);
  }
});

// Add ripple animation CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes ripple {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
  
  .filterBtn {
    position: relative;
    overflow: hidden;
  }
`;
document.head.appendChild(style);