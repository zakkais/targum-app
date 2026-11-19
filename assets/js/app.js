/* Targum shared library.
 *
 * window.Targum = {
 *   stripNikud(str) -> str,
 *   loadDict(lang) -> Promise<array>,
 *   searchDict(query, langs, options) -> Promise<array>,
 *   renderEntryCard(entry) -> string (HTML),
 *   loadThesaurus() -> Promise<object> (plain word -> group headword),
 *   LANG_NAMES: { modern, ancient, aramaic, yiddish }
 * }
 *
 * Also exposed as helpers for other pages: LANGS (all four language
 * keys), HEBREW_LETTERS (the Aleph-Beis, for browse indexes), and
 * escapeHtml (for safely rendering data strings into markup).
 *
 * Entry schema (see data/dict-*.json): {"h", "p", "l", "pos", "g",
 * "s", optional "o", "yivo", "hasidic", "tr", "n"}. "h" is the
 * unpointed headword; "n" (when present) is the pointed form from the
 * source, shown under the main word in small text.
 *
 * Entry cards carry a Copy button (copies headword + gloss; handled
 * by a delegated click listener registered here) and, when the
 * thesaurus data is loaded and contains a group for the word, a
 * "Synonyms" link to thesaurus.html?group=<headword>.
 */
(function () {
  'use strict';

  var LANG_NAMES = {
    modern: 'Modern Hebrew',
    ancient: 'Lashon HaKodesh',
    aramaic: 'Aramaic',
    yiddish: 'Yiddish'
  };

  var LANGS = ['modern', 'ancient', 'aramaic', 'yiddish'];

  var HEBREW_LETTERS = [
    'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ',
    'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'
  ];

  // Hebrew points and marks: U+0591-U+05BD (accents, vowel points and
  // meteg), U+05BF (rafe), U+05C1-U+05C2 (shin/sin dots), U+05C4-U+05C5
  // (upper/lower dots), U+05C7 (kamatz katan). Geresh/gershayim and
  // maqaf are not nikud and are left alone.
  var NIKUD_RE = /[\u0591-\u05BD\u05BF\u05C1-\u05C2\u05C4-\u05C5\u05C7]/g;

  function stripNikud(str) {
    return String(str == null ? '' : str).replace(NIKUD_RE, '');
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // lang -> Promise<array>. Failed loads are not cached, so a retry
  // fetches again.
  var dictCache = {};

  function loadDict(lang) {
    if (!dictCache[lang]) {
      dictCache[lang] = fetch('data/dict-' + lang + '.json')
        .then(function (response) {
          if (!response.ok) {
            throw new Error('Dictionary file for "' + lang + '" could not be loaded (' + response.status + ').');
          }
          return response.json();
        })
        .catch(function (err) {
          delete dictCache[lang];
          throw err;
        });
    }
    return dictCache[lang];
  }

  // Search across the given languages (default: all four).
  // Hebrew matching is nikud-insensitive: nikud is stripped from the
  // query and from headwords before comparing. English matching is a
  // case-insensitive substring match on the gloss. Results are ranked:
  // exact headword matches first, then headwords starting with the
  // query, then other headword substring matches, then gloss-only
  // matches; alphabetical by plain form within each tier.
  // options.glossOnly restricts matching to the gloss (used by the
  // "English gloss search" filter). A language whose file fails to
  // load contributes no results.
  function searchDict(query, langs, options) {
    var q = String(query == null ? '' : query).trim();
    if (!q) return Promise.resolve([]);
    var wanted = Array.isArray(langs) && langs.length ? langs : LANGS.slice();
    var glossOnly = !!(options && options.glossOnly);
    var qPlain = stripNikud(q);
    var qLower = q.toLowerCase();
    var hasHebrew = /[\u0590-\u05FF]/.test(q);
    return Promise.all(wanted.map(function (lang) {
      return loadDict(lang).catch(function () { return []; });
    })).then(function (lists) {
      var scored = [];
      lists.forEach(function (list) {
        list.forEach(function (entry) {
          var rank = -1;
          if (!glossOnly && hasHebrew) {
            var headPlain = stripNikud(entry.p || '');
            var headShown = stripNikud(entry.h || '');
            if (headPlain === qPlain || headShown === qPlain) rank = 0;
            else if (headPlain.indexOf(qPlain) === 0 || headShown.indexOf(qPlain) === 0) rank = 1;
            else if (headPlain.indexOf(qPlain) !== -1 || headShown.indexOf(qPlain) !== -1) rank = 2;
          }
          if (rank === -1 && String(entry.g || '').toLowerCase().indexOf(qLower) !== -1) rank = 3;
          if (rank !== -1) scored.push({ entry: entry, rank: rank });
        });
      });
      scored.sort(function (a, b) {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return String(a.entry.p || '').localeCompare(String(b.entry.p || ''), 'he');
      });
      return scored.map(function (item) { return item.entry; });
    });
  }

  // Thesaurus group lookup: plain word -> group headword (plain).
  // Built from data/thesaurus.json when it exists: group headwords
  // and synonym words both map to their group. A missing file (the
  // thesaurus is not in v1 yet) resolves to an empty map, so no
  // "Synonyms" links appear until the data lands.
  var thesaurusMap = null;
  var thesaurusPromise = null;

  function loadThesaurus() {
    if (!thesaurusPromise) {
      thesaurusPromise = fetch('data/thesaurus.json')
        .then(function (response) {
          if (!response.ok) throw new Error('Thesaurus data not available.');
          return response.json();
        })
        .then(function (data) {
          var map = {};
          (Array.isArray(data) ? data : []).forEach(function (group) {
            var gp = stripNikud(group.p || '');
            if (!gp) return;
            if (!map[gp]) map[gp] = gp;
            (group.syn || []).forEach(function (syn) {
              var w = stripNikud(syn.w || '');
              if (w && !map[w]) map[w] = gp;
            });
          });
          thesaurusMap = map;
          return map;
        })
        .catch(function () {
          thesaurusMap = {};
          return {};
        });
    }
    return thesaurusPromise;
  }

  // Copy buttons on entry cards: delegated, so cards rendered by any
  // page work. Copies the headword + gloss from data-copy-text.
  function copyText(text, button) {
    function done() {
      var original = button.textContent;
      button.textContent = 'Copied';
      button.disabled = true;
      setTimeout(function () {
        button.textContent = original;
        button.disabled = false;
      }, 1500);
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    try {
      var area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
      done();
    } catch (err) {
      // Copy unavailable; leave the button unchanged.
    }
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function (event) {
      var btn = event.target && event.target.closest
        ? event.target.closest('[data-targum-copy]') : null;
      if (!btn) return;
      copyText(btn.getAttribute('data-copy-text') || '', btn);
    });
  }

  // Start loading the thesaurus map in the background (browser only);
  // pages re-render once it resolves so links appear.
  if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    try { loadThesaurus(); } catch (err) { /* thesaurus is optional */ }
  }

  // Full entry card (Bootstrap card). Shows only what the data
  // contains: headword (unpointed; the pointed form from entry.n, when
  // present, shows under it in small text), language badge, part of
  // speech, gloss senses (split on " | "), source line, origin note
  // when entry.o exists, a Copy button, and a "Synonyms" link when a
  // thesaurus group exists for the word. Verb entries get a
  // "Conjugate" link; Yiddish entries show both spellings when
  // entry.yivo / entry.hasidic exist and the transliteration when
  // entry.tr exists (in a .targum-translit element, so pages can
  // toggle it).
  function renderEntryCard(entry) {
    var langKey = entry.l || '';
    var langName = LANG_NAMES[langKey] || langKey;
    var isYiddish = langKey === 'yiddish';
    var langAttr = isYiddish ? 'yi' : 'he';
    var senses = String(entry.g || '').split(' | ')
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s !== ''; });
    var headword = entry.h || entry.p || '';
    var copyTextValue = headword + (entry.g ? ' — ' + entry.g : '');

    var html = '<article class="card mb-5"><div class="card-body">';
    html += '<div class="d-flex justify-content-between align-items-start gap-3">';
    html += '<h3 class="card-title targum-headword fs-3xl mb-1">' +
      '<span lang="' + langAttr + '" dir="rtl">' +
      escapeHtml(headword) + '</span></h3>';
    html += '<button type="button" class="btn-sm btn-outline theme-secondary flex-shrink-0" ' +
      'data-targum-copy data-copy-text="' + escapeHtml(copyTextValue) + '" ' +
      'aria-label="Copy entry text">Copy</button>';
    html += '</div>';
    if (entry.n && entry.n !== headword) {
      html += '<p class="targum-nikud small fg-secondary mb-3">' +
        '<span lang="' + langAttr + '" dir="rtl">' + escapeHtml(entry.n) + '</span></p>';
    }
    html += '<p class="mb-3">';
    if (langName) {
      html += '<span class="badge theme-primary rounded-pill">' + escapeHtml(langName) + '</span> ';
    }
    if (entry.pos) {
      html += '<span class="fg-secondary">' + escapeHtml(entry.pos) + '</span>';
    }
    html += '</p>';
    if (isYiddish && (entry.yivo || entry.hasidic)) {
      var spellings = [];
      if (entry.yivo) {
        spellings.push('YIVO: <span lang="yi" dir="rtl">' + escapeHtml(entry.yivo) + '</span>');
      }
      if (entry.hasidic) {
        spellings.push('Hasidic: <span lang="yi" dir="rtl">' + escapeHtml(entry.hasidic) + '</span>');
      }
      html += '<p class="card-text mb-3">' + spellings.join('<br>') + '</p>';
    }
    if (isYiddish && entry.tr) {
      html += '<p class="card-text targum-translit fst-italic fg-secondary mb-3">' +
        escapeHtml(entry.tr) + '</p>';
    }
    html += '</div>';

    if (senses.length) {
      html += '<ul class="list-group list-group-flush">';
      senses.forEach(function (sense) {
        html += '<li class="list-group-item">' + escapeHtml(sense) + '</li>';
      });
      html += '</ul>';
    }

    var isVerb = /verb/i.test(entry.pos || '');
    var thesGroup = thesaurusMap ? thesaurusMap[stripNikud(entry.p || '')] : null;
    if (entry.s || entry.o || (isVerb && entry.p) || thesGroup) {
      html += '<div class="card-footer">';
      if (entry.s) {
        html += '<p class="fg-secondary small mb-0">Source: ' + escapeHtml(entry.s) + '</p>';
      }
      if (entry.o) {
        html += '<p class="fg-secondary small mb-0">Origin: ' + escapeHtml(entry.o) + '</p>';
      }
      if (isVerb && entry.p) {
        html += '<a href="conjugator.html?verb=' +
          encodeURIComponent(entry.p) + '">Conjugate</a>';
      }
      if (thesGroup) {
        html += '<a href="thesaurus.html?group=' +
          encodeURIComponent(thesGroup) + '">Synonyms</a>';
      }
      html += '</div>';
    }
    html += '</article>';
    return html;
  }

  window.Targum = {
    stripNikud: stripNikud,
    loadDict: loadDict,
    searchDict: searchDict,
    renderEntryCard: renderEntryCard,
    loadThesaurus: loadThesaurus,
    LANG_NAMES: LANG_NAMES,
    LANGS: LANGS.slice(),
    HEBREW_LETTERS: HEBREW_LETTERS.slice(),
    escapeHtml: escapeHtml
  };
})();
