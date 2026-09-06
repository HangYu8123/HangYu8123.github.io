# Website discovery metadata

The site is static. All biography and publication content remains in `index.html`
and can be fetched without running JavaScript. The discovery generator changes
only head metadata and creates static companion files; it preserves the page body,
title, styles, and interactive scripts.

After updating the page, run from the repository root:

```sh
python scripts/generate_discovery.py
python scripts/generate_discovery.py --check
```

Python 3.8 or later is sufficient; no packages are required. Commit the generated
files together with the source page. If the role, affiliation, or metadata summary
changes, update those values in the generator as well as the visible page.

- `profile.jsonld`: Schema.org graph for the site, profile, person, and every listed
  research entry. The same graph is embedded in the HTML head for search engines.
  Author lists come from the page; missing authors and exact dates are not guessed.
- `llms.txt`: Short resource directory for agents, linked from the HTML head.
- `llms-full.txt`: Text with Markdown formatting extracted from the biography and
  book contents, including the conference papers on the left publication page.
  It includes absolute links to the original papers, datasets, code, and profiles.
- `robots.txt`: Permits all crawlers and advertises the sitemap. The additional
  resource comments are informational; the HTML links provide discovery.
- `sitemap.xml`: Lists the canonical homepage and CV, plus the profile image.
  Fragments and alternate representations are not separate sitemap pages.
  `lastmod` is omitted rather than publishing dates that can become inaccurate.

Deploy these files through the site's normal GitHub Pages publishing process.
Then verify the public URLs return HTTP 200 and submit `sitemap.xml` in Google
Search Console and Bing Webmaster Tools. The existing Google verification file
must remain in place. Use Google's Rich Results Test and Search Console URL
Inspection on the deployed homepage to check how Google reads it.

Structured data and crawl access help discovery but do not guarantee rankings,
rich results, indexing, or citations by AI systems. `llms.txt` is a proposal,
not a universal requirement for AI search. No bot-specific content is served.

References: [Google profile markup](https://developers.google.com/search/docs/appearance/structured-data/profile-page),
[Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap),
[Schema.org ScholarlyArticle](https://schema.org/ScholarlyArticle),
and the [llms.txt proposal](https://llmstxt.org/).
