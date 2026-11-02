/**
 * Static build for Lukespeak Engineering Insights.
 *
 * Renders every article in articles/articles.json to its own HTML page at
 * articles/<id>.html (with per-article <title>, description, Open Graph,
 * Twitter, canonical and JSON-LD metadata), writes the full-text search index,
 * sitemap.xml and feed.xml, and copies the static site into _site/ for GitHub
 * Pages.
 *
 * The build fails if articles.json, tags.json and the Markdown files disagree,
 * so a broken article can never be deployed.
 *
 * Usage: npm run build
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

const SITE_URL = 'https://yisheng05.github.io/lukespeak-portfolio/';
const SITE_NAME = 'Lukespeak Engineering Insights';
const SITE_DESCRIPTION = 'Articles on AI architectures, agentic systems, and data products.';
const AUTHOR = { name: 'Luke Ong', url: 'https://www.linkedin.com/in/lukeong7' };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_site');
const ARTICLES_DIR = path.join(ROOT, 'articles');

// Files and folders copied verbatim into the published site.
const STATIC_ENTRIES = [
    'index.html', 'articles.html', 'article.html', 'favicon.svg', 'og-image.png',
    'css', 'js', 'articles/articles.json', 'articles/tags.json',
];

// ---------------------------------------------------------------- helpers

const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const toUtcDate = (ymd) => new Date(`${ymd}T00:00:00Z`);

const formatDisplayDate = (ymd) => toUtcDate(ymd).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
});

const articleUrl = (id) => `${SITE_URL}articles/${id}.html`;

function fillTemplate(template, values) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        if (!(key in values)) throw new Error(`Template placeholder {{${key}}} has no value`);
        return values[key];
    });
}

// ---------------------------------------------------------------- markdown

/**
 * Pass LaTeX through untouched so MathJax can typeset it in the browser.
 * Without this, marked treats "\(" and "\[" as escaped punctuation and strips
 * the backslash, so inline math like \(H\) renders as the literal "(H)".
 */
const mathExtension = {
    extensions: [{
        name: 'math',
        level: 'inline',
        start(src) {
            const i = src.search(/\\\(|\\\[|\$\$/);
            return i === -1 ? undefined : i;
        },
        tokenizer(src) {
            const match = /^(?:\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]|\$\$[\s\S]+?\$\$)/.exec(src);
            if (match) return { type: 'math', raw: match[0], text: match[0] };
        },
        renderer(token) {
            return token.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        },
    }],
};

const marked = new Marked({ gfm: true, breaks: true }, mathExtension);

function renderMarkdown(markdown) {
    // The page header already shows the title, so drop a leading "# Title" line.
    const body = markdown.replace(/^# .+\n?/, '');
    return marked.parse(body)
        // Let wide tables scroll horizontally on small screens.
        .replace(/<table>/g, '<div class="table-wrapper"><table>')
        .replace(/<\/table>/g, '</table></div>');
}

const decodeEntities = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    if (e[0] !== '#') return named[e.toLowerCase()];
    const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return String.fromCodePoint(code);
});

/**
 * Plain prose for full-text search: code blocks and LaTeX are dropped because
 * they make poor result snippets; inline code and everything else is kept.
 */
function toSearchText(html) {
    const text = decodeEntities(html.replace(/<pre[\s\S]*?<\/pre>/g, ' ').replace(/<[^>]+>/g, ' '));
    return text
        .replace(/\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]|\$\$[\s\S]+?\$\$/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// ---------------------------------------------------------------- validation

function loadTags() {
    let tags;
    try {
        tags = JSON.parse(fs.readFileSync(path.join(ARTICLES_DIR, 'tags.json'), 'utf8'));
    } catch (err) {
        throw new Error(`articles/tags.json could not be parsed: ${err.message}`);
    }
    const errors = [];
    if (!Array.isArray(tags) || !tags.length) throw new Error('articles/tags.json must be a non-empty JSON array');
    const ids = new Set();
    tags.forEach((t, i) => {
        if (!t || typeof t.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t.id)) errors.push(`tags.json[${i}]: id must be lowercase-kebab-case`);
        else if (ids.has(t.id)) errors.push(`tags.json[${i}]: duplicate id "${t.id}"`);
        else ids.add(t.id);
        if (!t || typeof t.label !== 'string' || !t.label.trim()) errors.push(`tags.json[${i}]: missing "label"`);
    });
    if (errors.length) throw new Error(`Tag list is invalid:\n  - ${errors.join('\n  - ')}`);
    return tags;
}

function loadArticles(tagIds) {
    const errors = [];
    const indexPath = path.join(ARTICLES_DIR, 'articles.json');
    let articles;
    try {
        articles = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    } catch (err) {
        throw new Error(`articles/articles.json could not be parsed: ${err.message}`);
    }
    if (!Array.isArray(articles)) throw new Error('articles/articles.json must be a JSON array');

    const seen = new Set();
    articles.forEach((a, i) => {
        const where = `articles.json[${i}]${a && a.id ? ` (${a.id})` : ''}`;
        for (const field of ['id', 'title', 'date', 'summary']) {
            if (typeof a[field] !== 'string' || !a[field].trim()) errors.push(`${where}: missing "${field}"`);
        }
        if (typeof a.id === 'string') {
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.id)) errors.push(`${where}: id must be lowercase-kebab-case`);
            if (seen.has(a.id)) errors.push(`${where}: duplicate id`);
            seen.add(a.id);
            if (!fs.existsSync(path.join(ARTICLES_DIR, `${a.id}.md`))) errors.push(`${where}: articles/${a.id}.md does not exist`);
        }
        if (typeof a.date === 'string') {
            const d = toUtcDate(a.date);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== a.date) {
                errors.push(`${where}: date "${a.date}" is not a valid YYYY-MM-DD date`);
            }
        }
        if (!Array.isArray(a.tags) || !a.tags.length) {
            errors.push(`${where}: "tags" must be a non-empty array of ids from articles/tags.json`);
        } else {
            const unknown = a.tags.filter((t) => !tagIds.has(t));
            if (unknown.length) errors.push(`${where}: unknown tag(s) ${unknown.map((t) => `"${t}"`).join(', ')}; add them to articles/tags.json first`);
            if (new Set(a.tags).size !== a.tags.length) errors.push(`${where}: duplicate tags`);
        }
    });

    for (const file of fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.md'))) {
        if (!seen.has(file.slice(0, -3))) errors.push(`articles/${file} has no entry in articles.json`);
    }

    if (errors.length) {
        throw new Error(`Article index is invalid:\n  - ${errors.join('\n  - ')}`);
    }
    return [...articles].sort((a, b) => b.date.localeCompare(a.date));
}

// ---------------------------------------------------------------- outputs

function buildArticlePage(template, article, html, tagLabels) {
    const url = articleUrl(article.id);
    const jsonLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: article.title,
        description: article.summary,
        datePublished: article.date,
        url,
        mainEntityOfPage: url,
        image: [`${SITE_URL}og-image.png`],
        author: { '@type': 'Person', ...AUTHOR },
        publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    }).replace(/</g, '\\u003c'); // never let content close the <script> tag

    return fillTemplate(template, {
        root: '../',
        siteUrl: SITE_URL,
        url,
        title: escapeHtml(article.title),
        summary: escapeHtml(article.summary),
        date: article.date,
        dateDisplay: formatDisplayDate(article.date),
        readTime: escapeHtml(article.readTime || '5 min'),
        jsonLd,
        tagLinks: article.tags
            .map((t) => `<li><a href="../articles.html?tag=${t}">${escapeHtml(tagLabels.get(t))}</a></li>`)
            .join(''),
        content: html,
    });
}

function buildSitemap(articles) {
    const urls = [
        `  <url><loc>${SITE_URL}</loc></url>`,
        `  <url><loc>${SITE_URL}articles.html</loc></url>`,
        ...articles.map((a) => `  <url><loc>${articleUrl(a.id)}</loc><lastmod>${a.date}</lastmod></url>`),
    ];
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

function buildFeed(articles) {
    const items = articles.map((a) => [
        '    <item>',
        `      <title>${escapeHtml(a.title)}</title>`,
        `      <link>${articleUrl(a.id)}</link>`,
        `      <guid isPermaLink="true">${articleUrl(a.id)}</guid>`,
        `      <pubDate>${toUtcDate(a.date).toUTCString()}</pubDate>`,
        `      <description>${escapeHtml(a.summary)}</description>`,
        '    </item>',
    ].join('\n'));
    // Use the newest article date (not the wall clock) so builds are reproducible.
    const lastBuild = articles.length ? toUtcDate(articles[0].date).toUTCString() : new Date(0).toUTCString();
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_NAME}</title>
    <link>${SITE_URL}</link>
    <description>${SITE_DESCRIPTION}</description>
    <language>en</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${SITE_URL}feed.xml" rel="self" type="application/rss+xml"/>
${items.join('\n')}
  </channel>
</rss>
`;
}

// ---------------------------------------------------------------- main

function main() {
    const tags = loadTags();
    const tagLabels = new Map(tags.map((t) => [t.id, t.label]));
    const articles = loadArticles(new Set(tagLabels.keys()));
    const template = fs.readFileSync(path.join(ROOT, 'templates', 'article.html'), 'utf8');

    fs.rmSync(OUT, { recursive: true, force: true });
    for (const entry of STATIC_ENTRIES) {
        fs.cpSync(path.join(ROOT, entry), path.join(OUT, entry), { recursive: true });
    }

    const searchIndex = {};
    for (const article of articles) {
        const markdown = fs.readFileSync(path.join(ARTICLES_DIR, `${article.id}.md`), 'utf8');
        const html = renderMarkdown(markdown);
        searchIndex[article.id] = toSearchText(html);
        fs.writeFileSync(path.join(OUT, 'articles', `${article.id}.html`), buildArticlePage(template, article, html, tagLabels));
    }
    // Full-text index for the archive search; fetched only when a reader starts searching.
    fs.writeFileSync(path.join(OUT, 'articles', 'search-index.json'), JSON.stringify(searchIndex));
    fs.writeFileSync(path.join(OUT, 'sitemap.xml'), buildSitemap(articles));
    fs.writeFileSync(path.join(OUT, 'feed.xml'), buildFeed(articles));

    console.log(`Built ${articles.length} article pages, search index, sitemap.xml and feed.xml into ${path.relative(ROOT, OUT)}/`);
}

try {
    main();
} catch (err) {
    console.error(`Build failed: ${err.message}`);
    process.exit(1);
}
