import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllDates,
  getBriefingByParam,
  getAdjacentDates,
  type BriefingSection,
  type BriefingItem,
} from "@/lib/briefings";

export function generateStaticParams() {
  return getAllDates().map((date) => ({
    date: date.replace(/-/g, ""),
  }));
}

function BadgeSpan({ badge }: { badge: { label: string; type: string } }) {
  const colors: Record<string, string> = {
    hot: "bg-badge-hot",
    ai: "bg-badge-ai",
    dev: "bg-badge-dev",
    security: "bg-badge-security",
  };
  return (
    <span
      className={`${colors[badge.type] || "bg-gray-600"} text-white text-[10px] font-semibold px-1.5 py-0.5 rounded mr-1.5`}
    >
      {badge.label}
    </span>
  );
}

function Item({ item }: { item: BriefingItem }) {
  return (
    <div className="py-2 border-b border-[#1a1a1a] last:border-b-0">
      <div className="text-sm font-medium text-text-primary leading-snug">
        {item.badges.map((b, i) => (
          <BadgeSpan key={i} badge={b} />
        ))}
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-badge-hot hover:underline transition-colors"
        >
          {item.title}
        </a>
      </div>
      {item.meta && (
        <div className="text-[11px] text-text-dim mt-0.5">{item.meta}</div>
      )}
      {item.description && (
        <div className="text-xs text-text-muted mt-0.5 leading-relaxed">
          {item.description}
        </div>
      )}
    </div>
  );
}

function Section({ section }: { section: BriefingSection }) {
  const titleColors: Record<string, string> = {
    ai: "text-badge-ai",
    dev: "text-badge-dev",
    security: "text-badge-security",
    notable: "text-badge-hot",
  };

  return (
    <div className="mb-4">
      <h2
        className={`text-xs font-semibold uppercase tracking-widest ${titleColors[section.type] || "text-badge-hot"} mb-2 pb-1.5 border-b border-[#1e1e1e]`}
      >
        {section.title}
      </h2>
      {section.items.map((item, i) => (
        <Item key={i} item={item} />
      ))}
    </div>
  );
}

export default async function BriefingPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date: dateParam } = await params;
  const briefing = getBriefingByParam(dateParam);
  if (!briefing) notFound();

  const adjacent = getAdjacentDates(briefing.date);
  const prevParam = adjacent.prev?.replace(/-/g, "");
  const nextParam = adjacent.next?.replace(/-/g, "");

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-5">
        <header className="flex items-center justify-between mb-5 pb-3 border-b border-border">
          <Link
            href="/"
            className="text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            ← Home
          </Link>
          <div className="text-right">
            <h1 className="text-base font-bold text-text-primary tracking-tight">
              Daily Tech Briefing
            </h1>
            <div className="text-xs text-text-muted">
              {briefing.displayDate}
            </div>
          </div>
        </header>

        {briefing.sections.map((section, i) => (
          <Section key={i} section={section} />
        ))}

        <nav className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          {prevParam ? (
            <Link
              href={`/${prevParam}`}
              className="text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              ← {adjacent.prev}
            </Link>
          ) : (
            <span />
          )}
          {nextParam ? (
            <Link
              href={`/${nextParam}`}
              className="text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              {adjacent.next} →
            </Link>
          ) : (
            <span />
          )}
        </nav>

        <footer className="text-center mt-6 pt-3 border-t border-border text-[11px] text-text-dim">
          Sources: Hacker News, GeekNews (news.hada.io)
        </footer>
      </div>
    </div>
  );
}
