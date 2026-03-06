import fs from "fs";
import path from "path";

const BRIEFINGS_DIR = path.join(process.cwd(), "data", "briefings");

export interface BriefingItem {
  title: string;
  link: string;
  badges: { label: string; type: string }[];
  meta: string;
  description: string;
}

export interface BriefingSection {
  title: string;
  type: "ai" | "dev" | "security" | "notable";
  items: BriefingItem[];
}

export interface Briefing {
  date: string; // YYYY-MM-DD
  dateParam: string; // YYYYMMDD
  displayDate: string;
  sections: BriefingSection[];
}

function classifySectionType(title: string): BriefingSection["type"] {
  const lower = title.toLowerCase();
  if (lower.includes("ai") || lower.includes("llm")) return "ai";
  if (lower.includes("agent") || lower.includes("dev") || lower.includes("tool"))
    return "dev";
  if (lower.includes("secur")) return "security";
  return "notable";
}

function extractText(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function parseBriefingHtml(html: string, date: string): Briefing {
  const dateParam = date.replace(/-/g, "");

  // Extract display date from header
  const dateMatch = html.match(
    /<div class="date">([\s\S]*?)<\/div>/
  );
  const displayDate = dateMatch ? extractText(dateMatch[1]) : date;

  // Parse sections
  const sections: BriefingSection[] = [];
  const sectionRegex =
    /<div class="section">\s*<div class="section-title">(.*?)<\/div>([\s\S]*?)(?=<div class="section">|<div class="footer">|<\/div>\s*<\/body>)/g;

  let sectionMatch;
  while ((sectionMatch = sectionRegex.exec(html)) !== null) {
    const sectionTitle = extractText(sectionMatch[1]);
    const sectionContent = sectionMatch[2];
    const type = classifySectionType(sectionTitle);

    const items: BriefingItem[] = [];
    const itemRegex =
      /<div class="item">([\s\S]*?)(?=<div class="item">|<\/div>\s*<\/div>)/g;

    let itemMatch;
    while ((itemMatch = itemRegex.exec(sectionContent)) !== null) {
      const itemHtml = itemMatch[1];

      // Extract badges
      const badges: BriefingItem["badges"] = [];
      const badgeRegex =
        /<span class="badge badge-(\w+)">(.*?)<\/span>/g;
      let badgeMatch;
      while ((badgeMatch = badgeRegex.exec(itemHtml)) !== null) {
        badges.push({ type: badgeMatch[1], label: badgeMatch[2] });
      }

      // Extract link and title
      const linkMatch = itemHtml.match(
        /<a href="(.*?)"[^>]*>([\s\S]*?)<\/a>/
      );
      const title = linkMatch ? extractText(linkMatch[2]) : "";
      const link = linkMatch ? linkMatch[1] : "";

      // Extract meta
      const metaMatch = itemHtml.match(
        /<div class="item-meta">([\s\S]*?)<\/div>/
      );
      const meta = metaMatch ? extractText(metaMatch[1]) : "";

      // Extract description
      const descMatch = itemHtml.match(
        /<div class="item-desc">([\s\S]*?)<\/div>/
      );
      const description = descMatch ? extractText(descMatch[1]) : "";

      if (title) {
        items.push({ title, link, badges, meta, description });
      }
    }

    if (items.length > 0) {
      sections.push({ title: sectionTitle, type, items });
    }
  }

  return { date, dateParam, displayDate, sections };
}

export function getAllDates(): string[] {
  const files = fs.readdirSync(BRIEFINGS_DIR);
  return files
    .filter((f) => f.endsWith(".html"))
    .map((f) => f.replace(".html", ""))
    .sort()
    .reverse();
}

export function getBriefing(date: string): Briefing | null {
  const filePath = path.join(BRIEFINGS_DIR, `${date}.html`);
  if (!fs.existsSync(filePath)) return null;
  const html = fs.readFileSync(filePath, "utf-8");
  return parseBriefingHtml(html, date);
}

export function getBriefingByParam(dateParam: string): Briefing | null {
  // YYYYMMDD -> YYYY-MM-DD
  if (dateParam.length !== 8) return null;
  const date = `${dateParam.slice(0, 4)}-${dateParam.slice(4, 6)}-${dateParam.slice(6, 8)}`;
  return getBriefing(date);
}

export function getAdjacentDates(
  date: string
): { prev: string | null; next: string | null } {
  const dates = getAllDates().reverse(); // oldest first
  const idx = dates.indexOf(date);
  return {
    prev: idx > 0 ? dates[idx - 1] : null,
    next: idx < dates.length - 1 ? dates[idx + 1] : null,
  };
}
