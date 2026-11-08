"""
Fetches English phrasal verbs, idioms and proverbs from English Wiktionary (CC BY-SA) for build-phrases.py.

It reads the category lists with the MediaWiki API, then the page text of the entries 50 at a time (Wikimedia's
guidance is to be gentle and to identify yourself, so requests are made one after the other with a pause). Only the
English part of each page is kept. Answers are appended to <folder>/wiktionary_phrases.jsonl as they arrive, so an
interrupted run continues where it stopped.

Usage:
  python -I scripts/fetch-wiktionary-phrases.py <folder to save into>
"""

import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

AGENT = "SpeakBetter-vocab-build/1.0 (English learning app; builds a phrase list from Wiktionary)"
API = "https://en.wiktionary.org/w/api.php"
CATEGORIES = {
    "phrasal verb": "Category:English phrasal verbs",
    "idiom": "Category:English idioms",
    "proverb": "Category:English proverbs",
}
BATCH = 50
PAUSE = 1.5  # seconds between requests


def get(params, retries=8):
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                wait = e.headers.get("Retry-After")
                time.sleep(min(300, float(wait) + 2 if wait and wait.replace(".", "").isdigit() else 20 * (attempt + 1)))
            else:
                time.sleep(3 * (attempt + 1))
        except Exception:
            time.sleep(3 * (attempt + 1))
    return None


def members(category):
    """The page titles directly in a category"""
    titles, cont = [], {}
    while True:
        data = get({"action": "query", "list": "categorymembers", "cmtitle": category, "cmlimit": "500", "cmtype": "page", "format": "json", **cont})
        if not data:
            break
        titles += [m["title"] for m in data["query"]["categorymembers"] if m["ns"] == 0]
        if "continue" not in data:
            break
        cont = {"cmcontinue": data["continue"]["cmcontinue"]}
        time.sleep(PAUSE)
    return titles


def english_section(text):
    """The part of a Wiktionary page that is about English"""
    m = re.search(r"(?m)^==\s*English\s*==\s*$", text)
    if not m:
        return ""
    rest = text[m.end():]
    nxt = re.search(r"(?m)^==[^=].*?==\s*$", rest)
    return rest[: nxt.start()] if nxt else rest


def main(folder):
    folder = Path(folder)
    out = folder / "wiktionary_phrases.jsonl"
    done = set()
    if out.exists():
        for line in out.read_text(encoding="utf-8").splitlines():
            try:
                done.add(json.loads(line)["title"])
            except Exception:
                pass
    print("already fetched:", len(done), flush=True)

    kinds = {}
    for kind, cat in CATEGORIES.items():
        found = members(cat)
        print(f"{cat}: {len(found)} entries", flush=True)
        for t in found:
            kinds.setdefault(t, kind)
    todo = sorted(t for t in kinds if t not in done)
    print("to fetch:", len(todo), flush=True)

    start, fetched, empty = time.time(), 0, 0
    for i in range(0, len(todo), BATCH):
        batch = todo[i : i + BATCH]
        data = get({
            "action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main", "titles": "|".join(batch),
            "format": "json", "formatversion": "2", "redirects": "0",
        })
        if not data:
            print("a batch failed; run again to continue", flush=True)
            continue
        pages = {p["title"]: p for p in data["query"]["pages"]}
        with open(out, "a", encoding="utf-8") as f:
            for title in batch:
                page = pages.get(title, {})
                revs = page.get("revisions") or []
                text = revs[0]["slots"]["main"]["content"] if revs else ""
                english = english_section(text)
                if not english:
                    empty += 1
                f.write(json.dumps({"title": title, "kind": kinds[title], "wikitext": english}, ensure_ascii=False) + "\n")
        fetched += len(batch)
        if (i // BATCH) % 10 == 0:
            print(f"{fetched}/{len(todo)} fetched, no English text: {empty}, {time.time() - start:.0f}s", flush=True)
        time.sleep(PAUSE)
    print("finished", flush=True)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1])
