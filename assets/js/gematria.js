/* Targum gematria calculator.
 *
 * Pure math (window.TargumGematria):
 *   METHODS: { hechrachi, siduri, katan, atbash }
 *   letterValue(letter, method) -> number | null
 *   breakdown(phrase, method) -> [{ letter, value }] (Hebrew letters only)
 *   total(phrase, method, hakolel) -> number
 *   hakolel: 'none' | 'word' (+1 per word) | 'letter' (+1 per letter)
 *
 * Final letters (sofit) share their base letter's value in every
 * method. Nikud and non-Hebrew characters are ignored.
 */
(function () {
  'use strict';

  // Hechrachi (standard) values, aleph through tav.
  var HECHRACHI = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400];

  var LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ',
    'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'];

  // Final letters map to their base letter's index.
  var FINALS = { 'ך': 10, 'ם': 12, 'ן': 13, 'ף': 16, 'ץ': 17 };

  function letterIndex(letter) {
    var idx = LETTERS.indexOf(letter);
    if (idx !== -1) return idx;
    if (Object.prototype.hasOwnProperty.call(FINALS, letter)) return FINALS[letter];
    return -1;
  }

  function letterValue(letter, method) {
    var idx = letterIndex(letter);
    if (idx === -1) return null;
    if (method === 'siduri') return idx + 1;
    if (method === 'katan') {
      var v = HECHRACHI[idx] % 9;
      return v === 0 ? 9 : v;
    }
    if (method === 'atbash') return HECHRACHI[21 - idx];
    return HECHRACHI[idx]; // hechrachi (default)
  }

  function hebrewLetters(phrase) {
    return String(phrase == null ? '' : phrase).split('').filter(function (ch) {
      return letterIndex(ch) !== -1;
    });
  }

  function breakdown(phrase, method) {
    return hebrewLetters(phrase).map(function (ch) {
      return { letter: ch, value: letterValue(ch, method) };
    });
  }

  function wordCount(phrase) {
    return String(phrase == null ? '' : phrase).trim().split(/\s+/).filter(function (w) {
      return w !== '' && hebrewLetters(w).length > 0;
    }).length;
  }

  function total(phrase, method, hakolel) {
    var sum = breakdown(phrase, method).reduce(function (acc, item) {
      return acc + item.value;
    }, 0);
    if (hakolel === 'word') sum += wordCount(phrase);
    else if (hakolel === 'letter') sum += hebrewLetters(phrase).length;
    return sum;
  }

  var METHODS = {
    hechrachi: 'Mispar Hechrachi',
    siduri: 'Mispar Siduri',
    katan: 'Mispar Katan',
    atbash: 'Atbash'
  };

  window.TargumGematria = {
    METHODS: METHODS,
    letterValue: letterValue,
    breakdown: breakdown,
    total: total,
    wordCount: wordCount
  };

  // ---- Page wiring (tools.html) ----

  function init() {
    var phrase1 = document.getElementById('phrase-1');
    var phrase2 = document.getElementById('phrase-2');
    var results = document.getElementById('gematria-results');
    if (!phrase1 || !phrase2 || !results) return;

    function currentMethod() {
      var checked = document.querySelector('input[name="gematria-method"]:checked');
      return checked ? checked.value : 'hechrachi';
    }

    function currentHakolel() {
      var checked = document.querySelector('input[name="gematria-hakolel"]:checked');
      return checked ? checked.value : 'none';
    }

    function breakdownTable(phrase, method) {
      var rows = breakdown(phrase, method);
      if (!rows.length) return '<p class="text-body-secondary">No Hebrew letters.</p>';
      var body = rows.map(function (item) {
        return '<tr><td lang="he" dir="rtl" class="targum-headword fs-5">' +
          item.letter + '</td><td>' + item.value + '</td></tr>';
      }).join('');
      return '<div class="table-responsive"><table class="table table-sm">' +
        '<thead><tr><th scope="col">Letter</th><th scope="col">Value</th></tr></thead>' +
        '<tbody>' + body + '</tbody></table></div>';
    }

    function phraseCard(label, phrase, method, hakolel) {
      var value = total(phrase, method, hakolel);
      var hasLetters = hebrewLetters(phrase).length > 0;
      return '<div class="card mb-3"><div class="card-body">' +
        '<h3 class="card-title h5">' + label + '</h3>' +
        '<p class="card-text targum-headword fs-4 mb-1" lang="he" dir="rtl">' +
          (typeof Targum !== 'undefined' ? Targum.escapeHtml(phrase) : phrase) + '</p>' +
        '<p class="card-text fs-5 mb-2">' + (hasLetters ? value : '—') + '</p>' +
        breakdownTable(phrase, method) +
        '</div></div>';
    }

    function render() {
      var method = currentMethod();
      var hakolel = currentHakolel();
      var p1 = phrase1.value;
      var p2 = phrase2.value;
      var has1 = hebrewLetters(p1).length > 0;
      var has2 = hebrewLetters(p2).length > 0;
      if (!has1 && !has2) {
        results.innerHTML = '<p class="text-body-secondary">Enter a Hebrew phrase above to see its value.</p>';
        return;
      }
      var html = '';
      if (has1 && has2) {
        var t1 = total(p1, method, hakolel);
        var t2 = total(p2, method, hakolel);
        var diff = t1 - t2;
        html += '<div class="alert ' + (diff === 0 ? 'alert-success' : 'alert-info') + '" role="status">' +
          (diff === 0
            ? 'The two phrases are equal in value.'
            : 'Difference: ' + Math.abs(diff) + ' (first phrase ' + (diff > 0 ? 'higher' : 'lower') + ').') +
          '</div>';
      }
      html += '<div class="row"><div class="col-md-6">' +
        (has1 ? phraseCard('First phrase', p1, method, hakolel) : '') + '</div>' +
        '<div class="col-md-6">' +
        (has2 ? phraseCard('Second phrase', p2, method, hakolel) : '') + '</div></div>';
      results.innerHTML = html;
    }

    [phrase1, phrase2].forEach(function (input) {
      input.addEventListener('input', render);
    });
    document.querySelectorAll('input[name="gematria-method"], input[name="gematria-hakolel"]')
      .forEach(function (input) {
        input.addEventListener('change', render);
      });
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
