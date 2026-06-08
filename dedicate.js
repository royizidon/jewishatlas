document.addEventListener("DOMContentLoaded", function () {

  // =============================
  // CORE ELEMENTS
  // =============================
  const form = document.getElementById("dedicateForm");
  const tierValue = document.getElementById("tierValue");
  const submitBtn = document.getElementById("submitBtn");
  const btnText = submitBtn.querySelector(".btn-text");
  const btnLoading = submitBtn.querySelector(".btn-loading");

  // Image elements
  const imageInput = document.getElementById("imageInput");
  const uploadIdle = document.getElementById("uploadIdle");
  const imagePreview = document.getElementById("imagePreview");
  const previewImg = document.getElementById("previewImg");
  const removeBtn = document.getElementById("removeBtn");

  // Terms modal
  const termsModal = document.getElementById("termsModal");
  const openTermsBtn = document.getElementById("openTermsBtn");
  const closeTermsBtn = document.getElementById("closeTermsBtn");
  const acceptTermsBtn = document.getElementById("acceptTermsBtn");
  const termsCheck = document.getElementById("termsCheck");

  // Place section elements
  const placeSearch = document.getElementById("placeSearch");
  const geocoderResults = document.getElementById("geocoderResults");
  const placeDetails = document.getElementById("placeDetails");
  const placeLat = document.getElementById("placeLat");
  const placeLng = document.getElementById("placeLng");
  const geocoderLabel = document.getElementById("geocoderLabel");
  const locationLabel = document.getElementById("locationLabel");
  const connectionType = document.getElementById("connectionType");
  const locationPrecision = document.getElementById("locationPrecision");
  const whyThisPlace = document.getElementById("whyThisPlace");
  const hasMapPlace = document.getElementById("hasMapPlace");
  const showOnMap = document.querySelector('input[name="show_on_map"]');

  // Selected place chip
  const selectedPlaceChip = document.getElementById("selectedPlaceChip");
  const selectedPlaceName = document.getElementById("selectedPlaceName");
  const selectedPlaceRegion = document.getElementById("selectedPlaceRegion");
  const selectedPlaceClear = document.getElementById("selectedPlaceClear");
  const placeSearchField = document.querySelector(".geocoder-field");

  // Wizard elements
  const wizardProgress = document.getElementById("wizardProgress");
  const progressDashes = wizardProgress.querySelectorAll(".progress-dash");
  const panels = document.querySelectorAll(".wizard-panel");
  const landingCards = document.querySelectorAll(".tier-btn");
  const beginBtn = document.getElementById("beginBtn");
  const skipPlaceBtn = document.getElementById("skipPlaceBtn");

  // Review elements
  const reviewNameEng = document.getElementById("reviewNameEng");
  const reviewNameHe = document.getElementById("reviewNameHe");
  const reviewMeta = document.getElementById("reviewMeta");
  const reviewTierName = document.getElementById("reviewTierName");
  const reviewTierPrice = document.getElementById("reviewTierPrice");

  let selectedGeocoderPlace = null;
  let geocoderTimer = null;
  let currentSuggestions = [];
  let activeSuggestionIndex = -1;
  const suggestionCache = new Map();

  // =============================
  // PAYMENT LINKS
  // =============================
  const paymentLinks = {
    brick: "https://mrng.to/qfUqZwJ1Pt",   // ₪180
    page:  "https://mrng.to/RVyZt1jILJ"    // ₪360
  };

  const tierMeta = {
    brick: { name: "Brick", price: "₪180" },
    page:  { name: "Brick & Page", price: "₪360" }
  };

  // =============================
  // WIZARD CONTROLLER
  // =============================
  const wizard = {
    currentStep: 0,
    // Step sequence is dynamic: Brick skips step 3 (story panel)
    stepsForBrick: [0, 1, 2, 4, 5],
    stepsForPage:  [0, 1, 2, 3, 4, 5],

    sequence: function () {
      const tier = tierValue.value || "brick";
      return tier === "page" ? this.stepsForPage : this.stepsForBrick;
    },

    indexOf: function (step) {
      return this.sequence().indexOf(step);
    },

    totalUserSteps: function () {
      // exclude landing (step 0) from the visible total
      return this.sequence().length - 1;
    },

    userStepNumber: function (step) {
      // 1-based number shown to the user (excludes landing)
      return this.indexOf(step);
    },

    goTo: function (step) {
      // Dismiss mobile keyboard before transitioning to prevent scroll jumpiness on iOS
      if (document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }

      // Hide all
      panels.forEach(p => p.classList.remove("active"));

      // Show target
      const target = document.querySelector(`.wizard-panel[data-step="${step}"]`);
      if (!target) return;
      target.classList.add("active");

      this.currentStep = step;
      this.updateProgress(step);

      // Populate review summary if entering step 5
      if (step === 5) populateReview();

      // Scroll to top
      window.scrollTo({ top: 0, behavior: "smooth" });
    },

    updateProgress: function (step) {
      if (step === 0) {
        wizardProgress.classList.remove("visible");
        return;
      }
      wizardProgress.classList.add("visible");

      const seq = this.sequence();
      const total = this.totalUserSteps();
      const userNum = this.userStepNumber(step);

      // Update dashes — show only as many as the sequence requires
      progressDashes.forEach((dash, i) => {
        if (i >= total) {
          dash.style.display = "none";
          return;
        }
        dash.style.display = "";
        dash.classList.remove("active", "completed");

        const dashStepNum = i + 1; // 1-based
        if (dashStepNum < userNum) dash.classList.add("completed");
        else if (dashStepNum === userNum) dash.classList.add("active");
      });
    },

    next: function () {
      const seq = this.sequence();
      const i = seq.indexOf(this.currentStep);
      if (i === -1 || i === seq.length - 1) return;
      this.goTo(seq[i + 1]);
    },

    back: function () {
      const seq = this.sequence();
      const i = seq.indexOf(this.currentStep);
      if (i <= 0) return;
      this.goTo(seq[i - 1]);
    }
  };

  // =============================
  // LANDING — TIER SELECTION
  // =============================
  landingCards.forEach(card => {
    card.addEventListener("click", function () {
      const newTier = this.dataset.tier;
      const oldTier = tierValue.value;

      landingCards.forEach(c => c.classList.remove("active"));
      this.classList.add("active");

      tierValue.value = newTier;

      // Tier downgrade — clear premium-only fields so they're not silently submitted
      if (oldTier === "page" && newTier === "brick") {
        clearPremiumFields();
      }
    });
  });

  function clearPremiumFields() {
    const bio = document.getElementById("bioField");
    if (bio) bio.value = "";

    // Clear image input + preview UI
    imageInput.value = "";
    previewImg.src = "";
    imagePreview.classList.remove("active");
    uploadIdle.style.display = "flex";
    imageInput.style.pointerEvents = "auto";
  }

  beginBtn.addEventListener("click", function () {
    wizard.goTo(1);
  });

  // =============================
  // STEP NAVIGATION (next / back buttons inside panels)
  // =============================
  document.querySelectorAll('[data-action="back"]').forEach(btn => {
    btn.addEventListener("click", () => wizard.back());
  });

  document.querySelectorAll('[data-action="next"]').forEach(btn => {
    btn.addEventListener("click", function () {
      if (!validateStep(wizard.currentStep)) return;
      wizard.next();
    });
  });

  // =============================
  // PER-STEP VALIDATION
  // =============================
  function validateStep(step) {
    if (step === 1) {
      const he = document.getElementById("heName").value.trim();
      const en = document.getElementById("engName").value.trim();
      if (!he && !en) {
        alert("Please enter a Hebrew or English name.");
        return false;
      }
    }
    if (step === 4) {
      const placeTyped = placeSearch.value.trim();
      if (placeTyped && !selectedGeocoderPlace) {
        alert("Please choose a place from the search results, or skip this step.");
        return false;
      }
      if (selectedGeocoderPlace) {
        if (!locationLabel.value.trim()) {
          alert("Please enter what this place is called.");
          return false;
        }
        if (!connectionType.value) {
          alert("Please choose what this place was to them.");
          return false;
        }
      }
    }
    return true;
  }

  // =============================
  // SKIP PLACE STEP — clean-slate the geocoder state
  // =============================
  skipPlaceBtn.addEventListener("click", function () {
    resetSelectedPlace();
    placeSearch.value = "";
    wizard.next();
  });

  // =============================
  // POPULATE REVIEW SUMMARY (Step 5)
  // =============================
  function populateReview() {
    syncDateFields();
    const fd = new FormData(form);
    const he = (fd.get("he_name") || "").trim();
    const en = (fd.get("eng_name") || "").trim();
    const bornDate = (fd.get("born_date") || "").trim();
    const deathDate = (fd.get("death_date") || "").trim();
    const bornStr = (fd.get("born_str") || "").trim();
    const deathStr = (fd.get("death_str") || "").trim();
    const origin = (fd.get("origin") || "").trim();
    const tier = fd.get("tier") || "brick";
    const place = (window._selectedPlaceCleanName || geocoderLabel.value || "").trim();
    const bio = (fd.get("full_bio") || "").trim();

    reviewNameEng.textContent = en;
    reviewNameEng.style.display = en ? "block" : "none";

    reviewNameHe.textContent = he;
    reviewNameHe.style.display = he ? "block" : "none";

    // Photo (premium only — only render if an image was uploaded)
    const reviewPhotoWrap = document.getElementById("reviewPhotoWrap");
    const reviewPhoto = document.getElementById("reviewPhoto");
    if (tier === "page" && previewImg.src && imagePreview.classList.contains("active")) {
      reviewPhoto.src = previewImg.src;
      reviewPhotoWrap.style.display = "block";
    } else {
      reviewPhotoWrap.style.display = "none";
      reviewPhoto.src = "";
    }

    // Build meta rows
    const rows = [];
    const gDate = formatDateRange(bornDate, deathDate);
    if (gDate) rows.push(metaRow("", gDate));

    const hDate = formatHebrewRange(bornStr, deathStr);
    if (hDate) rows.push(metaRow("", hDate));

    if (origin) rows.push(metaRow("", origin));
    if (place) rows.push(metaRow("", place));

    if (rows.length === 0) {
      reviewMeta.innerHTML = '<span class="review-meta-empty">Their memory, simply preserved.</span>';
    } else {
      reviewMeta.innerHTML = rows.join("");
    }

    // Biography (premium only)
    const reviewBioWrap = document.getElementById("reviewBioWrap");
    const reviewBio = document.getElementById("reviewBio");
    if (tier === "page" && bio) {
      reviewBio.textContent = bio;
      reviewBioWrap.style.display = "block";
    } else {
      reviewBioWrap.style.display = "none";
      reviewBio.textContent = "";
    }

    // Tier
    const meta = tierMeta[tier];
    reviewTierName.textContent = meta.name;
    reviewTierPrice.textContent = meta.price;
  }

  function metaRow(label, value) {
    if (!value) return "";
    const lbl = label ? `<span class="label">${escapeHtml(label)}</span>` : "";
    return `<span class="review-meta-row">${lbl}${escapeHtml(value)}</span>`;
  }

  function formatDateRange(born, died) {
    if (!born && !died) return "";
    if (born && died) return `${born} — ${died}`;
    if (born) return `Born ${born}`;
    return `Died ${died}`;
  }

  function formatHebrewRange(born, died) {
    if (!born && !died) return "";
    if (born && died) return `${born} — ${died}`;
    if (born) return `נולד/ה ${born}`;
    return `נפטר/ה ${died}`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // =============================
  // TERMS MODAL
  // =============================
  openTermsBtn.addEventListener("click", function () {
    termsModal.classList.add("active");
    document.body.style.overflow = "hidden";
  });

  function closeModal() {
    termsModal.classList.remove("active");
    document.body.style.overflow = "";
  }

  closeTermsBtn.addEventListener("click", closeModal);

  termsModal.addEventListener("click", function (e) {
    if (e.target === termsModal) closeModal();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && termsModal.classList.contains("active")) closeModal();
  });

  acceptTermsBtn.addEventListener("click", function () {
    termsCheck.checked = true;
    submitBtn.disabled = false;
    closeModal();
  });

  // Submit gated by terms checkbox
  submitBtn.disabled = true;
  termsCheck.addEventListener("change", function () {
    submitBtn.disabled = !this.checked;
  });

  // =============================
  // IMAGE PREVIEW
  // =============================
  imageInput.addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5 MB.");
      this.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      previewImg.src = e.target.result;
      imagePreview.classList.add("active");
      uploadIdle.style.display = "none";
      imageInput.style.pointerEvents = "none";
    };
    reader.readAsDataURL(file);
  });

  removeBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    imageInput.value = "";
    previewImg.src = "";
    imagePreview.classList.remove("active");
    uploadIdle.style.display = "flex";
    imageInput.style.pointerEvents = "auto";
  });

  // =============================
  // OPTIONAL NOMINATIM GEOCODER (no API key, no map)
  // =============================
  // =============================
  // DATE ASSEMBLY — Gregorian & Hebrew
  // Assembles the split input boxes into a single hidden field
  // before every submission and review render.
  // =============================

  function padTwo(n) {
    return String(n).padStart(2, "0");
  }

  function assembleGregorianDate(dayId, monthId, yearId) {
    const day   = document.getElementById(dayId).value.trim();
    const month = document.getElementById(monthId).value.trim();
    const year  = document.getElementById(yearId).value.trim();
    if (!day && !month && !year) return "";
    if (day && month && year)  return `${padTwo(day)}/${padTwo(month)}/${year}`;
    if (month && year)         return `${padTwo(month)}/${year}`;
    if (year)                  return year;
    // edge: only day or day+month — still store what we have
    if (day && month)          return `${padTwo(day)}/${padTwo(month)}`;
    return day || month || year;
  }

  function syncDateFields() {
    document.getElementById("bornDate").value  = assembleGregorianDate("bornDay",  "bornMonth",  "bornYear");
    document.getElementById("deathDate").value = assembleGregorianDate("deathDay", "deathMonth", "deathYear");
    // Hebrew dates are free text — no assembly needed
  }

  // Clamp values to valid ranges on blur
  const dateClamping = {
    bornDay:    [1, 31],  deathDay:   [1, 31],
    bornMonth:  [1, 12],  deathMonth: [1, 12],
    bornYear:   [1, 2100], deathYear: [1, 2100],
  };
  Object.entries(dateClamping).forEach(([id, [min, max]]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("blur", function () {
      if (this.value === "") return;
      const v = parseInt(this.value, 10);
      if (isNaN(v))       { this.value = ""; return; }
      if (v < min)        this.value = min;
      else if (v > max)   this.value = max;
      syncDateFields();
    });
  });

  // Wire up live sync on Gregorian date sub-fields only
  ["bornDay","bornMonth","bornYear","deathDay","deathMonth","deathYear"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", syncDateFields);
    if (el) el.addEventListener("change", syncDateFields);
  });

  // =============================
  // LEAFLET MAP + NOMINATIM GEOCODER
  // =============================

  const NOMINATIM_SUGGEST = (q) =>
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`;

  const NOMINATIM_REVERSE = (lat, lon) =>
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lon}`;

  // Init Leaflet map — shown when user reaches the place step
  let _mapInited = false;
  let _leafletMap = null;
  let _leafletMarker = null;

  function initLeafletMap() {
    if (_mapInited) return;
    _mapInited = true;

    const mapEl = document.getElementById("dedicateMap");
    mapEl.classList.add("visible");

    _leafletMap = L.map("dedicateMap", { zoomControl: true }).setView([32, 20], 3);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap, © CARTO",
      subdomains: "abcd",
      maxZoom: 19
    }).addTo(_leafletMap);

    // Custom pin icon matching the site's indigo style
    const pinIcon = L.divIcon({
      className: "",
      html: `<div style="width:14px;height:14px;background:#4f46e5;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 6px rgba(79,70,229,0.45);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    _leafletMarker = L.marker([0, 0], { icon: pinIcon, opacity: 0 }).addTo(_leafletMap);

    // Click on map → reverse geocode → activate place
    _leafletMap.on("click", async function (e) {
      const { lat, lng } = e.latlng;
      try {
        const r = await fetch(NOMINATIM_REVERSE(lat, lng), { headers: { Accept: "application/json" } });
        const place = await r.json();
        if (!place || place.error) return;
        // Normalise to same shape as forward search results
        place.lat = String(lat);
        place.lon = String(lng);
        activateSelectedPlace(place);
        _leafletMarker.setLatLng([lat, lng]).setOpacity(1);
      } catch (err) {
        console.error("Reverse geocode error:", err);
      }
    });

    // Fix tile rendering after map becomes visible
    setTimeout(() => _leafletMap.invalidateSize(), 50);
  }

  // Call initLeafletMap when the place wizard step becomes active
  const _origShowStep = typeof showStep === "function" ? showStep : null;
  // Hook into the wizard step transition — map step is step 3 (0-indexed)
  // We observe the place panel becoming active instead
  const _placePanel = document.getElementById("panelStep4");

  if (_placePanel) {
    const _mapObserver = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.type === "attributes" && m.attributeName === "class") {
          if (_placePanel.classList.contains("active")) initLeafletMap();
        }
      });
    });
    _mapObserver.observe(_placePanel, { attributes: true });
  }

  function resetSelectedPlace() {
    selectedGeocoderPlace = null;
    placeLat.value = "";
    placeLng.value = "";
    geocoderLabel.value = "";
    hasMapPlace.value = "0";
    showOnMap.value = "0";

    placeDetails.hidden = true;
    locationLabel.value = "";
    connectionType.value = "";
    locationPrecision.value = "";
    whyThisPlace.value = "";

    // Restore the search field, hide the chip
    selectedPlaceChip.hidden = true;
    selectedPlaceName.textContent = "";
    selectedPlaceRegion.textContent = "";
    window._selectedPlaceCleanName = "";
    if (placeSearchField) placeSearchField.hidden = false;

    // Hide map marker
    if (_leafletMarker) _leafletMarker.setOpacity(0);
  }

  // Build a clean, human two-part name from Nominatim's structured address
  function buildPlaceDisplay(place) {
    const a = place.address || {};
    const parts = place.display_name.split(",").map(s => s.trim());

    // Primary line: the most specific meaningful name
    const primary =
      a.amenity || a.building || a.road || a.neighbourhood ||
      a.suburb || a.city || a.town || a.village || a.hamlet ||
      parts[0];

    // Secondary line: keep it short — just the city (if different from primary) and country.
    // Deliberately skip state/district/subdistrict, which create the long ugly chain.
    const regionBits = [];
    const city = a.city || a.town || a.village || a.municipality;
    if (city && city !== primary) regionBits.push(city);
    if (a.country && !regionBits.includes(a.country)) regionBits.push(a.country);

    let region = regionBits.join(", ");
    // Fallback if structured data was thin — take just the last part (usually the country)
    if (!region && parts.length > 1) {
      region = parts[parts.length - 1];
    }

    return { primary, region };
  }

  function activateSelectedPlace(place) {
    selectedGeocoderPlace = place;

    placeSearch.value = place.display_name; // keep full string in input (used for validation)
    placeLat.value = place.lat;
    placeLng.value = place.lon;
    geocoderLabel.value = place.display_name;
    hasMapPlace.value = "1";
    showOnMap.value = "0"; // admin sets to 1 after review

    geocoderResults.classList.remove("active");
    geocoderResults.innerHTML = "";
    currentSuggestions = [];
    activeSuggestionIndex = -1;

    // Clean two-line chip display
    const display = buildPlaceDisplay(place);
    selectedPlaceName.textContent = display.primary;
    selectedPlaceRegion.textContent = display.region;
    selectedPlaceChip.hidden = false;
    // Stash clean name for the review card
    place._cleanName = display.region ? `${display.primary}, ${display.region}` : display.primary;
    window._selectedPlaceCleanName = place._cleanName;

    // Hide the search field now that a place is locked in
    if (placeSearchField) placeSearchField.hidden = true;

    placeDetails.hidden = false;

    // Prefill location_label with the clean short name
    if (!locationLabel.value) locationLabel.value = display.primary;

    // Move Leaflet marker to the selected place
    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);
    if (_leafletMap && !isNaN(lat) && !isNaN(lon)) {
      _leafletMarker.setLatLng([lat, lon]).setOpacity(1);
      _leafletMap.setView([lat, lon], Math.max(_leafletMap.getZoom(), 14), { animate: true });
    }
  }

  async function searchNominatim(query) {
    if (suggestionCache.has(query)) return suggestionCache.get(query);

    const response = await fetch(NOMINATIM_SUGGEST(query), {
      headers: { Accept: "application/json" }
    });
    const data = await response.json();
    suggestionCache.set(query, data);
    return data;
  }

  function renderSuggestions(items) {
    geocoderResults.innerHTML = "";
    currentSuggestions = items;
    activeSuggestionIndex = -1;

    if (!items.length) {
      geocoderResults.classList.remove("active");
      return;
    }

    items.forEach((item, idx) => {
      const el = document.createElement("div");
      el.className = "geocoder-result";
      el.textContent = item.display_name;
      el.setAttribute("role", "option");
      el.dataset.index = idx;

      el.addEventListener("click", () => activateSelectedPlace(item));
      el.addEventListener("mouseenter", () => setActiveSuggestion(idx));

      geocoderResults.appendChild(el);
    });

    geocoderResults.classList.add("active");
  }

  function setActiveSuggestion(idx) {
    const items = geocoderResults.querySelectorAll(".geocoder-result");
    items.forEach((el, i) => {
      el.classList.toggle("active", i === idx);
    });
    activeSuggestionIndex = idx;
  }

  // Clear the selected place via the chip's × button
  selectedPlaceClear.addEventListener("click", function () {
    resetSelectedPlace();
    placeSearch.value = "";
    placeSearch.focus();
  });

  placeSearch.addEventListener("input", function () {
    const query = this.value.trim();

    if (selectedGeocoderPlace && query !== selectedGeocoderPlace.display_name) {
      const typedValue = this.value;
      resetSelectedPlace();
      placeSearch.value = typedValue;
    }

    clearTimeout(geocoderTimer);

    if (query.length < 3) {
      geocoderResults.classList.remove("active");
      geocoderResults.innerHTML = "";
      return;
    }

    geocoderTimer = setTimeout(async function () {
      try {
        const items = await searchNominatim(query);
        renderSuggestions(items);
      } catch (err) {
        console.error("Geocoder error:", err);
        geocoderResults.classList.remove("active");
      }
    }, 450);
  });

  placeSearch.addEventListener("keydown", function (e) {
    if (!geocoderResults.classList.contains("active")) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion(Math.min(activeSuggestionIndex + 1, currentSuggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion(Math.max(activeSuggestionIndex - 1, 0));
    } else if (e.key === "Enter" && activeSuggestionIndex >= 0) {
      e.preventDefault();
      activateSelectedPlace(currentSuggestions[activeSuggestionIndex]);
    } else if (e.key === "Escape") {
      geocoderResults.classList.remove("active");
    }
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".geocoder-field")) {
      geocoderResults.classList.remove("active");
    }
  });

  // =============================
  // SUBMIT
  // =============================
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Sync assembled date hidden fields before reading FormData
    syncDateFields();

    const formData = new FormData(form);

    // Name (sanity-check — should already be validated in step 1)
    const heName = (formData.get("he_name") || "").trim();
    const engName = (formData.get("eng_name") || "").trim();
    if (!heName && !engName) {
      alert("Please enter a Hebrew or English name.");
      wizard.goTo(1);
      return;
    }

    // Email
    const email = (formData.get("dedicator_email") || "").trim();
    if (!email) {
      alert("Please enter your email address.");
      return;
    }
    if (!email.includes("@")) {
      alert("Please enter a valid email address (must include @).");
      return;
    }
    if (email.length > 256) {
      alert("Email address must be 256 characters or fewer.");
      return;
    }

    // Place sanity check
    const placeTyped = placeSearch.value.trim();
    if (placeTyped && !selectedGeocoderPlace) {
      alert("Please choose a place from the search results, or clear the place field.");
      wizard.goTo(4);
      return;
    }
    if (selectedGeocoderPlace) {
      if (!locationLabel.value.trim()) {
        alert("Please enter what this place is called.");
        wizard.goTo(4);
        return;
      }
      if (!connectionType.value) {
        alert("Please choose what this place was to them.");
        wizard.goTo(4);
        return;
      }
    }

    // Image size
    const file = formData.get("image");
    if (file && file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5 MB.");
      return;
    }

    // Loading state
    submitBtn.disabled = true;
    btnText.style.display = "none";
    btnLoading.style.display = "inline-flex";

    try {
      const response = await fetch("https://api.jewishatlas.org/api/dedicate", {
        method: "POST",
        body: formData
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const tier = formData.get("tier");
        const url = paymentLinks[tier] || paymentLinks.brick;

        // Mark as submitted in sessionStorage — survives full page navigations (e.g. back from Morashet)
        sessionStorage.setItem("dedicationSubmitted", "1");

        // Disable beforeunload warning before redirecting to payment
        if (typeof window._dedicationSubmitting === "function") {
          window._dedicationSubmitting();
        }

        window.location.href = url;
      } else {
        alert("Error: " + (typeof result.error === "string" ? result.error : JSON.stringify(result.error)));
      }

    } catch (err) {
      console.error(err);
      alert("Could not reach the server. Please try again.");
      // Only restore button state on error — on success we're navigating away
      submitBtn.disabled = !termsCheck.checked;
      btnText.style.display = "inline";
      btnLoading.style.display = "none";
    }
  });

  // =============================
  // INITIALIZE
  // =============================
  wizard.goTo(0);

  // =============================
  // BEFORE-UNLOAD WARNING
  // Warn if user accidentally closes/refreshes mid-flow
  // =============================
  let hasUserStarted = false;
  let isSubmittingSuccessfully = false;

  // Track when user has meaningfully begun filling the form
  form.addEventListener("input", function () {
    hasUserStarted = true;
  });

  window.addEventListener("beforeunload", function (e) {
    // Don't warn on the landing page or after a successful submission
    if (!hasUserStarted || isSubmittingSuccessfully || wizard.currentStep === 0) return;
    e.preventDefault();
  });

  // Expose flag for the submit handler to flip on success
  window._dedicationSubmitting = function () {
    isSubmittingSuccessfully = true;
  };

  // =============================
  // BACK-BUTTON GUARD
  // If user presses Back from the payment page, the browser may restore
  // this page from bfcache with the form fully visible and already submitted.
  // Detect this and redirect back to payment immediately.
  // =============================
  // On page load AND bfcache restore — if already submitted, redirect to payment
  // sessionStorage handles full navigations (back from Morashet/payment page)
  // e.persisted handles bfcache restores
  function checkAlreadySubmitted() {
    if (sessionStorage.getItem("dedicationSubmitted") === "1") {
      const tier = (form.querySelector('[name="tier"]') || {}).value || "brick";
      window.location.replace(paymentLinks[tier] || paymentLinks.brick);
    }
  }

  checkAlreadySubmitted(); // runs on fresh page load too

  window.addEventListener("pageshow", function (e) {
    if (e.persisted) checkAlreadySubmitted();
  });

});
