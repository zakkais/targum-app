/* Dikduk page: renders the binyan rules, tables, and examples from
 * data/dikduk-binyanim.json (המסלול לדקדוק, Walder Education, 2009)
 * into native details/summary accordions (the Bootstrap 6 accordion
 * pattern) — one item per binyan, in standard binyan order — plus a
 * General terms card above it.
 *
 * Depends on window.Targum (escapeHtml) from app.js. The render
 * functions are also exported for Node smoke tests (module.exports)
 * when `module` exists.
 */
(function () {
  'use strict';

  // Chevron for the native details/summary accordions (Bootstrap 6
  // accordions need the .accordion-icon SVG inside the summary).
  var ACCORDION_ICON = '<svg class="accordion-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m2 5 6 6 6-6"/></svg>';

  var TENSE_ORDER = ['past', 'present', 'future', 'imperative', 'infinitive'];
  var TENSE_NAMES = {
    past: 'Past',
    present: 'Present',
    future: 'Future',
    imperative: 'Imperative',
    infinitive: 'Infinitive'
  };

  // Person keys as they appear in the tables data.
  var PERSON_NAMES = {
    '1s': 'I',
    '2ms': 'you (m.)',
    '2fs': 'you (f.)',
    '3ms': 'he',
    '3fs': 'she',
    '1p': 'we',
    '2mp': 'you (m. pl.)',
    '2fp': 'you (f. pl.)',
    '3p': 'they',
    '3mp': 'they (m.)',
    '3fp': 'they (f.)',
    ms: 'masculine',
    fs: 'feminine',
    mp: 'masculine plural',
    fp: 'feminine plural'
  };

  var SECTION_ORDER = [
    'past', 'present', 'future', 'imperative',
    'ii_guttural', 'iii_guttural', 'review', 'summary_test_1'
  ];
  var SECTION_NAMES = {
    past: 'Past',
    present: 'Present',
    future: 'Future',
    imperative: 'Imperative',
    ii_guttural: 'II-guttural',
    iii_guttural: 'III-guttural',
    review: 'Review',
    summary_test_1: 'Summary test'
  };

  // Wrap runs of Hebrew characters in RTL spans, so Hebrew words
  // inside English sentences render in the right order on phones.
  // Runs may span spaces between Hebrew words (e.g. a quoted phrase),
  // but stop at punctuation and Latin text. Runs after escapeHtml, so
  // entities (which contain no Hebrew characters) are safe.
  var HEBREW_RUN = /[\u0590-\u05FF\uFB1D-\uFB4F]+(?:[ \u00A0\u05BE\u2010-\u2015\u00B7][\u0590-\u05FF\uFB1D-\uFB4F]+)*/g;

  function hebrewSpans(text) {
    return Targum.escapeHtml(text).replace(HEBREW_RUN, function (run) {
      return '<span lang="he" dir="rtl">' + run + '</span>';
    });
  }

  function hebrewForm(form) {
    return '<span lang="he" dir="rtl" class="hebrew-form">' +
      Targum.escapeHtml(form) + '</span>';
  }

  function renderRules(rules) {
    var items = (rules || []).map(function (rule) {
      var title = rule.title
        ? '<strong>' + hebrewSpans(rule.title) + '</strong> '
        : '';
      return '<li>' + title + hebrewSpans(rule.text) + '</li>';
    }).join('');
    return '<ul>' + items + '</ul>';
  }

  // One tense of one table: a two-column Person/Form table (phone
  // friendly), a single infinitive line, or an explicit "none" line
  // for the tenses Pu'al and Huf'al do not have.
  function renderTense(tense, value) {
    var name = TENSE_NAMES[tense] || tense;
    if (value === null || value === undefined) {
      return '<p class="fg-secondary mb-3">' + name + ': none.</p>';
    }
    if (typeof value === 'string') {
      return '<p class="mb-3">' + name + ': ' + hebrewForm(value) + '</p>';
    }
    var rows = Object.keys(value).map(function (person) {
      return '<tr><td>' + Targum.escapeHtml(PERSON_NAMES[person] || person) +
        '</td><td lang="he" dir="rtl" class="hebrew-form">' +
        Targum.escapeHtml(value[person]) + '</td></tr>';
    }).join('');
    return '<h5 class="h6 mt-5 mb-1">' + name + '</h5>' +
      '<div class="table-responsive"><table class="table table-sm table-striped mb-3">' +
      '<thead><tr><th scope="col">Person</th><th scope="col">Form</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
  }

  function renderTableEntry(entry) {
    var html = '<h4 class="h6 mt-7 mb-1">' +
      Targum.escapeHtml(entry.label) +
      ' — root <span lang="he" dir="rtl">' +
      Targum.escapeHtml(entry.shoresh) + '</span></h4>';
    if (entry.note) {
      html += '<p class="fg-secondary small mb-3">' +
        hebrewSpans(entry.note) + '</p>';
    }
    TENSE_ORDER.forEach(function (tense) {
      if (entry.tables && tense in entry.tables) {
        html += renderTense(tense, entry.tables[tense]);
      }
    });
    return html;
  }

  function renderExamples(examples) {
    var html = '';
    SECTION_ORDER.forEach(function (section) {
      var list = (examples || {})[section];
      if (!list || !list.length) return;
      html += '<h4 class="h6 mt-5 mb-3">' +
        (SECTION_NAMES[section] || section) + '</h4>';
      html += '<ul class="list-unstyled">';
      list.forEach(function (ex) {
        html += '<li class="mb-5"><span lang="he" dir="rtl" class="targum-headword fs-lg">' +
          Targum.escapeHtml(ex.text) + '</span><br>' +
          '<span class="fg-secondary small">' +
          Targum.escapeHtml(ex.reference_en) +
          ' (<span lang="he" dir="rtl">' +
          Targum.escapeHtml(ex.reference) + '</span>)</span>';
        if (ex.note) {
          html += '<br><span class="fg-secondary small">Note: ' +
            hebrewSpans(ex.note) + '</span>';
        }
        html += '</li>';
      });
      html += '</ul>';
    });
    return html;
  }

  function countExamples(examples) {
    var n = 0;
    Object.keys(examples || {}).forEach(function (section) {
      n += (examples[section] || []).length;
    });
    return n;
  }

  function renderBinyan(b, i) {
    var nTables = (b.tables || []).length;
    var nExamples = countExamples(b.examples);
    return '<details class="accordion-item" name="binyanim-accordion" id="binyan-item-' + i + '">' +
      '<summary class="accordion-header">' +
      '<span lang="he" dir="rtl" class="targum-headword fs-lg">' +
      Targum.escapeHtml(b.hebrew) + '</span>' +
      '<span class="ms-3">' + Targum.escapeHtml(b.name) + '</span>' +
      '<span class="fg-secondary small ms-3">' +
      nTables + (nTables === 1 ? ' table' : ' tables') + ' · ' +
      nExamples + ' examples</span>' +
      ACCORDION_ICON +
      '</summary>' +
      '<div class="accordion-body">' +
      '<h3 class="h5">Rules</h3>' + renderRules(b.rules) +
      '<h3 class="h5 mt-7">Tables</h3>' +
      (b.tables || []).map(renderTableEntry).join('') +
      '<h3 class="h5 mt-7">Examples</h3>' + renderExamples(b.examples) +
      '<p class="mt-7 mb-0"><a href="conjugator.html?verb=' +
      encodeURIComponent(b.paradigm) + '&amp;binyan=' + b.id + '">Conjugate ' +
      hebrewForm(b.paradigm_3ms) + ' (' + Targum.escapeHtml(b.name) +
      ') in the Conjugator</a></p>' +
      '</div></details>';
  }

  function renderGeneral(general) {
    if (!general) return '';
    return '<div class="card mb-7"><div class="card-body">' +
      '<h3 class="card-title h5">' + Targum.escapeHtml(general.title) + '</h3>' +
      renderRules(general.rules) +
      '</div></div>';
  }

  function renderAll(data) {
    var binyanim = Array.isArray(data.binyanim) ? data.binyanim : [];
    var nTables = 0;
    var nExamples = 0;
    binyanim.forEach(function (b) {
      nTables += (b.tables || []).length;
      nExamples += countExamples(b.examples);
    });
    return {
      generalHtml: renderGeneral(data.general),
      accordionHtml: binyanim.map(renderBinyan).join(''),
      countText: binyanim.length + ' binyanim · ' + nTables +
        ' tables · ' + nExamples + ' examples, from ' + data.source + '.'
    };
  }

  // Browser: fetch the data and render into the page.
  if (typeof document !== 'undefined') {
    var accordionEl = document.getElementById('binyanim-accordion');
    var generalEl = document.getElementById('dikduk-general');
    var countEl = document.getElementById('binyanim-count');
    if (accordionEl) {
      fetch('data/dikduk-binyanim.json')
        .then(function (response) {
          if (!response.ok) throw new Error('Dikduk data could not be loaded.');
          return response.json();
        })
        .then(function (data) {
          var rendered = renderAll(data);
          if (generalEl) generalEl.innerHTML = rendered.generalHtml;
          accordionEl.innerHTML = rendered.accordionHtml;
          if (countEl) countEl.textContent = rendered.countText;
        })
        .catch(function () {
          accordionEl.innerHTML = '<div class="alert theme-warning" role="alert">Dikduk data is not available yet. Please try again later.</div>';
        });
    }
  }

  // Node smoke tests.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      hebrewSpans: hebrewSpans,
      renderRules: renderRules,
      renderTense: renderTense,
      renderTableEntry: renderTableEntry,
      renderExamples: renderExamples,
      renderBinyan: renderBinyan,
      renderGeneral: renderGeneral,
      renderAll: renderAll,
      countExamples: countExamples
    };
  }
})();
