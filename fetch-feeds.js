import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FEEDS = [
  { name: "Import AI",              url: "https://importai.substack.com/feed" },
  { name: "AI Snake Oil",          url: "https://www.aisnakeoil.com/feed" },
  { name: "MIT Technology Review",  url: "https://www.technologyreview.com/topic/artificial-intelligence/feed" },
];

const OUT = "feeds.json";
const PER_FEED = 3;

function decode(s) {
  if (!s) return "";
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, " ").trim();
}

function pick(block, tag) {
  const m = block.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "i"));
  return m ? m[1] : "";
}

function linkOf(block) {
  const alt = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  if (alt) return alt[1];
  const href = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  if (href) return href[1];
  const rss = block.match(/<link>([\s\S]*?)<\/link>/i);
  if (rss && rss[1].trim()) return decode(rss[1]);
  const guid = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
  if (guid && /^https?:/i.test(guid[1].trim())) return decode(guid[1]);
  return "";
}

function dateOf(block) {
  for (const t of ["pubDate", "published", "updated", "date"]) {
    const v = pick(block, t);
    if (v && v.trim()) { const d = new Date(v.trim()); if (!isNaN(d)) return d.toISOString(); }
  }
  return "";
}

function parse(xml) {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  return blocks.slice(0, PER_FEED).map((b) => ({
    title: decode(pick(b, "title")) || "Untitled",
    link: linkOf(b),
    date: dateOf(b),
  })).filter((x) => x.link);
}

function attempts(url) {
  const r2 = "https://r.jina.ai/" + url;
  const allo = "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);
  return [url, r2, allo];
}

async function getText(target) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ai-briefing/1.0)",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      redirect: "follow",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFeed(f) {
  let lastErr = "no attempt";
  for (const target of attempts(f.url)) {
    try {
      const items = parse(await getText(target));
      if (items.length) return items;
      lastErr = "empty";
    } catch (e) {
      lastErr = e.message;
    }
  }
  throw new Error(lastErr);
}

async function main() {
  let prev = { feeds: {} };
  if (existsSync(OUT)) { try { prev = JSON.parse(readFileSync(OUT, "utf8")); } catch {} }
  const feeds = {};
  for (const f of FEEDS) {
    try {
      const items = await fetchFeed(f);
      feeds[f.name] = items;
      console.log(`ok   ${f.name} (${items.length})`);
    } catch (e) {
      feeds[f.name] = (prev.feeds && prev.feeds[f.name]) || [];
      console.log(`fail ${f.name} — ${e.message}, kept previous`);
    }
  }
  writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), feeds }, null, 2) + "\n");
  console.log(`wrote ${OUT}`);
}

main();
