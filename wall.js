const API_BASE = "https://api.jewishatlas.org/api";

const wallEl = document.getElementById("wall");
const searchInput = document.getElementById("searchInput");
const emptyState = document.getElementById("emptyState");

let allBricks = [];

/* ---- Escape HTML ---- */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])
  );
}

/* ---- Render ---- */
function renderBricks(data) {
  wallEl.innerHTML = "";
  wallEl.classList.remove("dim");

  if (!data.length) {
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  data.forEach(person => {
    const brick = document.createElement("div");
    brick.className = "brick";

    // Default view: Hebrew name preferred, fallback to English
    const displayName = person.he_name || person.eng_name || "";

    // Build expanded details
    let detailsHTML = '<div class="detail-divider"></div><div class="detail-names">';

    if (person.he_name) {
      detailsHTML += `<div class="he">${esc(person.he_name)}</div>`;
    }
    if (person.eng_name) {
      detailsHTML += `<div>${esc(person.eng_name)}</div>`;
    }

    detailsHTML += "</div>";

    // Hebrew dates
    if (person.born_str || person.death_str) {
      const heb = [person.born_str, person.death_str].filter(Boolean).join(" – ");
      detailsHTML += `<div class="detail-dates" dir="rtl">${esc(heb)}</div>`;
    }

    // Gregorian dates
    if (person.born_display || person.death_display) {
      const greg = [person.born_display, person.death_display].filter(Boolean).join(" – ");
      detailsHTML += `<div class="detail-dates">${esc(greg)}</div>`;
    }

    // Origin
    if (person.origin) {
      detailsHTML += `<div class="detail-origin">${esc(person.origin)}</div>`;
    }

    // Read more (if slug exists for a full memorial page)
    if (person.slug) {
      detailsHTML += `<a class="detail-more" href="memory.html?slug=${encodeURIComponent(person.slug)}">Read more →</a>`;
    }

    brick.innerHTML = `
      <div class="brick-name">${esc(displayName)}</div>
      <div class="brick-details">${detailsHTML}</div>
    `;

    brick.addEventListener("click", (e) => {
      e.stopPropagation();

      const wasActive = brick.classList.contains("active");

      // Close any open brick
      closeActiveBrick();

      // Toggle this one
      if (!wasActive) {
        brick.classList.add("active");
        wallEl.classList.add("dim");
      }
    });

    wallEl.appendChild(brick);
  });
}

/* ---- Close active brick ---- */
function closeActiveBrick() {
  const active = wallEl.querySelector(".brick.active");
  if (active) {
    active.classList.remove("active");
  }
  wallEl.classList.remove("dim");
}

/* ---- Click outside closes ---- */
document.addEventListener("click", (e) => {
  if (!e.target.closest(".brick")) {
    closeActiveBrick();
  }
});

/* ---- Escape key closes ---- */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeActiveBrick();
  }
});

/* ---- Search ---- */
searchInput.addEventListener("input", (e) => {
  const term = e.target.value.trim();

  if (!term) {
    renderBricks(allBricks);
    return;
  }

  const lower = term.toLowerCase();

  const filtered = allBricks.filter(p =>
    (p.he_name && p.he_name.includes(term)) ||
    (p.eng_name && p.eng_name.toLowerCase().includes(lower))
  );

  renderBricks(filtered);
});

/* ---- Fetch data ---- */
async function loadWall() {
  try {
    const res = await fetch(API_BASE + "/wall");
    if (!res.ok) throw new Error("API error");

    const data = await res.json();
    const features = data.features || [];
    allBricks = features.map(f => f.attributes);

    renderBricks(allBricks);
  } catch (err) {
    console.error(err);
    emptyState.style.display = "block";
    emptyState.textContent = "Could not load the wall right now.";
  }
}

loadWall();