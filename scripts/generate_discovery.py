"""Generate nonvisual discovery files from index.html (Python 3.8+, no packages).

Run after editing the page; --check reports stale outputs without changing files.
"""

import argparse
import json
import re
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]
VOID = set("area base br col embed hr img input link meta param source track wbr".split())


class Node:
    def __init__(self, tag="", attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def has_class(self, name):
        return name in self.attrs.get("class", "").split()

    def find(self, tag=None, cls=None):
        for child in self.children:
            if isinstance(child, Node):
                if (tag is None or child.tag == tag) and (cls is None or child.has_class(cls)):
                    yield child
                yield from child.find(tag, cls)

    def text(self):
        return "".join(c.text() if isinstance(c, Node) else c for c in self.children)


class Document(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def clean(value):
    return re.sub(r"\s+", " ", value).strip()


def first(node, tag=None, cls=None):
    return next(node.find(tag, cls))


def markdown(node, base):
    if isinstance(node, str):
        return re.sub(r"\s+", " ", node)
    if node.has_class("folio") or node.tag in {"script", "style", "h1"}:
        return ""
    if node.tag == "video":
        video = first(node, "source")
        return "\n\n[Short film]({})\n\n".format(urljoin(base, video.attrs["src"]))
    if node.tag == "img":
        return "\n\n![{}]({})\n\n".format(node.attrs.get("alt", ""), urljoin(base, node.attrs["src"]))
    text = "".join(markdown(c, base) for c in node.children).strip()
    if node.tag == "a":
        return " [{}]({}) ".format(text, urljoin(base, node.attrs["href"]))
    if node.tag == "br":
        return "\n"
    if node.tag in {"h2", "h3", "h4"}:
        return "\n\n{} {}\n\n".format("#" * int(node.tag[1]), text)
    if node.tag == "li":
        return "\n" + (text if node.has_class("pub") else "- " + clean(text)) + "\n"
    if node.tag in {"p", "div", "ul", "ol"}:
        return "\n\n" + text + "\n\n"
    return text + " "


def generate(source):
    doc = Document(source).root
    base = next(n.attrs["href"] for n in doc.find("link") if n.attrs.get("rel") == "canonical")
    title = first(doc, "title").text()
    bio = first(doc, cls="bio")
    description = "Hang Yu, Ph.D. candidate at Tufts University researching Human–Robot Interaction (HRI), Robot Learning, VLAs, and Agentic Robotics. Publications, datasets, code, and CV."
    social = list(first(bio, cls="social").find("a"))
    profiles = [n.attrs["href"] for n in social if n.attrs["href"].startswith("https:")]
    person_id, page_id = base + "#person", base + "#profile"
    person = {
        "@type": "Person", "@id": person_id, "name": "Hang Yu",
        "alternateName": clean(first(bio, cls="cn").text()), "url": base,
        "image": urljoin(base, first(first(doc, cls="portrait"), "img").attrs["src"]),
        "description": clean(first(bio, cls="text").text()),
        "jobTitle": "Ph.D. Candidate",
        "affiliation": {"@type": "CollegeOrUniversity", "name": "Tufts University"},
        "email": next(n.attrs["href"] for n in social if n.attrs["href"].startswith("mailto:")),
        "sameAs": profiles,
        "mainEntityOfPage": {"@id": page_id},
        "subjectOf": {"@type": "DigitalDocument", "name": "Hang Yu — Curriculum Vitae", "url": urljoin(base, "assets/cv.pdf"), "encodingFormat": "application/pdf"},
    }
    books = list(doc.find("article", "book"))
    publications = []
    for pub in doc.find("li", "pub"):
        name = clean(first(pub, "h4").text())
        links = list(pub.find("a"))
        venue = first(pub, cls="venue")
        image_path = first(pub, "img").attrs["src"]
        item = {
            "@type": "ScholarlyArticle",
            "@id": base + "#publication-" + Path(image_path).stem,
            "name": name,
            "url": urljoin(base, links[0].attrs["href"]) if links else base + "#publications",
            "image": urljoin(base, image_path),
            "isPartOf": {"@type": "CreativeWork", "name": clean(venue.text())},
            "mainEntityOfPage": {"@id": page_id},
        }
        authors = list(pub.find(cls="authors"))
        if authors:
            item["author"] = []
            for author in clean(authors[0].text()).rstrip(".").split(","):
                author = author.strip().rstrip("*")
                item["author"].append({"@id": person_id} if author == "Hang Yu" else {"@type": "Person", "name": author})
        year = re.search(r"\b(?:19|20)\d{2}\b", venue.text())
        if year:
            item["datePublished"] = year.group()
        for link in links:
            href = link.attrs["href"]
            if "doi.org/" in href or "dl.acm.org/doi/" in href:
                doi = href.split("doi.org/")[-1] if "doi.org/" in href else href.split("/doi/")[-1]
                item["identifier"] = {"@type": "PropertyValue", "propertyID": "DOI", "value": doi}
            if clean(link.text()) == "PDF":
                item["encoding"] = {"@type": "MediaObject", "contentUrl": href, "encodingFormat": "application/pdf"}
            elif clean(link.text()) in {"Code", "Dataset", "Dataset / Code"}:
                item.setdefault("subjectOf", []).append({"@type": "WebPage", "name": clean(link.text()), "url": href})
        publications.append(item)

    sections = [{"@type": "WebPageElement", "@id": base + "#" + b.attrs["id"], "name": clean(first(b, cls="c-title").text())} for b in books]
    page = {
        "@type": "ProfilePage", "@id": page_id, "url": base, "name": title,
        "description": description, "inLanguage": "en", "mainEntity": {"@id": person_id},
        "isPartOf": {"@id": base + "#website"}, "hasPart": sections,
        "mentions": [{"@id": p["@id"]} for p in publications],
    }
    graph = {"@context": "https://schema.org", "@graph": [
        {"@type": "WebSite", "@id": base + "#website", "url": base, "name": "Hang Yu", "inLanguage": "en", "publisher": {"@id": person_id}},
        page, person,
    ] + publications}
    data = json.dumps(graph, ensure_ascii=False, indent=2) + "\n"

    # Replace only metadata; retain the title, all styles, and the entire body.
    head_start = source.index('  <meta name="description"')
    head_end = source.index('  <link rel="preconnect"', head_start)
    meta = [
        '<meta name="description" content="{}">'.format(escape(description, quote=True)),
        '<meta name="author" content="Hang Yu">',
        '<link rel="canonical" href="{}">'.format(base),
        '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">',
        '<meta name="theme-color" content="#cbd6dd">',
        '<link rel="sitemap" type="application/xml" href="{}sitemap.xml">'.format(base),
        '<link rel="describedby" type="text/plain" href="{}llms.txt" title="Information for agents">'.format(base),
        '<link rel="alternate" type="text/plain" href="{}llms-full.txt" title="Plain-text profile and publications">'.format(base),
        '<link rel="alternate" type="application/ld+json" href="{}profile.jsonld" title="Structured profile and publications">'.format(base),
    ]
    values = {"og:type": "profile", "og:site_name": "Hang Yu", "og:locale": "en_US", "og:title": title,
              "og:description": description, "og:url": base, "og:image": person["image"],
              "og:image:alt": "Photo of Hang Yu", "og:image:type": "image/jpeg",
              "twitter:card": "summary", "twitter:title": title, "twitter:description": description,
              "twitter:image": person["image"], "twitter:image:alt": "Photo of Hang Yu"}
    for key, value in values.items():
        meta.append('<meta {}="{}" content="{}">'.format("property" if key.startswith("og:") else "name", key, escape(value, quote=True)))
    updated = source[:head_start] + "".join("  " + line + "\n" for line in meta) + "\n" + source[head_end:]
    embedded = '  <script type="application/ld+json">\n' + data.replace("</", "<\\/") + "  </script>"
    updated, count = re.subn(r'  <script type="application/ld\+json">.*?</script>', lambda m: embedded, updated, flags=re.S)
    if count != 1:
        raise ValueError("Expected exactly one JSON-LD block")
    assert updated.split("<body>", 1)[1] == source.split("<body>", 1)[1]

    full = "# " + clean(first(bio, "h1").text()) + "\n\nSource: " + base + "\n\n"
    full += markdown(bio, base) + "\n\n"
    for book in books:
        pages = list(book.find(cls="page-inner"))
        pages.sort(key=lambda p: not p.has_class("page-left"))
        for content in pages:
            full += markdown(content, base) + "\n\n"
    full = re.sub(r"\n[ \t]+", "\n", full)
    full = re.sub(r"[ \t]+\n", "\n", full)
    full = re.sub(r"\n{3,}", "\n\n", full).strip() + "\n"

    llms = "# Hang Yu (余航)\n\n> " + description + "\n\n"
    llms += "This is Hang Yu's academic website. The HTML page is the source of truth; the text and JSON-LD copies are generated from it. Dates and roles reflect the page as written.\n\n"
    llms += "## Profile and research\n\n"
    for label, path, note in [
        ("Full profile and publications", "llms-full.txt", "Plain-text biography, education, all listed publications and resource links, service, and contact information."),
        ("Structured data", "profile.jsonld", "Schema.org JSON-LD with person, profile, and publication records."),
        ("Academic homepage", "", "Interactive website with the same public information."),
        ("Curriculum vitae", "assets/cv.pdf", "Downloadable PDF."),
    ]:
        llms += "- [{}]({}): {}\n".format(label, urljoin(base, path), note)
    llms += "\n## Profiles\n\n"
    for link in social:
        if link.attrs["href"] in profiles:
            llms += "- [{}]({})\n".format(clean(link.text()), link.attrs["href"])
    return {"index.html": updated, "profile.jsonld": data, "llms.txt": llms, "llms-full.txt": full}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    source = (ROOT / "index.html").read_text(encoding="utf-8")
    outputs = generate(source)
    stale = []
    for name, content in outputs.items():
        path = ROOT / name
        if not path.exists() or path.read_text(encoding="utf-8") != content:
            stale.append(name)
            if not args.check:
                # Preserve the HTML's newline convention as well as its body.
                newline = "\r\n" if name == "index.html" and b"\r\n" in path.read_bytes() else "\n"
                path.write_bytes(content.replace("\n", newline).encode("utf-8"))
    if args.check and stale:
        parser.exit(1, "Stale discovery files: " + ", ".join(stale) + "\nRun python scripts/generate_discovery.py\n")
    print(("Updated: " + ", ".join(stale)) if stale else "Discovery files are up to date.")


if __name__ == "__main__":
    main()
