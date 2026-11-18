/* Targum Read Mode.
 *
 * Paste a Hebrew or Aramaic text; every word becomes a tappable
 * button. Tapping a word looks it up through window.Targum:
 * abbreviations (words containing gershayim or geresh) are checked
 * against data/roshei-teivos.json when that file exists, and all
 * other words against the dictionary via Targum.searchDict, with
 * the entry shown by Targum.renderEntryCard in the panel below
 * the text. Lookups are nikud-insensitive. Nothing is invented:
 * a word with no entry says so.
 */
(function () {
  'use strict';

  // A word: Hebrew letters (including presentation forms), nikud and
  // geresh/gershayim, or a run of Latin letters (for Yiddish or
  // English words pasted alongside the Hebrew text).
  var WORD_RE = /[\u0590-\u05FF\uFB1D-\uFB4F]+|[A-Za-z]+/g;

  var GERSHAYIM = '\u05F4'; // ״
  var GERESH = '\u05F3'; // ׳

  var MAX_CLOSE_MATCHES = 5;

  var form = document.getElementById('read-form');
  var input = document.getElementById('read-input');
  var clearBtn = document.getElementById('read-clear');
  var output = document.getElementById('read-output');
  var textEl = document.getElementById('read-text');
  var panelEl = document.getElementById('entry-panel');

  var selectedBtn = null;
  var lookupSeq = 0;

  // Roshei Teivos list, loaded lazily and cached. A missing or
  // unreadable file resolves to null, which means "no list yet" —
  // abbreviations then report as not in the current list.
  var rtPromise = null;

  function loadRosheiTeivos() {
    if (!rtPromise) {
      rtPromise = fetch('data/roshei-teivos.json')
        .then(function (response) {
          if (!response.ok) return null;
          return response.json();
        })
        .then(function (data) {
          if (Array.isArray(data)) return data;
          // Accept a plain mapping of abbreviation -> expansion too.
          if (data && typeof data === 'object') {
            return Object.keys(data).map(function (key) {
              return { a: key, e: data[key] };
            });
          }
          return null;
        })
        .catch(function () { return null; });
    }
    return rtPromise;
  }

  // Final letters (sofit) folded to their regular forms, so a word
  // ending in ך still matches a dictionary form ending in כ.
  function foldSofit(str) {
    return String(str)
      .replace(/\u05DA/g, '\u05DB')
      .replace(/\u05DD/g, '\u05DE')
      .replace(/\u05DF/g, '\u05E0')
      .replace(/\u05E3/g, '\u05E4')
      .replace(/\u05E5/g, '\u05E6');
  }

  function plainForm(word) {
    return foldSofit(Targum.stripNikud(word));
  }

  // Abbreviation forms compared loosely: nikud stripped, sofit
  // folded, and ASCII quotes treated as geresh/gershayim.
  function abbrevForm(word) {
    return plainForm(word)
      .replace(/"/g, GERSHAYIM)
      .replace(/'/g, GERESH);
  }

  function isAbbreviation(word) {
    return word.indexOf(GERSHAYIM) !== -1 || word.indexOf(GERESH) !== -1 ||
      word.indexOf('"') !== -1 || word.indexOf('\'') !== -1;
  }

  // Split the text into word buttons and untouched separators
  // (whitespace and punctuation keep their place).
  function renderText(text) {
    var html = '';
    var lastIndex = 0;
    var match;
    WORD_RE.lastIndex = 0;
    while ((match = WORD_RE.exec(text)) !== null) {
      html += Targum.escapeHtml(text.slice(lastIndex, match.index));
      html += '<button type="button" class="btn btn-link p-0 align-baseline ' +
        'text-reset text-decoration-none targum-word" data-word="' +
        Targum.escapeHtml(match[0]) + '" aria-label="Look up ' +
        Targum.escapeHtml(match[0]) + '">' +
        Targum.escapeHtml(match[0]) + '</button>';
      lastIndex = match.index + match[0].length;
    }
    html += Targum.escapeHtml(text.slice(lastIndex));
    textEl.innerHTML = html;
    output.hidden = false;
    panelEl.innerHTML = '<p class="text-body-secondary">Tap a word above to see its entry.</p>';
  }

  function markSelected(btn) {
    if (selectedBtn) {
      selectedBtn.classList.remove('bg-warning-subtle', 'rounded-1');
    }
    selectedBtn = btn;
    if (btn) btn.classList.add('bg-warning-subtle', 'rounded-1');
  }

  function dictionaryLink(word) {
    return '<p class="mb-0"><a href="index.html?q=' +
      encodeURIComponent(word) + '">Search the dictionary for this word</a></p>';
  }

  function showAbbreviation(word, entry) {
    var abbrev = entry.a || entry.abbrev || entry.h || entry.p || word;
    var expansion = entry.e || entry.expansion || entry.g || '';
    var html = '<article class="card mb-3"><div class="card-body">' +
      '<h3 class="card-title targum-headword fs-2 mb-1">' +
      '<span lang="he" dir="rtl">' + Targum.escapeHtml(abbrev) + '</span></h3>' +
      '<p class="mb-2"><span class="badge text-bg-primary rounded-pill">Roshei Teivos</span></p>' +
      '<p class="card-text mb-0"><span lang="he" dir="rtl">' +
      Targum.escapeHtml(expansion) + '</span></p>' +
      '</div></article>';
    panelEl.innerHTML = html;
  }

  function showAbbreviationMissing(word) {
    panelEl.innerHTML = '<div class="alert alert-info" role="status">' +
      '<span lang="he" dir="rtl">' + Targum.escapeHtml(word) + '</span> ' +
      'is not in the current list of Roshei Teivos.</div>';
  }

  function lookupAbbreviation(word) {
    var seq = ++lookupSeq;
    panelEl.innerHTML = '<p class="text-body-secondary" role="status">Loading…</p>';
    loadRosheiTeivos().then(function (list) {
      if (seq !== lookupSeq) return;
      if (!list) { showAbbreviationMissing(word); return; }
      var wanted = abbrevForm(word);
      var hit = null;
      list.some(function (entry) {
        var cand = entry.a || entry.abbrev || entry.h || entry.p || '';
        if (cand && abbrevForm(cand) === wanted) { hit = entry; return true; }
        return false;
      });
      if (hit) showAbbreviation(word, hit);
      else showAbbreviationMissing(word);
    });
  }

  function lookupWord(word) {
    var seq = ++lookupSeq;
    panelEl.innerHTML = '<p class="text-body-secondary" role="status">Loading…</p>';
    var plain = plainForm(word);
    Targum.searchDict(Targum.stripNikud(word), Targum.LANGS).then(function (results) {
      if (seq !== lookupSeq) return;
      var exact = results.filter(function (entry) {
        return plainForm(entry.h || '') === plain || plainForm(entry.p || '') === plain;
      });
      if (exact.length) {
        panelEl.innerHTML = exact.map(Targum.renderEntryCard).join('');
        return;
      }
      if (results.length) {
        panelEl.innerHTML =
          '<p class="text-body-secondary">No exact match for ' +
          '<span lang="he" dir="rtl">' + Targum.escapeHtml(word) + '</span>. ' +
          'Closest results:</p>' +
          results.slice(0, MAX_CLOSE_MATCHES).map(Targum.renderEntryCard).join('') +
          dictionaryLink(word);
        return;
      }
      panelEl.innerHTML = '<div class="alert alert-info" role="status">' +
        'No dictionary entry found for ' +
        '<span lang="he" dir="rtl">' + Targum.escapeHtml(word) + '</span>.</div>' +
        dictionaryLink(word);
    });
  }

  textEl.addEventListener('click', function (event) {
    var btn = event.target.closest('.targum-word');
    if (!btn) return;
    var word = btn.getAttribute('data-word') || '';
    if (!word) return;
    markSelected(btn);
    if (isAbbreviation(word)) lookupAbbreviation(word);
    else lookupWord(word);
    panelEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var text = input.value.trim();
    if (!text) {
      output.hidden = true;
      textEl.innerHTML = '';
      panelEl.innerHTML = '';
      return;
    }
    selectedBtn = null;
    renderText(input.value);
  });

  clearBtn.addEventListener('click', function () {
    input.value = '';
    output.hidden = true;
    textEl.innerHTML = '';
    panelEl.innerHTML = '';
    selectedBtn = null;
    input.focus();
  });
})();
