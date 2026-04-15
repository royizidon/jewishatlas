/**
 * Jewish Atlas — Shared Header
 *
 * Usage: add ONE placeholder div to each page, then load this script.
 *
 *   <div id="ja-header" data-page="map"></div>
 *   <script src="header.js"></script>
 *
 * data-page values:
 *   "map"      — light theme, full nav, search container + filter row
 *   "upload"   — light theme, full nav (Upload active)
 *   "about"    — light theme, full nav (About active)
 *   "wall"     — dark theme, minimal nav
 *   "memorial" — gradient overlay (fixed, over hero image), minimal nav
 *   "dedicate" — light theme, minimal nav
 */

(function () {

  var placeholder = document.getElementById('ja-header');
  if (!placeholder) return;

  var page = placeholder.getAttribute('data-page') || 'map';

  /* ── Theme ───────────────────────────────────────────── */
  var theme = 'ja-light';
  if (page === 'wall')     theme = 'ja-dark';
  if (page === 'memorial') theme = 'ja-memorial';

  /* ── Nav links config ────────────────────────────────── */
  var platformNav = [
    { href: 'index.html',   label: 'Map',      key: 'map'    },
    { href: 'wall.html',    label: 'The Wall', key: 'wall'   },
    { href: 'upload.html',  label: 'Upload',   key: 'upload' },
    { href: 'about.html',   label: 'About',    key: 'about'  }
  ];

  var memorialNav = [
    { href: 'index.html',   label: 'Map',      key: 'map'  },
    { href: 'wall.html',    label: 'The Wall', key: 'wall' }
  ];

  var isPlatform = (page === 'map' || page === 'upload' || page === 'about');
  var links = isPlatform ? platformNav : memorialNav;

  function buildNavLinks(links, isMobile) {
    return links.filter(function (l) {
      return l.key !== page;
    }).map(function (l) {
      return '<a href="' + l.href + '" class="navBtn">' + l.label + '</a>';
    }).join('');
  }

  /* ── Search container (map only, ArcGIS mounts here) ── */
  var searchHtml = (page === 'map')
    ? '<div id="searchContainer"></div>'
    : '';

  /* ── Filter row (map only, app.js populates) ─────────── */
  var row2Html = (page === 'map')
    ? '<div id="headerRow2"><div id="filterContainer"></div></div>'
    : '';

  /* ── Dedicate button (all pages except dedicate itself) ─ */
  var dedicateHtml = (page !== 'dedicate')
    ? '<a href="dedicate.html" id="ja-dedicate-btn">Dedicate</a>'
    : '';

  /* ── Build HTML ──────────────────────────────────────── */
  var html = [
    '<header id="appHeader" class="' + theme + '">',
    '  <div id="headerRow1">',
    '    <a href="index.html" id="siteTitle">Jewish Atlas</a>',
    '    <nav id="navButtons">' + buildNavLinks(links) + '</nav>',
    searchHtml,
    dedicateHtml,
    '    <button id="ja-hamburger" aria-label="Toggle menu">',
    '      <span></span><span></span><span></span>',
    '    </button>',
    '  </div>',
    row2Html,
    '  <div id="ja-mobile-menu">',
    '    ' + buildNavLinks(links, true),
    '    ' + (page !== 'dedicate' ? '<a href="dedicate.html" class="navBtn" style="margin-top:8px;">Dedicate</a>' : ''),
    '  </div>',
    '</header>'
  ].join('\n');

  /* ── Inject ──────────────────────────────────────────── */
  placeholder.outerHTML = html;

  /* ── Hamburger toggle ────────────────────────────────── */
  var hamBtn  = document.getElementById('ja-hamburger');
  var mobileMenu = document.getElementById('ja-mobile-menu');

  if (hamBtn && mobileMenu) {
    hamBtn.addEventListener('click', function () {
      var open = mobileMenu.classList.toggle('open');
      hamBtn.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
        mobileMenu.classList.remove('open');
        hamBtn.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  /* ── Body padding (not needed for map or memorial) ───── */
  // Map uses --header-h CSS var (set by app.js) for #viewDiv positioning
  // Memorial header is transparent overlay, body padding not needed
  if (page !== 'map' && page !== 'memorial') {
    function adjustPadding() {
      var header = document.getElementById('appHeader');
      if (!header) return;
      document.body.style.paddingTop = header.offsetHeight + 'px';
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', adjustPadding);
    } else {
      adjustPadding();
    }
    window.addEventListener('resize', adjustPadding);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(adjustPadding);
    }
  }

  /* ── Update --header-h for map page ─────────────────── */
  if (page === 'map') {
    function setHeaderHeight() {
      var h = document.getElementById('appHeader');
      if (h) {
        document.documentElement.style.setProperty('--header-h', h.offsetHeight + 'px');
      }
    }
    window.addEventListener('load', setHeaderHeight);
    window.addEventListener('resize', setHeaderHeight);
    setHeaderHeight();
  }

})();
