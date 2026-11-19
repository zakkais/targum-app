/* Targum site navigation.
 *
 * NAV is plain data — an array of {label, href} — so the site owner's
 * navigation tree can drop in here later without a rewrite of the
 * markup below. This file injects the Bootstrap 6 navbar (navy header,
 * native <dialog> drawer on mobile, current page marked active) into
 * #nav-root and the footer into #footer-root on every page.
 *
 * The nine nav items sit in a nav-overflow wrapper, which collapses
 * the items that do not fit into a "More" menu (Priority+). The
 * wrapper is only initialized at desktop widths (lg and up): in the
 * vertical mobile drawer every item is full-width, so nav-overflow
 * would wrongly move all but Dictionary into the "More" menu. Below lg
 * the wrapper stays uninitialized and the drawer lists all nine links;
 * style.css keeps an uninitialized nav visible below lg.
 */
(function () {
  'use strict';

  var NAV = [
    { label: 'Dictionary', href: 'index.html' },
    { label: 'Roshei Teivos', href: 'roshei-teivos.html' },
    { label: 'Thesaurus', href: 'thesaurus.html' },
    { label: 'Dikduk', href: 'dikduk.html' },
    { label: 'Loanwords', href: 'loanwords.html' },
    { label: 'Conjugator', href: 'conjugator.html' },
    { label: 'Tools', href: 'tools.html' },
    { label: 'Read Mode', href: 'read.html' },
    { label: 'Sources', href: 'sources.html' }
  ];

  // Same bundle the pages load via <script type="module">; the dynamic
  // import below resolves from the module cache, not a second fetch.
  var BOOTSTRAP_BUNDLE_URL =
    'https://cdn.jsdelivr.net/npm/bootstrap@6.0.0-alpha.1/dist/js/bootstrap.bundle.min.js';

  // Bootstrap 6's lg breakpoint is 1024px, applied as a container
  // query on the navbar — so "desktop" is judged by the navbar's own
  // width (via ResizeObserver), not the viewport. That matches the
  // CSS exactly, including when a vertical scrollbar narrows the
  // navbar below the viewport width.
  var LG_BREAKPOINT = 1024;

  var overflowInstance = null;
  var overflowImport = null;

  function currentPage() {
    var path = window.location.pathname || '';
    var page = path.substring(path.lastIndexOf('/') + 1);
    return page === '' ? 'index.html' : page;
  }

  function renderNav() {
    var root = document.getElementById('nav-root');
    if (!root) return;
    var current = currentPage();
    var items = NAV.map(function (item, index) {
      var active = item.href === current;
      // Dictionary is the home page and stays visible: nav-overflow
      // never moves .nav-overflow-keep items into the "More" menu.
      var keep = index === 0 ? ' nav-overflow-keep' : '';
      return '<li class="nav-item' + keep + '">' +
        '<a class="nav-link' + (active ? ' active' : '') + '"' +
        (active ? ' aria-current="page"' : '') +
        ' href="' + item.href + '">' + item.label + '</a>' +
        '</li>';
    }).join('');
    root.innerHTML =
      '<nav class="navbar lg:navbar-expand bg-targum-navy" data-bs-theme="dark" aria-label="Main navigation">' +
        '<div class="container">' +
          '<a class="navbar-brand" href="index.html">Targum</a>' +
          '<button class="btn-icon navbar-toggler" type="button" data-bs-toggle="drawer" data-bs-target="#targumDrawer" aria-controls="targumDrawer" aria-expanded="false" aria-label="Toggle navigation">' +
            '<span class="navbar-toggler-icon"></span>' +
          '</button>' +
          '<dialog class="drawer drawer-end" id="targumDrawer" tabindex="-1" aria-labelledby="targumDrawerLabel">' +
            '<div class="drawer-header">' +
              '<h5 class="drawer-title" id="targumDrawerLabel">Menu</h5>' +
              '<button type="button" class="btn-close" data-bs-dismiss="drawer" aria-label="Close"></button>' +
            '</div>' +
            '<div class="drawer-body">' +
              '<div class="nav-overflow" id="targumNavOverflow">' +
                '<ul class="nav navbar-nav">' + items + '</ul>' +
              '</div>' +
            '</div>' +
          '</dialog>' +
        '</div>' +
      '</nav>';
  }

  function renderFooter() {
    var root = document.getElementById('footer-root');
    if (!root) return;
    root.innerHTML =
      '<footer class="border-top mt-12 py-7">' +
        '<div class="container">' +
          '<p class="fg-secondary small mb-1">Targum — a dictionary of Torah languages: Modern Hebrew, Lashon HaKodesh, Aramaic, Yiddish, and English.</p>' +
          '<p class="fg-secondary small mb-0">Dictionary data: Wiktionary via kaikki.org (CC BY-SA), Strong&rsquo;s (public domain), Jastrow&rsquo;s Dictionary (public domain, 1903).</p>' +
        '</div>' +
      '</footer>';
  }

  function isDesktop() {
    var nav = document.querySelector('#nav-root nav');
    if (nav) return nav.offsetWidth >= LG_BREAKPOINT;
    return window.innerWidth >= LG_BREAKPOINT;
  }

  // Initialize nav-overflow on desktop; dispose it below lg so the
  // drawer shows the full vertical list. If the Bootstrap bundle
  // failed to load (offline), the import rejects and the nav simply
  // stays fully visible.
  function syncNavOverflow() {
    var wrapper = document.getElementById('targumNavOverflow');
    if (!wrapper) return;
    // The drawer is a light panel on mobile, but the inline desktop
    // nav sits on the navy navbar — so the drawer's theme follows the
    // breakpoint too (dark links would vanish on navy, light links
    // would vanish on white).
    var drawer = document.getElementById('targumDrawer');
    if (drawer) drawer.setAttribute('data-bs-theme', isDesktop() ? 'dark' : 'light');
    if (isDesktop()) {
      if (overflowInstance) return;
      if (!overflowImport) {
        overflowImport = import(BOOTSTRAP_BUNDLE_URL).catch(function () {
          return null;
        });
      }
      overflowImport.then(function (bs) {
        if (!bs || !bs.NavOverflow) return;
        if (!isDesktop()) return;
        var w = document.getElementById('targumNavOverflow');
        if (w && !overflowInstance) {
          overflowInstance = bs.NavOverflow.getOrCreateInstance(w);
        }
      });
    } else if (overflowInstance) {
      overflowInstance.dispose();
      overflowInstance = null;
    }
  }

  function init() {
    renderNav();
    renderFooter();
    syncNavOverflow();
    var navEl = document.querySelector('#nav-root nav');
    if (navEl && 'ResizeObserver' in window) {
      new ResizeObserver(function () { syncNavOverflow(); }).observe(navEl);
    } else if (window.matchMedia) {
      // Fallback for browsers without ResizeObserver: the viewport
      // width is a close approximation of the navbar width.
      var mq = window.matchMedia('(min-width: 1024px)');
      if (mq.addEventListener) {
        mq.addEventListener('change', syncNavOverflow);
      } else if (mq.addListener) {
        mq.addListener(syncNavOverflow);
      }
    }
  }

  // Exposed so other pages and tests can read the navigation tree.
  window.TargumNav = { NAV: NAV };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
