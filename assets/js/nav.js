/* Targum site navigation.
 *
 * NAV is plain data — an array of {label, href} — so the site owner's
 * navigation tree can drop in here later without a rewrite of the
 * markup below. This file injects the Bootstrap navbar (navy header,
 * mobile collapse, current page marked active) into #nav-root and the
 * footer into #footer-root on every page.
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

  function currentPage() {
    var path = window.location.pathname || '';
    var page = path.substring(path.lastIndexOf('/') + 1);
    return page === '' ? 'index.html' : page;
  }

  function renderNav() {
    var root = document.getElementById('nav-root');
    if (!root) return;
    var current = currentPage();
    var items = NAV.map(function (item) {
      var active = item.href === current;
      return '<li class="nav-item">' +
        '<a class="nav-link' + (active ? ' active' : '') + '"' +
        (active ? ' aria-current="page"' : '') +
        ' href="' + item.href + '">' + item.label + '</a>' +
        '</li>';
    }).join('');
    root.innerHTML =
      '<nav class="navbar navbar-expand-lg bg-targum-navy" data-bs-theme="dark" aria-label="Main navigation">' +
        '<div class="container">' +
          '<a class="navbar-brand" href="index.html">Targum</a>' +
          '<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#targumNavbar" aria-controls="targumNavbar" aria-expanded="false" aria-label="Toggle navigation">' +
            '<span class="navbar-toggler-icon"></span>' +
          '</button>' +
          '<div class="collapse navbar-collapse" id="targumNavbar">' +
            '<ul class="navbar-nav me-auto mb-2 mb-lg-0">' + items + '</ul>' +
          '</div>' +
        '</div>' +
      '</nav>';
  }

  function renderFooter() {
    var root = document.getElementById('footer-root');
    if (!root) return;
    root.innerHTML =
      '<footer class="border-top mt-5 py-4">' +
        '<div class="container">' +
          '<p class="text-body-secondary small mb-1">Targum — a dictionary of Torah languages: Modern Hebrew, Lashon HaKodesh, Aramaic, Yiddish, and English.</p>' +
          '<p class="text-body-secondary small mb-0">Dictionary data: Wiktionary via kaikki.org (CC BY-SA), Strong&rsquo;s (public domain), Jastrow&rsquo;s Dictionary (public domain, 1903).</p>' +
        '</div>' +
      '</footer>';
  }

  function init() {
    renderNav();
    renderFooter();
  }

  // Exposed so other pages and tests can read the navigation tree.
  window.TargumNav = { NAV: NAV };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
