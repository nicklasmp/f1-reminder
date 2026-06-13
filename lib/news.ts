import { F1NewsItem } from '@/types/f1';

// English F1 journalism feeds. All verified RSS 2.0, no auth, no key.
// Resilient by design: a feed that 404s or times out is skipped, not fatal.
const FEEDS: { source: string; url: string }[] = [
  { source: 'The Race',       url: 'https://www.the-race.com/rss/' },
  { source: 'Autosport',      url: 'https://www.autosport.com/rss/f1/news/' },
  { source: 'Motorsport.com', url: 'https://www.motorsport.com/rss/f1/news/' },
  { source: 'RaceFans',       url: 'https://www.racefans.net/feed/' },
  { source: 'GPFans',         url: 'https://www.gpfans.com/en/rss.xml' },
];

const MAX_ITEMS = 40;
const PER_FEED_TIMEOUT_MS = 8000;

// Decode the HTML/XML entities that show up in feed titles & summaries.
function decodeEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&'); // last, so it doesn't double-decode
}

function stripCdata(str: string): string {
  const m = str.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return m ? m[1] : str;
}

// Inner text of the first <tag ...>…</tag> in a block (CDATA-aware). Namespaced
// tags like content:encoded / dc:creator work because ':' is regex-literal.
function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? stripCdata(m[1]).trim() : null;
}

// A url="…" attribute on a self-closing tag like <enclosure …/> or <media:content …/>.
function selfClosingUrl(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}\\b[^>]*\\burl=["']([^"']+)["']`, 'i'));
  return m ? m[1] : null;
}

function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractImage(block: string): string | null {
  // Prefer explicit media tags, then enclosure, then first <img> in the body.
  const media = selfClosingUrl(block, 'media:content') ?? selfClosingUrl(block, 'media:thumbnail');
  if (media) return media;

  const enclosure = block.match(/<enclosure\b[^>]*\burl=["']([^"']+)["'][^>]*>/i);
  if (enclosure && /\.(jpe?g|png|webp|gif)/i.test(enclosure[1])) return enclosure[1];

  const body = tag(block, 'content:encoded') ?? tag(block, 'description') ?? '';
  const img = body.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  return img ? img[1] : null;
}

function toIso(raw: string | null): string {
  if (!raw) return '';
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? '' : new Date(t).toISOString();
}

// Strip tracking query params so dedupe matches across feeds.
function cleanLink(link: string): string {
  return decodeEntities(link).replace(/[?&]utm_[^=]+=[^&]*/g, '').replace(/[?&]$/, '');
}

function parseFeed(xml: string, source: string): F1NewsItem[] {
  // Support both RSS <item> and Atom <entry>.
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? [];
  const items: F1NewsItem[] = [];

  for (const block of blocks) {
    const rawTitle = tag(block, 'title');
    if (!rawTitle) continue;

    // RSS link is element text; Atom link is an href attribute.
    const linkText = tag(block, 'link');
    const linkHref = block.match(/<link\b[^>]*\bhref=["']([^"']+)["']/i)?.[1];
    const link = cleanLink(linkText || linkHref || '');
    if (!link) continue;

    const summaryRaw = tag(block, 'description') ?? tag(block, 'summary') ?? tag(block, 'content:encoded') ?? '';
    const publishedAt = toIso(tag(block, 'pubDate') ?? tag(block, 'published') ?? tag(block, 'updated') ?? tag(block, 'dc:date'));

    items.push({
      title: decodeEntities(rawTitle),
      link,
      source,
      publishedAt,
      summary: stripHtml(summaryRaw).slice(0, 220) || undefined,
      image: extractImage(block),
    });
  }

  return items;
}

async function fetchFeed(feed: { source: string; url: string }): Promise<F1NewsItem[]> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), PER_FEED_TIMEOUT_MS);
  try {
    const res = await fetch(feed.url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'F1ReminderBot/1.0 (+https://github.com/f1-reminder)' },
      next: { revalidate: 600 },
    });
    if (!res.ok) return [];
    return parseFeed(await res.text(), feed.source);
  } catch {
    return []; // dead feed degrades gracefully
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchNews(): Promise<F1NewsItem[]> {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const all = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));

  // Dedupe: by link, and by normalized title (Autosport/Motorsport.com share a
  // network and republish identical stories).
  const seen = new Set<string>();
  const deduped: F1NewsItem[] = [];
  for (const item of all) {
    const titleKey = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(item.link) || seen.has(titleKey)) continue;
    seen.add(item.link);
    seen.add(titleKey);
    deduped.push(item);
  }

  // Newest first; items without a date sort last.
  deduped.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
  return deduped.slice(0, MAX_ITEMS);
}
