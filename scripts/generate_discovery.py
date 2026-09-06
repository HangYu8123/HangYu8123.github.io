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
    books = list(doc.find("article", "book"))
    by_id = {b.attrs["id"]: b for b in books}
    # Research topics and keywords come from the About book; honors from the Experience book.
    knows = []
    for meta_node in by_id["about"].find("div", "meta"):
        for part in re.split(r"\s*[•,]\s*", clean(meta_node.text())):
            if part and part not in knows:
                knows.append(part)
    awards = [clean(li.text()) for entry in by_id["experience"].find("div", "entry")
              if clean(first(entry, cls="kicker").text()).startswith("Honors") for li in entry.find("li")]
    cn = clean(first(bio, cls="cn").text())
    tufts = {"@type": "CollegeOrUniversity", "name": "Tufts University", "url": "https://www.tufts.edu/",
             "sameAs": "https://en.wikipedia.org/wiki/Tufts_University"}
    lab = {"@type": "ResearchOrganization", "name": "Assistive Agent and Behavior Learning Lab (AABL)", "alternateName": "AABL Lab",
           "url": "https://aabl.cs.tufts.edu/", "parentOrganization": {"@type": "CollegeOrUniversity", "name": "Tufts University"}}
    person = {
        "@type": "Person", "@id": person_id, "name": "Hang Yu", "givenName": "Hang", "familyName": "Yu",
        "alternateName": [cn, "Hang Yu ({})".format(cn), "H. Yu"], "url": base,
        "image": urljoin(base, first(first(doc, cls="portrait"), "img").attrs["src"]),
        "description": clean(first(bio, cls="text").text()),
        "jobTitle": "Ph.D. Candidate in Computer Science",
        # The current role and affiliations are stated on the page; update these when they change.
        "affiliation": [tufts, lab],
        "memberOf": lab,
        "worksFor": [{"@type": "Organization", "name": "ABB Robotics", "url": "https://new.abb.com/products/robotics"}, tufts],
        "alumniOf": tufts,
        "knowsAbout": knows,
        "knowsLanguage": ["en", "zh"],
        "award": awards,
        "email": next(n.attrs["href"] for n in social if n.attrs["href"].startswith("mailto:")),
        "sameAs": profiles,
        "mainEntityOfPage": {"@id": page_id},
        "subjectOf": {"@type": "DigitalDocument", "name": "Hang Yu — Curriculum Vitae", "url": urljoin(base, "assets/cv.pdf"), "encodingFormat": "application/pdf"},
    }
    publications, resources = [], []
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
        identifiers, same_as = [], []
        for link in links:
            href = link.attrs["href"]
            label = clean(link.text())
            if "doi.org/" in href or "dl.acm.org/doi/" in href:
                doi = href.split("doi.org/")[-1] if "doi.org/" in href else href.split("/doi/")[-1]
                identifiers.append({"@type": "PropertyValue", "propertyID": "DOI", "value": doi})
                same_as.append("https://doi.org/" + doi)
            elif "arxiv.org/abs/" in href:
                identifiers.append({"@type": "PropertyValue", "propertyID": "arXiv", "value": href.split("arxiv.org/abs/")[-1]})
                same_as.append(href)
            if label == "PDF":
                item["encoding"] = {"@type": "MediaObject", "contentUrl": href, "encodingFormat": "application/pdf"}
            elif label in {"Code", "Dataset", "Dataset / Code"}:
                # Datasets and code get their own nodes; Google Dataset Search reads Dataset markup.
                is_data = label.startswith("Dataset")
                resource = {
                    "@type": "Dataset" if is_data else "SoftwareSourceCode",
                    "@id": item["@id"] + ("-dataset" if is_data else "-code"),
                    "name": "{} ({})".format(name, "dataset" if is_data else "code"),
                    "description": '{} released with the paper "{}" ({}).'.format(
                        "Dataset and code" if label == "Dataset / Code" else label, name, clean(venue.text()).rstrip(".")),
                    "url": href, "isAccessibleForFree": True, "citation": {"@id": item["@id"]},
                }
                if is_data:
                    resource["creator"] = item.get("author", [{"@id": person_id}])
                else:
                    resource["codeRepository"] = href
                resources.append(resource)
                item.setdefault("subjectOf", []).append({"@id": resource["@id"]})
        if identifiers:
            item["identifier"] = identifiers if len(identifiers) > 1 else identifiers[0]
        if same_as:
            item["sameAs"] = same_as
        publications.append(item)

    sections = [{"@type": "WebPageElement", "@id": base + "#" + b.attrs["id"], "name": clean(first(b, cls="c-title").text())} for b in books]
    page = {
        "@type": "ProfilePage", "@id": page_id, "url": base, "name": title,
        "description": description, "inLanguage": "en", "mainEntity": {"@id": person_id},
        "isPartOf": {"@id": base + "#website"}, "hasPart": sections,
        "mentions": [{"@id": p["@id"]} for p in publications + resources],
    }
    graph = {"@context": "https://schema.org", "@graph": [
        {"@type": "WebSite", "@id": base + "#website", "url": base, "name": "Hang Yu", "inLanguage": "en",
         "author": {"@id": person_id}, "publisher": {"@id": person_id}},
        page, person,
    ] + publications + resources}
    data = json.dumps(graph, ensure_ascii=False, indent=2) + "\n"

    # Replace only metadata; retain the title, all styles, and the entire body.
    head_start = source.index('  <meta name="description"')
    head_end = source.index('  <link rel="preconnect"', head_start)
    # Link-preview card: a 1200x630 crop of assets/img/icon.jpg (the original is 11 MB, which preview scrapers reject).
    card = urljoin(base, "assets/img/og-image.jpg")
    card_alt = "Hang Yu standing next to a robot; Ph.D. candidate in Human-Robot Interaction and Robot Learning at Tufts University"
    meta = [
        '<meta name="description" content="{}">'.format(escape(description, quote=True)),
        '<meta name="author" content="Hang Yu">',
        '<meta name="keywords" content="Hang Yu, {}, Tufts University, Human-Robot Interaction, HRI, Robot Learning, RLHF, Interactive Reinforcement Learning, Learning from Demonstration, Vision-Language-Action, VLA, Agentic Robotics, AABL Lab, ABB Robotics">'.format(cn),
        '<link rel="canonical" href="{}">'.format(base),
        '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">',
        '<meta name="theme-color" content="#cbd6dd">',
        '<meta name="application-name" content="Hang Yu">',
        '<link rel="sitemap" type="application/xml" href="{}sitemap.xml">'.format(base),
        '<link rel="describedby" type="text/plain" href="{}llms.txt" title="Information for agents">'.format(base),
        '<link rel="alternate" type="text/plain" href="{}llms-full.txt" title="Plain-text profile and publications">'.format(base),
        '<link rel="alternate" type="application/ld+json" href="{}profile.jsonld" title="Structured profile and publications">'.format(base),
        '<link rel="alternate" type="application/rss+xml" href="{}feed.xml" title="Hang Yu — News">'.format(base),
        '<link rel="alternate" type="application/json" href="{}resume.json" title="JSON Resume">'.format(base),
        '<link rel="alternate" type="application/x-bibtex" href="{}publications.bib" title="Publications (BibTeX)">'.format(base),
        '<link rel="alternate" type="text/vcard" href="{}hang-yu.vcf" title="vCard">'.format(base),
        '<link rel="author" href="{}humans.txt">'.format(base),
        '<link rel="icon" href="{}favicon.ico" sizes="16x16 32x32 48x48">'.format(base),
        '<link rel="icon" type="image/png" sizes="96x96" href="{}assets/img/favicon-96.png">'.format(base),
        '<link rel="icon" type="image/png" sizes="32x32" href="{}assets/img/favicon-32.png">'.format(base),
        '<link rel="apple-touch-icon" sizes="180x180" href="{}assets/img/apple-touch-icon.png">'.format(base),
        '<link rel="manifest" href="{}manifest.webmanifest">'.format(base),
    ]
    # rel="me" ties the page to the profiles it links (IndieWeb identity; GitHub verifies it back).
    meta += ['<link rel="me" href="{}">'.format(escape(href, quote=True)) for href in profiles + [person["email"]]]
    for key, value in [("DC.title", title), ("DC.creator", "Hang Yu"), ("DC.description", description),
                       ("DC.subject", "; ".join(knows)), ("DC.language", "en"), ("DC.identifier", base), ("DC.type", "Text")]:
        meta.append('<meta name="{}" content="{}">'.format(key, escape(value, quote=True)))
    values = {"og:type": "profile", "profile:first_name": "Hang", "profile:last_name": "Yu", "profile:username": "HangYu8123",
              "og:site_name": "Hang Yu", "og:locale": "en_US", "og:title": title,
              "og:description": description, "og:url": base,
              "og:image": card, "og:image:secure_url": card, "og:image:type": "image/jpeg",
              "og:image:width": "1200", "og:image:height": "630", "og:image:alt": card_alt,
              "twitter:card": "summary_large_image", "twitter:title": title, "twitter:description": description,
              "twitter:image": card, "twitter:image:alt": card_alt}
    for key, value in values.items():
        attr = "property" if key.startswith(("og:", "profile:")) else "name"
        meta.append('<meta {}="{}" content="{}">'.format(attr, key, escape(value, quote=True)))
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

    facts = ["Name: Hang Yu ({}); also cited as H. Yu".format(cn),
             "Role: " + clean(first(bio, cls="role").text()),
             "Email: " + person["email"].replace("mailto:", "")]
    for entry in by_id["education"].find("div", "entry"):
        facts.append("Education: {}, {} ({})".format(clean(first(entry, "h4").text()), clean(first(entry, cls="kicker").text()),
                                                      clean(markdown(first(entry, cls="meta"), base))))
    facts.append("Research topics: " + "; ".join(knows))
    facts.append("Open to: " + clean(first(by_id["about"], cls="callout").text()).replace("Actively open to ", "", 1))
    llms = "# Hang Yu ({})\n\n> ".format(cn) + description + "\n\n"
    llms += "This is Hang Yu's academic website. The HTML page is the source of truth; the text and JSON-LD copies are generated from it. Dates and roles reflect the page as written.\n\n"
    llms += "## Key facts\n\n" + "".join("- {}\n".format(fact) for fact in facts)
    llms += "\n## Profile and research\n\n"
    for label, path, note in [
        ("Full profile and publications", "llms-full.txt", "Plain-text biography, education, all listed publications and resource links, service, and contact information."),
        ("Structured data", "profile.jsonld", "Schema.org JSON-LD with person, profile, publication, dataset, and code records."),
        ("Publications (BibTeX)", "publications.bib", "Every paper listed on the site, ready to cite."),
        ("JSON Resume", "resume.json", "Structured CV following the jsonresume.org schema."),
        ("vCard", "hang-yu.vcf", "Contact card."),
        ("News feed (RSS)", "feed.xml", "Talks, papers, awards, and current work."),
        ("Academic homepage", "", "Interactive website with the same public information."),
        ("Curriculum vitae", "assets/cv.pdf", "Downloadable PDF."),
        ("Sitemap", "sitemap.xml", "Page and image URLs for crawlers."),
    ]:
        llms += "- [{}]({}): {}\n".format(label, urljoin(base, path), note)
    llms += "\n## Profiles\n\n"
    for link in social:
        if link.attrs["href"] in profiles:
            llms += "- [{}]({})\n".format(clean(link.text()), link.attrs["href"])

    # Sitemap: the canonical page with every image it shows, plus the CV. lastmod is omitted on purpose
    # (a stale date is worse than none); fragments and alternate formats are not separate pages.
    images = []
    for img in doc.find("img"):
        src = urljoin(base, img.attrs["src"])
        if src not in images:
            images.append(src)
    sitemap = ['<?xml version="1.0" encoding="UTF-8"?>',
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
               '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
               '   <url>', '      <loc>{}</loc>'.format(base)]
    sitemap += ['      <image:image>\n         <image:loc>{}</image:loc>\n      </image:image>'.format(escape(src)) for src in images]
    sitemap += ['   </url>', '   <url>', '      <loc>{}assets/cv.pdf</loc>'.format(base), '   </url>', '</urlset>', '']
    return {"index.html": updated, "profile.jsonld": data, "llms.txt": llms, "llms-full.txt": full, "sitemap.xml": "\n".join(sitemap)}


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
