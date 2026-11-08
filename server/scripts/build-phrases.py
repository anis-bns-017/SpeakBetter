"""
Builds server/data/packs.phrases.json.gz: the "Phrasal verbs" and "Idioms and proverbs" word packs.

Source: English Wiktionary (CC BY-SA), fetched by scripts/fetch-wiktionary-phrases.py into
<folder>/wiktionary_phrases.jsonl. Also reads <folder>/freq50k.txt (FrequencyWords, CC BY-SA 4.0) to put the most
useful phrases first. Vulgar, offensive, dated, obsolete, rare and dialect-only senses are left out.

Usage (the folder is the one the fetch script saved into, with freq50k.txt copied or saved there too):
  python -I scripts/build-phrases.py <folder>
"""

import gzip
import importlib.util
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("build_dictionary", HERE / "build-dictionary.py")
bd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bd)

MAX_PACK = 40
MIN_PACK = 8
MAX_SENSES = 3
MAX_MEANING = 220

PARTICLES = set("""up out off on in down over away back through around apart along ahead across by for into with about at to
after against ahead aside forward together under from onto past behind between beyond within without upon""".split())

# Labels that make a sense unsuitable for a learning app
BAD_LABELS = re.compile(
    r"\b(vulgar|offensive|derogatory|slur|obscene|pejorative|ethnic|racial|sexist|obsolete|archaic|dated|historical|rare|"
    r"nonstandard|non-standard|dialect|dialectal|scotland|scots|northern england|cockney|proscribed|euphemistic for sex)\b", re.I)
# Not a real meaning: a pointer to another entry
POINTER = re.compile(
    r"^(alternative|alt\.?|synonym|misspelling|obsolete|archaic|dated|eye dialect|pronunciation spelling|initialism|abbreviation|"
    r"acronym|clipping|contraction|ellipsis|apocopic|plural|present participle|simple past|past participle|"
    r"third-person|form of|nonstandard|standard|rare|short for|abbreviated|common misspelling|superseded|"
    r"a (misspelling|variant|form|archaic|dated|obsolete|rare|nonstandard|eye dialect|alternative))", re.I)
EXTRA_RUDE = re.compile(
    r"\b(sex\w*|fuck\w*|shit\w*|dick|dicks|cock|cocks|pussy|cunt|tits?|boob\w*|ass|asses|arse|asshole|bitch\w*|whore\w*|slut\w*|"
    r"piss\w*|wank\w*|cum|orgasm\w*|penis\w*|vagina\w*|testicle\w*|balls|semen|erection\w*|masturbat\w*|prostitut\w*|"
    r"nigg\w*|fag\w*|retard\w*|raped?|rapist|suicid\w*|genital\w*|horny|dildo|porn\w*|bastard\w*|bugger\w*|prick|twat|"
    r"tampon|condom|nazi|lynch\w*|slave|slaves|slavery|crap\w*|damn\w*|jesus|christ|christ's|god ?damn\w*|screw\w*|bloody hell|turd\w*|fart\w*|poo|poop\w*|puke|vomit\w*|snot|booze\w*|drunk\w*|stoned|junkie|hooker|pimp)\b", re.I)
TAGS = ["informal", "slang", "formal", "literary", "figurative", "humorous", "US", "UK", "British", "Australia", "Canada",
        "euphemistic", "ironic", "sarcastic", "colloquial", "poetic", "business", "sports", "nautical", "military"]
STOP = set("""a an the of to in on at by for from with as is are be it its and or but if so that this off up out into over per
via vs one's someone someone's something somebody somebody's oneself your you your's my his her their our one""".split())

THEMES = [
    ("Body and health", "head hand hands foot feet eye eyes ear ears nose mouth tongue lip lips teeth tooth neck back arm arms leg legs finger fingers thumb thumbs heart blood bone bones skin hair face shoulder shoulders chest stomach belly nerve nerves brain knee knees elbow"),
    ("Animals", "dog dogs cat cats bird birds horse horses fish bull cow cows pig pigs sheep lamb wolf fox snake monkey rat rats mouse duck chicken hen goose bear lion tiger elephant donkey eagle worm worms bee bees fly flies ant owl swan crow rabbit goat camel frog turtle snail hawk hare mule ox wasp wasps cock mare beast zoo"),
    ("Food and drink", "bread butter cheese egg eggs milk tea coffee wine beer apple apples cake pie sugar salt pepper soup meat bean beans potato cherry lemon orange banana nut jam honey cook cooking kitchen bake feast hungry dinner lunch breakfast eat eating drink drunk food pudding cream jelly oil sauce bacon ham pot plate cup spoon menu"),
    ("Colours and shapes", "red blue green yellow black white pink purple grey gray golden gold silver colour color colours rainbow round square straight circle"),
    ("Money and business", "money cash pay paid price prices cost penny pence pound dollar dollars buck bucks bank rich poor debt debts bill buy buying sell selling sold trade deal bargain profit loss business worth owe broke credit rent tax market shop store account budget cheap expensive wealth fortune income"),
    ("Time and age", "time times day days night morning evening year years hour hours minute minutes moment moon week weeks century early late old young age ages season tomorrow yesterday today"),
    ("Weather and nature", "rain storm wind snow sun sunshine cloud clouds thunder lightning weather sky fire water sea ocean river wave waves stone rock rocks tree trees wood grass flower flowers garden earth mountain hill road mud ice air smoke dust field fields leaf leaves root roots seed bush forest island lake"),
    ("Home and objects", "door doors house home room window wall walls roof table chair bed floor key keys lock clock knife pot pan box bag hat shoe shoes boot boots cap coat pocket string rope chain bell candle lamp book books paper pen pencil glass mirror needle thread button hammer nail nails brush"),
    ("Sport and games", "ball game games play player team race score goal card cards ace win won lose lost bat court field fight punch boxing ring jump cricket football golf chess dice bet gamble gamble jackpot trump hand slam referee"),
    ("People and relationships", "man men woman women boy girl child children kids baby mother father brother sister friend friends neighbour family wife husband son daughter parent parents uncle aunt cousin king queen boss master servant stranger enemy lover bride"),
    ("Mind and feelings", "mind think thought thoughts idea know knew believe wish hope fear love hate angry mad happy sad cry cried laugh smile joy proud shame guilty worry trust doubt dream mood spirit spirits temper nerves courage"),
    ("Speech and communication", "say said tell told talk speak speaking word words voice whisper shout call calls ask answer lie lies truth story tale news joke secret promise swear vow question language name names"),
    ("Movement and travel", "go going come run walk jump road way ship boat sail train bus car drive driving travel journey step steps trip fly flying ride ladder bridge track path street corner turn"),
]
THEME_WORDS = [(name, set(words.split())) for name, words in THEMES]


def log(*a):
    print(*a, flush=True)


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


POINTER_TEMPLATE = re.compile(
    r"(form of|synonym of|alternative|alt form|alt sp|misspelling|abbreviation of|initialism of|short for|clipping of|"
    r"obsolete|archaic spelling|eye dialect|contraction of|pronunciation spelling|standard spelling|&lit|plural of|"
    r"nonstandard|dated spelling|rare spelling|ellipsis of|acronym of|apocopic)", re.I)
TEMPLATE = re.compile(r"\{\{([^{}]*)\}\}")
LINK = re.compile(r"\[\[([^\[\]|]*)(?:\|([^\[\]]*))?\]\]")
NAMED = re.compile(r"^[A-Za-z0-9_-]+=")
HEADING = re.compile(r"^(={3,6})\s*(.+?)\s*\1\s*$")
GOOD_POS = re.compile(r"^(verb|phrase|idiom|proverb|noun|adverb|adjective|interjection|preposition|conjunction|prepositional phrase|"
                      r"verb phrase|adverbial phrase|adjective phrase|noun phrase|particle|determiner|pronoun|contraction|saying)$")


def render_templates(text, labels):
    def handle(m):
        parts = m.group(1).split("|")
        name = parts[0].strip().lower()
        args = [a.strip() for a in parts[1:]]
        pos = [a for a in args if not NAMED.match(a)]
        if name in ("lb", "lbl", "label", "context", "cx", "term-label", "tlb"):
            labels.extend(x for x in pos[1:] if x and x not in ("_", "and", "or", ","))
            return ""
        if name in ("ux", "uxi", "usex", "usex-ux", "ux-en", "quote-ux"):
            return pos[1] if len(pos) > 1 else ""
        if name in ("l", "link", "m", "mention", "ml", "ll", "l-self", "m-self", "l-en", "m-en", "lemma", "vern"):
            if len(pos) > 2 and pos[2]:
                return pos[2]
            return pos[1] if len(pos) > 1 else ""
        if name in ("n-g", "ng", "non-gloss", "nongloss", "non-gloss definition", "n-g-lite"):
            return pos[0] if pos else ""
        if name in ("w", "pedia", "wikipedia", "wp"):
            return pos[-1] if pos else ""
        if name in ("gloss", "gl", "qualifier", "qual", "q", "qf", "i", "sense", "taxlink", "taxfmt", "senseid", "defdate", "def-date", "sup", "sub", "c", "topics", "top", "catlangname", "cln"):
            return ""
        if POINTER_TEMPLATE.search(name):
            return " @@PTR@@ "
        return ""

    for _ in range(10):
        new = TEMPLATE.sub(handle, text)
        if new == text:
            break
        text = new
    return text


def wiki_to_text(raw, labels=None):
    labels = labels if labels is not None else []
    text = re.sub(r"<!--.*?-->", "", raw, flags=re.S)
    text = re.sub(r"<ref[^>]*>.*?</ref>|<ref[^>]*/>", "", text, flags=re.S)
    text = render_templates(text, labels)
    text = re.sub(r"\[https?://\S+\s+([^\]]*)\]", r"\1", text)
    text = re.sub(r"\[https?://\S+\]", "", text)
    text = LINK.sub(lambda m: (m.group(2) or m.group(1).split(":")[-1].split("#")[0]) if not m.group(1).startswith("Category") else "", text)
    text = re.sub(r"'{2,5}", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"\{\{|\}\}", "", text)
    return re.sub(r"\s+", " ", text).strip(), labels


def parse_senses(wikitext, kind):
    """The meanings in the English part of a page: [(pos, {text, labels, examples})] with examples attached"""
    senses, pos, current = [], "", None
    for line in wikitext.splitlines():
        h = HEADING.match(line)
        if h:
            pos = h.group(2).strip().lower()
            current = None
            continue
        if not GOOD_POS.match(pos):
            continue
        if kind == "phrasal verb" and pos not in ("verb", "phrase", "verb phrase", "idiom"):
            continue
        m = re.match(r"^#\s+(.*)$", line)
        if m:
            labels = []
            text, labels = wiki_to_text(m.group(1), labels)
            current = {"pos": pos, "text": text, "labels": ", ".join(labels), "examples": []}
            senses.append(current)
            continue
        m = re.match(r"^#:\s*(.*)$", line)
        if m and current is not None:
            text, _ = wiki_to_text(m.group(1))
            if text:
                current["examples"].append(text)
    return senses


def short_meaning(text):
    """The first clear clause of a Wiktionary definition: they often list three near-synonyms separated by semicolons"""
    parts = [p.strip() for p in text.split(";") if p.strip()]
    out = parts[0] if parts else text
    if len(out) < 28 and len(parts) > 1:
        out = out + "; " + parts[1]
    if len(out) > 170:
        out = out[:170].rsplit(" ", 1)[0].rstrip(",;:") + "…"
    return out


def tidy(text):
    text = text.replace("’", "'").replace("“", '"').replace("”", '"')
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    return text.strip()


def main(folder):
    folder = Path(folder)
    out_file = HERE.parent / "data" / "packs.phrases.json.gz"

    freq = {}
    with open(folder / "freq50k.txt", encoding="utf-8") as f:
        for i, line in enumerate(f):
            parts = line.split()
            if len(parts) == 2 and parts[0] not in freq:
                freq[parts[0]] = i + 1

    records = []
    seen_lines = set()
    with open(folder / "wiktionary_phrases.jsonl", encoding="utf-8") as f:
        for line in f:
            try:
                r = json.loads(line)
            except Exception:
                continue
            if r["title"] not in seen_lines:
                seen_lines.add(r["title"])
                records.append(r)
    log("entries read:", len(records), Counter(r["kind"] for r in records))

    def rank(token):
        return freq.get(token.lower(), 10**6)

    def commonness(title):
        """Lower is more common: the rarest meaningful word in the phrase, with the first word counting double"""
        tokens = [t for t in re.findall(r"[a-z']+", title.lower()) if t not in STOP and len(t) > 1]
        if not tokens:
            return 10**6
        ranks = [rank(t.strip("'")) for t in tokens]
        return max(max(ranks), ranks[0] * 2)

    def theme_of(title):
        tokens = set(re.findall(r"[a-z]+", title.lower()))
        for name, words in THEME_WORDS:
            if tokens & words:
                return name
        return None

    def surface_pattern(title):
        """A regex that finds the phrase in an example sentence even when its verb is inflected or it has an object"""
        tokens = title.split()
        parts = []
        for i, tok in enumerate(tokens):
            low = tok.lower()
            if low in ("someone", "somebody", "something", "someone's", "somebody's", "oneself", "one's", "one"):
                parts.append(r"(?:[\w'-]+\s+){1,3}" if "'" not in low else r"(?:[\w'-]+\s+){1,2}[\w'-]+'s?")
                continue
            if i == 0 and re.fullmatch(r"[a-z]{2,}", low) and low not in STOP:
                forms = {low}
                try:
                    forms |= {x.strip() for v in bd.verb_forms(low).values() for x in v.split("/")}
                except Exception:
                    pass
                parts.append("(?:" + "|".join(re.escape(x) for x in sorted(forms, key=len, reverse=True) if x) + ")")
            else:
                parts.append(re.escape(low))
        # words of the phrase may be separated by one object word for phrasal verbs ("give it up")
        glue = r"\s+(?:(?:it|them|him|her|me|you|us|that|this|one|up)\s+)?" if len(tokens) == 2 and tokens[1].lower() in PARTICLES else r"\s+"
        return re.compile(r"(?<![\w'])" + glue.join(p.strip() if p.endswith(r"\s+") else p for p in parts).replace(r"\s+\s+", r"\s+") + r"(?![\w'])", re.I)

    def build(rec):
        title = rec["title"]
        kind = rec["kind"]
        if not re.fullmatch(r"[A-Za-z][A-Za-z'’ -]*[A-Za-z]|[A-Za-z]", title) or len(title.split()) < 2 or len(title) > 60:
            return None
        if kind == "phrasal verb" and not (title.split()[-1].lower() in PARTICLES or title.split()[1].lower() in PARTICLES):
            return None
        if EXTRA_RUDE.search(title) or bd.RUDE.search(title):
            return None
        senses = []
        for d in parse_senses(rec.get("wikitext", ""), kind):
            text = tidy(d["text"])
            labels = d["labels"]
            if "@@PTR@@" in text or len(text) < 6 or POINTER.match(text):
                continue
            if BAD_LABELS.search(labels) or BAD_LABELS.search(text[:40]):
                continue
            if EXTRA_RUDE.search(text) or bd.RUDE.search(text):
                continue
            examples = []
            for t in d["examples"]:
                t = tidy(t)
                if 14 <= len(t) <= 220 and len(t.split()) >= 4 and "@@PTR@@" not in t and not EXTRA_RUDE.search(t) and not bd.RUDE.search(t):
                    examples.append(t)
            senses.append({"meaning": text, "labels": labels, "examples": examples})
        if not senses:
            return None

        pattern = surface_pattern(title)

        def match(sentence):
            m = pattern.search(sentence)
            return m.group(0) if m and len(m.group(0)) <= 80 else None

        # The first meaning is the main one; other meanings follow with their own examples
        primary = next((s for s in senses if title.lower() not in s["meaning"].lower()), senses[0])
        if title.lower() in primary["meaning"].lower():
            return None
        example, form = "", None
        for sentence in primary["examples"]:
            got = match(sentence)
            if got:
                example, form = sentence, got
                break
        if not example and primary["examples"]:
            example = primary["examples"][0]
        extra = [s for s in primary["examples"] if s != example][:2]

        others = []
        for s in senses:
            if s is primary or len(others) >= MAX_SENSES - 1:
                continue
            if title.lower() in s["meaning"].lower():
                continue
            others.append({"meaning": short_meaning(s["meaning"]), **({"example": s["examples"][0]} if s["examples"] else {})})

        labels = " ".join(s["labels"] for s in senses[:2]).lower()
        tags = []
        for t in TAGS:
            if re.search(r"\b" + t.lower() + r"\b", labels) and t not in tags:
                tags.append(t)
        tags = [t for t in tags if t not in ("British", "UK")] + (["UK"] if re.search(r"\b(british|uk)\b", labels) else [])

        item = {
            "word": title,
            "pos": "phrasal verb" if kind == "phrasal verb" else "proverb" if kind == "proverb" else "idiom",
            "meaning": short_meaning(primary["meaning"]),
            "example": example,
        }
        if form and form.lower() != title.lower():
            item["form"] = form
        elif form:
            item["form"] = title
        if extra:
            item["examples"] = extra
        if others:
            item["senses"] = others
        if tags:
            item["tags"] = tags[:3]
        return item

    built = []
    dropped = Counter()
    for rec in records:
        item = build(rec)
        if not item:
            dropped[rec["kind"]] += 1
            continue
        item["_kind"] = rec["kind"]
        item["_c"] = commonness(rec["title"])
        item["_theme"] = theme_of(rec["title"])
        built.append(item)
    log("built:", len(built), "dropped:", dict(dropped))

    # ---------- real sentences (Tatoeba) for entries that have a single meaning and no example ----------
    import bz2
    tatoeba = folder / "tatoeba.tsv.bz2"
    if tatoeba.exists():
        anchors = defaultdict(list)  # a word form -> the entries it can belong to
        for idx, w in enumerate(built):
            if w["example"] or w.get("senses"):
                continue
            tokens = [t.strip("'") for t in re.findall(r"[a-z']+", w["word"].lower()) if t not in STOP and len(t) > 2]
            if not tokens:
                continue
            anchor = max(tokens, key=rank)
            forms = {anchor, anchor + "s", anchor + "es"}
            if anchor == tokens[0] or anchor == w["word"].lower().split()[0]:
                try:
                    forms |= {x.strip() for v in bd.verb_forms(anchor).values() for x in v.split("/")}
                except Exception:
                    pass
            for form in forms:
                anchors[form].append(idx)
        log("entries looking for a sentence:", len({i for v in anchors.values() for i in v}))
        patterns = {}
        found = defaultdict(list)
        good = re.compile(r"^[A-Z][A-Za-z ,'\u2019\-]*[a-z][.?!]$")
        with bz2.open(tatoeba, "rt", encoding="utf-8") as f:
            for line in f:
                parts = line.rstrip(chr(10)).split(chr(9))
                if len(parts) != 3:
                    continue
                text = parts[2]
                if not (24 <= len(text) <= 110) or not good.match(text):
                    continue
                low = text.lower().replace("\u2019", "'")
                tokens = set(re.findall(r"[a-z']+", low))
                for t in tokens:
                    for idx in anchors.get(t, ()):
                        if len(found[idx]) >= 2:
                            continue
                        pat = patterns.get(idx)
                        if pat is None:
                            pat = patterns[idx] = surface_pattern(built[idx]["word"])
                        m = pat.search(text)
                        if m and len(m.group(0)) <= 80 and not EXTRA_RUDE.search(text) and not bd.RUDE.search(text):
                            found[idx].append((text, m.group(0)))
        found = {idx: hits for idx, hits in found.items() if hits}
        for idx, hits in found.items():
            w = built[idx]
            w["example"], w["form"] = hits[0]
            if len(hits) > 1:
                w["examples"] = [hits[1][0]]
        log("sentences found for", len(found), "entries")

    # ---------- sections ----------
    packs = []
    counters = defaultdict(int)

    def level_of(chunk, kind):
        cs = sorted(w["_c"] for w in chunk)
        median = cs[len(cs) // 2]
        if kind == "phrasal verb":
            return "B1" if median <= 1500 else "B2" if median <= 6000 else "C1"
        return "B1" if median <= 2500 else "B2" if median <= 9000 else "C1"

    def freq_label(c):
        return "common" if c <= 3000 else "uncommon" if c <= 12000 else "rare"

    def add_packs(category, section_title, summary, icon, items, kind):
        items = sorted(items, key=lambda w: (w["_c"], w["word"]))
        if len(items) < MIN_PACK:
            return items
        parts = -(-len(items) // MAX_PACK)
        size = -(-len(items) // parts)
        chunks = [items[i : i + size] for i in range(0, len(items), size)]
        for n, chunk in enumerate(chunks, 1):
            counters[category] += 1
            level = level_of(chunk, kind)
            title = section_title + (f" ({n}/{len(chunks)})" if len(chunks) > 1 else "")
            words = []
            for i, w in enumerate(chunk, 1):
                clean = {k: v for k, v in w.items() if not k.startswith("_")}
                clean["id"] = f"w{i}"
                clean["freq"] = freq_label(w["_c"])
                if w["_theme"]:
                    clean["topic"] = w["_theme"]
                words.append(clean)
            packs.append({
                "id": f"{level.lower()}-{category}-{counters[category]:03d}-{slug(section_title)}" + (f"-{n}" if len(chunks) > 1 else ""),
                "level": level, "category": category, "title": title, "topic": section_title, "icon": icon,
                "summary": summary, "bulk": True, "words": words,
            })
        return []

    # Phrasal verbs by particle
    phrasal = [w for w in built if w["_kind"] == "phrasal verb"]
    by_particle = defaultdict(list)
    for w in phrasal:
        tokens = w["word"].lower().split()
        particle = next((t for t in reversed(tokens) if t in PARTICLES), tokens[-1])
        by_particle[particle].append(w)
    leftover = []
    order = sorted(by_particle, key=lambda p: -len(by_particle[p]))
    for particle in order:
        items = by_particle[particle]
        if len(items) < MIN_PACK:
            leftover += items
            continue
        add_packs("phrasal", f"Phrasal verbs with {particle.upper()}", f"Phrasal verbs that end with '{particle}', the most useful first, with all their meanings.", "Link2", items, "phrasal verb")
    if leftover:
        add_packs("phrasal", "More phrasal verbs", "Less common phrasal verbs with other particles.", "Link2", leftover, "phrasal verb")

    # Idioms and proverbs by theme
    for kind, label, noun in (("idiom", "Idioms", "idioms"), ("proverb", "Proverbs", "proverbs")):
        group = [w for w in built if w["_kind"] == kind]
        themed = defaultdict(list)
        for w in group:
            themed[w["_theme"] or "General"].append(w)
        rest = themed.pop("General", [])
        for name in [n for n, _ in THEMES]:
            items = themed.get(name, [])
            leftover_items = add_packs("idioms", f"{label}: {name}", f"{noun.capitalize()} about {name.lower()}, the most useful first.", "Quote", items, kind) if items else []
            rest += leftover_items
        add_packs("idioms", f"{label}: Everyday {noun}" if kind == "idiom" else "Proverbs and sayings", f"Everyday {noun} that do not belong to one theme, the most useful first.", "Quote", rest, kind)

    total = sum(len(p["words"]) for p in packs)
    by_cat = Counter()
    for p in packs:
        by_cat[p["category"]] += len(p["words"])
    log(f"packs: {len(packs)} words: {total} by category: {dict(by_cat)}")
    log("with example:", sum(1 for p in packs for w in p['words'] if w['example']), "with form:", sum(1 for p in packs for w in p['words'] if w.get('form')))

    data = {"version": 1, "count": total, "packs": packs}
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with gzip.open(out_file, "wb", compresslevel=9) as f:
        f.write(raw)
    log(f"wrote {out_file} ({len(raw) / 1e6:.1f} MB raw, {out_file.stat().st_size / 1e6:.1f} MB gzipped)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1])
