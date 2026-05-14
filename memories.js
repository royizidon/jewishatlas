/**
 * Jewish Atlas — Memories Mode
 * ============================
 * Adds an "Memories" filter chip that swaps the place layer for the
 * Memorial Wall layer (gold dots, one per dedication).
 *
 * Wired from app.js via:
 *   initMemoriesMode({ view, map, FeatureLayer, ..., globalLayer, search,
 *                      filterContainer, DeviceInfo, GeoUtils });
 *
 * The module owns:
 *   - the Memories FeatureLayer
 *   - the popup template for memories
 *   - the chip + filter-row integration
 *   - the search-source swap
 *
 * It does NOT own the click handler. app.js calls
 * window.__memoriesIsHit(graphic) and window.__memoriesIsLayer(layer)
 * to route hits.
 */

(function () {
  // -------- Configuration --------
  // v5 — includes connection_type field
  const MEMORIES_LAYER_URL =
    "https://services-eu1.arcgis.com/FckSU1kja7wbnBnq/arcgis/rest/services/" +
    "JewishAtlas_Memories_Public_20260513_v5/FeatureServer/0";

  const STORY_BASE_URL = "https://jewishatlas.org/memory.html?slug=";

  const CHIP_LABEL = "Memories";
  const CHIP_CAT   = "Memories";              // data-cat value
  const GOLD       = "#c5a47e";               // matches --ja-gold
  const GOLD_DARK  = "#92724f";               // matches popup accent text

  // connection_type coded value → display label for the popup eyebrow.
  // 'other' and unknown/empty codes deliberately map to "" so the popup
  // skips the eyebrow entirely rather than printing a meaningless label.
  const CONNECTION_LABELS = {
    birthplace:    "Birthplace",
    hometown:      "Hometown",
    family_origin: "Family origin",
    home:          "Home",
    resting_place: "Resting place",
    meaningful:    "Meaningful place",
    other:         ""
  };

  // Public init — called once from app.js
  window.initMemoriesMode = function initMemoriesMode(ctx) {
    const {
      view, map, FeatureLayer, UniqueValueRenderer,
      Search, search, globalLayer, filterContainer,
      DeviceInfo,
    } = ctx;

    if (!view || !FeatureLayer || !globalLayer || !filterContainer) {
      console.warn("[memories] init skipped — missing context");
      return;
    }

    // ------------------------------------------------------------------
    // Popup template
    // ------------------------------------------------------------------
    const memoriesPopupTemplate = {
      title: null,
      outFields: ["*"],
      // Suppress the default "Zoom to" action bar — keeps the popup chrome-free
      actions: [],
      overwriteActions: true,
      content: function (feature) {
        const a = feature.graphic.attributes || {};

        const heName    = (a.he_name    || "").trim();
        const engName   = (a.eng_name   || "").trim();
        const bornHe    = (a.born_str   || "").trim();
        const deathHe   = (a.death_str  || "").trim();
        const bornEn    = toYear(a.born_display);
        const deathEn   = toYear(a.death_display);
        const location  = cleanLocation(a.location_label || a.origin || "");
        const why       = (a.why_this_place || "").trim();
        const connRaw   = String(a.connection_type || "").trim();
        const connType  = connectionLabel(a.connection_type);
        const slug      = (a.slug || "").trim();
        const tier      = (a.tier || "").toLowerCase();

        // Dates: Hebrew line + Gregorian line, each shown independently
        // Format mirrors wall.html modal: "born – death"
        const datesHe = formatDatePair(bornHe, deathHe);
        const datesEn = formatDatePair(bornEn, deathEn);

        const showStoryLink = tier === "page" && slug;
        const storyUrl = showStoryLink ? STORY_BASE_URL + encodeURIComponent(slug) : "";
        const wallUrl = "https://jewishatlas.org/wall.html";

        const container = document.createElement("div");
        container.className = "enhanced-popup-container memories-popup";

        // Build name block — Hebrew primary if present, English secondary
        let nameBlock = "";
        if (heName && engName) {
          nameBlock = `
            <h2 class="popup-title memories-he-name" dir="rtl" lang="he">${escapeHtml(heName)}</h2>
            <div class="memories-eng-name">${escapeHtml(engName)}</div>
          `;
        } else if (heName) {
          nameBlock = `<h2 class="popup-title memories-he-name" dir="rtl" lang="he">${escapeHtml(heName)}</h2>`;
        } else if (engName) {
          nameBlock = `<h2 class="popup-title memories-eng-name-solo">${escapeHtml(engName)}</h2>`;
        } else {
          nameBlock = `<h2 class="popup-title">In Memory</h2>`;
        }

        // Actions block:
        //   - page tier: primary "Read the full story" + secondary "View on the Wall"
        //   - brick tier: primary "View on the Wall" (the dead-end becomes a bridge)
        let actionsBlock = "";
        if (showStoryLink) {
          actionsBlock = `
            <a href="${storyUrl}" class="memories-action memories-action-primary">Read the full story</a>
            <a href="${wallUrl}" class="memories-action memories-action-secondary">View on the Wall →</a>
          `;
        } else {
          actionsBlock = `
            <a href="${wallUrl}" class="memories-action memories-action-primary">View on the Wall →</a>
          `;
        }

        let html = `
          ${nameBlock}
          <div class="popup-category memories-dates-row">
            ${datesHe ? `<div class="memories-dates-he" dir="rtl" lang="he">${escapeHtml(datesHe)}</div>` : ""}
            ${datesEn ? `<div class="memories-dates-en">${escapeHtml(datesEn)}</div>` : ""}
          </div>
          <div class="popup-content-wrapper">
            <div class="tab-content active memories-body">
              ${connType ? `<div class="memories-connection">${escapeHtml(connType)}</div>` : ""}
              ${location ? `<div class="memories-place">${escapeHtml(location)}</div>` : ""}
              ${why ? renderWhy(why, connRaw, connType) : ""}

              <div class="memories-actions">
                ${actionsBlock}
              </div>
            </div>
          </div>
        `;

        container.innerHTML = html;

        // Stop popup clicks from reaching the map
        ["click", "mousedown", "mouseup", "touchstart", "touchend"].forEach(evt => {
          container.addEventListener(evt, (e) => e.stopPropagation(), { passive: false });
        });

        // Custom close button (matches places popup pattern)
        const closeBtn = document.createElement("button");
        closeBtn.className = "custom-close-btn";
        closeBtn.textContent = "✕";
        closeBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          view.popup.close();
          view.popup.clear();
          view.popup.visible = false;
        });
        container.appendChild(closeBtn);

        // Mobile: same-tab navigation; desktop: new tab.
        // Applies to both primary and secondary action links.
        const isMobile = DeviceInfo && DeviceInfo.isMobile && DeviceInfo.isMobile();
        container.querySelectorAll(".memories-action").forEach(link => {
          if (isMobile) {
            link.setAttribute("target", "_self");
            link.removeAttribute("rel");
          } else {
            link.setAttribute("target", "_blank");
            link.setAttribute("rel", "noopener");
          }
        });

        return container;
      }
    };

    // ------------------------------------------------------------------
    // Renderer — gold dots with subtle outline
    // ------------------------------------------------------------------
    const memoriesRenderer = {
      type: "simple",
      symbol: {
        type: "simple-marker",
        style: "circle",
        size: 9,
        color: GOLD,
        outline: { color: "#fffef9", width: 1.25 }
      },
      visualVariables: [{
        type: "size",
        valueExpression: "$view.scale",
        stops: [
          { scale: 591657527, size: 4 },
          { scale: 144447,    size: 7 },
          { scale: 18055,     size: 10 }
        ]
      }]
    };

    // Cluster renderer — same gold language
    const memoriesClusterConfig = {
      type: "cluster",
      clusterRadius: "80px",
      clusterMinSize: "20px",
      clusterMaxSize: "60px",
      symbol: {
        type: "simple-marker",
        style: "circle",
        size: 24,
        color: [197, 164, 126, 0.75],     // GOLD with alpha
        outline: { color: "#fffef9", width: 1.5 }
      },
      popupTemplate: {
        title: "Cluster ({cluster_count} memories)",
        content: "This cluster contains {cluster_count} memories. Zoom in to see individual names.",
        fieldInfos: [{
          fieldName: "cluster_count",
          format: { digitSeparator: true, places: 0 }
        }]
      }
    };

    // ------------------------------------------------------------------
    // The layer
    // ------------------------------------------------------------------
    const memoriesLayer = new FeatureLayer({
      url: MEMORIES_LAYER_URL,
      outFields: [
        "slug", "he_name", "eng_name",
        "born_display", "death_display",
        "born_str", "death_str",
        "origin", "location_label", "location_precision",
        "why_this_place", "connection_type", "tier", "show_on_map"
      ],
      definitionExpression: "show_on_map = 1",
      popupTemplate: memoriesPopupTemplate,
      renderer: memoriesRenderer,
      featureReduction: memoriesClusterConfig,
      visible: false,                       // hidden until user picks Memories
      title: "Memories",
      listMode: "hide"
    });
    map.add(memoriesLayer);

    // Same zoom-threshold cluster toggle the places layer uses
    const CLUSTER_ZOOM_THRESHOLD = 12;
    memoriesLayer.when(() => {
      if (view.zoom >= CLUSTER_ZOOM_THRESHOLD) {
        memoriesLayer.featureReduction = null;
      }
      view.watch("zoom", (zoom) => {
        if (zoom >= CLUSTER_ZOOM_THRESHOLD && memoriesLayer.featureReduction) {
          memoriesLayer.featureReduction = null;
        } else if (zoom < CLUSTER_ZOOM_THRESHOLD && !memoriesLayer.featureReduction) {
          memoriesLayer.featureReduction = memoriesClusterConfig;
        }
      });
    });

    // ------------------------------------------------------------------
    // Chip
    // ------------------------------------------------------------------
    const chip = document.createElement("button");
    chip.textContent = CHIP_LABEL;
    chip.dataset.cat = CHIP_CAT;
    chip.className = "filterBtn memoriesBtn";
    filterContainer.appendChild(chip);

    // ------------------------------------------------------------------
    // Search source swap
    // ------------------------------------------------------------------
    let originalSources = null;
    let originalIncludeDefault = null;
    let originalPlaceholder = null;

    const memoriesSearchSource = search ? {
      layer: memoriesLayer,
      searchFields: ["eng_name", "he_name"],
      displayField: "eng_name",
      exactMatch: false,
      outFields: ["*"],
      name: "Memories",
      placeholder: "Search a name (English or Hebrew)…",
      maxResults: 6,
      maxSuggestions: 6,
      suggestionsEnabled: true,
      minSuggestCharacters: 2,
      zoomScale: 50000,
      popupEnabled: false,
      resultGraphicEnabled: false,
      suggestionTemplate: "{eng_name}"
    } : null;

    function snapshotSearchState() {
      if (!search || originalSources !== null) return;
      // sources is a Collection; toArray() gives a stable copy
      originalSources = search.sources && search.sources.toArray
        ? search.sources.toArray()
        : (Array.isArray(search.sources) ? search.sources.slice() : []);
      originalIncludeDefault = search.includeDefaultSources;
      const input = document.querySelector("#searchContainer .esri-search__input");
      originalPlaceholder = input ? input.placeholder : "Search a city, country or place…";
    }

    function activateMemoriesSearch() {
      if (!search || !memoriesSearchSource) return;
      snapshotSearchState();
      search.includeDefaultSources = false;
      search.sources = [memoriesSearchSource];
      search.activeSourceIndex = 0;
      const input = document.querySelector("#searchContainer .esri-search__input");
      if (input) input.placeholder = "Search a name (English or Hebrew)…";
      if (search.allPlaceholder !== undefined) {
        search.allPlaceholder = "Search a name (English or Hebrew)…";
      }
    }

    function restoreDefaultSearch() {
      if (!search || originalSources === null) return;
      search.sources = originalSources;
      search.includeDefaultSources = originalIncludeDefault;
      const input = document.querySelector("#searchContainer .esri-search__input");
      if (input) input.placeholder = originalPlaceholder || "Search a city, country or place…";
      if (search.allPlaceholder !== undefined) {
        search.allPlaceholder = originalPlaceholder || "Search a city, country or place…";
      }
    }

    // ------------------------------------------------------------------
    // Mode switching
    // ------------------------------------------------------------------
    function activateMemoriesMode() {
      globalLayer.visible = false;
      memoriesLayer.visible = true;
      activateMemoriesSearch();
    }

    function deactivateMemoriesMode() {
      memoriesLayer.visible = false;
      globalLayer.visible = true;
      restoreDefaultSearch();
    }

    // ------------------------------------------------------------------
    // Wire chip to filter row
    // ------------------------------------------------------------------
    // Memories chip click
    chip.addEventListener("click", () => {
      const buttons = filterContainer.querySelectorAll(".filterBtn");
      buttons.forEach(b => b.classList.remove("active"));
      chip.classList.add("active");
      filterContainer.classList.add("filtered");
      // Clear the place layer's definitionExpression so when we come back,
      // it shows everything (parity with clicking "All")
      globalLayer.definitionExpression = "";
      activateMemoriesMode();
    });

    // Existing chips → make sure they deactivate Memories
    // (their handler in app.js sets globalLayer.definitionExpression but
    // doesn't know about us — we wrap that here)
    filterContainer.querySelectorAll(".filterBtn:not(.memoriesBtn)").forEach(btn => {
      btn.addEventListener("click", () => {
        if (memoriesLayer.visible) deactivateMemoriesMode();
      });
    });

    // ------------------------------------------------------------------
    // Click-handler hooks
    // app.js's hit-test only checks globalLayer. Expose two helpers it
    // can use to also route Memory hits.
    // ------------------------------------------------------------------
    window.__memoriesIsLayer = (layer) => layer === memoriesLayer;
    window.__memoriesLayer = memoriesLayer;

    // Helper for popup hover/highlight
    window.__memoriesIsActive = () => memoriesLayer.visible;

    console.log("[memories] initialised");
  };

  // -------- Utilities --------
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Detect Hebrew (U+0590–U+05FF range) anywhere in a string
  function isHebrew(s) {
    return /[\u0590-\u05FF]/.test(String(s || ""));
  }

  // Minimal, SAFE location cleaner. Does NOT try to reorder to "City,
  // Country" — geocoder strings are too inconsistent to do that reliably
  // without seeing real data volume. It only does two safe things:
  //   1. Collapse adjacent duplicate words ("Širvintos Širvintos" → "Širvintos")
  //   2. Strip common administrative noise words that add no meaning
  // For perfect labels, fix location_label by hand in AGOL — this is just
  // a safety net so the worst raw geocoder strings don't look broken.
  const LOCATION_NOISE = new Set([
    "district", "municipality", "region", "province", "county",
    "subdistrict", "sub-district", "prefecture", "oblast", "raion",
    "department", "commune", "borough", "township"
  ]);
  function cleanLocation(raw) {
    let s = String(raw || "").trim();
    if (!s) return "";

    // Split on whitespace, walk the words
    const words = s.split(/\s+/);
    const out = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const bare = w.toLowerCase().replace(/[^a-z\u0590-\u05FF]/g, "");
      // skip pure administrative noise words
      if (LOCATION_NOISE.has(bare)) continue;
      // skip if identical to the previous kept word (case-insensitive)
      const prev = out[out.length - 1];
      if (prev && prev.toLowerCase() === w.toLowerCase()) continue;
      out.push(w);
    }
    // Re-join, tidy up doubled commas / spaces left by removed words
    return out.join(" ")
      .replace(/\s*,\s*,\s*/g, ", ")
      .replace(/\s+,/g, ",")
      .replace(/,\s*$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  // connection_type code → display label. Unknown/empty/'other' → ""
  // so the popup skips the eyebrow. Falls back gracefully if the data
  // somehow contains a human-readable value instead of a code.
  function connectionLabel(raw) {
    const code = String(raw || "").trim().toLowerCase();
    if (!code) return "";
    if (code in CONNECTION_LABELS) return CONNECTION_LABELS[code];
    // Unknown code — if it looks like a real phrase already, use it;
    // otherwise skip rather than print a raw code.
    return /\s/.test(code) ? raw.trim() : "";
  }

  // Normalize a string for fuzzy comparison: lowercase, strip punctuation,
  // collapse whitespace. "Birth place" / "birthplace" / "Birth-place" all
  // become "birthplace".
  function normalizeForCompare(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\u0590-\u05FF]+/g, "")
      .trim();
  }

  // Phrases that are just category-restatements, not real personal notes.
  // Built from the connection labels + common variants dedicators typed
  // into the old free-text-only form. If why_this_place reduces to one of
  // these AND a connection_type is set, the note is redundant — suppress it.
  const REDUNDANT_WHY = new Set([
    "birthplace", "born", "bornhere", "placeofbirth",
    "hometown", "hishometown", "herhometown",
    "familyorigin", "origin", "ancestraltown", "ancestralhome",
    "home", "wheretheylived", "wherehelived", "whereshelived", "lived",
    "restingplace", "buried", "wheretheyreburied", "grave", "placeofburial",
    "meaningfulplace", "meaningful",
    "other"
  ]);

  // Render `why_this_place` as the personal layer — a quiet note beneath
  // the place name. connection_type owns the categorical eyebrow, so this
  // field should only ever be a genuine personal note.
  //
  // Dedup: if why_this_place just restates the category (e.g. "Birth place"
  // while connection_type is already "birthplace"), it's noise — suppress
  // it. This cleans up legacy rows from the old free-text-only form without
  // touching the data. Genuine notes ("the lab she so loved") pass through.
  function renderWhy(text, connRaw, connLabel) {
    const t = String(text || "").trim();
    if (!t) return "";

    // Suppress if redundant with the category
    const norm = normalizeForCompare(t);
    const hasCategory = !!(connRaw || connLabel);
    if (hasCategory) {
      // (a) matches a known category-restatement phrase
      if (REDUNDANT_WHY.has(norm)) return "";
      // (b) is literally the same text as the connection code or label
      if (norm === normalizeForCompare(connRaw)) return "";
      if (norm === normalizeForCompare(connLabel)) return "";
    }

    if (isHebrew(t)) {
      return `<div class="memories-why memories-why-he" dir="rtl" lang="he">${escapeHtml(t)}</div>`;
    }
    return `<div class="memories-why memories-why-en">${escapeHtml(t)}</div>`;
  }

  // First 4 chars of a date string → year only (mirrors wall.html toYear)
  // "1909-09-29" → "1909",  "1909" → "1909",  "" → ""
  function toYear(val) {
    if (!val) return "";
    return String(val).trim().substring(0, 4);
  }

  // Build "born – death", "b. X", or "d. X". Filters empties.
  function formatDatePair(born, death) {
    if (born && death) return `${born} – ${death}`;
    if (born)          return `b. ${born}`;
    if (death)         return `d. ${death}`;
    return "";
  }
})();
