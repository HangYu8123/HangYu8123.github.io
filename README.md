# hangyu8123.github.io

Personal academic website of **Hang Yu (余航)**, Ph.D. candidate in Computer Science at Tufts University, working on Human-Robot Interaction (HRI), robot learning from human feedback and demonstrations, Vision-Language-Action (VLA) models, and agentic robotics.

**Live site:** https://hangyu8123.github.io/

## Layout

| Path | What it is |
|------|------------|
| `index.html` | The whole site: a single page with About, News, Education, Publications, Experience & Service, Life, and Contact. |
| `assets/css/style.css` | Styles for the bookshelf layout. |
| `assets/js/monet.js` | Paints the background wall in the browser (Canvas). |
| `assets/js/shelf.js` | Book open/close interaction. Without JavaScript the page degrades to a plain document. |
| `assets/img/` | Photos, paper figures, favicons, and the social-card image. |
| `assets/cv.pdf` | Curriculum vitae. |
| `404.html` | Custom not-found page served by GitHub Pages. |

## Machine-readable resources

These files mirror the content of `index.html` for search engines, LLM agents, and scripts. They are maintained by hand; when the page changes, update them too.

| URL | Format | Purpose |
|-----|--------|---------|
| [`/llms.txt`](https://hangyu8123.github.io/llms.txt) | Markdown ([llmstxt.org](https://llmstxt.org/)) | Short summary and link index for LLM agents |
| [`/llms-full.txt`](https://hangyu8123.github.io/llms-full.txt) | Markdown | Full site content in plain text |
| [`/resume.json`](https://hangyu8123.github.io/resume.json) | [JSON Resume](https://jsonresume.org/schema/) | Structured CV |
| [`/publications.bib`](https://hangyu8123.github.io/publications.bib) | BibTeX | All publications listed on the site |
| [`/hang-yu.vcf`](https://hangyu8123.github.io/hang-yu.vcf) | vCard 3.0 | Contact card |
| [`/feed.xml`](https://hangyu8123.github.io/feed.xml) | RSS 2.0 | News items |
| [`/sitemap.xml`](https://hangyu8123.github.io/sitemap.xml) | XML sitemap (with image extension) | For crawlers |
| [`/robots.txt`](https://hangyu8123.github.io/robots.txt) | robots.txt | Crawl policy (everything allowed, AI crawlers explicitly welcome) |
| [`/manifest.webmanifest`](https://hangyu8123.github.io/manifest.webmanifest) | Web App Manifest | Name, icons, and theme colour |
| [`/humans.txt`](https://hangyu8123.github.io/humans.txt) | humans.txt | Authorship and tech notes |

`index.html` also embeds schema.org JSON-LD (`WebSite`, `ProfilePage`, `Person`, `ScholarlyArticle`, `Dataset`, `SoftwareSourceCode`), Open Graph and Twitter Card tags, and Dublin Core metadata.

## Local preview

No build step. Open `index.html` directly, or serve the folder:

```sh
python -m http.server 8000
```

then visit http://localhost:8000/.
