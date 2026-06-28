import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FEEDS = [
  { name: "The Batch",              url: "https://www.deeplearning.ai/the-batch/rss/" },
  { name: "Import AI",              url: "https://importai.substack.com/feed" },
  { name: "AI Snake Oil",          url: "https://www.aisnakeoil.com/feed" },
  { name: "MIT Technology Review",  url: "https://www.technologyreview.com/topic/artificial-intelligence/feed" },
  { name: "arXiv — cs.AI",         url: "https://rss.arxiv.org/rss/cs.AI" },
  { name: "Stanford HAI",          url: "https://hai.stanford.edu/news/all/rss" },
];

const OUT = "feeds.json";
const PER_FEED = 3;

function decode(s) {
  if (!s) return "";
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, " ")
    .trim();
}

function pick(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1] : "";
}

function linkOf(block) {
  const rss = block.match(/<link>([\s\S]*?)<\/link>/i);
  if (rss && rss[1].trim()) return decode(rss[1]);
  const alt = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  if (alt) return alt[1];
  const any = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  return any ? any[1] : "";
}

function dateOf(block) {
  for (const t of ["pubDate", "published", "updated", "dc:date", "date"]) {
    const v = pick(block, t);
    if (v && v.trim()) return new Date(v.trim()).toISOString();
  }
  return "";
}

function parse(xml) {
  let blocks = xml.match(/<item[\s\S]*?<\/item>/gi);
  if (!blocks) blocks = xml.match(/<entry[\s\S]*?<\/entry>/gi);
  if (!blocks) return [];
  return blocks.slice(0, PER_FEED).map((b) => ({
    title: decode(pick(b, "title")) || "Untitled",
    link: linkOf(b),
    date: dateOf(b),
  })).filter((x) => x.link);
}

async function fetchFeed(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "ai-briefing/1.0 (+github actions)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parse(await res.text());
}

async function main() {
  let prev = { feeds: {} };
  if (existsSync(OUT)) {
    try { prev = JSON.parse(readFileSync(OUT, "utf8")); } catch {}
  }
  const feeds = {};
  for (const f of FEEDS) {
    try {
      const items = await fetchFeed(f.url);
      if (items.length) {
        feeds[f.name] = items;
        console.log(`ok   ${f.name} (${items.length})`);
      } else {
        feeds[f.name] = (prev.feeds && prev.feeds[f.name]) || [];
        console.log(`warn ${f.name} — empty, kept previous`);
      }
    } catch (e) {
      feeds[f.name] = (prev.feeds && prev.feeds[f.name]) || [];
      console.log(`fail ${f.name} — ${e.message}, kept previous`);
    }
  }
  const out = { generated: new Date().toISOString(), feeds };
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`wrote ${OUT}`);
}

main();
