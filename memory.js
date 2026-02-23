const API_BASE = "https://api.jewishatlas.org/api";

// ── Format full date from ISO "1909-09-29" → "29.09.1909" ──
function formatDate(val) {
  if (!val) return "";
  const s = String(val);
  if (s.length === 10 && s[4] === "-") {
    const [y, m, d] = s.split("-");
    return d + "." + m + "." + y;
  }
  return s;
}

// ── Slug from URL ──
function getSlug() {
  return new URLSearchParams(window.location.search).get("slug") || "";
}

// ── Nav scroll effect ──
window.addEventListener("scroll", () => {
  document.getElementById("nav").classList.toggle("scrolled", window.scrollY > 60);
});

// ── Render ──
function render(attrs, imageUrl) {
  const name = attrs.he_name || attrs.eng_name || "Memorial";
  document.title = (attrs.eng_name || attrs.he_name || "Memorial") + " · Jewish Atlas";

  // Hero meta
  document.getElementById("heroMeta").textContent = "IN MEMORY OF";

  // Names
  document.getElementById("heName").textContent = attrs.he_name || "";
  document.getElementById("enName").textContent  = attrs.eng_name || "";

  // Dates
  const datesHe = [attrs.born_str, attrs.death_str].filter(Boolean).join(" – ");
  const datesEn = [formatDate(attrs.born_display), formatDate(attrs.death_display)].filter(Boolean).join(" – ");

  const datesWrap = document.getElementById("heroDates");
  datesWrap.innerHTML = `
    ${datesHe ? `<div class="dates-he">${datesHe}</div>` : ""}
    ${datesEn ? `<div class="dates-en">${datesEn}</div>` : ""}
    ${attrs.origin ? `<div class="origin-text">${attrs.origin}</div>` : ""}
  `;

  // Portrait
  if (imageUrl) {
    const img = document.getElementById("portraitImg");
    img.src = imageUrl;
    img.alt = attrs.he_name || attrs.eng_name || "";
    document.getElementById("portraitCaption").textContent = attrs.eng_name || "";
    document.getElementById("portraitCol").style.display = "block";
  }

  // Bio
  const bioEl = document.getElementById("bioText");
  if (attrs.full_bio && attrs.full_bio.trim()) {
    bioEl.textContent = attrs.full_bio.trim();
  } else {
    // Hide the rule if no bio
    document.querySelector(".bio-rule").style.display = "none";
  }

  // Show body
  document.getElementById("loadingState").style.display = "none";
  document.getElementById("memBody").style.display = "block";
}

// ── Error ──
function showError(msg) {
  document.getElementById("loadingState").style.display = "none";
  document.getElementById("errorMsg").textContent = msg || "Memorial not found.";
  document.getElementById("errorState").style.display = "flex";
}

// ── Load ──
async function loadMemory() {
  const slug = getSlug();
  if (!slug) { showError("No memorial specified."); return; }

  try {
    const res = await fetch(`${API_BASE}/memory/${encodeURIComponent(slug)}`);

    if (res.status === 404) {
      showError("This memorial page could not be found.");
      return;
    }
    if (!res.ok) throw new Error(`Server error ${res.status}`);

    const data = await res.json();
    if (data.error) { showError(data.error); return; }

    render(data.attributes, data.image_url || null);

  } catch (err) {
    console.error(err);
    showError("Could not load this memorial. Please try again.");
  }
}

loadMemory();