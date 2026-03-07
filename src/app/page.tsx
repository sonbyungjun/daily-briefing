import Link from "next/link";
import { getAllDates, getBriefing } from "@/lib/briefings";
import { BriefingSection } from "@/lib/briefings";

function getBadgeColor(type: string): string {
  const colors: Record<string, string> = {
    hot: "bg-badge-hot",
    ai: "bg-badge-ai",
    dev: "bg-badge-dev",
    security: "bg-badge-security",
  };
  return colors[type] || "bg-gray-600";
}

function SectionPreview({ section }: { section: BriefingSection }) {
  const borderColors: Record<string, string> = {
    ai: "border-l-badge-ai",
    dev: "border-l-badge-dev",
    security: "border-l-badge-security",
    notable: "border-l-badge-hot",
  };

  return (
    <div
      className={`border-l-2 ${borderColors[section.type] || "border-l-gray-600"} pl-3 mb-3`}
    >
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1">
        {section.title}
      </h3>
      <ul className="space-y-1">
        {section.items.slice(0, 3).map((item, i) => (
          <li key={i} className="text-[13px] leading-snug">
            <span className="inline-flex gap-0.5 mr-1">
              {item.badges.map((b, j) => (
                <span
                  key={j}
                  className={`${getBadgeColor(b.type)} text-white text-[9px] font-semibold px-1 py-0.5 rounded`}
                >
                  {b.label}
                </span>
              ))}
            </span>
            <span className="text-text-primary">{item.title}</span>
          </li>
        ))}
        {section.items.length > 3 && (
          <li className="text-[11px] text-text-dim">
            +{section.items.length - 3}건 더보기
          </li>
        )}
      </ul>
    </div>
  );
}

export default function Home() {
  const dates = getAllDates();
  const latestBriefing = dates.length > 0 ? getBriefing(dates[0]) : null;

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-5">
        <header className="text-center mb-6 pb-4 border-b border-border">
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Daily Tech Briefing
          </h1>
          <p className="text-xs text-text-muted mt-1">
            AI / Dev / Security trends, daily
          </p>
        </header>

        {latestBriefing && (
          <section className="mb-8">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-base font-semibold text-text-primary">
                Latest
              </h2>
              <Link
                href={`/${latestBriefing.dateParam}`}
                className="text-sm text-badge-hot hover:underline"
              >
                {latestBriefing.displayDate}
              </Link>
            </div>
            <div className="bg-bg-card rounded-lg p-4 border border-border">
              {latestBriefing.sections.map((section, i) => (
                <SectionPreview key={i} section={section} />
              ))}
              <Link
                href={`/${latestBriefing.dateParam}`}
                className="inline-block mt-2 text-sm text-badge-hot hover:underline"
              >
                전체 보기 →
              </Link>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3">
            Archive
          </h2>
          <div className="grid gap-1.5">
            {dates.map((date) => {
              const param = date.replace(/-/g, "");
              return (
                <Link
                  key={date}
                  href={`/${param}`}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg-card border border-border hover:bg-bg-hover transition-colors"
                >
                  <span className="text-sm text-text-primary">{date}</span>
                  <span className="text-xs text-text-dim">→</span>
                </Link>
              );
            })}
          </div>
        </section>

        <footer className="text-center mt-8 pt-4 border-t border-border text-[11px] text-text-dim">
          Sources: Hacker News, GeekNews (news.hada.io)
        </footer>
      </div>
    </div>
  );
}
