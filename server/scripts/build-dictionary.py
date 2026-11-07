"""
Builds server/data/dictionary.json.gz: the 10,000-word English dictionary behind the Dictionary, the word map and
the vocabulary size test.

Every source is free to use in a commercial app with credit (the app shows these under "Word data sources"):
  * CEFR-J Wordlist 1.5 (Tono Laboratory, TUFS) and the Octanove C1/C2 profile (CC BY-SA 4.0): the level of each word
  * Open English WordNet 2025 (CC BY 4.0): meanings, examples, synonyms, opposites, word families, topics,
    pronunciation, irregular forms
  * ipa-dict (MIT): pronunciation where WordNet has none
  * FrequencyWords, OpenSubtitles 2018 (CC BY-SA 4.0): how common each word is
  * Tatoeba (CC BY 2.0 FR): real example sentences
  * Free Dictionary API (Wiktionary, CC BY-SA 3.0): meanings of grammar words WordNet leaves out (the, of, she ...)

Usage (downloads go in their own folder; nothing in it is executed):
  python -I scripts/build-dictionary.py <folder with the downloads>

The folder must hold: cefrj.csv, octanove.csv, oewn.zip (english-wordnet-2025-json.zip), ipa_us.txt, ipa_uk.txt,
freq50k.txt, tatoeba.tsv.bz2. Grammar-word meanings are fetched once and cached in that folder (dictapi_cache.json).
"""

import bz2
import csv
import gzip
import json
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path

TARGET = 10_000
# A few words are dropped later (no usable meaning), so the top-up picks a few extra
TOP_UP = TARGET + 300
LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]
MAX_SENSES = 8
MAX_SENSES_PER_POS = 4
MAX_SYNONYMS = 6
MAX_EXAMPLES = 3
NONWORDS = 400

POS_NAME = {"n": "noun", "v": "verb", "a": "adjective", "s": "adjective", "r": "adverb"}
CEFR_POS = {
    "noun": "noun", "verb": "verb", "adjective": "adjective", "adverb": "adverb", "pronoun": "pronoun",
    "preposition": "preposition", "determiner": "determiner", "conjunction": "conjunction", "number": "number",
    "modal auxiliary": "modal verb", "be-verb": "verb", "do-verb": "verb", "have-verb": "verb",
    "interjection": "exclamation", "infinitive-to": "particle", "vern": "verb",
}
WORDNET_POS = {"noun", "verb", "adjective", "adverb"}

TOPIC = {
    "noun.food": "Food & drink", "verb.consumption": "Food & drink", "noun.animal": "Animals", "noun.plant": "Plants",
    "noun.body": "Body & health", "verb.body": "Body & health", "noun.feeling": "Feelings", "verb.emotion": "Feelings",
    "noun.person": "People", "noun.artifact": "Things & objects", "noun.location": "Places", "noun.time": "Time",
    "noun.communication": "Communication", "verb.communication": "Communication", "verb.motion": "Movement & travel",
    "noun.act": "Actions & activities", "noun.cognition": "Thinking & ideas", "verb.cognition": "Thinking & ideas",
    "noun.possession": "Money & ownership", "verb.possession": "Money & ownership", "noun.group": "Groups & society",
    "verb.social": "Social life", "noun.event": "Events", "noun.state": "States & conditions",
    "noun.attribute": "Qualities", "noun.quantity": "Numbers & amounts", "noun.substance": "Materials",
    "noun.phenomenon": "Nature & weather", "noun.object": "Nature & weather", "verb.weather": "Nature & weather",
    "noun.shape": "Shapes", "verb.competition": "Sport & competition", "verb.creation": "Making & creating",
    "verb.change": "Change", "verb.contact": "Touch & handling", "verb.perception": "Senses",
    "noun.motive": "Thinking & ideas", "noun.relation": "Relationships", "noun.process": "Change",
    "verb.stative": "Being & having", "adj.all": "Describing words", "adj.ppl": "Describing words",
}

# Offensive words that subtitles are full of; they are left out of the frequency top-up
BLOCK = set("""fuck fucking fucker shit bitch bastard asshole dick cock pussy cunt whore slut nigger fag faggot
retard twat wanker bollocks crap damn goddamn piss tits boob boobs bullshit motherfucker jerk""".split())

# Irregular verbs: base -> (past, past participle). WordNet lists irregular forms but not which is which.
IRREGULAR = {}
for line in """
arise arose arisen|awake awoke awoken|be was/were been|bear bore borne|beat beat beaten|become became become|
begin began begun|bend bent bent|bet bet bet|bind bound bound|bite bit bitten|bleed bled bled|blow blew blown|
break broke broken|breed bred bred|bring brought brought|broadcast broadcast broadcast|build built built|
burn burned/burnt burned/burnt|burst burst burst|buy bought bought|cast cast cast|catch caught caught|
choose chose chosen|cling clung clung|come came come|cost cost cost|creep crept crept|cut cut cut|deal dealt dealt|
dig dug dug|do did done|draw drew drawn|dream dreamed/dreamt dreamed/dreamt|drink drank drunk|drive drove driven|
eat ate eaten|fall fell fallen|feed fed fed|feel felt felt|fight fought fought|find found found|flee fled fled|
fling flung flung|fly flew flown|forbid forbade forbidden|forecast forecast forecast|forget forgot forgotten|
forgive forgave forgiven|freeze froze frozen|get got got/gotten|give gave given|go went gone|grind ground ground|
grow grew grown|hang hung hung|have had had|hear heard heard|hide hid hidden|hit hit hit|hold held held|
hurt hurt hurt|keep kept kept|kneel knelt knelt|know knew known|lay laid laid|lead led led|lean leaned/leant leaned/leant|
leap leaped/leapt leaped/leapt|learn learned/learnt learned/learnt|leave left left|lend lent lent|let let let|
lie lay lain|light lit lit|lose lost lost|make made made|mean meant meant|meet met met|mislead misled misled|
mistake mistook mistaken|overcome overcame overcome|pay paid paid|prove proved proven/proved|put put put|quit quit quit|
read read read|ride rode ridden|ring rang rung|rise rose risen|run ran run|saw sawed sawn/sawed|say said said|
see saw seen|seek sought sought|sell sold sold|send sent sent|set set set|sew sewed sewn|shake shook shaken|
shed shed shed|shine shone shone|shoot shot shot|show showed shown|shrink shrank shrunk|shut shut shut|sing sang sung|
sink sank sunk|sit sat sat|sleep slept slept|slide slid slid|sling slung slung|slit slit slit|smell smelled/smelt smelled/smelt|
speak spoke spoken|speed sped sped|spell spelled/spelt spelled/spelt|spend spent spent|spill spilled/spilt spilled/spilt|
spin spun spun|spit spat spat|split split split|spoil spoiled/spoilt spoiled/spoilt|spread spread spread|
spring sprang sprung|stand stood stood|steal stole stolen|stick stuck stuck|sting stung stung|stink stank stunk|
strike struck struck|string strung strung|strive strove striven|swear swore sworn|sweep swept swept|swell swelled swollen|
swim swam swum|swing swung swung|take took taken|teach taught taught|tear tore torn|tell told told|think thought thought|
throw threw thrown|thrust thrust thrust|tread trod trodden|understand understood understood|undertake undertook undertaken|
upset upset upset|wake woke woken|wear wore worn|weave wove woven|weep wept wept|wet wet wet|win won won|wind wound wound|
withdraw withdrew withdrawn|wring wrung wrung|write wrote written|withstand withstood withstood|undergo underwent undergone|
oversee oversaw overseen|overtake overtook overtaken|override overrode overridden|outgrow outgrew outgrown|
rebuild rebuilt rebuilt|redo redid redone|rewrite rewrote rewritten|sell sold sold|uphold upheld upheld|
foresee foresaw foreseen|forsake forsook forsaken|bid bid bid|bust bust bust|dwell dwelt dwelt|plead pleaded/pled pleaded/pled|
""".replace("\n", "").split("|"):
    parts = line.split()
    if len(parts) == 3:
        IRREGULAR[parts[0]] = (parts[1].replace("/", " / "), parts[2].replace("/", " / "))

# Verbs of two or more syllables that double their last letter (stress on the end)
DOUBLE = set("""admit commit compel control equip excel expel extol forbid incur occur omit patrol permit prefer
propel rebel recur refer regret repel submit transfer transmit upset abhor acquit befit""".split())

# The parts of speech Wiktionary uses for each word type on the CEFR lists
WIKT_POS = {
    "pronoun": ["pronoun"], "determiner": ["determiner", "article"], "preposition": ["preposition"],
    "conjunction": ["conjunction"], "number": ["numeral", "number", "noun"], "modal verb": ["verb"],
    "particle": ["particle", "preposition"], "exclamation": ["interjection"],
}
# Core grammar words whose usual meaning is missing or misleading in the free sources (written for this app)
CORE_SENSES = {
    "the": [{"p": "determiner", "d": "Used before a noun when it is clear which person or thing you mean, because it has been mentioned or it is the only one.", "x": ["Close the door, please.", "The sun is very hot today."]}],
    "a": [{"p": "determiner", "d": "Used before a singular noun to mean one person or thing, but not a particular one.", "x": ["She has a dog.", "I need a new phone."]}],
    "an": [{"p": "determiner", "d": "The form of “a” used before a vowel sound.", "x": ["an apple", "an hour"]}],
    "my": [{"p": "determiner", "d": "Belonging to or connected with me.", "x": ["This is my phone.", "My sister lives in London."]}],
    "would": [
        {"p": "modal verb", "d": "Used to talk about something you imagine, or something that could happen.", "x": ["I would love to visit Japan.", "It would be nice to see you."]},
        {"p": "modal verb", "d": "Used to ask for something or offer something politely.", "x": ["Would you like some tea?", "Would you open the window?"]},
    ],
    "it": [{"p": "pronoun", "d": "Used for a thing, an animal or a situation that has already been mentioned.", "x": ["Where's my bag? I can't find it.", "It's raining again."]}],
    "every": [{"p": "determiner", "d": "All the people or things of a group, each one counted.", "x": ["I go running every morning.", "Every student has a book."]}],
    "other": [{"p": "determiner", "d": "Different from the one already mentioned, or the rest of a group.", "x": ["Where are the other students?", "I'll call you some other time."]}],
    "of": [{"p": "preposition", "d": "Shows that one thing belongs to, is part of, or is connected with another.", "x": ["a cup of tea", "the end of the film"]}],
    "with": [{"p": "preposition", "d": "Together with someone or something; having or using something.", "x": ["I live with my parents.", "She cut the bread with a knife."]}],
    "no": [
        {"p": "determiner", "d": "Not any; not one.", "x": ["There's no milk left.", "I have no idea."]},
        {"p": "exclamation", "d": "Used to give a negative answer or to disagree.", "x": ["“Are you tired?” “No, I'm fine.”"]},
    ],
    "will": [
        {"p": "modal verb", "d": "Used to talk about the future.", "x": ["I will call you tomorrow.", "It'll be cold tonight."]},
        {"p": "modal verb", "d": "Used to offer, promise or agree to do something.", "x": ["I'll help you with that.", "Don't worry, I won't tell anyone."]},
    ],
    "may": [
        {"p": "modal verb", "d": "Used to say that something is possible.", "x": ["It may rain later.", "She may not know yet."]},
        {"p": "modal verb", "d": "Used to ask for or give permission politely.", "x": ["May I come in?", "You may leave now."]},
    ],
    "might": [{"p": "modal verb", "d": "Used to say that something is possible but not certain.", "x": ["I might be late tonight.", "You might be right."]}],
    "could": [
        {"p": "modal verb", "d": "The past of “can”: was or were able to.", "x": ["I could swim when I was five."]},
        {"p": "modal verb", "d": "Used to say that something is possible, or to ask politely.", "x": ["It could be true.", "Could you help me, please?"]},
    ],
    "him": [{"p": "pronoun", "d": "Used for a man, boy or male animal, as the object of a verb or after a preposition.", "x": ["I saw him yesterday.", "Give it to him."]}],
    "his": [{"p": "determiner", "d": "Belonging to a man, boy or male animal already mentioned.", "x": ["This is his car.", "He lost his keys."]}],
    "about": [
        {"p": "preposition", "d": "On the subject of; connected with.", "x": ["a book about cats", "What are you talking about?"]},
        {"p": "adverb", "d": "A little more or less than; approximately.", "x": ["It takes about 20 minutes."]},
    ],
    "yeah": [{"p": "exclamation", "d": "An informal way of saying yes.", "x": ["“Are you coming?” “Yeah, wait a second.”"]}],
    "yes": [{"p": "exclamation", "d": "Used to give a positive answer or to agree.", "x": ["“Are you ready?” “Yes, let's go.”"]}],
    "well": [
        {"p": "adverb", "d": "In a good, skilful or satisfactory way.", "x": ["She speaks English very well.", "Did you sleep well?"]},
        {"p": "adjective", "d": "Healthy; not ill.", "x": ["I don't feel well today."]},
    ],
    "okay": [{"p": "adjective", "d": "Acceptable or good enough; all right.", "x": ["Is it okay if I sit here?", "The food was okay."]}],
    "off": [{"p": "adverb", "d": "Away from a place or a surface; not on or not working.", "x": ["Take your shoes off.", "Turn the light off, please."]}],
    "damn": [{"p": "exclamation", "d": "An impolite word people say when they are angry or annoyed.", "x": ["Damn! I've missed the bus."]}],
    "'s": [{"p": "verb", "d": "Short for “is” or “has”, or added to a name to show that something belongs to someone.", "x": ["She's my sister.", "It's been a long day.", "This is Anna's bag."]}],
}

# Senses whose wording would be rude in a learning app are left out
RUDE = re.compile(r"\b(fuck\w*|shit\w*|cunt|bitch\w*|whore|slut|nigg\w*|fag\w*|dick|pussy|cock|asshole|bastard)\b", re.I)

LETTER_SENSE = re.compile(r"^(The )?name of the .*letter|letter of the (Latin|English) alphabet", re.I)

FUNCTION_POS = {"pronoun", "preposition", "determiner", "conjunction", "number", "modal verb", "particle", "exclamation"}


def log(*args):
    print(*args, flush=True)


def clean_head(raw):
    """'a.m./A.M./am/AM' -> ('a.m.', ['A.M.', 'am', 'AM']); 'behavior/behaviour' -> ('behavior', ['behaviour'])"""
    parts = [p.strip() for p in raw.split("/") if p.strip()]
    return parts[0], parts[1:]


def slug(word):
    s = re.sub(r"[^a-z0-9]+", "-", word.lower().replace("'", "")).strip("-")
    return s or "word"


def vowel_groups(word):
    return len(re.findall(r"[aeiouy]+", word))


def verb_forms(base):
    """Third person, past, past participle and -ing form of a one-word verb"""
    if base in IRREGULAR:
        past, pp = IRREGULAR[base]
    else:
        past = pp = past_tense(base)
    third = (
        "is" if base == "be" else "has" if base == "have" else
        base + "es" if re.search(r"(s|sh|ch|x|z|o)$", base) else
        base[:-1] + "ies" if re.search(r"[^aeiou]y$", base) else base + "s"
    )
    return {"third": third, "past": past, "pastParticiple": pp, "ing": ing_form(base)}


def doubles(base):
    if base in DOUBLE:
        return True
    return vowel_groups(base) == 1 and re.search(r"[^aeiou][aeiou][bcdfgklmnprstvz]$", base) is not None


def past_tense(base):
    if base.endswith("e"):
        return base + "d"
    if re.search(r"[^aeiou]y$", base):
        return base[:-1] + "ied"
    if doubles(base):
        return base + base[-1] + "ed"
    return base + "ed"


def ing_form(base):
    if base in ("be", "see", "flee", "agree", "free", "guarantee", "dye", "singe"):
        return base + "ing"
    if base.endswith("ie"):
        return base[:-2] + "ying"
    if base.endswith("e") and not base.endswith(("ee", "ye", "oe")):
        return base[:-1] + "ing"
    if doubles(base):
        return base + base[-1] + "ing"
    return base + "ing"


def first_text(value):
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return value.get("text") or ""
    return ""


def main(folder):
    folder = Path(folder)
    out = Path(__file__).resolve().parent.parent / "data" / "dictionary.json.gz"

    # ---------- levels ----------
    words = {}  # key -> info
    for file in ("cefrj.csv", "octanove.csv"):
        with open(folder / file, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if not row["headword"].strip() or row["CEFR"] not in LEVELS:
                    continue
                head, variants = clean_head(row["headword"])
                key = head.lower()
                pos = CEFR_POS.get(row["pos"].strip(), "")
                info = words.setdefault(key, {"word": head, "variants": [], "level": row["CEFR"], "pos": [], "posLevel": {}, "official": True})
                # "it" and "IT" are one entry; show the everyday lowercase spelling
                if head == key and info["word"] != head:
                    info["word"] = head
                if LEVELS.index(row["CEFR"]) < LEVELS.index(info["level"]):
                    info["level"] = row["CEFR"]
                if pos and pos not in info["pos"]:
                    info["pos"].append(pos)
                if pos:
                    lv = LEVELS.index(row["CEFR"])
                    info["posLevel"][pos] = min(lv, info["posLevel"].get(pos, lv))
                for v in variants:
                    if v.lower() != key and v not in info["variants"]:
                        info["variants"].append(v)
    for info in words.values():
        tie = ["verb", "noun", "adjective", "adverb"]
        info["pos"].sort(key=lambda p: (info["posLevel"].get(p, 9), tie.index(p) if p in tie else len(tie)))
    log("levelled words:", len(words))

    # ---------- WordNet ----------
    z = zipfile.ZipFile(folder / "oewn.zip")
    entries = {}
    synsets = {}
    for name in z.namelist():
        data = json.loads(z.read(name))
        if name.startswith("entries-"):
            entries.update(data)
        elif name not in ("frames.json",):
            lex = name[:-5]
            for sid, syn in data.items():
                syn["lex"] = lex
                synsets[sid] = syn
    sense_lemma = {}
    for lemma, by_pos in entries.items():
        for pos, entry in by_pos.items():
            for sense in entry.get("sense", []):
                sense_lemma[sense["id"]] = lemma
    lower_lemmas = {l for l in entries if l == l.lower()}
    log("wordnet entries:", len(entries), "synsets:", len(synsets))

    # ---------- frequency ----------
    freq = {}
    with open(folder / "freq50k.txt", encoding="utf-8") as f:
        for i, line in enumerate(f):
            parts = line.split()
            if len(parts) == 2 and parts[0] not in freq:
                freq[parts[0]] = i + 1

    # ---------- top up to 10,000 with common real words ----------
    def is_inflection(w):
        for suffix, base_options in (("ies", ["y"]), ("es", [""]), ("s", [""]), ("ied", ["y"]), ("ed", ["", "e"]),
                                     ("ing", ["", "e"]), ("er", ["", "e"]), ("est", ["", "e"]), ("ly", [""])):
            if w.endswith(suffix) and len(w) > len(suffix) + 2:
                stem = w[: -len(suffix)]
                for b in base_options:
                    if stem + b in words or (len(stem) > 2 and stem[-1] == stem[-2] and stem[:-1] in words):
                        return suffix != "ly"
        return False

    irregular_forms = {f for p, pp in IRREGULAR.values() for f in (p.split(" / ") + pp.split(" / "))}
    for w, rank in sorted(freq.items(), key=lambda x: x[1]):
        if len(words) >= TOP_UP:
            break
        if w in words or w in BLOCK or not re.fullmatch(r"[a-z]{3,}", w) or w not in lower_lemmas:
            continue
        if w in irregular_forms or is_inflection(w):
            continue
        by_pos = entries[w]
        poses = [POS_NAME[p] for p in by_pos if p in POS_NAME]
        if not poses:
            continue
        words[w] = {"word": w, "variants": [], "level": "C1" if rank <= 12000 else "C2", "pos": list(dict.fromkeys(poses)), "official": False}
    log("after top-up:", len(words))

    # ---------- pronunciation ----------
    def read_ipa(file):
        table = {}
        with open(folder / file, encoding="utf-8") as f:
            for line in f:
                if "\t" in line:
                    w, ipa = line.rstrip("\n").split("\t", 1)
                    table.setdefault(w.lower(), ipa.split(",")[0].strip())
        return table

    ipa_us, ipa_uk = read_ipa("ipa_us.txt"), read_ipa("ipa_uk.txt")

    # ---------- grammar words WordNet does not cover ----------
    cache_file = folder / "dictapi_cache.json"
    cache = json.loads(cache_file.read_text(encoding="utf-8")) if cache_file.exists() else {}
    # Only answers are cached ([] means "no entry"); failed requests are tried again on the next run
    cache = {k: v for k, v in cache.items() if v is not None}

    def free_dictionary(word):
        if word in cache:
            return cache[word]
        url = "https://api.dictionaryapi.dev/api/v2/entries/en/" + urllib.parse.quote(word)
        result = None
        for attempt in range(4):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "SpeakBetter dictionary build"}), timeout=20) as r:
                    result = json.loads(r.read().decode("utf-8"))
                break
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    result = []
                    break
                # 429: the free service asks us to slow down
                time.sleep(15 if e.code == 429 else 3 + attempt * 3)
            except Exception:
                time.sleep(3 + attempt * 3)
        if result is not None:
            cache[word] = result
            cache_file.write_text(json.dumps(cache), encoding="utf-8")
        time.sleep(1.1)
        return result

    # ---------- entries ----------
    built = []
    needs_api = 0
    for key, info in words.items():
        word = info["word"]
        # WordNet keeps the capital on names of months, days, languages ("April", "English")
        lemma = next((c for c in (key, word, key.replace(" ", "_"), word.replace(" ", "_"), key.capitalize()) if c in entries), None)
        wn = entries.get(lemma, {}) if lemma else {}
        senses, topics, family, antonyms_all = [], [], [], []
        pron = {}
        forms = {}
        per_pos = defaultdict(int)
        wn_pos_order = sorted(wn.keys(), key=lambda p: (info["pos"].index(POS_NAME.get(p, "")) if POS_NAME.get(p, "") in info["pos"] else 9))
        for p in wn_pos_order:
            entry = wn[p]
            for pr in entry.get("pronunciation", []):
                v = pr.get("variety")
                if v in ("US", "GB") and v not in pron:
                    pron[v] = "/" + pr["value"] + "/"
            for sense in entry.get("sense", []):
                syn = synsets.get(sense["synset"])
                if not syn:
                    continue
                pos_name = POS_NAME.get(p, p)
                for rel in ("derivation", "pertainym"):
                    for sid in sense.get(rel, []):
                        lem = sense_lemma.get(sid)
                        if lem and lem != lemma and lem not in family and "_" not in lem and lem == lem.lower():
                            family.append(lem)
                ants = [sense_lemma[s] for s in sense.get("antonym", []) if s in sense_lemma]
                if len(senses) >= MAX_SENSES or per_pos[pos_name] >= MAX_SENSES_PER_POS:
                    continue
                per_pos[pos_name] += 1
                topic = TOPIC.get(syn["lex"])
                if topic and topic not in topics:
                    topics.append(topic)
                definition = (syn.get("definition") or [""])[0]
                if RUDE.search(definition):
                    continue
                examples = [e for e in (first_text(x) for x in syn.get("example", [])) if not RUDE.search(e)][:2]
                synonyms = [m.replace("_", " ") for m in syn.get("members", []) if m.lower() != key and m != lemma][:MAX_SYNONYMS]
                senses.append({
                    "p": pos_name,
                    "d": definition,
                    **({"x": [e for e in examples if e]} if any(examples) else {}),
                    **({"syn": synonyms} if synonyms else {}),
                    **({"ant": [a.replace("_", " ") for a in ants][:4]} if ants else {}),
                })
            if p == "v" and " " not in key and "modal verb" not in info["pos"]:
                forms.update(verb_forms(key))
            elif p == "n" and entry.get("form") and "plural" not in forms:
                forms["plural"] = entry["form"][0]
            elif p in ("a", "s") and entry.get("form") and len(entry["form"]) >= 2 and "comparative" not in forms:
                comp = sorted(entry["form"], key=len)
                forms["comparative"], forms["superlative"] = comp[0], comp[-1]

        # Grammar words (the, of, she, can ...) and words WordNet does not know: meanings from Wiktionary
        if not senses or any(p in FUNCTION_POS for p in info["pos"]):
            needs_api += 1
            api = free_dictionary(word)
            if isinstance(api, list) and api:
                extra = []
                for e in api:
                    for m in e.get("meanings", []):
                        pos_name = m.get("partOfSpeech", "")
                        for d in m.get("definitions", [])[:3]:
                            if not d.get("definition") or LETTER_SENSE.search(d["definition"]) or RUDE.search(d["definition"]):
                                continue
                            extra.append({
                                "p": pos_name,
                                "d": d["definition"],
                                **({"x": [d["example"]]} if d.get("example") and not RUDE.search(d["example"]) else {}),
                                **({"syn": d["synonyms"][:MAX_SYNONYMS]} if d.get("synonyms") else {}),
                                **({"ant": d["antonyms"][:4]} if d.get("antonyms") else {}),
                            })
                    for ph in e.get("phonetics", []):
                        t = ph.get("text")
                        if t and "US" not in pron and "-us" in (ph.get("audio") or ""):
                            pron["US"] = t
                        if t and "GB" not in pron and "-uk" in (ph.get("audio") or ""):
                            pron["GB"] = t
                # The word's own word type first ("I": pronoun, not the letter; "the": article, not adverb)
                wanted = [w for p in info["pos"] for w in WIKT_POS.get(p, [p])]
                extra.sort(key=lambda x: wanted.index(x["p"]) if x["p"] in wanted else len(wanted))
                extra = extra[:6]
                # Grammar words: Wiktionary's grammar senses first, WordNet's (often odd) senses after
                senses = (extra + senses)[:MAX_SENSES] if any(p in FUNCTION_POS for p in info["pos"]) else (senses or extra)
        # Meanings follow the word's types in level order (Wiktionary's names mapped to the list's)
        order = [w for p in info["pos"] for w in [p, *WIKT_POS.get(p, [])]]
        senses.sort(key=lambda x: order.index(x["p"]) if x["p"] in order else len(order))
        # Hand-written senses for core words always come first
        if key in CORE_SENSES:
            senses = (CORE_SENSES[key] + senses)[:MAX_SENSES]
        if not senses:
            continue

        us = pron.get("US") or (ipa_us.get(key) and ipa_us[key])
        uk = pron.get("GB") or (ipa_uk.get(key) and ipa_uk[key])
        entry_out = {
            "id": slug(word),
            "w": word,
            "lv": info["level"],
            **({"est": True} if not info["official"] else {}),
            "pos": info["pos"] or list(dict.fromkeys(s["p"] for s in senses)),
            **({"ipa": {k: v for k, v in (("us", us), ("uk", uk)) if v}} if us or uk else {}),
            "s": senses,
            **({"f": forms} if forms else {}),
            **({"fam": family[:8]} if family else {}),
            **({"t": topics[:2]} if topics else {}),
            **({"alt": info["variants"]} if info["variants"] else {}),
            "_freq": freq.get(key, 10**7),
            "_lvl": LEVELS.index(info["level"]),
        }
        built.append(entry_out)
    log("built entries:", len(built), "grammar-word lookups:", needs_api)

    # Unique ids ("can" the verb and "can" the noun are one entry already; different spellings may collide)
    seen = set()
    for e in built:
        base, n = e["id"], 2
        while e["id"] in seen:
            e["id"] = f"{base}-{n}"
            n += 1
        seen.add(e["id"])

    # Rank: most common first (subtitle frequency), words the frequency list lacks go after, easier levels first
    built.sort(key=lambda e: (e["_freq"], e["_lvl"], e["w"].lower()))
    for i, e in enumerate(built):
        e["r"] = i + 1
    built = built[:TARGET]

    # ---------- real example sentences (Tatoeba) ----------
    form_to_ids = defaultdict(set)
    for e in built:
        w = e["w"].lower()
        if " " in w:
            continue
        for f in {w, *(x for v in e.get("f", {}).values() for x in v.split(" / ")), w + "s"}:
            form_to_ids[f].add(e["id"])
    examples = defaultdict(list)
    openings = defaultdict(set)
    good = re.compile(r"^[A-Z][A-Za-z ,'’\-]*[a-z][.?!]$")
    with bz2.open(folder / "tatoeba.tsv.bz2", "rt", encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) != 3:
                continue
            sid, _, text = parts
            if not (24 <= len(text) <= 90) or not good.match(text) or RUDE.search(text):
                continue
            tokens = re.findall(r"[a-z']+", text.lower())
            if not (5 <= len(tokens) <= 14):
                continue
            opening = " ".join(tokens[:3])
            for t in set(tokens):
                for wid in form_to_ids.get(t, ()):
                    if len(examples[wid]) < MAX_EXAMPLES and opening not in openings[wid]:
                        examples[wid].append([text, int(sid)])
                        openings[wid].add(opening)
    for e in built:
        if examples.get(e["id"]):
            e["ex"] = examples[e["id"]]
        e.pop("_freq", None)
        e.pop("_lvl", None)

    # ---------- made-up words for the size test (spotting guesses) ----------
    rng = random.Random(7)
    onsets = "b bl br c cl cr d dr f fl fr g gl gr h j k l m n p pl pr r s sc sk sl sm sn sp st str sw t tr v w".split()
    vowels = "a e i o u ai ea ee oo ou".split()
    codas = "b d ft g k l ld lk m mp n nd nk nt p r rd rk rm rn s sh sk st t th x".split()
    endings = ["", "", "", "le", "er", "ish", "ent", "ous", "ate", "ity", "ment", "y"]
    known = set(freq) | lower_lemmas | set(ipa_us) | set(ipa_uk) | {e["w"].lower() for e in built}
    nonwords = set()
    while len(nonwords) < NONWORDS:
        syllables = rng.choice([1, 2, 2, 3])
        w = "".join(rng.choice(onsets) + rng.choice(vowels) + (rng.choice(codas) if i == syllables - 1 or rng.random() < 0.4 else "") for i in range(syllables))
        w += rng.choice(endings)
        if 4 <= len(w) <= 10 and w not in known and not re.search(r"(.)\1\1", w):
            nonwords.add(w)

    data = {
        "version": 1,
        "count": len(built),
        "levels": LEVELS,
        "words": built,
        "nonwords": sorted(nonwords),
        "sources": [
            {"name": "CEFR-J Wordlist 1.5", "by": "Tono Laboratory, Tokyo University of Foreign Studies", "url": "http://www.cefr-j.org/", "use": "word levels A1-B2"},
            {"name": "Octanove Vocabulary Profile C1/C2", "by": "Octanove Labs", "url": "https://github.com/openlanguageprofiles/olp-en-cefrj", "license": "CC BY-SA 4.0", "use": "word levels C1-C2"},
            {"name": "Open English WordNet 2025", "by": "Global WordNet Association", "url": "https://en-word.net/", "license": "CC BY 4.0", "use": "meanings, examples, synonyms, opposites, word families, pronunciation"},
            {"name": "ipa-dict", "by": "open-dict-data", "url": "https://github.com/open-dict-data/ipa-dict", "license": "MIT", "use": "pronunciation"},
            {"name": "FrequencyWords (OpenSubtitles 2018)", "by": "Hermit Dave", "url": "https://github.com/hermitdave/FrequencyWords", "license": "CC BY-SA 4.0", "use": "how common each word is"},
            {"name": "Tatoeba", "by": "Tatoeba contributors", "url": "https://tatoeba.org/", "license": "CC BY 2.0 FR", "use": "example sentences"},
            {"name": "Free Dictionary API (Wiktionary)", "by": "Wiktionary contributors", "url": "https://dictionaryapi.dev/", "license": "CC BY-SA 3.0", "use": "meanings of grammar words"},
        ],
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with gzip.open(out, "wb", compresslevel=9) as f:
        f.write(raw)
    with_ex = sum(1 for e in built if e.get("ex"))
    with_ipa = sum(1 for e in built if e.get("ipa"))
    by_level = {lv: sum(1 for e in built if e["lv"] == lv) for lv in LEVELS}
    log(f"wrote {out} ({len(raw) / 1e6:.1f} MB raw) words={len(built)} examples={with_ex} ipa={with_ipa} levels={by_level}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1])
