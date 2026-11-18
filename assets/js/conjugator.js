/* Targum verb conjugator — rule-based, fully offline.
 *
 * Templates use {1},{2},{3} ({4} for four-letter roots) as slots for the
 * root letters, with nikud inline. Dagesh hazak (morphological) is marked
 * in templates as ּ after the letter; dagesh lene is deliberately not
 * marked. Irregular root classes override the regular templates per
 * binyan (see IRREGULAR); a class×binyan combination with no override
 * and no regular fallback is reported as not covered rather than
 * guessed.
 *
 * Exposes window.TargumConjugator = { conjugate, identify, BINYANIM }.
 * conjugate(shoresh, binyan) -> { covered, class, tables } where tables
 * is { past: {person: form}, present: {...}, future: {...},
 * imperative: {...}, infinitive: "form" }.
 * identify(form) -> [{ shoresh, binyan, tense, person, form }].
 */
(function () {
  'use strict';

  var BINYANIM = ['paal', 'nifal', 'piel', 'pual', 'hifil', 'hufal', 'hitpael', 'poel'];
  var BINYAN_NAMES = {
    paal: 'Paal', nifal: 'Nifal', piel: 'Piel', pual: 'Pual',
    hifil: 'Hifil', hufal: 'Hufal', hitpael: 'Hitpael', poel: 'Poel'
  };

  var GUTTURALS = ['א', 'ה', 'ח', 'ע'];
  var SIBILANTS = ['ז', 'ס', 'ש'];

  // Persons in display order per tense.
  var PAST_PERSONS = ['1s', '2ms', '2fs', '3ms', '3fs', '1p', '2mp', '2fp', '3p'];
  var PRESENT_PERSONS = ['ms', 'fs', 'mp', 'fp'];
  var FUTURE_PERSONS = ['1s', '2ms', '2fs', '3ms', '3fs', '1p', '2mp', '2fp', '3mp', '3fp'];
  var IMPERATIVE_PERSONS = ['ms', 'fs', 'mp', 'fp'];
  var PERSON_LABELS = {
    '1s': '1st sg.', '2ms': '2nd masc. sg.', '2fs': '2nd fem. sg.',
    '3ms': '3rd masc. sg.', '3fs': '3rd fem. sg.', '1p': '1st pl.',
    '2mp': '2nd masc. pl.', '2fp': '2nd fem. pl.', '3p': '3rd pl.',
    '3mp': '3rd masc. pl.', '3fp': '3rd fem. pl.',
    ms: 'masc. sg.', fs: 'fem. sg.', mp: 'masc. pl.', fp: 'fem. pl.'
  };

  var NIKUD_RE = /[֑-ֽׁ-ׂׄ-ְׅ-ׇ]/g;
  var DAGESH = 'ּ';

  function stripMarks(str) {
    return String(str == null ? '' : str).replace(NIKUD_RE, '').replace(/ּ/g, '');
  }

  function isHebrewLetter(ch) {
    return ch >= 'א' && ch <= 'ת';
  }

  function isGuttural(ch) {
    return GUTTURALS.indexOf(ch) !== -1;
  }

  // Parse a shoresh: strip nikud, spaces and maqaf; keep Hebrew letters.
  // Returns an array of 3 or 4 letters, or null.
  function parseRoot(input) {
    var letters = stripMarks(input).replace(/[^א-ת]/g, '').split('');
    if (letters.length !== 3 && letters.length !== 4) return null;
    return letters;
  }

  // Detect the root class. Order matters: check the most specific first.
  // Returns one of: regular, iii-he, iii-aleph, hollow-vav, hollow-yod,
  // geminate, i-nun, i-yod, i-aleph, or null for a four-letter root
  // (four-letter roots are always treated as regular).
  function rootClass(root) {
    if (root.length === 4) return 'regular';
    var r1 = root[0], r2 = root[1], r3 = root[2];
    if (r3 === 'ה') return 'iii-he';
    if (r3 === 'א') return 'iii-aleph';
    if (r2 === 'ו') return 'hollow-vav';
    if (r2 === 'י') return 'hollow-yod';
    if (r2 === r3) return 'geminate';
    if (r1 === 'נ') return 'i-nun';
    if (r1 === 'י') return 'i-yod';
    if (r1 === 'א') return 'i-aleph';
    return 'regular';
  }

  // Substitute root letters into a template ({1}..{4}).
  // Final letters (ךםןףץ) become regular mid-word: only the last
  // Hebrew letter of the form keeps its final shape.
  var FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
  function fill(template, root) {
    var form = template.replace(/\{(\d)\}/g, function (m, n) {
      return root[Number(n) - 1] || '';
    });
    var lastIdx = -1;
    for (var i = 0; i < form.length; i++) {
      if (isHebrewLetter(form[i])) lastIdx = i;
    }
    var out = '';
    for (var j = 0; j < form.length; j++) {
      var ch = form[j];
      out += (j !== lastIdx && FINALS[ch]) ? FINALS[ch] : ch;
    }
    return out;
  }

  // A word-final ך takes a shva in pointed text (בֵּרֵךְ, מֶלֶךְ).
  function finalKafShva(form) {
    if (/ך$/.test(form)) return form + 'ְ';
    return form;
  }

  // Guttural adjustments applied to a generated form.
  // - A shva under א or ע always becomes a hataf (they cannot take a
  //   shva at all). A shva under ח or ה becomes a hataf unless the
  //   next consonant carries a long vowel (kamatz/tzere/holam), in
  //   which case the guttural closes the syllable and keeps a plain
  //   shva (יַחְשֹׁב, but הֶחֱזִיר). The hataf matches the preceding
  //   vowel: segol/tzere/hirik -> hataf segol, kamatz/holam/kubutz ->
  //   hataf kamatz, otherwise hataf patach.
  // - In Nifal/Hifil, a prefix hirik before a guttural R1 becomes
  //   segol (נִ -> נֶ, הִ -> הֶ).
  // - In future-tense prefixes, the prefix vowel becomes patach before
  //   a guttural R1 (Paal), tzere in Nifal. Handled via opts.
  function gutturalize(form, root, opts) {
    opts = opts || {};
    var out = '';
    var prevVowel = '';
    var prevLetter = '';
    for (var i = 0; i < form.length; i++) {
      var ch = form[i];
      if (ch === 'ְ' && isGuttural(prevLetter)) {
        var useHataf = prevLetter === 'א' || prevLetter === 'ע';
        if (!useHataf) {
          var j = i + 1;
          var nextVowel = '';
          while (j < form.length) {
            var c = form[j];
            if (isHebrewLetter(c)) {
              j++;
              while (j < form.length && !isHebrewLetter(form[j])) {
                if (form[j] >= 'ֱ' && form[j] <= 'ֻ') nextVowel = form[j];
                j++;
              }
              break;
            }
            j++;
          }
          useHataf = !(nextVowel === 'ָ' || nextVowel === 'ֵ' || nextVowel === 'ֹ');
        }
        if (useHataf) {
          var hataf = 'ֲ';
          if (prevVowel === 'ֶ' || prevVowel === 'ֵ' || prevVowel === 'ִ') hataf = 'ֱ';
          else if (prevVowel === 'ָ' || prevVowel === 'ֹ' || prevVowel === 'ֻ') hataf = 'ֳ';
          out += hataf;
          continue;
        }
      }
      if (ch >= 'ֱ' && ch <= 'ֻ') prevVowel = ch;
      if (isHebrewLetter(ch)) prevLetter = ch;
      out += ch;
    }
    form = out;
    if (root.length === 3 && isGuttural(root[0])) {
      if (opts.binyan === 'nifal' || opts.binyan === 'hifil') {
        form = form.replace(/^לְהִ/, 'לְהֶ').replace(/^הִ/, 'הֶ').replace(/^נִ/, 'נֶ');
      }
      if (opts.futurePrefix === 'patach') {
        form = form.replace(/^([איתנ])[ִֶ]/, '$1ַ');
      } else if (opts.futurePrefix === 'tzere') {
        form = form.replace(/^([איתנ])[ִֶ]/, '$1ֵ');
      }
    }
    return form;
  }

  // Patach ganuv: when a form ends in a guttural R3 (ח/ע/ה) preceded by
  // a long vowel (holam, tzere, kamatz), a patach is written under the
  // final guttural (pronounced before it). The ְנָה suffix is not R3.
  function patachGanuv(form, root) {
    if (root.length !== 3) return form;
    var r3 = root[2];
    if (r3 !== 'ח' && r3 !== 'ע' && r3 !== 'ה') return form;
    if (form[form.length - 1] !== r3) return form;
    if (/ְנָה$/.test(form)) return form;
    var before = form[form.length - 2];
    if (before !== 'ֹ' && before !== 'ֵ' && before !== 'ָ') return form;
    return form + 'ַ';
  }

  // Regular (shlemim) paradigms. Templates per binyan, tense, person.
  // Pual and Hufal have no imperative or infinitive (null).
  var REGULAR = {
    paal: {
      past: {
        '1s': '{1}ָ{2}ַ{3}ְתִי', '2ms': '{1}ָ{2}ַ{3}ְתָ', '2fs': '{1}ָ{2}ַ{3}ְתְ',
        '3ms': '{1}ָ{2}ַ{3}', '3fs': '{1}ָ{2}ְ{3}ָה', '1p': '{1}ָ{2}ַ{3}ְנוּ',
        '2mp': '{1}ָ{2}ַ{3}ְתֶם', '2fp': '{1}ָ{2}ַ{3}ְתֶן', '3p': '{1}ָ{2}ְ{3}וּ'
      },
      present: {
        ms: '{1}וֹ{2}ֵ{3}', fs: '{1}וֹ{2}ֶ{3}ֶת',
        mp: '{1}וֹ{2}ְ{3}ִים', fp: '{1}וֹ{2}ְ{3}וֹת'
      },
      future: {
        '1s': 'אֶ{1}ְ{2}ֹ{3}', '2ms': 'תִ{1}ְ{2}ֹ{3}', '2fs': 'תִ{1}ְ{2}ְ{3}ִי',
        '3ms': 'יִ{1}ְ{2}ֹ{3}', '3fs': 'תִ{1}ְ{2}ֹ{3}', '1p': 'נִ{1}ְ{2}ֹ{3}',
        '2mp': 'תִ{1}ְ{2}ְ{3}וּ', '2fp': 'תִ{1}ְ{2}ֹ{3}ְנָה',
        '3mp': 'יִ{1}ְ{2}ְ{3}וּ', '3fp': 'תִ{1}ְ{2}ֹ{3}ְנָה'
      },
      imperative: {
        ms: '{1}ְ{2}ֹ{3}', fs: '{1}ִ{2}ְ{3}ִי',
        mp: '{1}ִ{2}ְ{3}וּ', fp: '{1}ְ{2}ֹ{3}ְנָה'
      },
      infinitive: 'לִ{1}ְ{2}ֹ{3}'
    },
    nifal: {
      past: {
        '1s': 'נִ{1}ְ{2}ַ{3}ְתִי', '2ms': 'נִ{1}ְ{2}ַ{3}ְתָ', '2fs': 'נִ{1}ְ{2}ַ{3}ְתְ',
        '3ms': 'נִ{1}ְ{2}ַ{3}', '3fs': 'נִ{1}ְ{2}ְ{3}ָה', '1p': 'נִ{1}ְ{2}ַ{3}ְנוּ',
        '2mp': 'נִ{1}ְ{2}ַ{3}ְתֶם', '2fp': 'נִ{1}ְ{2}ַ{3}ְתֶן', '3p': 'נִ{1}ְ{2}ְ{3}וּ'
      },
      present: {
        ms: 'נִ{1}ְ{2}ָ{3}', fs: 'נִ{1}ְ{2}ֶ{3}ֶת',
        mp: 'נִ{1}ְ{2}ָ{3}ִים', fp: 'נִ{1}ְ{2}ָ{3}וֹת'
      },
      future: {
        '1s': 'אִ{1}ָ{2}ֵ{3}', '2ms': 'תִ{1}ָ{2}ֵ{3}', '2fs': 'תִ{1}ָ{2}ְ{3}ִי',
        '3ms': 'יִ{1}ָ{2}ֵ{3}', '3fs': 'תִ{1}ָ{2}ֵ{3}', '1p': 'נִ{1}ָ{2}ֵ{3}',
        '2mp': 'תִ{1}ָ{2}ְ{3}וּ', '2fp': 'תִ{1}ָ{2}ֵ{3}ְנָה',
        '3mp': 'יִ{1}ָ{2}ְ{3}וּ', '3fp': 'תִ{1}ָ{2}ֵ{3}ְנָה'
      },
      imperative: {
        ms: 'הִ{1}ָ{2}ֵ{3}', fs: 'הִ{1}ָ{2}ְ{3}ִי',
        mp: 'הִ{1}ָ{2}ְ{3}וּ', fp: 'הִ{1}ָ{2}ֵ{3}ְנָה'
      },
      infinitive: 'לְהִ{1}ָ{2}ֵ{3}'
    },
    piel: {
      past: {
        '1s': '{1}ִ{2}ַּ{3}ְתִי', '2ms': '{1}ִ{2}ַּ{3}ְתָ', '2fs': '{1}ִ{2}ַּ{3}ְתְ',
        '3ms': '{1}ִ{2}ֵּ{3}', '3fs': '{1}ִ{2}ְּ{3}ָה', '1p': '{1}ִ{2}ַּ{3}ְנוּ',
        '2mp': '{1}ִ{2}ַּ{3}ְתֶם', '2fp': '{1}ִ{2}ַּ{3}ְתֶן', '3p': '{1}ִ{2}ְּ{3}וּ'
      },
      present: {
        ms: 'מְ{1}ַ{2}ֵּ{3}', fs: 'מְ{1}ַ{2}ֶּ{3}ֶת',
        mp: 'מְ{1}ַ{2}ְּ{3}ִים', fp: 'מְ{1}ַ{2}ְּ{3}וֹת'
      },
      future: {
        '1s': 'אֲ{1}ַ{2}ֵּ{3}', '2ms': 'תְ{1}ַ{2}ֵּ{3}', '2fs': 'תְ{1}ַ{2}ְּ{3}ִי',
        '3ms': 'יְ{1}ַ{2}ֵּ{3}', '3fs': 'תְ{1}ַ{2}ֵּ{3}', '1p': 'נְ{1}ַ{2}ֵּ{3}',
        '2mp': 'תְ{1}ַ{2}ְּ{3}וּ', '2fp': 'תְ{1}ַ{2}ֵּ{3}ְנָה',
        '3mp': 'יְ{1}ַ{2}ְּ{3}וּ', '3fp': 'תְ{1}ַ{2}ֵּ{3}ְנָה'
      },
      imperative: {
        ms: '{1}ַ{2}ֵּ{3}', fs: '{1}ַ{2}ְּ{3}ִי',
        mp: '{1}ַ{2}ְּ{3}וּ', fp: '{1}ַ{2}ֵּ{3}ְנָה'
      },
      infinitive: 'לְ{1}ַ{2}ֵּ{3}'
    },
    pual: {
      past: {
        '1s': '{1}ֻ{2}ַּ{3}ְתִי', '2ms': '{1}ֻ{2}ַּ{3}ְתָ', '2fs': '{1}ֻ{2}ַּ{3}ְתְ',
        '3ms': '{1}ֻ{2}ַּ{3}', '3fs': '{1}ֻ{2}ְּ{3}ָה', '1p': '{1}ֻ{2}ַּ{3}ְנוּ',
        '2mp': '{1}ֻ{2}ַּ{3}ְתֶם', '2fp': '{1}ֻ{2}ַּ{3}ְתֶן', '3p': '{1}ֻ{2}ְּ{3}וּ'
      },
      present: {
        ms: 'מְ{1}ֻ{2}ָּ{3}', fs: 'מְ{1}ֻ{2}ֶּ{3}ֶת',
        mp: 'מְ{1}ֻ{2}ָּ{3}ִים', fp: 'מְ{1}ֻ{2}ָּ{3}וֹת'
      },
      future: {
        '1s': 'אֲ{1}ֻ{2}ַּ{3}', '2ms': 'תְ{1}ֻ{2}ַּ{3}', '2fs': 'תְ{1}ֻ{2}ְּ{3}ִי',
        '3ms': 'יְ{1}ֻ{2}ַּ{3}', '3fs': 'תְ{1}ֻ{2}ַּ{3}', '1p': 'נְ{1}ֻ{2}ַּ{3}',
        '2mp': 'תְ{1}ֻ{2}ְּ{3}וּ', '2fp': 'תְ{1}ֻ{2}ַּ{3}ְנָה',
        '3mp': 'יְ{1}ֻ{2}ְּ{3}וּ', '3fp': 'תְ{1}ֻ{2}ַּ{3}ְנָה'
      },
      imperative: null,
      infinitive: null
    }
  };

  REGULAR.hifil = {
    past: {
      '1s': 'הִ{1}ְ{2}ַ{3}ְתִי', '2ms': 'הִ{1}ְ{2}ַ{3}ְתָ', '2fs': 'הִ{1}ְ{2}ַ{3}ְתְ',
      '3ms': 'הִ{1}ְ{2}ִי{3}', '3fs': 'הִ{1}ְ{2}ִי{3}ָה', '1p': 'הִ{1}ְ{2}ַ{3}ְנוּ',
      '2mp': 'הִ{1}ְ{2}ַ{3}ְתֶם', '2fp': 'הִ{1}ְ{2}ַ{3}ְתֶן', '3p': 'הִ{1}ְ{2}ִי{3}וּ'
    },
    present: {
      ms: 'מַ{1}ְ{2}ִי{3}', fs: 'מַ{1}ְ{2}ִי{3}ָה',
      mp: 'מַ{1}ְ{2}ִי{3}ִים', fp: 'מַ{1}ְ{2}ִי{3}וֹת'
    },
    future: {
      '1s': 'אַ{1}ְ{2}ִי{3}', '2ms': 'תַ{1}ְ{2}ִי{3}', '2fs': 'תַ{1}ְ{2}ִי{3}ִי',
      '3ms': 'יַ{1}ְ{2}ִי{3}', '3fs': 'תַ{1}ְ{2}ִי{3}', '1p': 'נַ{1}ְ{2}ִי{3}',
      '2mp': 'תַ{1}ְ{2}ִי{3}וּ', '2fp': 'תַ{1}ְ{2}ֵ{3}ְנָה',
      '3mp': 'יַ{1}ְ{2}ִי{3}וּ', '3fp': 'תַ{1}ְ{2}ֵ{3}ְנָה'
    },
    imperative: {
      ms: 'הַ{1}ְ{2}ֵ{3}', fs: 'הַ{1}ְ{2}ִי{3}ִי',
      mp: 'הַ{1}ְ{2}ִי{3}וּ', fp: 'הַ{1}ְ{2}ֵ{3}ְנָה'
    },
    infinitive: 'לְהַ{1}ְ{2}ִי{3}'
  };

  REGULAR.hufal = {
    past: {
      '1s': 'הָ{1}ְ{2}ַ{3}ְתִי', '2ms': 'הָ{1}ְ{2}ַ{3}ְתָ', '2fs': 'הָ{1}ְ{2}ַ{3}ְתְ',
      '3ms': 'הָ{1}ְ{2}ַ{3}', '3fs': 'הָ{1}ְ{2}ְ{3}ָה', '1p': 'הָ{1}ְ{2}ַ{3}ְנוּ',
      '2mp': 'הָ{1}ְ{2}ַ{3}ְתֶם', '2fp': 'הָ{1}ְ{2}ַ{3}ְתֶן', '3p': 'הָ{1}ְ{2}ְ{3}וּ'
    },
    present: {
      ms: 'מָ{1}ְ{2}ָ{3}', fs: 'מָ{1}ְ{2}ֶ{3}ֶת',
      mp: 'מָ{1}ְ{2}ָ{3}ִים', fp: 'מָ{1}ְ{2}ָ{3}וֹת'
    },
    future: {
      '1s': 'אָ{1}ְ{2}ַ{3}', '2ms': 'תָ{1}ְ{2}ַ{3}', '2fs': 'תָ{1}ְ{2}ְ{3}ִי',
      '3ms': 'יָ{1}ְ{2}ַ{3}', '3fs': 'תָ{1}ְ{2}ַ{3}', '1p': 'נָ{1}ְ{2}ַ{3}',
      '2mp': 'תָ{1}ְ{2}ְ{3}וּ', '2fp': 'תָ{1}ְ{2}ַ{3}ְנָה',
      '3mp': 'יָ{1}ְ{2}ְ{3}וּ', '3fp': 'תָ{1}ְ{2}ַ{3}ְנָה'
    },
    imperative: null,
    infinitive: null
  };

  REGULAR.hitpael = {
    past: {
      '1s': 'הִתְ{1}ַ{2}ֵּ{3}ְתִי', '2ms': 'הִתְ{1}ַ{2}ֵּ{3}ְתָ', '2fs': 'הִתְ{1}ַ{2}ֵּ{3}ְתְ',
      '3ms': 'הִתְ{1}ַ{2}ֵּ{3}', '3fs': 'הִתְ{1}ַ{2}ְּ{3}ָה', '1p': 'הִתְ{1}ַ{2}ֵּ{3}ְנוּ',
      '2mp': 'הִתְ{1}ַ{2}ֵּ{3}ְתֶם', '2fp': 'הִתְ{1}ַ{2}ֵּ{3}ְתֶן', '3p': 'הִתְ{1}ַ{2}ְּ{3}וּ'
    },
    present: {
      ms: 'מִתְ{1}ַ{2}ֵּ{3}', fs: 'מִתְ{1}ַ{2}ֶּ{3}ֶת',
      mp: 'מִתְ{1}ַ{2}ְּ{3}ִים', fp: 'מִתְ{1}ַ{2}ְּ{3}וֹת'
    },
    future: {
      '1s': 'אֶתְ{1}ַ{2}ֵּ{3}', '2ms': 'תִתְ{1}ַ{2}ֵּ{3}', '2fs': 'תִתְ{1}ַ{2}ְּ{3}ִי',
      '3ms': 'יִתְ{1}ַ{2}ֵּ{3}', '3fs': 'תִתְ{1}ַ{2}ֵּ{3}', '1p': 'נִתְ{1}ַ{2}ֵּ{3}',
      '2mp': 'תִתְ{1}ַ{2}ְּ{3}וּ', '2fp': 'תִתְ{1}ַ{2}ֵּ{3}ְנָה',
      '3mp': 'יִתְ{1}ַ{2}ְּ{3}וּ', '3fp': 'תִתְ{1}ַ{2}ֵּ{3}ְנָה'
    },
    imperative: {
      ms: 'הִתְ{1}ַ{2}ֵּ{3}', fs: 'הִתְ{1}ַ{2}ְּ{3}ִי',
      mp: 'הִתְ{1}ַ{2}ְּ{3}וּ', fp: 'הִתְ{1}ַ{2}ֵּ{3}ְנָה'
    },
    infinitive: 'לְהִתְ{1}ַ{2}ֵּ{3}'
  };

  REGULAR.poel = {
    past: {
      '1s': '{1}וֹ{2}ַ{3}ְתִי', '2ms': '{1}וֹ{2}ַ{3}ְתָ', '2fs': '{1}וֹ{2}ַ{3}ְתְ',
      '3ms': '{1}וֹ{2}ֵ{3}', '3fs': '{1}וֹ{2}ְ{3}ָה', '1p': '{1}וֹ{2}ַ{3}ְנוּ',
      '2mp': '{1}וֹ{2}ַ{3}ְתֶם', '2fp': '{1}וֹ{2}ַ{3}ְתֶן', '3p': '{1}וֹ{2}ְ{3}וּ'
    },
    present: {
      ms: 'מְ{1}וֹ{2}ֵ{3}', fs: 'מְ{1}וֹ{2}ֶ{3}ֶת',
      mp: 'מְ{1}וֹ{2}ְ{3}ִים', fp: 'מְ{1}וֹ{2}ְ{3}וֹת'
    },
    future: {
      '1s': 'אֲ{1}וֹ{2}ֵ{3}', '2ms': 'תְ{1}וֹ{2}ֵ{3}', '2fs': 'תְ{1}וֹ{2}ְ{3}ִי',
      '3ms': 'יְ{1}וֹ{2}ֵ{3}', '3fs': 'תְ{1}וֹ{2}ֵ{3}', '1p': 'נְ{1}וֹ{2}ֵ{3}',
      '2mp': 'תְ{1}וֹ{2}ְ{3}וּ', '2fp': 'תְ{1}וֹ{2}ֵ{3}ְנָה',
      '3mp': 'יְ{1}וֹ{2}ְ{3}וּ', '3fp': 'תְ{1}וֹ{2}ֵ{3}ְנָה'
    },
    imperative: {
      ms: '{1}וֹ{2}ֵ{3}', fs: '{1}וֹ{2}ְ{3}ִי',
      mp: '{1}וֹ{2}ְ{3}וּ', fp: '{1}וֹ{2}ֵ{3}ְנָה'
    },
    infinitive: 'לְ{1}וֹ{2}ֵ{3}'
  };

  // Four-letter roots: Piel and Hitpael only (the productive patterns).
  var FOUR_LETTER = {
    piel: {
      past: {
        '1s': '{1}ִ{2}ְ{3}ַ{4}ְתִי', '2ms': '{1}ִ{2}ְ{3}ַ{4}ְתָ', '2fs': '{1}ִ{2}ְ{3}ַ{4}ְתְ',
        '3ms': '{1}ִ{2}ְ{3}ֵ{4}', '3fs': '{1}ִ{2}ְ{3}ְ{4}ָה', '1p': '{1}ִ{2}ְ{3}ַ{4}ְנוּ',
        '2mp': '{1}ִ{2}ְ{3}ַ{4}ְתֶם', '2fp': '{1}ִ{2}ְ{3}ַ{4}ְתֶן', '3p': '{1}ִ{2}ְ{3}ְ{4}וּ'
      },
      present: {
        ms: 'מְ{1}ַ{2}ְ{3}ֵ{4}', fs: 'מְ{1}ַ{2}ְ{3}ֶ{4}ֶת',
        mp: 'מְ{1}ַ{2}ְ{3}ְ{4}ִים', fp: 'מְ{1}ַ{2}ְ{3}ְ{4}וֹת'
      },
      future: {
        '1s': 'אֲ{1}ַ{2}ְ{3}ֵ{4}', '2ms': 'תְ{1}ַ{2}ְ{3}ֵ{4}', '2fs': 'תְ{1}ַ{2}ְ{3}ְ{4}ִי',
        '3ms': 'יְ{1}ַ{2}ְ{3}ֵ{4}', '3fs': 'תְ{1}ַ{2}ְ{3}ֵ{4}', '1p': 'נְ{1}ַ{2}ְ{3}ֵ{4}',
        '2mp': 'תְ{1}ַ{2}ְ{3}ְ{4}וּ', '2fp': 'תְ{1}ַ{2}ְ{3}ֵ{4}ְנָה',
        '3mp': 'יְ{1}ַ{2}ְ{3}ְ{4}וּ', '3fp': 'תְ{1}ַ{2}ְ{3}ֵ{4}ְנָה'
      },
      imperative: {
        ms: '{1}ַ{2}ְ{3}ֵ{4}', fs: '{1}ַ{2}ְ{3}ְ{4}ִי',
        mp: '{1}ַ{2}ְ{3}ְ{4}וּ', fp: '{1}ַ{2}ְ{3}ֵ{4}ְנָה'
      },
      infinitive: 'לְ{1}ַ{2}ְ{3}ֵ{4}'
    },
    hitpael: {
      past: {
        '1s': 'הִתְ{1}ַ{2}ְ{3}ֵ{4}ְתִי', '2ms': 'הִתְ{1}ַ{2}ְ{3}ֵ{4}ְתָ', '2fs': 'הִתְ{1}ַ{2}ְ{3}ֵ{4}ְתְ',
        '3ms': 'הִתְ{1}ַ{2}ְ{3}ֵ{4}', '3fs': 'הִתְ{1}ַ{2}ְ{3}ְ{4}ָה', '1p': 'הִתְ{1}ַ{2}ְ{3}ֵ{4}ְנוּ',
        '2mp': 'הִתְ{1}ַ{2}ְ{3}ֵ{4}ְתֶם', '2fp': 'הִתְ{1}ַ{2}ְ{3}ֵ{4}ְתֶן', '3p': 'הִתְ{1}ַ{2}ְ{3}ְ{4}וּ'
      },
      present: {
        ms: 'מִתְ{1}ַ{2}ְ{3}ֵ{4}', fs: 'מִתְ{1}ַ{2}ְ{3}ֶ{4}ֶת',
        mp: 'מִתְ{1}ַ{2}ְ{3}ְ{4}ִים', fp: 'מִתְ{1}ַ{2}ְ{3}ְ{4}וֹת'
      },
      future: {
        '1s': 'אֶתְ{1}ַ{2}ְ{3}ֵ{4}', '2ms': 'תִתְ{1}ַ{2}ְ{3}ֵ{4}', '2fs': 'תִתְ{1}ַ{2}ְ{3}ְ{4}ִי',
        '3ms': 'יִתְ{1}ַ{2}ְ{3}ֵ{4}', '3fs': 'תִתְ{1}ַ{2}ְ{3}ֵ{4}', '1p': 'נִתְ{1}ַ{2}ְ{3}ֵ{4}',
        '2mp': 'תִתְ{1}ַ{2}ְ{3}ְ{4}וּ', '2fp': 'תִתְ{1}ַ{2}ְ{3}ֵ{4}ְנָה',
        '3mp': 'יִתְ{1}ַ{2}ְ{3}ְ{4}וּ', '3fp': 'תִתְ{1}ַ{2}ְ{3}ֵ{4}ְנָה'
      },
      imperative: {
        ms: 'הִתְ{1}ַ{2}ְ{3}ֵ{4}', fs: 'הִתְ{1}ַ{2}ְ{3}ְ{4}ִי',
        mp: 'הִתְ{1}ַ{2}ְ{3}ְ{4}וּ', fp: 'הִתְ{1}ַ{2}ְ{3}ֵ{4}ְנָה'
      },
      infinitive: 'לְהִתְ{1}ַ{2}ְ{3}ֵ{4}'
    }
  };

  // Irregular root-class overrides: class -> binyan -> tense -> person.
  // Only the combinations below are covered; anything else is reported
  // as not covered rather than guessed from the regular templates.
  var IRREGULAR = {};

  // III-he (ל"ה), e.g. גלה. R3 ה drops and is replaced by י/ת/ו.
  IRREGULAR['iii-he'] = {
    paal: {
      past: {
        '1s': '{1}ָ{2}ִיתִי', '2ms': '{1}ָ{2}ִיתָ', '2fs': '{1}ָ{2}ִית',
        '3ms': '{1}ָ{2}ָה', '3fs': '{1}ָ{2}ְתָה', '1p': '{1}ָ{2}ִינוּ',
        '2mp': '{1}ָ{2}ִיתֶם', '2fp': '{1}ָ{2}ִיתֶן', '3p': '{1}ָ{2}וּ'
      },
      present: {
        ms: '{1}וֹ{2}ֶה', fs: '{1}וֹ{2}ָה',
        mp: '{1}וֹ{2}ִים', fp: '{1}וֹ{2}וֹת'
      },
      future: {
        '1s': 'אֶ{1}ְ{2}ֶה', '2ms': 'תִ{1}ְ{2}ֶה', '2fs': 'תִ{1}ְ{2}ִי',
        '3ms': 'יִ{1}ְ{2}ֶה', '3fs': 'תִ{1}ְ{2}ֶה', '1p': 'נִ{1}ְ{2}ֶה',
        '2mp': 'תִ{1}ְ{2}וּ', '2fp': 'תִ{1}ְ{2}ֶינָה',
        '3mp': 'יִ{1}ְ{2}וּ', '3fp': 'תִ{1}ְ{2}ֶינָה'
      },
      imperative: {
        ms: '{1}ְ{2}ֵה', fs: '{1}ְ{2}ִי',
        mp: '{1}ְ{2}וּ', fp: '{1}ְ{2}ֶינָה'
      },
      infinitive: 'לִ{1}ְ{2}וֹת'
    },
    piel: {
      past: {
        '1s': '{1}ִ{2}ִּיתִי', '2ms': '{1}ִ{2}ִּיתָ', '2fs': '{1}ִ{2}ִּית',
        '3ms': '{1}ִ{2}ָּה', '3fs': '{1}ִ{2}ְּתָה', '1p': '{1}ִ{2}ִּינוּ',
        '2mp': '{1}ִ{2}ִּיתֶם', '2fp': '{1}ִ{2}ִּיתֶן', '3p': '{1}ִ{2}ּוּ'
      },
      present: {
        ms: 'מְ{1}ַ{2}ֶּה', fs: 'מְ{1}ַ{2}ָּה',
        mp: 'מְ{1}ַ{2}ִּים', fp: 'מְ{1}ַ{2}ּוֹת'
      },
      future: {
        '1s': 'אֲ{1}ַ{2}ֶּה', '2ms': 'תְ{1}ַ{2}ֶּה', '2fs': 'תְ{1}ַ{2}ִּי',
        '3ms': 'יְ{1}ַ{2}ֶּה', '3fs': 'תְ{1}ַ{2}ֶּה', '1p': 'נְ{1}ַ{2}ֶּה',
        '2mp': 'תְ{1}ַ{2}ּוּ', '2fp': 'תְ{1}ַ{2}ֶּינָה',
        '3mp': 'יְ{1}ַ{2}ּוּ', '3fp': 'תְ{1}ַ{2}ֶּינָה'
      },
      imperative: {
        ms: '{1}ַ{2}ֵּה', fs: '{1}ַ{2}ִּי',
        mp: '{1}ַ{2}ּוּ', fp: '{1}ַ{2}ֶּינָה'
      },
      infinitive: 'לְ{1}ַ{2}ּוֹת'
    },
    hifil: {
      past: {
        '1s': 'הִ{1}ְ{2}ֵיתִי', '2ms': 'הִ{1}ְ{2}ֵיתָ', '2fs': 'הִ{1}ְ{2}ֵית',
        '3ms': 'הִ{1}ְ{2}ָה', '3fs': 'הִ{1}ְ{2}ְתָה', '1p': 'הִ{1}ְ{2}ֵינוּ',
        '2mp': 'הִ{1}ְ{2}ֵיתֶם', '2fp': 'הִ{1}ְ{2}ֵיתֶן', '3p': 'הִ{1}ְ{2}וּ'
      },
      present: {
        ms: 'מַ{1}ְ{2}ֶה', fs: 'מַ{1}ְ{2}ָה',
        mp: 'מַ{1}ְ{2}ִים', fp: 'מַ{1}ְ{2}וֹת'
      },
      future: {
        '1s': 'אַ{1}ְ{2}ֶה', '2ms': 'תַ{1}ְ{2}ֶה', '2fs': 'תַ{1}ְ{2}ִי',
        '3ms': 'יַ{1}ְ{2}ֶה', '3fs': 'תַ{1}ְ{2}ֶה', '1p': 'נַ{1}ְ{2}ֶה',
        '2mp': 'תַ{1}ְ{2}וּ', '2fp': 'תַ{1}ְ{2}ֶינָה',
        '3mp': 'יַ{1}ְ{2}וּ', '3fp': 'תַ{1}ְ{2}ֶינָה'
      },
      imperative: {
        ms: 'הַ{1}ְ{2}ֵה', fs: 'הַ{1}ְ{2}ִי',
        mp: 'הַ{1}ְ{2}וּ', fp: 'הַ{1}ְ{2}ֶינָה'
      },
      infinitive: 'לְהַ{1}ְ{2}וֹת'
    },
    hitpael: {
      past: {
        '1s': 'הִתְ{1}ַ{2}ֵּיתִי', '2ms': 'הִתְ{1}ַ{2}ֵּיתָ', '2fs': 'הִתְ{1}ַ{2}ֵּית',
        '3ms': 'הִתְ{1}ַ{2}ָּה', '3fs': 'הִתְ{1}ַ{2}ְּתָה', '1p': 'הִתְ{1}ַ{2}ֵּינוּ',
        '2mp': 'הִתְ{1}ַ{2}ֵּיתֶם', '2fp': 'הִתְ{1}ַ{2}ֵּיתֶן', '3p': 'הִתְ{1}ַ{2}ּוּ'
      },
      present: {
        ms: 'מִתְ{1}ַ{2}ֶּה', fs: 'מִתְ{1}ַ{2}ָּה',
        mp: 'מִתְ{1}ַ{2}ִּים', fp: 'מִתְ{1}ַ{2}ּוֹת'
      },
      future: {
        '1s': 'אֶתְ{1}ַ{2}ֶּה', '2ms': 'תִתְ{1}ַ{2}ֶּה', '2fs': 'תִתְ{1}ַ{2}ִּי',
        '3ms': 'יִתְ{1}ַ{2}ֶּה', '3fs': 'תִתְ{1}ַ{2}ֶּה', '1p': 'נִתְ{1}ַ{2}ֶּה',
        '2mp': 'תִתְ{1}ַ{2}ּוּ', '2fp': 'תִתְ{1}ַ{2}ֶּינָה',
        '3mp': 'יִתְ{1}ַ{2}ּוּ', '3fp': 'תִתְ{1}ַ{2}ֶּינָה'
      },
      imperative: {
        ms: 'הִתְ{1}ַ{2}ֵּה', fs: 'הִתְ{1}ַ{2}ִּי',
        mp: 'הִתְ{1}ַ{2}ּוּ', fp: 'הִתְ{1}ַ{2}ֶּינָה'
      },
      infinitive: 'לְהִתְ{1}ַ{2}ּוֹת'
    }
  };

  // Hollow roots (ע"ו / ע"י), e.g. קם, שם. R2 drops; the vowel lengthens.
  // II-vav future uses u (יָקוּם); II-yod future uses i (יָשִׂים).
  function hollowPaal(vav) {
    var fv = vav ? 'וּ' : 'ִי';
    var fp = vav ? 'וּ' : 'ִי';
    return {
      past: {
        '1s': '{1}ַ{3}ְתִי', '2ms': '{1}ַ{3}ְתָ', '2fs': '{1}ַ{3}ְתְ',
        '3ms': '{1}ָ{3}', '3fs': '{1}ָ{3}ָה', '1p': '{1}ַ{3}ְנוּ',
        '2mp': '{1}ַ{3}ְתֶם', '2fp': '{1}ַ{3}ְתֶן', '3p': '{1}ָ{3}וּ'
      },
      present: {
        ms: '{1}ָ{3}', fs: '{1}ָ{3}ָה',
        mp: '{1}ָ{3}ִים', fp: '{1}ָ{3}וֹת'
      },
      future: {
        '1s': 'אָ{1}' + fv + '{3}', '2ms': 'תָ{1}' + fv + '{3}', '2fs': 'תָ{1}' + fp + '{3}ִי',
        '3ms': 'יָ{1}' + fv + '{3}', '3fs': 'תָ{1}' + fv + '{3}', '1p': 'נָ{1}' + fv + '{3}',
        '2mp': 'תָ{1}' + fv + '{3}וּ', '2fp': 'תָ{1}ֹ{3}ְנָה',
        '3mp': 'יָ{1}' + fv + '{3}וּ', '3fp': 'תָ{1}ֹ{3}ְנָה'
      },
      imperative: {
        ms: '{1}' + fv + '{3}', fs: '{1}' + fv + '{3}ִי',
        mp: '{1}' + fv + '{3}וּ', fp: '{1}ֹ{3}ְנָה'
      },
      infinitive: 'לָ{1}' + fv + '{3}'
    };
  }
  IRREGULAR['hollow-vav'] = {
    paal: hollowPaal(true),
    hifil: {
      past: {
        '1s': 'הֲ{1}ִי{3}וֹתִי', '2ms': 'הֲ{1}ִי{3}וֹתָ', '2fs': 'הֲ{1}ִי{3}וֹת',
        '3ms': 'הֵ{1}ִי{3}', '3fs': 'הֵ{1}ִי{3}ָה', '1p': 'הֲ{1}ִי{3}וֹנוּ',
        '2mp': 'הֲ{1}ִי{3}וֹתֶם', '2fp': 'הֲ{1}ִי{3}וֹתֶן', '3p': 'הֵ{1}ִי{3}וּ'
      },
      present: {
        ms: 'מֵ{1}ִי{3}', fs: 'מְ{1}ִי{3}ָה',
        mp: 'מְ{1}ִי{3}ִים', fp: 'מְ{1}ִי{3}וֹת'
      },
      future: {
        '1s': 'אָ{1}ִי{3}', '2ms': 'תָ{1}ִי{3}', '2fs': 'תָ{1}ִי{3}ִי',
        '3ms': 'יָ{1}ִי{3}', '3fs': 'תָ{1}ִי{3}', '1p': 'נָ{1}ִי{3}',
        '2mp': 'תָ{1}ִי{3}וּ', '2fp': 'תָ{1}ֵ{3}ְנָה',
        '3mp': 'יָ{1}ִי{3}וּ', '3fp': 'תָ{1}ֵ{3}ְנָה'
      },
      imperative: {
        ms: 'הָ{1}ֵ{3}', fs: 'הָ{1}ִי{3}ִי',
        mp: 'הָ{1}ִי{3}וּ', fp: 'הָ{1}ֵ{3}ְנָה'
      },
      infinitive: 'לְהָ{1}ִי{3}'
    }
  };
  IRREGULAR['hollow-yod'] = { paal: hollowPaal(false) };

  // Geminate roots (ע"ע), e.g. סבב. The doubled letter takes dagesh hazak.
  IRREGULAR.geminate = {
    paal: {
      past: {
        '1s': '{1}ַ{2}ּוֹתִי', '2ms': '{1}ַ{2}ּוֹתָ', '2fs': '{1}ַ{2}ּוֹת',
        '3ms': '{1}ַ{2}ּ', '3fs': '{1}ַ{2}ָּה', '1p': '{1}ַ{2}ּוֹנוּ',
        '2mp': '{1}ַ{2}ּוֹתֶם', '2fp': '{1}ַ{2}ּוֹתֶן', '3p': '{1}ַ{2}ּוּ'
      },
      present: {
        ms: '{1}ָ{2}', fs: '{1}ַ{2}ָּה',
        mp: '{1}ַ{2}ִּים', fp: '{1}ַ{2}ּוֹת'
      },
      future: {
        '1s': 'אָ{1}ֹ{2}', '2ms': 'תָ{1}ֹ{2}', '2fs': 'תָ{1}ֹ{2}ִי',
        '3ms': 'יָ{1}ֹ{2}', '3fs': 'תָ{1}ֹ{2}', '1p': 'נָ{1}ֹ{2}',
        '2mp': 'תָ{1}ֹ{2}ּוּ', '2fp': 'תָ{1}ֹ{2}ְנָה',
        '3mp': 'יָ{1}ֹ{2}ּוּ', '3fp': 'תָ{1}ֹ{2}ְנָה'
      },
      imperative: {
        ms: '{1}ֹ{2}', fs: '{1}ֹ{2}ִי',
        mp: '{1}ֹ{2}ּוּ', fp: '{1}ֹ{2}ְנָה'
      },
      infinitive: 'לָ{1}ֹ{2}'
    },
    piel: {
      past: {
        '1s': '{1}וֹ{2}ַ{2}ְתִי', '2ms': '{1}וֹ{2}ַ{2}ְתָ', '2fs': '{1}וֹ{2}ַ{2}ְתְ',
        '3ms': '{1}וֹ{2}ֵ{2}', '3fs': '{1}וֹ{2}ְ{2}ָה', '1p': '{1}וֹ{2}ַ{2}ְנוּ',
        '2mp': '{1}וֹ{2}ַ{2}ְתֶם', '2fp': '{1}וֹ{2}ַ{2}ְתֶן', '3p': '{1}וֹ{2}ְ{2}וּ'
      },
      present: {
        ms: 'מְ{1}וֹ{2}ֵ{2}', fs: 'מְ{1}וֹ{2}ֶ{2}ֶת',
        mp: 'מְ{1}וֹ{2}ְ{2}ִים', fp: 'מְ{1}וֹ{2}ְ{2}וֹת'
      },
      future: {
        '1s': 'אֲ{1}וֹ{2}ֵ{2}', '2ms': 'תְ{1}וֹ{2}ֵ{2}', '2fs': 'תְ{1}וֹ{2}ְ{2}ִי',
        '3ms': 'יְ{1}וֹ{2}ֵ{2}', '3fs': 'תְ{1}וֹ{2}ֵ{2}', '1p': 'נְ{1}וֹ{2}ֵ{2}',
        '2mp': 'תְ{1}וֹ{2}ְ{2}וּ', '2fp': 'תְ{1}וֹ{2}ֵ{2}ְנָה',
        '3mp': 'יְ{1}וֹ{2}ְ{2}וּ', '3fp': 'תְ{1}וֹ{2}ֵ{2}ְנָה'
      },
      imperative: {
        ms: '{1}וֹ{2}ֵ{2}', fs: '{1}וֹ{2}ְ{2}ִי',
        mp: '{1}וֹ{2}ְ{2}וּ', fp: '{1}וֹ{2}ֵ{2}ְנָה'
      },
      infinitive: 'לְ{1}וֹ{2}ֵ{2}'
    }
  };

  // I-nun (פ"נ), e.g. נפל. The nun assimilates (dagesh in R2) outside
  // the past and present, which are regular.
  IRREGULAR['i-nun'] = {
    paal: {
      past: REGULAR.paal.past,
      present: REGULAR.paal.present,
      future: {
        '1s': 'אֶ{2}ֹּ{3}', '2ms': 'תִ{2}ֹּ{3}', '2fs': 'תִ{2}ְּ{3}ִי',
        '3ms': 'יִ{2}ֹּ{3}', '3fs': 'תִ{2}ֹּ{3}', '1p': 'נִ{2}ֹּ{3}',
        '2mp': 'תִ{2}ְּ{3}וּ', '2fp': 'תִ{2}ֹּ{3}ְנָה',
        '3mp': 'יִ{2}ְּ{3}וּ', '3fp': 'תִ{2}ֹּ{3}ְנָה'
      },
      imperative: {
        ms: '{2}ֹּ{3}', fs: '{2}ְּ{3}ִי',
        mp: '{2}ְּ{3}וּ', fp: '{2}ֹּ{3}ְנָה'
      },
      infinitive: 'לִ{2}ֹּ{3}'
    },
    hifil: {
      past: {
        '1s': 'הִ{2}ַּ{3}ְתִי', '2ms': 'הִ{2}ַּ{3}ְתָ', '2fs': 'הִ{2}ַּ{3}ְתְ',
        '3ms': 'הִ{2}ִּי{3}', '3fs': 'הִ{2}ִּי{3}ָה', '1p': 'הִ{2}ַּ{3}ְנוּ',
        '2mp': 'הִ{2}ַּ{3}ְתֶם', '2fp': 'הִ{2}ַּ{3}ְתֶן', '3p': 'הִ{2}ִּי{3}וּ'
      },
      present: {
        ms: 'מַ{2}ִּי{3}', fs: 'מַ{2}ִּי{3}ָה',
        mp: 'מַ{2}ִּי{3}ִים', fp: 'מַ{2}ִּי{3}וֹת'
      },
      future: {
        '1s': 'אַ{2}ִּי{3}', '2ms': 'תַ{2}ִּי{3}', '2fs': 'תַ{2}ִּי{3}ִי',
        '3ms': 'יַ{2}ִּי{3}', '3fs': 'תַ{2}ִּי{3}', '1p': 'נַ{2}ִּי{3}',
        '2mp': 'תַ{2}ִּי{3}וּ', '2fp': 'תַ{2}ֵּ{3}ְנָה',
        '3mp': 'יַ{2}ִּי{3}וּ', '3fp': 'תַ{2}ֵּ{3}ְנָה'
      },
      imperative: {
        ms: 'הַ{2}ֵּ{3}', fs: 'הַ{2}ִּי{3}ִי',
        mp: 'הַ{2}ִּי{3}וּ', fp: 'הַ{2}ֵּ{3}ְנָה'
      },
      infinitive: 'לְהַ{2}ִּי{3}'
    }
  };

  // I-yod (פ"י), e.g. ישב. The yod becomes vav in the future/imperative.
  IRREGULAR['i-yod'] = {
    paal: {
      past: REGULAR.paal.past,
      present: REGULAR.paal.present,
      future: {
        '1s': 'אֵ{2}ֵ{3}', '2ms': 'תֵ{2}ֵ{3}', '2fs': 'תֵ{2}ְ{3}ִי',
        '3ms': 'יֵ{2}ֵ{3}', '3fs': 'תֵ{2}ֵ{3}', '1p': 'נֵ{2}ֵ{3}',
        '2mp': 'תֵ{2}ְ{3}וּ', '2fp': 'תֵ{2}ֵ{3}ְנָה',
        '3mp': 'יֵ{2}ְ{3}וּ', '3fp': 'תֵ{2}ֵ{3}ְנָה'
      },
      imperative: {
        ms: '{2}ֵ{3}', fs: '{2}ְ{3}ִי',
        mp: '{2}ְ{3}וּ', fp: '{2}ֵ{3}ְנָה'
      },
      infinitive: 'לָ{2}ֶ{3}ת'
    },
    hifil: {
      past: {
        '1s': 'הוֹ{2}ַ{3}ְתִי', '2ms': 'הוֹ{2}ַ{3}ְתָ', '2fs': 'הוֹ{2}ַ{3}ְתְ',
        '3ms': 'הוֹ{2}ִי{3}', '3fs': 'הוֹ{2}ִי{3}ָה', '1p': 'הוֹ{2}ַ{3}ְנוּ',
        '2mp': 'הוֹ{2}ַ{3}ְתֶם', '2fp': 'הוֹ{2}ַ{3}ְתֶן', '3p': 'הוֹ{2}ִי{3}וּ'
      },
      present: {
        ms: 'מוֹ{2}ִי{3}', fs: 'מוֹ{2}ִי{3}ָה',
        mp: 'מוֹ{2}ִי{3}ִים', fp: 'מוֹ{2}ִי{3}וֹת'
      },
      future: {
        '1s': 'אוֹ{2}ִי{3}', '2ms': 'תוֹ{2}ִי{3}', '2fs': 'תוֹ{2}ִי{3}ִי',
        '3ms': 'יוֹ{2}ִי{3}', '3fs': 'תוֹ{2}ִי{3}', '1p': 'נוֹ{2}ִי{3}',
        '2mp': 'תוֹ{2}ִי{3}וּ', '2fp': 'תוֹ{2}ֵ{3}ְנָה',
        '3mp': 'יוֹ{2}ִי{3}וּ', '3fp': 'תוֹ{2}ֵ{3}ְנָה'
      },
      imperative: {
        ms: 'הוֹ{2}ֵ{3}', fs: 'הוֹ{2}ִי{3}ִי',
        mp: 'הוֹ{2}ִי{3}וּ', fp: 'הוֹ{2}ֵ{3}ְנָה'
      },
      infinitive: 'לְהוֹ{2}ִי{3}'
    }
  };

  // III-aleph (ל"א), e.g. קרא. The aleph is quiescent; vowels lengthen.
  IRREGULAR['iii-aleph'] = {
    paal: {
      past: {
        '1s': '{1}ָ{2}ָאתִי', '2ms': '{1}ָ{2}ָאתָ', '2fs': '{1}ָ{2}ָאתְ',
        '3ms': '{1}ָ{2}ָא', '3fs': '{1}ָ{2}ְאָה', '1p': '{1}ָ{2}ָאנוּ',
        '2mp': '{1}ָ{2}ָאתֶם', '2fp': '{1}ָ{2}ָאתֶן', '3p': '{1}ָ{2}ְאוּ'
      },
      present: {
        ms: '{1}וֹ{2}ֵא', fs: '{1}וֹ{2}ְאָה',
        mp: '{1}וֹ{2}ְאִים', fp: '{1}וֹ{2}ְאוֹת'
      },
      future: {
        '1s': 'אֶ{1}ְ{2}ָא', '2ms': 'תִ{1}ְ{2}ָא', '2fs': 'תִ{1}ְ{2}ְאִי',
        '3ms': 'יִ{1}ְ{2}ָא', '3fs': 'תִ{1}ְ{2}ָא', '1p': 'נִ{1}ְ{2}ָא',
        '2mp': 'תִ{1}ְ{2}ְאוּ', '2fp': 'תִ{1}ְ{2}ָאנָה',
        '3mp': 'יִ{1}ְ{2}ְאוּ', '3fp': 'תִ{1}ְ{2}ָאנָה'
      },
      imperative: {
        ms: '{1}ְ{2}ָא', fs: '{1}ְ{2}ְאִי',
        mp: '{1}ְ{2}ְאוּ', fp: '{1}ְ{2}ָאנָה'
      },
      infinitive: 'לִ{1}ְ{2}ֹא'
    }
  };

  // I-aleph (פ"א), e.g. אמר. The aleph is quiescent in the future.
  IRREGULAR['i-aleph'] = {
    paal: {
      past: REGULAR.paal.past,
      present: REGULAR.paal.present,
      future: {
        '1s': 'אֹ{1}{2}ַ{3}', '2ms': 'תֹ{1}{2}ַ{3}', '2fs': 'תֹ{1}{2}ְ{3}ִי',
        '3ms': 'יֹ{1}{2}ַ{3}', '3fs': 'תֹ{1}{2}ַ{3}', '1p': 'נֹ{1}{2}ַ{3}',
        '2mp': 'תֹ{1}{2}ְ{3}וּ', '2fp': 'תֹ{1}{2}ַ{3}ְנָה',
        '3mp': 'יֹ{1}{2}ְ{3}וּ', '3fp': 'תֹ{1}{2}ַ{3}ְנָה'
      },
      imperative: {
        ms: 'אֱ{2}ֹ{3}', fs: 'אִ{2}ְ{3}ִי',
        mp: 'אִ{2}ְ{3}וּ', fp: 'אֱ{2}ֹ{3}ְנָה'
      },
      infinitive: 'לֵ{1}{2}ֹ{3}'
    }
  };

  // Guttural R2 (א/ה/ח/ע/ר) cannot take dagesh hazak: remove it and
  // lengthen the preceding short vowel (compensation). Applies to the
  // Piel/Pual/Hitpael/Hufal templates. The vowel before R2 sits on R1
  // (or on the prefix for Hitpael): hirik->tzere, patach->kamatz,
  // kubutz->holam.
  function compensateGutturalR2(form, root, binyan) {
    if (root.length !== 3) return form;
    var r2 = root[1];
    if (!isGuttural(r2) && r2 !== 'ר') return form;
    if (['piel', 'pual', 'hitpael', 'hufal'].indexOf(binyan) === -1) return form;
    if (form.indexOf(DAGESH) === -1) return form;
    var out = form.replace(DAGESH, '');
    // Lengthen the vowel immediately before R2.
    var idx = out.indexOf(r2);
    if (idx > 0) {
      var before = out[idx - 1];
      var repl = { 'ִ': 'ֵ', 'ַ': 'ָ', 'ֻ': 'ֹ' }[before];
      if (repl) out = out.slice(0, idx - 1) + repl + out.slice(idx);
    }
    return out;
  }

  // Hitpael metathesis: when R1 is a sibilant (ז/ס/ש), the ת of the
  // prefix swaps with it (הסתדר, הזדמן, השתמר); when R1 is צ, the ת
  // becomes ט and swaps (הצטלם). The swap replaces תְ+R1 with R1ְ+ת
  // (or צְט), so the original R1 is not duplicated.
  function hitpaelMetathesis(form, root) {
    if (root.length !== 3) return form;
    var r1 = root[0];
    if (SIBILANTS.indexOf(r1) === -1 && r1 !== 'צ') return form;
    var rep = r1 === 'צ' ? 'צְט' : r1 + 'ְת';
    var re = new RegExp('^((?:לְהִ|הִ|מִ|[איתנ][ִֶ]))תְ' + r1);
    return form.replace(re, '$1' + rep);
  }

  // Which binyanim each root class covers. Regular covers all eight.
  var COVERAGE = {
    'regular': BINYANIM,
    'iii-he': ['paal', 'piel', 'hifil', 'hitpael'],
    'iii-aleph': ['paal'],
    'hollow-vav': ['paal', 'hifil'],
    'hollow-yod': ['paal'],
    'geminate': ['paal', 'piel'],
    'i-nun': ['paal', 'hifil'],
    'i-yod': ['paal', 'hifil'],
    'i-aleph': ['paal']
  };
  var CLASS_NAMES = {
    'regular': 'Regular', 'iii-he': 'III-he', 'iii-aleph': 'III-aleph',
    'hollow-vav': 'Hollow (II-vav)', 'hollow-yod': 'Hollow (II-yod)',
    'geminate': 'Geminate', 'i-nun': 'I-nun', 'i-yod': 'I-yod',
    'i-aleph': 'I-aleph'
  };

  // Build one tense table from a paradigm object.
  function buildTense(paradigm, root, binyan, tense) {
    var out = {};
    var persons = tense === 'past' ? PAST_PERSONS
      : tense === 'present' ? PRESENT_PERSONS
      : tense === 'future' ? FUTURE_PERSONS
      : IMPERATIVE_PERSONS;
    persons.forEach(function (person) {
      var tpl = paradigm[tense][person];
      var form = fill(tpl, root);
      form = compensateGutturalR2(form, root, binyan);
      if (binyan === 'hitpael') form = hitpaelMetathesis(form, root);
      var opts = { binyan: binyan };
      if (tense === 'future') {
        opts.futurePrefix = binyan === 'nifal' ? 'tzere'
          : binyan === 'paal' ? 'patach' : null;
      }
      form = gutturalize(form, root, opts);
      if (tense === 'future' || tense === 'imperative') form = patachGanuv(form, root);
      out[person] = finalKafShva(form);
    });
    return out;
  }

  // Conjugate a shoresh in one binyan.
  // Returns { covered, class, root, binyan, tables } or
  // { covered: false, class, root, binyan, reason }.
  function conjugate(shoreshInput, binyan) {
    var root = parseRoot(shoreshInput);
    if (!root) return { covered: false, reason: 'Enter a shoresh of 3 or 4 Hebrew letters.' };
    if (BINYANIM.indexOf(binyan) === -1) binyan = 'paal';
    var cls = rootClass(root);
    var paradigm;
    if (root.length === 4) {
      paradigm = FOUR_LETTER[binyan];
      if (!paradigm) {
        return { covered: false, class: cls, root: root, binyan: binyan,
          reason: 'Four-letter roots are covered in Piel and Hitpael only.' };
      }
    } else {
      if (COVERAGE[cls].indexOf(binyan) === -1) {
        return { covered: false, class: cls, root: root, binyan: binyan,
          reason: CLASS_NAMES[cls] + ' roots are not covered in ' + BINYAN_NAMES[binyan] + ' yet.' };
      }
      paradigm = (IRREGULAR[cls] && IRREGULAR[cls][binyan]) || REGULAR[binyan];
    }
    var tables = {};
    ['past', 'present', 'future', 'imperative'].forEach(function (tense) {
      tables[tense] = paradigm[tense] ? buildTense(paradigm, root, binyan, tense) : null;
    });
    if (paradigm.infinitive) {
      var inf = fill(paradigm.infinitive, root);
      inf = compensateGutturalR2(inf, root, binyan);
      if (binyan === 'hitpael') inf = hitpaelMetathesis(inf, root);
      inf = gutturalize(inf, root, { binyan: binyan });
      tables.infinitive = finalKafShva(patachGanuv(inf, root));
    } else {
      tables.infinitive = null;
    }
    return { covered: true, class: cls, root: root, binyan: binyan, tables: tables };
  }

  // Reverse lookup: identify an inflected form.
  // Candidate roots are derived by stripping known prefixes/suffixes,
  // then every candidate is conjugated in every covered binyan and the
  // stripped forms are matched.
  var REV_PREFIXES = ['להת', 'הת', 'לה', 'מת', 'ה', 'מ', 'א', 'י', 'ת', 'נ', 'ל'];
  var REV_SUFFIXES = ['יתם', 'יתן', 'יתי', 'ותי', 'ית', 'ינו', 'ות', 'תם', 'תן', 'תי', 'נו', 'ים', 'נה', 'תה', 'ת', 'ו', 'י', 'ה'];
  var FILLERS = ['ה', 'ו', 'י', 'א'];

  // K'tiv malei variant of a pointed form: insert ו after a holam or
  // kubutz, and י after a hirik, when the next letter is not already
  // that mater. Used only for matching user input in identify(), since
  // users type unpointed k'tiv malei (אכתוב, דיבר) while the engine
  // generates pointed k'tiv chaser (אֶכְתֹּב, דִּבֵּר).
  function ktivMalei(form) {
    var letters = [];
    var i = 0;
    while (i < form.length) {
      var ch = form[i];
      var marks = '';
      i++;
      while (i < form.length && (form[i] < 'א' || form[i] > 'ת')) {
        marks += form[i];
        i++;
      }
      letters.push({ letter: ch, marks: marks });
    }
    var out = '';
    // A hirik under a PREFIX consonant (infinitive ל, future י/ת/נ/א,
    // hifil/nifal/hitpael ה, nifal נ) never takes a י mater in k'tiv
    // malei (לִקְרֹא -> לקרוא, not ליקרוא). A hirik under a root
    // letter does (דִּבַּרְתִּי -> דיברתי). Cholam/kubutz always take
    // a ו mater, prefix or not (יֻכְתַּב -> יוכתב).
    var PREFIX_LETTERS = 'ליתנהמובכ';
    for (var j = 0; j < letters.length; j++) {
      out += letters[j].letter;
      var next = j + 1 < letters.length ? letters[j + 1].letter : '';
      if ((letters[j].marks.indexOf('ֹ') !== -1 || letters[j].marks.indexOf('ֻ') !== -1) && next !== 'ו') {
        out += 'ו';
      } else if (letters[j].marks.indexOf('ִ') !== -1 && next !== 'י' &&
                 !(j === 0 && PREFIX_LETTERS.indexOf(letters[j].letter) !== -1)) {
        out += 'י';
      }
    }
    return out;
  }

  function stripVowelLetters(str) {
    return str.replace(/[וי]/g, '');
  }

  function candidateRoots(plain) {
    var cores = {};
    var prefixes = [''].concat(REV_PREFIXES);
    var suffixes = [''].concat(REV_SUFFIXES);
    prefixes.forEach(function (pre) {
      if (pre && plain.indexOf(pre) !== 0) return;
      var rest = plain.slice(pre.length);
      suffixes.forEach(function (suf) {
        if (suf && rest.slice(-suf.length) !== suf) return;
        var core = rest.slice(0, rest.length - suf.length);
        if (core.length < 2 || core.length > 4) return;
        cores[core] = true;
      });
    });
    var roots = [];
    Object.keys(cores).forEach(function (core) {
      // Matres lectionis (ו/י) in unpointed input are often vowels, not
      // root letters: also try the core with them removed.
      var variants = [core];
      var noVav = core.replace(/ו/g, '');
      var noYod = core.replace(/י/g, '');
      var noBoth = core.replace(/[וי]/g, '');
      if (noVav !== core) variants.push(noVav);
      if (noYod !== core) variants.push(noYod);
      if (noBoth !== core && noBoth !== noVav && noBoth !== noYod) variants.push(noBoth);
      variants.forEach(function (v) {
        var letters = v.split('');
        if (letters.length === 3 || letters.length === 4) {
          roots.push(letters);
          return;
        }
        if (letters.length === 2) {
          // Two-consonant core: try III-he, hollow, geminate, III-aleph,
          // I-nun, I-yod.
          FILLERS.forEach(function (f) {
            roots.push([letters[0], letters[1], f]);
          });
          roots.push([letters[0], 'ו', letters[1]]);
          roots.push([letters[0], 'י', letters[1]]);
          roots.push([letters[0], letters[1], letters[1]]);
          roots.push(['נ', letters[0], letters[1]]);
          roots.push(['י', letters[0], letters[1]]);
        }
      });
    });
    var seen = {};
    return roots.filter(function (r) {
      var key = r.join('');
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function identify(input) {
    var plain = stripMarks(input).replace(/[^א-ת]/g, '');
    if (!plain) return [];
    var plainNoVL = stripVowelLetters(plain);
    var byKey = {};
    function consider(root, binyan, tense, person, form) {
      var stripped = stripMarks(form);
      var score = -1;
      if (stripped === plain) score = 0;
      else if (ktivMalei(form) === plain) score = 1;
      else if (plainNoVL.length >= 2 && stripVowelLetters(stripped) === plainNoVL) score = 2;
      if (score === -1) return;
      var key = root.join('') + '|' + binyan + '|' + tense + '|' + person;
      // Rank: match quality first, with a one-point penalty for
      // four-letter roots (a 4-letter core often turns out to be a
      // 3-letter root plus a mater), then shorter roots first.
      var rank = score + (root.length === 4 ? 1 : 0);
      if (byKey[key] && byKey[key].rank <= rank) return;
      byKey[key] = {
        shoresh: root.join(''), binyan: binyan, binyanName: BINYAN_NAMES[binyan],
        tense: tense, person: person, personLabel: PERSON_LABELS[person],
        form: form, score: score, rank: rank
      };
    }
    candidateRoots(plain).forEach(function (root) {
      BINYANIM.forEach(function (binyan) {
        var res = conjugate(root.join(''), binyan);
        if (!res.covered) return;
        ['past', 'present', 'future', 'imperative'].forEach(function (tense) {
          var table = res.tables[tense];
          if (!table) return;
          Object.keys(table).forEach(function (person) {
            consider(root, binyan, tense, person, table[person]);
          });
        });
        if (res.tables.infinitive) consider(root, binyan, 'infinitive', '', res.tables.infinitive);
      });
    });
    var results = Object.keys(byKey).map(function (k) { return byKey[k]; });
    results.sort(function (a, b) {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.shoresh.length !== b.shoresh.length) return a.shoresh.length - b.shoresh.length;
      return a.score - b.score;
    });
    return results;
  }

  // ---- UI ----
  var TENSE_LABELS = { past: 'Past', present: 'Present', future: 'Future', imperative: 'Imperative' };

  function esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function tenseTable(title, table) {
    if (!table) return '';
    var rows = Object.keys(table).map(function (person) {
      return '<tr><th scope="row">' + esc(PERSON_LABELS[person]) +
        '</th><td lang="he" dir="rtl" class="hebrew-form">' + esc(table[person]) + '</td></tr>';
    }).join('');
    return '<div class="col-md-6"><div class="card mb-3"><div class="card-header">' + esc(title) +
      '</div><table class="table table-sm mb-0"><tbody>' + rows + '</tbody></table></div></div>';
  }

  function renderResult(res) {
    var el = document.getElementById('conj-result');
    if (!el) return;
    if (!res.covered) {
      el.innerHTML = '<div class="alert alert-warning" role="alert">' + esc(res.reason) + '</div>';
      return;
    }
    var root = res.root.join('');
    var html = '<h2 class="h4"><span lang="he" dir="rtl">' + esc(root) + '</span> — ' +
      esc(BINYAN_NAMES[res.binyan]) + ' <small class="text-body-secondary">(' +
      esc(CLASS_NAMES[res.class]) + ' root)</small></h2>';
    html += '<div class="row">';
    ['past', 'present', 'future', 'imperative'].forEach(function (tense) {
      html += tenseTable(TENSE_LABELS[tense], res.tables[tense]);
    });
    html += '</div>';
    if (res.tables.infinitive) {
      html += '<p>Infinitive: <span lang="he" dir="rtl" class="hebrew-form">' +
        esc(res.tables.infinitive) + '</span></p>';
    } else {
      html += '<p class="text-body-secondary">This binyan has no imperative or infinitive forms.</p>';
    }
    html += '<p><a href="index.html?q=' + encodeURIComponent(root) + '">Look up ' +
      esc(root) + ' in the dictionary</a></p>';
    el.innerHTML = html;
  }

  function matchesListHtml(matches) {
    var shown = matches.slice(0, 10);
    var items = shown.map(function (m) {
      var desc = m.tense === 'infinitive'
        ? 'Infinitive'
        : TENSE_LABELS[m.tense] + ', ' + m.personLabel;
      return '<li class="list-group-item d-flex justify-content-between align-items-start">' +
        '<div><span lang="he" dir="rtl" class="hebrew-form">' + esc(m.form) + '</span> — ' +
        esc(desc) + ' of <span lang="he" dir="rtl">' + esc(m.shoresh) + '</span> (' +
        esc(m.binyanName) + ')</div>' +
        '<a class="btn btn-sm btn-outline-primary ms-2" href="conjugator.html?verb=' +
        encodeURIComponent(m.shoresh) + '&binyan=' + encodeURIComponent(m.binyan) +
        '">Table</a></li>';
    }).join('');
    var html = '<ul class="list-group">' + items + '</ul>';
    if (matches.length > shown.length) {
      html += '<p class="text-body-secondary small mt-2">Showing the ' + shown.length +
        ' most likely matches of ' + matches.length + ' possible parses.</p>';
    }
    return html;
  }

  // Conjugate a shoresh; if the input is not a shoresh (e.g. a
  // dictionary verb headword like an infinitive), identify it as an
  // inflected form instead.
  function conjugateOrIdentify(shoresh, binyan) {
    if (parseRoot(shoresh)) {
      renderResult(conjugate(shoresh, binyan));
      return;
    }
    var el = document.getElementById('conj-result');
    if (!el) return;
    var matches = identify(shoresh);
    if (!matches.length) {
      el.innerHTML = '<div class="alert alert-warning" role="alert">Enter a shoresh of 3 or 4 Hebrew letters.</div>';
      return;
    }
    el.innerHTML = '<p class="text-body-secondary">That is not a shoresh — it looks like an inflected form:</p>' +
      matchesListHtml(matches);
  }

  function init() {
    var select = document.getElementById('binyan');
    if (select) {
      BINYANIM.forEach(function (b) {
        var opt = document.createElement('option');
        opt.value = b;
        opt.textContent = BINYAN_NAMES[b];
        select.appendChild(opt);
      });
    }
    var form = document.getElementById('conj-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var shoresh = document.getElementById('shoresh').value;
        conjugateOrIdentify(shoresh, select.value);
      });
    }
    var iform = document.getElementById('identify-form');
    if (iform) {
      iform.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = document.getElementById('inflected').value;
        var out = document.getElementById('identify-result');
        var matches = identify(input);
        if (!matches.length) {
          out.innerHTML = '<div class="alert alert-warning" role="alert">No matching verb form found. Try the shoresh above instead.</div>';
          return;
        }
        out.innerHTML = matchesListHtml(matches);
      });
    }
    // Deep link: ?verb=כתב&binyan=paal (verb may be an inflected form,
    // e.g. a dictionary headword — identify it then).
    if (typeof window !== 'undefined' && window.location) {
      var params = new URLSearchParams(window.location.search);
      var verb = params.get('verb');
      if (verb) {
        var input = document.getElementById('shoresh');
        if (input) input.value = verb;
        if (params.get('binyan') && select) select.value = params.get('binyan');
        conjugateOrIdentify(verb, select ? select.value : 'paal');
      }
    }
  }

  var api = {
    conjugate: conjugate, identify: identify, parseRoot: parseRoot,
    rootClass: rootClass, BINYANIM: BINYANIM, BINYAN_NAMES: BINYAN_NAMES
  };
  if (typeof window !== 'undefined') {
    window.TargumConjugator = api;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
