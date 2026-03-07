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

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) =>
      String.fromCharCode(parseInt(n, 16))
    );
}

function extractText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, "").trim());
}

/**
 * 범용 아이템 파서 — news-item, item, card, li.news-item 모두 처리
 */
function parseItems(sectionContent: string): BriefingItem[] {
  const items: BriefingItem[] = [];

  // 아이템 경계: div/li with class news-item, item(+subclass), card
  const itemRegex =
    /<(?:div|li) class="(?:news-item|item|card)(?:\s[^"]*)?(?:"[^>]*>)([\s\S]*?)(?=<(?:div|li) class="(?:news-item|item|card)(?:\s|")|<\/(?:section|ul|ol)>|<\/div>\s*(?:<(?:section|div class="section)|<footer|$))/g;

  let match;
  while ((match = itemRegex.exec(sectionContent)) !== null) {
    const block = match[1];

    // 배지 추출
    const badges: BriefingItem["badges"] = [];
    const badgeRegex =
      /<span class="(?:badge badge-|tag tag-|tag |highlight)(\w*)">(.*?)<\/span>/g;
    let bm;
    while ((bm = badgeRegex.exec(block)) !== null) {
      const type = bm[1] || "hot";
      badges.push({ type, label: extractText(bm[2]) });
    }

    // 링크 + 제목 (링크가 없는 경우 item-title/title div에서 텍스트 추출)
    const linkMatch = block.match(/<a href="(.*?)"[^>]*>([\s\S]*?)<\/a>/);
    let title = linkMatch ? extractText(linkMatch[2]) : "";
    const link = linkMatch ? linkMatch[1] : "";

    // 링크가 없으면 item-title, title, news-title div에서 제목 추출
    if (!title) {
      const titleDivMatch = block.match(
        /<div class="(?:item-title|title|news-title)">([\s\S]*?)<\/div>/
      );
      title = titleDivMatch ? extractText(titleDivMatch[1]) : "";
    }

    // 메타 (다양한 클래스명)
    const metaMatch = block.match(
      /<div class="(?:meta|item-meta|news-meta|source)">([\s\S]*?)<\/div>/
    );
    const meta = metaMatch ? extractText(metaMatch[1]) : "";

    // 설명 (다양한 클래스명)
    const descMatch = block.match(
      /<div class="(?:desc|item-desc|news-desc|description)">([\s\S]*?)<\/div>/
    );
    const description = descMatch ? extractText(descMatch[1]) : "";

    if (title) {
      items.push({ title, link, badges, meta, description });
    }
  }
  return items;
}

function parseBriefingHtml(html: string, date: string): Briefing {
  const dateParam = date.replace(/-/g, "");

  // 날짜 추출
  const dateMatch = html.match(/<div class="date">([\s\S]*?)<\/div>/);
  const displayDate = dateMatch ? extractText(dateMatch[1]) : date;

  const sections: BriefingSection[] = [];

  // 섹션 찾기: <div class="section"> 또는 <section class="section"> (section-title 제외)
  const sectionRegex =
    /<(?:div|section) class="section(?:\s+[^"]*)?(?<!-title)"[^>]*>([\s\S]*?)(?=<(?:div|section) class="section(?:\s|")(?!-title)|<footer|<\/body)/g;

  let sectionMatch;
  while ((sectionMatch = sectionRegex.exec(html)) !== null) {
    const sectionHtml = sectionMatch[1];

    // 섹션 제목: <h2>, <div class="section-title..."> (추가 클래스 허용), <h3>
    const titleMatch =
      sectionHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) ||
      sectionHtml.match(
        /<div class="section-title[^"]*">([\s\S]*?)<\/div>/
      ) ||
      sectionHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);

    const sectionTitle = titleMatch ? extractText(titleMatch[1]) : "";
    if (!sectionTitle) continue;

    const type = classifySectionType(sectionTitle);
    const items = parseItems(sectionHtml);

    if (items.length > 0) {
      sections.push({ title: sectionTitle, type, items });
    }
  }

  // 섹션 래퍼가 없는 형식 — <h2> 직후에 아이템이 바로 나오는 경우
  if (sections.length === 0) {
    const h2Regex =
      /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2[^>]*>|<footer|<\/body)/g;

    while ((sectionMatch = h2Regex.exec(html)) !== null) {
      const sectionTitle = extractText(sectionMatch[1]);
      const sectionContent = sectionMatch[2];
      if (!sectionTitle) continue;

      const type = classifySectionType(sectionTitle);
      const items = parseItems(sectionContent);

      if (items.length > 0) {
        sections.push({ title: sectionTitle, type, items });
      }
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
  // YYYYMMDD -> YYYY-MM-DD (path traversal 방어)
  if (!/^\d{8}$/.test(dateParam)) return null;
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
