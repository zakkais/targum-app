# Lashon Translate

Live site: https://zakkais.github.io/targum-app/

A one-stop shop for anything Torah-language based: translate and look up words
across Modern Hebrew, Lashon HaKodesh, Aramaic, Yiddish, and English.

**Working title** — the name is not settled yet.

## Features (planned)

1. **Translate** — Google Translate-style, to and from English. Offline when the
   language pack is fully downloaded; online also works. Deferred to a future
   update; v1 is dictionary plus word-by-word lookup only.
2. **Dictionary** — entries with shoresh (root), word break-up, binyan for
   verbs, usage examples, and phrases as entries. Alphabetical browse.
3. **Thesaurus** — synonyms with notes on when each word is used, modeled on
   *Biur Shemos HaNirdafim* by R' Shlomo Aharon Wertheimer.
4. **Otzar of Roshei Teivos** — abbreviations from all genres, alphabetical.
5. **Dikduk** — grammar. Hebrew after Radak and Ramchal, Aramaic after
   Yitzhak Frank. Yiddish grammar in a later version.
6. **Tools** — gematria calculator (Mispar Hechrachi, Siduri, Katan, Atbash,
   with im hakolel), and more to come.
7. **Flashcards** — make your own cards and lists (Chumash, Gemara, dikduk),
   Quizlet-style. Public sharing in a later version, once accounts exist.

Plus: **Read mode** (paste a text, tap any word or abbreviation for its
entry), a **loanwords** section (Greek, French, Persian, and more), and a
**verb conjugator** (full tables, all binyanim and tenses, offline).

Later versions: recorded audio pronunciation for Hebrew and Yiddish entries,
and camera text scanning (like Google Lens).

## Status

V1 of the website is being built from scratch (Bootstrap, static site on
GitHub Pages). The live site still shows the tappable mock (v3) until the
new build replaces it. The Android app follows, reusing the same data.

**Databases not yet complete.** The dictionary base (22,286 entries from
Wiktionary and Strong's) is in place; the Yiddish and Jastrow additions are
still being merged in. The Roshei Teivos list has been extracted from all six
source books (about 38,000 raw entries) but has not yet been merged,
deduplicated, or checked.

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
