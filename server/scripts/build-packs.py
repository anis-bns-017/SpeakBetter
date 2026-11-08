"""
Builds server/data/packs.bulk.json.gz: the large vocabulary packs (GRE, IELTS, TOEFL, SAT, Cambridge, academic writing,
business, phrasal verbs, and everyday English from the dictionary), each word with everything needed to learn it:
pronunciation, meaning, real example sentences, synonyms, opposites, word family, word forms, topic and how common it is.

Where the words come from
  * scripts/pack-lists/<category>.txt: the word selections, written for this app (not any publisher's list), grouped
    into sections. One section is "## Title | LEVEL | Icon | one-line summary" followed by words separated by spaces
    (use _ inside a phrase: "give_up"; "word/v" forces the word type: n, v, a, r).
  * The dictionary (server/data/dictionary.json.gz): the everyday packs, and the CEFR level of each word it knows.
  * Open English WordNet 2025 (CC BY 4.0): meanings, examples, synonyms, opposites, word families, forms, pronunciation.
  * ipa-dict (MIT): pronunciation WordNet lacks. FrequencyWords (CC BY-SA 4.0): how common a word is.
  * Tatoeba (CC BY 2.0 FR): real example sentences.

Usage (the folder is the one build-dictionary.py uses; nothing in it is executed):
  python -I scripts/build-packs.py <folder with oewn.zip, ipa_us.txt, ipa_uk.txt, freq50k.txt, tatoeba.tsv.bz2>
"""

import bz2
import gzip
import importlib.util
import json
import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("build_dictionary", HERE / "build-dictionary.py")
bd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bd)

POS_NAME = {"n": "noun", "v": "verb", "a": "adjective", "s": "adjective", "r": "adverb"}
POS_FROM_HINT = {"n": "n", "v": "v", "a": "a", "r": "r"}
# Small words that a list written with spaces would split a phrase into; never packs of their own
STOP = set("a an the of to in on at by for from with as is are be it its and or but if so that this off up out into over per via vs".split())
MAX_PACK = 50
MIN_PACK = 8
MAX_SYN = 6
MAX_ANT = 3
MAX_FAMILY = 6
MAX_EXAMPLES = 3

CATEGORY_DEFAULTS = {
    "gre": ("C1", "BookMarked"), "ielts": ("B2", "Award"), "toefl": ("B2", "GraduationCap"), "sat": ("B2", "ClipboardCheck"),
    "academic": ("B2", "PenLine"), "cambridge": ("C1", "Crown"), "business": ("B2", "Briefcase"),
    "expressions": ("B2", "Sparkles"), "everyday": ("A2", "Sun"),
}
LEVELS = ["A1", "A2", "B1", "B2", "C1"]
LEVELS_ALL = ["A1", "A2", "B1", "B2", "C1", "C2"]


def log(*a):
    print(*a, flush=True)


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def tidy_gloss(gloss):
    """WordNet glosses read like a thesaurus: keep the first clear clause, no leading (domain) tags that dominate"""
    g = gloss.strip()
    parts = [p.strip() for p in g.split(";")]
    out = parts[0]
    # A second clause is kept when the first is very short
    if len(out) < 35 and len(parts) > 1:
        out = out + "; " + parts[1]
    if len(out) > 170:
        out = out[:170].rsplit(" ", 1)[0].rstrip(",;:") + "…"
    return out[0].lower() + out[1:] if out and out[0].isupper() and not out[:2].isupper() and out.split(" ")[0].lower() == out.split(" ")[0] else out


def main(folder):
    folder = Path(folder)
    out_file = HERE.parent / "data" / "packs.bulk.json.gz"

    # ---------- WordNet ----------
    z = zipfile.ZipFile(folder / "oewn.zip")
    entries, synsets = {}, {}
    for name in z.namelist():
        data = json.loads(z.read(name))
        if name.startswith("entries-"):
            entries.update(data)
        elif name != "frames.json":
            lex = name[:-5]
            for sid, syn in data.items():
                syn["lex"] = lex
                synsets[sid] = syn
    sense_lemma = {}
    for lemma, by_pos in entries.items():
        for pos, entry in by_pos.items():
            for sense in entry.get("sense", []):
                sense_lemma[sense["id"]] = lemma
    log("wordnet entries:", len(entries), "synsets:", len(synsets))

    # ---------- frequency, pronunciation ----------
    freq = {}
    with open(folder / "freq50k.txt", encoding="utf-8") as f:
        for i, line in enumerate(f):
            parts = line.split()
            if len(parts) == 2 and parts[0] not in freq:
                freq[parts[0]] = i + 1

    def read_ipa(file):
        table = {}
        with open(folder / file, encoding="utf-8") as f:
            for line in f:
                if "\t" in line:
                    w, ipa = line.rstrip("\n").split("\t", 1)
                    table.setdefault(w.lower(), ipa.split(",")[0].strip())
        return table

    ipa_us, ipa_uk = read_ipa("ipa_us.txt"), read_ipa("ipa_uk.txt")

    # ---------- the dictionary (levels, and the everyday packs) ----------
    with gzip.open(HERE.parent / "data" / "dictionary.json.gz", "rb") as f:
        dictionary = json.loads(f.read().decode("utf-8"))
    dict_by_word = {w["w"].lower(): w for w in dictionary["words"]}

    # ---------- the word lists ----------
    sections = []  # {category, title, level, icon, summary, words: [(word, hint)]}
    list_dir = HERE / "pack-lists"
    for file in sorted(list_dir.glob("*.txt")):
        category = file.stem.split(".")[0]
        if category not in CATEGORY_DEFAULTS:
            raise SystemExit(f"{file.name}: unknown category {category}")
        current = None
        for raw in file.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or (line.startswith("#") and not line.startswith("##")):
                continue
            if line.startswith("##"):
                head = [p.strip() for p in line[2:].split("|")]
                level = head[1] if len(head) > 1 and head[1] in LEVELS else CATEGORY_DEFAULTS[category][0]
                icon = head[2] if len(head) > 2 and head[2] else CATEGORY_DEFAULTS[category][1]
                summary = head[3] if len(head) > 3 else ""
                current = {"category": category, "title": head[0], "level": level, "icon": icon, "summary": summary, "words": []}
                sections.append(current)
            elif current is not None and " :: " in line:
                # A hand-written entry for words and phrases WordNet lacks: word :: type :: meaning :: example [:: synonyms]
                bits = [b.strip() for b in line.split("::")]
                if len(bits) < 4:
                    raise SystemExit(f"{file.name}: bad entry: {line}")
                custom = {"pos": bits[1], "meaning": bits[2], "example": bits[3], "syn": [x.strip() for x in bits[4].split(",")] if len(bits) > 4 and bits[4] else []}
                current["words"].append((bits[0].replace("_", " ").lower(), custom))
            elif current is not None:
                for token in line.replace(",", " ").split():
                    hint = None
                    if "/" in token and token.rsplit("/", 1)[1] in POS_FROM_HINT:
                        token, hint = token.rsplit("/", 1)
                    current["words"].append((token.replace("_", " ").lower(), hint))
    log("list sections:", len(sections), "words listed:", sum(len(s["words"]) for s in sections))

    # ---------- everyday packs from the dictionary ----------
    TOPIC_ICON = {
        "Food & drink": "Utensils", "Body & health": "HeartPulse", "Feelings": "Heart", "People": "Users", "Places": "Compass",
        "Money & ownership": "Wallet", "Movement & travel": "Plane", "Communication": "MessagesSquare", "Thinking & ideas": "Brain",
        "Nature & weather": "Mountain", "Animals": "Leaf", "Plants": "Leaf", "Groups & society": "Users", "Social life": "Handshake",
        "Making & creating": "Palette", "Things & objects": "ShoppingBag", "Time": "Sunrise", "Actions & activities": "Rocket",
    }
    everyday = defaultdict(list)
    for w in dictionary["words"]:
        if w["lv"] not in ("A1", "A2", "B1", "B2") or " " in w["w"] or not re.fullmatch(r"[a-z]{3,}", w["w"]):
            continue
        pos = w["pos"][0] if w.get("pos") else ""
        if pos not in ("noun", "verb", "adjective", "adverb"):
            continue
        topic = (w.get("t") or ["Everyday words"])[0]
        everyday[(w["lv"], topic)].append(w["w"])
    for (level, topic), words in sorted(everyday.items(), key=lambda kv: (LEVELS.index(kv[0][0]), kv[0][1])):
        if len(words) < MIN_PACK:
            continue
        sections.append({
            "category": "everyday", "title": f"{topic}", "level": level, "icon": TOPIC_ICON.get(topic, "Sun"),
            "summary": f"{level} words about {topic.lower()}, with pronunciation, meaning, examples and related words.",
            "words": [(x, None) for x in words],
        })

    # ---------- Tatoeba sentences for every listed word ----------
    wanted = set()
    for s in sections:
        for word, _ in s["words"]:
            if " " not in word:
                wanted.add(word)
    sentences = defaultdict(list)
    seen_open = defaultdict(set)
    good = re.compile(r"^[A-Z][A-Za-z ,'’\-]*[a-z][.?!]$")
    with bz2.open(folder / "tatoeba.tsv.bz2", "rt", encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) != 3:
                continue
            _, _, text = parts
            if not (20 <= len(text) <= 100) or not good.match(text) or bd.RUDE.search(text):
                continue
            tokens = re.findall(r"[a-z']+", text.lower())
            if not (5 <= len(tokens) <= 16):
                continue
            opening = " ".join(tokens[:3])
            for t in set(tokens):
                if t in wanted and len(sentences[t]) < 4 and opening not in seen_open[t]:
                    sentences[t].append(text)
                    seen_open[t].add(opening)
    log("words with Tatoeba sentences:", len(sentences))

    # ---------- build one word ----------
    def contains(text, word):
        return re.search(r"(?<![A-Za-z])" + re.escape(word) + r"(?![A-Za-z])", text, re.I) is not None

    def contains_form(text, word):
        base = re.escape(word)
        return re.search(r"(?<![A-Za-z])" + base + r"(s|es|d|ed|ing|ly|er|est)?(?![A-Za-z])", text, re.I) is not None

    def guess_pos_order(word, by_pos):
        """The word types (WordNet's keys: n, v, a, s, r, sometimes with a suffix) from most to least likely"""
        prefer = []
        if re.search(r"(ous|ive|ful|less|able|ible|ic|ical|al|ish|ent|ant|ary|ory|ile)$", word):
            prefer += ["a", "s"]
        if word.endswith("ly"):
            prefer += ["r"]
        counts = {k: len(e.get("sense", [])) for k, e in by_pos.items()}
        base = lambda k: k.split("-")[0]
        return sorted(by_pos, key=lambda k: (prefer.index(base(k)) if base(k) in prefer else len(prefer), -counts[k]))

    def build_word(word, hint, category):
        lemma = word.replace(" ", "_")
        by_pos = entries.get(lemma) or entries.get(lemma.capitalize())
        if not by_pos:
            return None
        order = guess_pos_order(word, by_pos)
        if hint:
            order = [k for k in order if k.split("-")[0] == hint or (hint == "a" and k.split("-")[0] == "s")] or order
        chosen = None  # (pos letter, sense, synset)
        for p in order:
            for sense in by_pos[p].get("sense", []):
                syn = synsets.get(sense["synset"])
                if not syn:
                    continue
                gloss = (syn.get("definition") or [""])[0]
                if len(gloss) < 9 or bd.RUDE.search(gloss) or contains(gloss, word):
                    continue
                chosen = (p, sense, syn)
                break
            if chosen:
                break
        if not chosen:
            return None
        p, sense, syn = chosen
        entry = by_pos[p]
        p = p.split("-")[0]
        pos_name = POS_NAME[p.split("-")[0]]
        if " " in word and pos_name == "verb":
            pos_name = "phrasal verb"
        meaning = tidy_gloss((syn.get("definition") or [""])[0])

        # example sentences: WordNet's first, then Tatoeba's, those with the word exactly as written first
        candidates = []
        for s2 in entry.get("sense", []):
            sy = synsets.get(s2["synset"])
            if sy:
                candidates += [bd.first_text(x) for x in sy.get("example", [])]
        candidates = [c.strip() for c in candidates if c and not bd.RUDE.search(c)]
        own = [bd.first_text(x).strip() for x in syn.get("example", []) if bd.first_text(x)]
        pool = own + [c for c in candidates if c not in own] + sentences.get(word, [])
        pool = [c for c in dict.fromkeys(pool) if 14 <= len(c) <= 200 and len(c.split()) >= 4]
        exact = [c for c in pool if contains(c, word)]
        near = [c for c in pool if c not in exact and contains_form(c, word)]
        examples = (exact + near)[:MAX_EXAMPLES]
        # Capitalise and close the sentence so it reads like the others
        examples = [(e[0].upper() + e[1:]) + ("" if e[-1] in ".!?" else ".") for e in examples]
        example = examples[0] if examples and contains(examples[0], word) else ""

        syns = [m.replace("_", " ") for m in syn.get("members", []) if m.lower() != word.lower()][:MAX_SYN]
        ants = [sense_lemma[x].replace("_", " ") for x in sense.get("antonym", []) if x in sense_lemma][:MAX_ANT]
        if not ants:
            for rel in syn.get("similar", []) or []:
                head = synsets.get(rel)
                if head:
                    for m in head.get("members", []):
                        for e2 in (entries.get(m) or {}).values():
                            for s3 in e2.get("sense", []):
                                for a in s3.get("antonym", []):
                                    if a in sense_lemma and sense_lemma[a] != lemma and sense_lemma[a].replace("_", " ") not in ants:
                                        ants.append(sense_lemma[a].replace("_", " "))
                if len(ants) >= MAX_ANT:
                    break
            ants = ants[:MAX_ANT]
        family = []
        for s2 in entry.get("sense", []):
            for rel in ("derivation", "pertainym"):
                for sid in s2.get(rel, []):
                    lem = sense_lemma.get(sid)
                    if lem and lem != lemma and "_" not in lem and lem == lem.lower() and lem not in family and lem not in ants:
                        family.append(lem)
        forms = {}
        if p == "v" and " " not in word:
            forms = bd.verb_forms(word)
        elif p == "n" and entry.get("form"):
            forms = {"plural": entry["form"][0]}
        elif p in ("a", "s") and entry.get("form") and len(entry["form"]) >= 2:
            comp = sorted(entry["form"], key=len)
            forms = {"comparative": comp[0], "superlative": comp[-1]}

        pron = ""
        for pr in entry.get("pronunciation", []):
            if pr.get("variety") == "US":
                pron = "/" + pr["value"] + "/"
                break
        if not pron:
            pron = ipa_us.get(word, "") or ipa_uk.get(word, "")

        rank = freq.get(word.replace(" ", ""), freq.get(word, 10**7))
        common = "common" if rank <= 8000 else "uncommon" if rank <= 25000 else "rare"
        d = dict_by_word.get(word)
        topic = bd.TOPIC.get(syn["lex"])

        item = {"word": word, "pos": pos_name, "meaning": meaning, "example": example}
        if len(examples) > (1 if example else 0):
            item["examples"] = [e for e in examples if e != example][:2]
        if pron:
            item["ipa"] = pron
        if syns:
            item["syn"] = syns
        if ants:
            item["ant"] = ants
        if family:
            item["fam"] = family[:MAX_FAMILY]
        if forms:
            item["forms"] = forms
        if topic:
            item["topic"] = topic
        item["freq"] = common
        if d:
            item["lv"] = d["lv"]
        return item

    # ---------- packs ----------
    packs, dropped, seen_words = [], defaultdict(list), defaultdict(set)
    counters = defaultdict(int)
    for s in sections:
        category = s["category"]
        built = []
        for word, hint in s["words"]:
            if word in seen_words[category] or word in STOP or len(word) < 3:
                continue
            if isinstance(hint, dict):
                item = build_word(word, None, category) or {"word": word, "freq": "common"}
                item["pos"], item["meaning"], item["example"] = hint["pos"], hint["meaning"], hint["example"]
                item.pop("examples", None)
                if hint["syn"]:
                    item["syn"] = hint["syn"]
                if not contains(item["example"], word):
                    log(f"WARNING: the example for '{word}' does not contain it exactly: {item['example']}")
            else:
                item = build_word(word, hint, category)
            if not item:
                dropped[category].append(word)
                continue
            seen_words[category].add(word)
            built.append(item)
        if len(built) < MIN_PACK:
            # Too few to make a quiz pack: dropped words are reported, the rest is kept for a later section of the same title
            dropped[category].extend(i["word"] for i in built)
            for i in built:
                seen_words[category].discard(i["word"])
            continue
        # Split long sections into even parts of at most MAX_PACK words
        parts = -(-len(built) // MAX_PACK)
        size = -(-len(built) // parts)
        chunks = [built[i : i + size] for i in range(0, len(built), size)]
        for n, chunk in enumerate(chunks, 1):
            counters[category] += 1
            title = s["title"] + (f" ({n}/{len(chunks)})" if len(chunks) > 1 else "")
            pid = f"{s['level'].lower()}-{category}-{counters[category]:03d}-{slug(s['title'])}"
            if len(chunks) > 1:
                pid += f"-{n}"
            for i, word in enumerate(chunk, 1):
                word["id"] = f"w{i}"
            packs.append({
                "id": pid, "level": s["level"], "category": category, "title": title,
                "topic": category.upper() if category in ("gre", "ielts", "toefl", "sat") else s["title"],
                "icon": s["icon"], "summary": s["summary"] or f"{len(chunk)} words: {', '.join(w['word'] for w in chunk[:4])} and more.",
                "bulk": True, "words": chunk,
            })

    total = sum(len(p["words"]) for p in packs)
    by_cat = defaultdict(lambda: [0, 0])
    for p in packs:
        by_cat[p["category"]][0] += 1
        by_cat[p["category"]][1] += len(p["words"])
    with_ex = sum(1 for p in packs for w in p["words"] if w["example"])
    log(f"packs: {len(packs)} words: {total} with an example sentence: {with_ex}")
    for c, (n, wc) in sorted(by_cat.items()):
        log(f"  {c}: {n} packs, {wc} words, dropped {len(dropped[c])}")
    report = [f"{c}: " + " ".join(sorted(set(ws))) for c, ws in sorted(dropped.items())]
    (folder / "pack-dropped.txt").write_text(chr(10).join(report), encoding="utf-8")

    data = {"version": 1, "count": total, "packs": packs}
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with gzip.open(out_file, "wb", compresslevel=9) as f:
        f.write(raw)
    log(f"wrote {out_file} ({len(raw) / 1e6:.1f} MB raw, {out_file.stat().st_size / 1e6:.1f} MB gzipped)")
    return dropped


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.stdout.reconfigure(encoding="utf-8")
    dropped = main(sys.argv[1])
    for c, ws in dropped.items():
        if ws:
            log(f"not found / unusable in {c} ({len(ws)}): " + " ".join(sorted(set(ws))[:60]) + (" ..." if len(set(ws)) > 60 else ""))
