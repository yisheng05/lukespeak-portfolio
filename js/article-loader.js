/**
 * Article Loader Logic
 * Renders the article lists (archive and homepage featured cards) from
 * articles/articles.json and articles/tags.json, and powers archive search.
 * Article pages themselves are pre-rendered by scripts/build.mjs.
 *
 * Archive search:
 * - Every word in the query must appear somewhere in the title, tags, summary
 *   or full article text (articles/search-index.json, fetched on first use).
 * - Results are ranked title > tags > summary > body, newest first on ties.
 * - The query and topic live in the URL (?q=…&tag=…), so a filtered view can
 *   be shared and survives the back button.
 */

const ArticleLoader = {
    config: {
        articlesIndexPath: 'articles/articles.json',
        tagsPath: 'articles/tags.json',
        searchIndexPath: 'articles/search-index.json',
        // Wait for typing to pause before updating the URL and analytics
        settleDelayMs: 700
    },

    state: {
        articles: [],
        tags: [],
        tagLabels: {},
        query: '',
        tag: 'all',
        bodies: null,        // { id: lowercased full text } once the index has loaded
        rawBodies: null,     // { id: full text } for result snippets
        indexRequest: null,
        settleTimer: null,
        lastTrackedQuery: ''
    },

    // ------------------------------------------------------------ utilities

    formatDate: function (dateString) {
        // "YYYY-MM-DD" parses as UTC midnight, so format in UTC too; otherwise
        // readers west of UTC (e.g. the Americas) see the previous day.
        const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    },

    escapeHtml: function (value) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return String(value).replace(/[&<>"']/g, (c) => map[c]);
    },

    fetchJson: async function (path) {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Could not load ${path}`);
        return response.json();
    },

    loadTags: async function () {
        try {
            const tags = await this.fetchJson(this.config.tagsPath);
            this.state.tags = tags;
            this.state.tagLabels = Object.fromEntries(tags.map((t) => [t.id, t.label]));
        } catch (error) {
            console.error('Error loading tags:', error); // cards still render, just without topic labels
        }
    },

    tagLabel: function (id) {
        return this.state.tagLabels[id] || id;
    },

    newestFirst: function (articles) {
        return articles.sort((a, b) => b.date.localeCompare(a.date));
    },

    // ------------------------------------------------------------ search

    queryTerms: function (query) {
        return [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))];
    },

    loadSearchIndex: function () {
        if (!this.state.indexRequest) {
            this.state.indexRequest = this.fetchJson(this.config.searchIndexPath)
                .then((index) => {
                    this.state.rawBodies = index;
                    this.state.bodies = Object.fromEntries(
                        Object.entries(index).map(([id, text]) => [id, text.toLowerCase()])
                    );
                    if (this.state.query.trim()) this.applyFilters({ settle: false });
                })
                .catch((error) => {
                    // Title, summary and tag search keep working without it
                    console.error('Full-text search unavailable:', error);
                });
        }
        return this.state.indexRequest;
    },

    /** Returns null when some term matches nowhere; otherwise a relevance score. */
    scoreArticle: function (article, terms) {
        const title = article.title.toLowerCase();
        const summary = article.summary.toLowerCase();
        const tags = (article.tags || []).map((t) => this.tagLabel(t)).join(' ').toLowerCase();
        const body = this.state.bodies ? (this.state.bodies[article.id] || '') : '';
        let score = 0;
        for (const term of terms) {
            let termScore = 0;
            if (title.includes(term)) termScore += 8;
            if (tags.includes(term)) termScore += 5;
            if (summary.includes(term)) termScore += 3;
            if (body.includes(term)) termScore += 1;
            if (termScore === 0) return null;
            score += termScore;
        }
        return score;
    },

    /** Escape text and wrap query matches in <mark>. Single characters are not highlighted. */
    highlight: function (text, terms) {
        const marks = terms.filter((t) => t.length > 1);
        if (!marks.length) return this.escapeHtml(text);
        const lower = text.toLowerCase();
        const ranges = [];
        for (const term of marks) {
            for (let i = lower.indexOf(term); i !== -1; i = lower.indexOf(term, i + term.length)) {
                ranges.push([i, i + term.length]);
            }
        }
        if (!ranges.length) return this.escapeHtml(text);
        ranges.sort((a, b) => a[0] - b[0]);
        const merged = [ranges[0]];
        for (const [start, end] of ranges.slice(1)) {
            const last = merged[merged.length - 1];
            if (start <= last[1]) last[1] = Math.max(last[1], end);
            else merged.push([start, end]);
        }
        let html = '';
        let cursor = 0;
        for (const [start, end] of merged) {
            html += this.escapeHtml(text.slice(cursor, start)) + '<mark>' + this.escapeHtml(text.slice(start, end)) + '</mark>';
            cursor = end;
        }
        return html + this.escapeHtml(text.slice(cursor));
    },

    /** A short excerpt of the article text around the first match. */
    snippet: function (id, terms) {
        const raw = this.state.rawBodies && this.state.rawBodies[id];
        if (!raw) return '';
        const lower = this.state.bodies[id];
        let pos = -1;
        let length = 0;
        for (const term of terms) {
            const i = lower.indexOf(term);
            if (i !== -1 && (pos === -1 || i < pos)) {
                pos = i;
                length = term.length;
            }
        }
        if (pos === -1) return '';
        let start = Math.max(0, pos - 70);
        let end = Math.min(raw.length, pos + length + 110);
        if (start > 0) {
            const space = raw.indexOf(' ', start);
            if (space !== -1 && space < pos) start = space + 1;
        }
        if (end < raw.length) {
            const space = raw.lastIndexOf(' ', end);
            if (space > pos + length) end = space;
        }
        return (start > 0 ? '… ' : '') + this.highlight(raw.slice(start, end), terms) + (end < raw.length ? ' …' : '');
    },

    // ------------------------------------------------------------ rendering

    renderCard: function (article, options = {}) {
        const { headingTag = 'h2', ctaLabel = 'Read Full Article', terms = [], delay = 0, revealed = true } = options;
        const title = article.title.toLowerCase();
        const summary = article.summary.toLowerCase();
        // Only show where it matched when the title and summary don't already explain it
        const needsSnippet = terms.some((t) => !title.includes(t) && !summary.includes(t));
        const snippet = needsSnippet ? this.snippet(article.id, terms) : '';
        const tags = (article.tags || [])
            .map((t) => `<li class="tag-chip">${this.escapeHtml(this.tagLabel(t))}</li>`)
            .join('');

        return `
            <a href="articles/${article.id}.html" class="article-card glass-card reveal${revealed ? ' active' : ''}" style="transition-delay: ${delay}s">
                <div class="article-date">
                    <i class="far fa-calendar-alt"></i> ${this.formatDate(article.date)}
                    <span style="margin-left: 10px;"><i class="far fa-clock"></i> ${this.escapeHtml(article.readTime || '5 min')} read</span>
                </div>
                <${headingTag} class="article-title">${this.highlight(article.title, terms)}</${headingTag}>
                ${tags ? `<ul class="card-tags" aria-label="Topics">${tags}</ul>` : ''}
                <p class="article-summary">${this.highlight(article.summary, terms)}</p>
                ${snippet ? `<p class="search-snippet"><span class="snippet-label">In the article:</span> ${snippet}</p>` : ''}
                <span class="read-more">${ctaLabel} <i class="fas fa-arrow-right"></i></span>
            </a>`;
    },

    renderArticleList: function (articles, terms) {
        const container = document.getElementById('articles-container');
        if (!container) return;

        if (articles.length === 0) {
            container.innerHTML = `
                <div class="glass-card empty-state">
                    <i class="fas fa-search"></i>
                    <p>No articles match your search.</p>
                    <button type="button" class="btn btn-outline btn-sm" data-action="clear">Clear search and filters</button>
                </div>`;
            return;
        }

        container.innerHTML = articles
            .map((article, index) => this.renderCard(article, { terms, delay: Math.min(index, 10) * 0.05 }))
            .join('');
    },

    renderFilters: function (matchedByQuery) {
        const container = document.getElementById('category-filters');
        if (!container) return;
        const counts = { all: matchedByQuery.length };
        this.state.tags.forEach((t) => { counts[t.id] = 0; });
        matchedByQuery.forEach(({ article }) => {
            (article.tags || []).forEach((t) => { if (t in counts) counts[t] += 1; });
        });

        const chip = (id, label) => {
            const active = this.state.tag === id;
            const disabled = !active && counts[id] === 0;
            return `<button type="button" class="filter-btn${active ? ' active' : ''}" data-tag="${id}" aria-pressed="${active}"${disabled ? ' disabled' : ''}>`
                + `${this.escapeHtml(label)} <span class="filter-count">${counts[id]}</span></button>`;
        };

        // Re-rendering replaces the buttons, so keep keyboard focus on the same chip
        const focusedTag = document.activeElement && container.contains(document.activeElement)
            ? document.activeElement.dataset.tag
            : null;
        container.innerHTML = chip('all', 'All Insights') + this.state.tags.map((t) => chip(t.id, t.label)).join('');
        if (focusedTag) {
            const again = container.querySelector(`[data-tag="${focusedTag}"]`);
            if (again) again.focus({ preventScroll: true });
        }

        // On phones the chips are one scrollable row; keep the active one in view
        const active = container.querySelector('.filter-btn.active');
        if (active && container.scrollWidth > container.clientWidth) {
            const row = container.getBoundingClientRect();
            const box = active.getBoundingClientRect();
            if (box.left < row.left || box.right > row.right) {
                container.scrollLeft += box.left - row.left - 24;
            }
        }
    },

    renderStatus: function (count) {
        const status = document.getElementById('search-status');
        const clear = document.getElementById('clear-search');
        if (!status) return;
        const total = this.state.articles.length;
        const query = this.state.query.trim();
        const filtered = query || this.state.tag !== 'all';
        const noun = (n) => (n === 1 ? 'article' : 'articles');

        let text = `${total} ${noun(total)}`;
        if (filtered) {
            text = `${count} of ${total} ${noun(total)}`;
            if (query) text += ` matching “${query}”`;
            if (this.state.tag !== 'all') text += ` in ${this.tagLabel(this.state.tag)}`;
        }
        status.textContent = text;
        if (clear) clear.hidden = !filtered;
    },

    applyFilters: function ({ settle = true } = {}) {
        const terms = this.queryTerms(this.state.query);
        const matched = [];
        for (const article of this.state.articles) {
            const score = terms.length ? this.scoreArticle(article, terms) : 0;
            if (score !== null) matched.push({ article, score });
        }
        const visible = matched.filter(({ article }) =>
            this.state.tag === 'all' || (article.tags || []).includes(this.state.tag)
        );
        if (terms.length) {
            visible.sort((a, b) => b.score - a.score || b.article.date.localeCompare(a.article.date));
        }

        this.renderFilters(matched);
        this.renderArticleList(visible.map((m) => m.article), terms);
        this.renderStatus(visible.length);
        if (settle) this.scheduleSettle();
    },

    // ------------------------------------------------------------ URL + analytics

    readUrlState: function () {
        const params = new URLSearchParams(window.location.search);
        this.state.query = params.get('q') || '';
        const tag = params.get('tag');
        this.state.tag = tag && this.state.tags.some((t) => t.id === tag) ? tag : 'all';
    },

    writeUrlState: function () {
        const params = new URLSearchParams(window.location.search);
        const query = this.state.query.trim();
        if (query) params.set('q', query); else params.delete('q');
        if (this.state.tag !== 'all') params.set('tag', this.state.tag); else params.delete('tag');
        const search = params.toString();
        const url = window.location.pathname + (search ? `?${search}` : '') + window.location.hash;
        if (url !== window.location.pathname + window.location.search + window.location.hash) {
            window.history.replaceState(null, '', url);
        }
    },

    trackSearch: function () {
        const query = this.state.query.trim().toLowerCase();
        if (!query || query === this.state.lastTrackedQuery) return;
        this.state.lastTrackedQuery = query;
        if (typeof gtag === 'function') {
            gtag('event', 'search', { search_term: query });
        }
    },

    /** Runs once typing pauses (or immediately), so URL and analytics see settled queries only. */
    scheduleSettle: function (immediate = false) {
        clearTimeout(this.state.settleTimer);
        const settle = () => {
            this.writeUrlState();
            this.trackSearch();
        };
        if (immediate) settle();
        else this.state.settleTimer = setTimeout(settle, this.config.settleDelayMs);
    },

    // ------------------------------------------------------------ wiring

    setupSearchAndFilter: function () {
        const input = document.getElementById('article-search');
        const filters = document.getElementById('category-filters');
        const container = document.getElementById('articles-container');
        const clearButton = document.getElementById('clear-search');

        const clearAll = () => {
            this.state.query = '';
            this.state.tag = 'all';
            if (input) input.value = '';
            this.applyFilters({ settle: false });
            this.scheduleSettle(true);
            if (input) input.focus();
        };

        if (input) {
            input.value = this.state.query;
            // Start fetching the full-text index as soon as a reader shows intent
            input.addEventListener('focus', () => this.loadSearchIndex(), { once: true });
            input.addEventListener('input', (e) => {
                this.state.query = e.target.value;
                if (this.state.query.trim()) this.loadSearchIndex();
                this.applyFilters();
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && input.value) {
                    input.value = '';
                    this.state.query = '';
                    this.applyFilters({ settle: false });
                    this.scheduleSettle(true);
                }
            });
            // "/" focuses search from anywhere on the page
            document.addEventListener('keydown', (e) => {
                const target = e.target;
                const typing = target instanceof HTMLElement
                    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
                if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    e.preventDefault();
                    input.focus();
                }
            });
        }

        if (filters) {
            filters.addEventListener('click', (e) => {
                const button = e.target.closest('.filter-btn');
                if (!button || button.disabled) return;
                this.state.tag = button.dataset.tag;
                this.applyFilters({ settle: false });
                this.scheduleSettle(true);
            });
        }

        if (clearButton) clearButton.addEventListener('click', clearAll);
        if (container) {
            container.addEventListener('click', (e) => {
                if (e.target.closest('[data-action="clear"]')) clearAll();
            });
        }

        // Don't lose a just-typed query if the reader opens an article before typing settles
        window.addEventListener('pagehide', () => this.scheduleSettle(true));
    },

    /**
     * Load the list of articles for the articles.html page
     */
    loadArticleList: async function () {
        const container = document.getElementById('articles-container');
        const loading = document.getElementById('loading-indicator');
        if (!container || !loading) return;

        try {
            const [articles] = await Promise.all([
                this.fetchJson(this.config.articlesIndexPath),
                this.loadTags()
            ]);
            this.state.articles = this.newestFirst(articles);
            this.readUrlState();

            loading.style.display = 'none';
            this.setupSearchAndFilter();
            if (this.state.query.trim()) this.loadSearchIndex();
            this.applyFilters({ settle: false });
        } catch (error) {
            console.error('Error loading articles:', error);
            loading.innerHTML = '<p style="color: #ff6b6b;"><i class="fas fa-exclamation-circle"></i> Error loading articles. Please try again later.</p>';
        }
    },

    /**
     * Load top featured articles for the index.html landing page
     */
    loadFeaturedArticles: async function () {
        const container = document.getElementById('featured-articles-container');
        if (!container) return;

        try {
            const [articles] = await Promise.all([
                this.fetchJson(this.config.articlesIndexPath),
                this.loadTags()
            ]);
            const featured = this.newestFirst(articles).slice(0, 4);

            container.innerHTML = featured.map((article, index) => this.renderCard(article, {
                headingTag: 'h3',
                ctaLabel: (article.tags || []).includes('case-study') ? 'Read Architectural Case Study' : 'Read Full Article',
                delay: index * 0.1,
                revealed: false
            })).join('');

            setTimeout(() => {
                container.querySelectorAll('.reveal').forEach((el) => el.classList.add('active'));
            }, 100);
        } catch (error) {
            console.error('Error loading featured articles:', error);
        }
    }
};
