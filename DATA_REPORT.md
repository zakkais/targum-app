# Targum App v1 — Data Report

Built 2026-11-18. Build script + downloaded sources (reproducible pipeline):
`~/workspace/.targum-build/build_targum_data.py`

Rebuilt 2026-11-18 (evening) with the nikud move (see "Nikud rule" below);
counts unchanged, 24,969 entries gained an `n` field.

## Files written

| File | Entries | Size | Sources |
|---|---|---|---|
| `data/dict-modern.json` | 13,760 | 2.4 MB | wiktionary 13,760 |
| `data/dict-ancient.json` | 6,147 | 1.1 MB | strongs 5,807; wiktionary+strongs 226; wiktionary 106; ledger 8 |
| `data/dict-aramaic.json` | 21,742 | 3.1 MB | jastrow 19,363; wiktionary 1,747; strongs 396; wiktionary+strongs 220; ledger 16 |
| `data/dict-yiddish.json` | 11,369 | 2.1 MB | kaikki-yiddish 11,369 |
| `data/roshei-teivos.json` | — | — | **NOT CREATED — RT data not ready** (see below) |
| `data/dikduk-binyanim.json` | 7 binyanim; 32 tables; 216 examples; 88 rules | 105 KB | המסלול לדקדוק (Walder Education, 2009) |
| **Total (dictionary)** | **53,018** | **~8.6 MB** | |

## Reconciliation

- Source DB (`~/workspace/hebrew-dict-app/data/dict.db`, table `entries`):
  modern 13,760 + ancient 6,147 + aramaic 2,379 = **22,286**. All 22,286 rows
  exported; counts match exactly.
- Yiddish: kaikki dump has 12,556 lines; dedup by plain form merged 1,187
  duplicates (1,006 groups) → **11,369** entries. 12,556 − 1,187 = 11,369. ✓
- Jastrow: 32,512 records = 5 with no senses + 13,059 with no usable gloss
  (see below) + 35 internal duplicates + 50 overlaps with existing DB Aramaic
  entries (same plain form + same gloss; DB entry kept) + **19,363 added**. ✓
- Total: 22,286 + 11,369 + 19,363 = **53,018**. ✓

## Sources

- **DB export**: `~/workspace/hebrew-dict-app/data/dict.db`. Exported verbatim
  (headword, plain form, lang, pos, gloss, source). Empty `pos` mapped to `null`.
- **Yiddish**: kaikki.org Wiktionary pipeline,
  `https://kaikki.org/dictionary/Yiddish/kaikki.org-dictionary-Yiddish.jsonl.gz`
  (downloaded 2026-11-18; 12,556 entries). Glosses joined with ` | `.
  Transliteration from head-template `tr`, falling back to the first
  `romanization` form (verified: first romanization matched head `tr` in
  2,985/3,037 cases where both exist).
- **Jastrow**: found via the ChavrutAI/Bekiut repo (`EzraBrand/bekiut`, formerly
  `EzraBrand/chavrutai`), whose `jastrow-entry-details` files cite their source
  as `UniquePixels/jastrow` (Sefaria-derived, CC-BY-NC as attributed there).
  Data downloaded from
  `github.com/UniquePixels/jastrow` @ `05c8a79`, `data/raw/jastrow-part1.jsonl`
  + `jastrow-part2.jsonl` (32,512 records). First usable sense per entry,
  HTML stripped, citations/examples trimmed (see "Jastrow cleaning" below).
  Homograph markers (`I`, `II`, `²`, …) stripped from headwords; homographs
  with different glosses kept as separate entries.

## Validation

- All four JSON files parse (`python -m json.tool`). ✓
- Schema check: every entry has `h`, `p`, `l`, `pos` (string or null), `g`,
  `s`; `l` matches its file; no unknown keys; no nikud/spaces/maqaf in `p`. ✓
- All files sorted by `p` in Hebrew alphabetical order (final letters folded
  to their non-final form for ordering; the 18 Latin-script Yiddish entries
  sort after the Hebrew-script ones). ✓
- Defect scans on Jastrow glosses all zero: no HTML/entity/folio remnants, no
  citation remnants, no `v.` cross-refs, no leading `=`/`as preced.`, no
  trailing single-letter fragments, no unbalanced parens.

## Gaps and decisions

### Nikud rule (applied 2026-11-18, evening rebuild)
Per Zakkai's rule, words with nekudos are NOT separate entries: the headword
`h` is the unpointed form and the pointed form (when the source gives one)
lives in `n`, shown under the main word in small text. The pipeline's
`move_nikud` step applies this at build time: 24,969 entries gained `n`
(modern 2, ancient 5,811, Aramaic 19,156). No entries were merged or dropped
by this step — the sources contained no duplicate entries differing only by
nikud (verified: 0 mergeable groups), so the move is a field move, not a
dedupe (`nikud_deduped: 0`). **Yiddish is excluded by design**: Yiddish vowel
points (pasekh, komets, rafe) are orthography, not nikud — stripping them
would corrupt the spelling (אַ vs אָ vs א are different). Yiddish headwords
keep their points and have no `n` field.

### No shoresh / binyan / examples in the source data (GAP)
The DB has no shoresh, binyan, or example fields, and neither kaikki nor the
Jastrow dump provides them in usable form. **No shoresh, binyan, or examples
were invented.** The conjugator will need shoresh/binyan from another source
or from a later enrichment pass. (Jastrow does carry `verbal_stem` data on
2,337 records; entries whose gloss starts with "to " and whose record has a
verbal stem are tagged `pos: "verb"` — 2,052 entries. All other Jastrow
entries have `pos: null`.)

Update 2026-11-19: binyan tables and verb examples now exist in
`data/dikduk-binyanim.json` (see below), and the conjugator is validated
against them (696/696). Dictionary entries still carry no shoresh/binyan
fields.

### `pos` coverage
- Modern: all 13,760 have pos. Yiddish: all 11,369 have pos.
- Ancient: 5,815 of 6,147 have `pos: null` (all 5,807 Strong's entries + 8
  ledger entries carry no part of speech in the DB).
- Aramaic: 17,722 of 21,742 have `pos: null` (17,311 Jastrow + 411 DB).

### Source value `ledger` is outside the schema enum (FLAG)
24 DB entries (8 ancient, 16 aramaic) carry source `ledger` — hand-added
phrases from Zakkai's own learning (e.g. `ובכמה דוכתי`, `לדידן דלא קיימא לן הכי`).
The schema enum lists only wiktionary/strongs/wiktionary+strongs/jastrow/
kaikki-yiddish. The entries were kept with `s: "ledger"` rather than dropped
or misattributed — the site JS should accept `ledger` as a source value (or
the parent can direct a remap). 8 of these had spaces in `headword_plain`
(hand-entered, bypassing the normalizer); their `p` was normalized to the DB
convention (spaces/maqaf stripped) — e.g. `ובכמה דוכתי` → `ובכמהדוכתי`.

### Yiddish: no YIVO/Hasidic spelling fields (GAP)
Kaikki lists alternate forms for 1,260 entries, but does **not** label which
spelling system they belong to — the alternates mix Hasidic spellings
(`אידיש`), dialectal forms (`פֿינעף`), Daytshmerish (`יודיש`), archaic forms
(`אונד`), and punctuation variants (`שלום־עליכם`). "YIVO" appears in the data
only as an IPA pronunciation tag, never as a spelling label. Assigning
`yivo`/`hasidic` labels would have been guessing, so **no `yivo`/`hasidic`
fields were emitted**. A later pass could label them with a spelling-system
heuristic or a dedicated source.
- Transliteration: 11,319 of 11,369 Yiddish entries have `tr` (99.6%); 50 lack
  any romanization in the data.
- 1,464 Yiddish entries are pointer-only glosses (mostly "plural of X" for
  inflected forms); kept as real entries.
- 18 Yiddish entries are Latin-script headwords from Wiktionary
  (`geshmak`, `tsuker`, `ikh`, …); kept, sorted after Hebrew-script entries.

### Jastrow merge details
- Added 19,363 entries. Overlap with existing DB Aramaic: only 50 exact
  (plain form + gloss) matches — Jastrow and Wiktionary word glosses
  differently, so most shared headwords appear twice with different glosses.
- 13,059 records skipped as having no usable gloss: ~9,000 are pure
  cross-references (`v. X`), the rest are citation-only, plural-form-only
  (`—Pl. …`), or correction notes (`read X`). These headwords are NOT in the
  file; a later pass could add them as "See X" redirects if wanted.
- 173 entries were rescued from after an em dash (citations first, gloss
  after, e.g. `אַבָּא` → "my father").
- 5,539 extra Aramaic entries share a `p` with another entry (Jastrow
  homographs kept separate, e.g. `אָב` = month of Av vs. father, plus
  Jastrow/DB pairs with different glosses). The site should expect and display
  multiple entries per headword.
- Jastrow glosses keep some original abbreviations (`pr. n.` proper name,
  `m.`/`f.` gender, `trnsf.` transferred sense, `etc.`). Leading language
  markers (`(b. h.)`, `(ch.)`, `(Aram.)`) were stripped as lexicon notation.
- Jastrow covers post-biblical Hebrew as well as Aramaic; all merged entries
  are in the Aramaic file with `l: "aramaic"` per the task spec.

### Origin labels
`o` was added ONLY for the one verified case: `שלום עליכם` →
`"Hebrew in origin; borrowed into Yiddish"`, in `dict-modern.json` and
`dict-yiddish.json` (it does not occur in the ancient, Aramaic, or Jastrow
data). No other `o` fields exist.

### Roshei Teivos — READY (added 2026-11-18 evening)
`~/workspace/translate-app-mock/roshei-teivos/consolidated.json` landed
during the build (23,971 unique abbreviations in the final version used)
and was converted by `~/workspace/.targum-build/build_rt_data.py` into
`data/roshei-teivos.json`: **23,750 abbreviations, 69,186 expansions**
(4.75 MB). Schema: `{"a", "p", "e", "v"?, "g", "s"}` — `a` abbreviation
as printed, `p` Hebrew-letters-only plain form (search/sort key), `e`
expansions joined with `" | "` (most-attested first), `v` variant plain
forms (338 entries), `g` genres, `s` source book keys. Sorted by `p`
(final letters folded).

Filters applied (OCR garbage out, facts kept): dropped 69 unreadable
entries, 13 with Latin/Cyrillic/digits in the abbreviation, 139 left
with no clean expansions, and 768 garbage expansions (Latin, digits,
Cyrillic, Greek, `#`, U+FFFD, block/bullet marks, brackets). Leading
non-Hebrew characters stripped from abbreviations. Low-confidence
entries kept when their expansions pass the garbage filter (Notrikon
vol. 1's "low" entries are mostly clean).

Known residual noise: some expansions are Hebrew-only OCR garble that
no character filter catches (e.g. רש״י lists "רעיס רוח בן יוחאי"
alongside the correct "רבי שלמה יצחקי"; גמר״א leads with a misspelled
"גבריאל מיבאל רפאל אוריאל" before the correct spelling). The correct
expansion is usually first (most-attested ordering). The extraction job
cross-verified 653 of 846 sampled expansions. A future cleanup pass can
improve this; nothing was hand-edited.

### Thesaurus — READY (added 2026-11-18 evening)
`~/workspace/translate-app-mock/thesaurus/consolidated.json` was copied
as-is to `data/thesaurus.json` (schema already matched):
**148 groups, 275 synonyms, 423 words** from Sefer Biur Shemos
HaNirdafim, R' Shlomo Aharon Wertheimer, part 1, Jerusalem 1924
(HebrewBooks ID 31481, public domain). The "800 groups" figure in
earlier notes belongs to the later complete edition — this first part
covers 400 synonym words per its own title page and index, and the
extraction covers all of it (cross-checked against the book's index:
215 of 300 recoverable index words appear; the other 85 are form
variants, words discussed inside groups, or index OCR misreadings).

Notes: the "when" usage notes are in Hebrew, condensed from the book's
own discussions (an English translation pass is a separate job, not yet
decided). 7 synonyms are flagged `"unclear": true` — the word is listed
but its distinct sense could not be read from the scan; the page shows
them without an explanation rather than inventing one. Two headwords
appear twice deliberately (מטה: staff group and bed group; עזר: with
ישע and with סעד) — separate groups in the book. The seed group אור was
dropped: it is not in the book at all.

### Dikduk binyanim — READY (added 2026-11-19)
`data/dikduk-binyanim.json` (105 KB) was built by
`~/workspace/targum-app/sources/hifil-workbook/build_dikduk_data.py`
from the extraction in the same directory: **7 binyanim** (Pa'al,
Nif'al, Pi'el, Pu'al, Hif'il, Huf'al, Hitpa'el), **32 conjugation
tables** (7 full paradigms + 25 guttural/special tables), **216 cited
examples** (pesukim, Mishnah, Gemara, Midrash, tefillah), and **88
rules** (9 general terms + 79 per-binyan). Schema: `{"source",
"source_note", "general": {"title", "rules": [{"title", "text"}]},
"binyanim": [{"id", "name", "hebrew", "meaning", "paradigm",
"paradigm_3ms", "rules", "tables": [{"shoresh", "main", "label",
"note"?, "tables": {past/present/future/imperative/infinitive}}],
"examples": {section: [{text, reference, reference_en, source,
note?}]}}]}`. Rendered by `assets/js/dikduk.js` into a Bootstrap
accordion on `dikduk.html` (one item per binyan, in standard binyan
order), with the General terms as a card above it.

Rules are paraphrased in our own words from the workbooks (the
extraction's `rules.md` was written as paraphrase, not quotation);
tables and quoted sources are transcribed as printed. Workbook errors
are kept as printed and flagged in `note` fields: several wrong
citations (e.g. a pasuk cited to Bereishis 12:15 that is really
Shemos 12:15), the Hitpa'el צלמ imperative column misprinting the
סכל forms, and the יעצ rule/table self-contradiction (rule text says
ayin takes no tashlum dagesh; the tables print kamatz). The Nif'al
I-guttural section genuinely uses a different example root per tense
(ענש past/present, חתמ future, רדמ imperative) — kept as separate
tables with explanatory notes. Pu'al and Huf'al have no imperative or
infinitive (`null` in the data; the page says "none").

Validation: counts asserted by the build script (7 binyanim, 32
tables, 216 examples, 88 rules); render logic smoke-tested in Node
(32 checks) plus a DOM-stub integration test (14 checks); rendered
page verified in headless Chromium at phone width (390px) — 7
accordion items, 95 tense tables in responsive wrappers, no console
errors, no horizontal overflow, accordion collapse works. The
conjugator re-validated 696/696 against the workbook tables after
the fix (see `sources/hifil-workbook/validation-report.md`).

## Notes for the site builder
- `dict-aramaic.json` is the largest file (3.1 MB, 21,742 entries); consider
  lazy-loading per language.
- `p` (plain form) is the lookup key: nikud-, space-, and maqaf-stripped.
  Geresh/gershayim and ASCII quotes are kept (e.g. `ה"ל`, `חז״ל`).
- Entries with the same `p` are distinct entries (homographs) — do not dedup
  on `p` alone at display time.
