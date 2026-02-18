const API_BASE = "https://api.jewishatlas.org/api";

const grid = document.getElementById("wallGrid");
const empty = document.getElementById("wallEmpty");
const searchInput = document.getElementById("wallSearch");
const backBtn = document.getElementById("backBtn");
const dedicateBtn = document.getElementById("dedicateBtn");

let ALL = [];
let QUERY = "";

/* Navigation */
backBtn.addEventListener("click", () => {
  window.location.href = "index.html";
});

dedicateBtn.addEventListener("click", () => {
  window.location.href = "dedicate.html";
});

/* Escape HTML */
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

/* Build Lifespan */
function buildLifespan(b) {
  let hebLine = "";
  let gregLine = "";

  if (b.born_str || b.death_str) {
    hebLine = `${b.born_str || ""}${b.born_str && b.death_str ? " – " : ""}${b.death_str || ""}`;
  }

  if (b.born_display || b.death_display) {
    gregLine = `${b.born_display || ""}${b.born_display && b.death_display ? " – " : ""}${b.death_display || ""}`;
  }

  return { hebLine, gregLine };
}

/* Match Search */
function matches(b) {
  if (!QUERY) return true;

  const q = QUERY.toLowerCase();

  return (
    (b.eng_name || "").toLowerCase().includes(q) ||
    (b.he_name || "").includes(QUERY)
  );
}

/* Render */
function render(list) {
  grid.innerHTML = "";

  if (!list.length) {
    empty.style.display = "block";
    empty.textContent = "No memorials found.";
    return;
  }

  empty.style.display = "none";

  list.forEach(b => {
    const dates = buildLifespan(b);
    const origin = b.origin || "";

    const btn = document.createElement("button");
    btn.className = "brick";
    btn.dataset.slug = b.slug;

    btn.innerHTML = `
      ${b.he_name ? `<div class="brick-he-name">${escapeHtml(b.he_name)}</div>` : ""}
      ${b.eng_name ? `<div class="brick-name">${escapeHtml(b.eng_name)}</div>` : ""}
      ${dates.hebLine ? `<div class="brick-date-he">${escapeHtml(dates.hebLine)}</div>` : ""}
      ${dates.gregLine ? `<div class="brick-date">${escapeHtml(dates.gregLine)}</div>` : ""}
      ${origin ? `<div class="brick-location">${escapeHtml(origin)}</div>` : ""}
    `;

    btn.addEventListener("click", () => {
      window.location.href = "memory.html?slug=" + encodeURIComponent(b.slug);
    });

    grid.appendChild(btn);
  });
}

/* Load Wall */
async function loadWall() {
  try {
    const res = await fetch(API_BASE + "/wall");
    if (!res.ok) throw new Error("API failed");

    const data = await res.json();

    // ArcGIS returns { features: [{ attributes: {...} }, ...] }
    const features = data.features || [];
    ALL = features.map(f => f.attributes);

    render(ALL);

  } catch (e) {
    console.error(e);
    empty.style.display = "block";
    empty.textContent = "Could not load the wall right now.";
  }
}

/* Search */
searchInput.addEventListener("input", e => {
  QUERY = e.target.value.trim();
  render(ALL.filter(matches));
});

loadWall();