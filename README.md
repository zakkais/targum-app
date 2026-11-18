# Lashon Translate

Live site: https://zakkais.github.io/targum-app/

A one-stop shop for anything Torah-language based: translate and look up words
across Modern Hebrew, Lashon HaKodesh, Aramaic, Yiddish, and English.

**Working title** — the name is not settled yet.

## Features (v1 — live in this build)

1. **Dictionary** — 53,018 entries: Modern Hebrew (13,760), Lashon
   HaKodesh (6,147), Aramaic (21,742, including Jastrow), Yiddish
   (11,369). Nikud-insensitive search, English gloss search, exact
   matches ranked first, alphabetical browse with an Aleph-Beis index,
   copy button on every entry. Pointed forms show under the main word.
2. **Otzar of Roshei Teivos** — 23,750 abbreviations with 69,186
   expansions from six books (Notrikon 2 vols., Stern, Lexicon,
   Luach Chabad, Steinsaltz), alphabetical browse, genre filter.
3. **Thesaurus** — 148 synonym groups (423 words) from *Biur Shemos
   HaNirdafim* by R' Shlomo Aharon Wertheimer (Jerusalem 1924), each
   synonym with a note on when that word is used. The notes are in
   Hebrew, condensed from the book itself; an English translation pass
   is a separate job not yet decided. Integrated both ways with the
   dictionary: groups link to entries, entries link to their group.
4. **Dikduk** — grammar. Hebrew after Radak and Ramchal, Aramaic after
   Yitzhak Frank. Original explanations; Yiddish grammar in a later
   version.
5. **Tools** — gematria calculator: Mispar Hechrachi, Siduri, Katan,
   Atbash, with im hakolel options and a letter breakdown.
6. **Verb conjugator** — rule-based, fully offline: full tables
   (past/present/future/imperative/infinitive × all persons, with
   nikud), all eight binyanim, irregular roots handled, reverse
   identification of typed forms.
7. **Read mode** — paste a text, tap any word or abbreviation for its
   entry.
8. **Loanwords** — 54 terms borrowed from Greek, French, Persian, and
   Latin, including Rashi's French glosses (laazim).
9. **Sources** — the seforim the app is built on, with verified links
   to free editions where public domain and purchase links where in
   print.

Later versions: fluent sentence translation, user features — flashcards
(make your own cards and lists), entry submissions, saved items sync,
and public sharing — plus recorded audio pronunciation for Hebrew and
Yiddish entries, and camera text scanning (like Google Lens).

## Status

V1 of the website is built from scratch (Bootstrap via CDN, static site
on GitHub Pages, no build step) and is live at
https://zakkais.github.io/targum-app/. The Android app follows, reusing
the same data.

**Data live in this build:** dictionary 53,018 entries; Roshei Teivos
23,750 abbreviations; thesaurus 148 groups (423 words); loanwords 54
entries. See [DATA_REPORT.md](DATA_REPORT.md)
for the full data report, including known gaps: entries have no shoresh,
binyan, or usage examples in any source yet (none were invented), and
the Roshei Teivos data carries some OCR noise from the scanned books.

## Data sources

- Dictionary: Wiktionary via kaikki.org (CC BY-SA), Strong's (public domain),
  Jastrow's *Dictionary of the Targumim, the Talmud Babli and Yerushalmi, and
  the Midrashic Literature* (public domain, 1903).
- Roshei Teivos: extracted from printed lists (facts only, in our own
  arrangement); the *Otzar Roshei Teivos* book is used as a checklist.
- Grammar: original explanations following the structure of Radak's *Mikhlol*
  / *Sefer HaShorashim*, Ramchal's *Sefer HaDikduk*, and Frank's *Grammar for
  Gemara*.

## License

MIT. See [LICENSE](LICENSE). Data keeps its own terms (see above).
