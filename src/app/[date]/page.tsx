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
    <div className="py-3.5 border-b border-[#1a1a1a] last:border-b-0">
      <div className="text-[15px] font-semibold text-text-primary">
        {item.badges.map((b, i) => (
          <BadgeSpan key={i} badge={b} />
        ))}
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-badge-hot transition-colors"
        >
          {item.title}
        </a>
      </div>
      {item.meta && (
        <div className="text-xs text-text-dim mt-1">{item.meta}</div>
      )}
      {item.description && (
        <div className="text-[13px] text-text-muted mt-1.5">
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
    <div className="mb-7">
      <h2
        className={`text-sm font-semibold uppercase tracking-widest ${titleColors[section.type] || "text-badge-hot"} mb-3.5 pb-2 border-b border-[#1e1e1e]`}
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
      <div className="max-w-2xl mx-auto px-4 py-8">
        <header className="text-center mb-8 pb-5 border-b border-border">
          <Link
            href="/"
            className="text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            ← Home
          </Link>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight mt-3">
            Daily Tech Briefing
          </h1>
          <div className="text-[13px] text-text-muted mt-1.5">
            {briefing.displayDate}
          </div>
        </header>

        {briefing.sections.map((section, i) => (
          <Section key={i} section={section} />
        ))}

        <nav className="flex items-center justify-between mt-10 pt-5 border-t border-border">
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

        <footer className="text-center mt-8 pt-4 border-t border-border text-[11px] text-text-dim">
          Sources: Hacker News, GeekNews (news.hada.io)
        </footer>
      </div>
    </div>
  );
}
