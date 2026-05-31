#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { verifyUrlWithRetry } from './verify-url.mjs';

const TZ = 'Asia/Seoul';
const root = process.cwd();
const outDir = path.join(root, 'data', 'briefings');
const dateArg = process.argv.find(a => a.startsWith('--date='))?.split('=')[1];
const noDeploy = process.argv.includes('--no-deploy');
const noWrite = process.argv.includes('--no-write');

function kstParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' }).formatToParts(d);
  const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { y: obj.year, m: obj.month, d: obj.day, weekday: obj.weekday };
}
const weekdaysKo = { Monday:'월요일', Tuesday:'화요일', Wednesday:'수요일', Thursday:'목요일', Friday:'금요일', Saturday:'토요일', Sunday:'일요일' };
const date = dateArg || (() => { const p = kstParts(); return `${p.y}-${p.m}-${p.d}`; })();
const dateParam = date.replaceAll('-', '');
const [yy, mm, dd] = date.split('-');
const weekday = weekdaysKo[new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday:'long' }).format(new Date(`${date}T00:00:00+09:00`))] || '';
const displayDate = `${Number(yy)}년 ${Number(mm)}월 ${Number(dd)}일 ${weekday}`;

const sources = [];
function stripTags(s) { return s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'").trim(); }
function esc(s) { return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }
function absHN(url) { return url?.startsWith('item?') ? `https://news.ycombinator.com/${url}` : url; }
function attrClass(name) { return `(?:class=(?:['\"][^'\"]*\\b${name}\\b[^'\"]*['\"]|[^\\s>]*\\b${name}\\b[^\\s>]*))`; }
function safeHost(url, fallback = 'news.hada.io') {
  try { return new URL(url, 'https://news.hada.io').hostname; }
  catch { return fallback; }
}
async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 daily-briefing-bot' } });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return await res.text();
}
async function fetchGeekNews() {
  const html = await fetchText('https://news.hada.io/');
  const items = [];

  // Current GeekNews HTML: each entry is a .topic_row with topictitle/topicdesc blocks.
  // Keep this parser tolerant because class quoting and nested attributes change occasionally.
  const rowRe = new RegExp(`<div ${attrClass('topic_row')}[\\s\\S]*?(?=<div ${attrClass('topic_row')}|<button[^>]*>토픽 더 불러오기|</main>|$)`, 'g');
  let row;
  while ((row = rowRe.exec(html)) && items.length < 30) {
    const block = row[0];
    const linkMatch = block.match(new RegExp(`<div ${attrClass('topictitle')}[\\s\\S]*?<a href=['\"]([^'\"]+)['\"][^>]*>[\\s\\S]*?<h2[^>]*>([\\s\\S]*?)</h2>`));
    if (!linkMatch) continue;
    const title = stripTags(linkMatch[2]);
    const link = new URL(linkMatch[1], 'https://news.hada.io').href;
    const host = stripTags(block.match(new RegExp(`<span ${attrClass('topicurl')}>\\(([^)]*)\\)</span>`))?.[1] || safeHost(link));
    const desc = stripTags(block.match(new RegExp(`<div ${attrClass('topicdesc')}[\\s\\S]*?<a[^>]*>([\\s\\S]*?)</a>`))?.[1] || '');
    items.push({ title, link, source: 'GeekNews', meta: host, body: desc });
  }

  if (items.length) return items;

  // Legacy text-rendered fallback.
  const re = /\n\d+\n▲\n([^\n]+) \(([^)]+)\)\n([\s\S]*?)(?=\n\d+\n▲\n|\n토픽 더 불러오기)/g;
  let m;
  while ((m = re.exec(html)) && items.length < 30) {
    const title = stripTags(m[1]);
    const host = stripTags(m[2]);
    const desc = stripTags(m[3]).split('\n').filter(Boolean)[0] || '';
    items.push({ title, link: `https://${host}`, source: 'GeekNews', meta: host, body: desc });
  }
  return items;
}
async function fetchHN() {
  const [y, m, d] = date.split('-').map(Number);
  const prevLocalNoon = new Date(Date.UTC(y, m - 1, d - 1, 12));
  const days = [date, prevLocalNoon.toISOString().slice(0, 10)];

  const items = [];
  for (const day of days) {
    let html;
    try { html = await fetchText(`https://news.ycombinator.com/front?day=${day}`); }
    catch (e) { console.error(`HN ${day} fetch failed:`, e.message); continue; }
    const re = /<span class="titleline"><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html)) && items.length < 30) {
      items.push({ title: stripTags(m[2]), link: absHN(m[1]), source: 'Hacker News', meta: `HN front ${day}`, body: '' });
    }
    if (items.length) break;
  }
  return items;
}
function loadPreviousTitles() {
  const titles = new Set();
  for (const file of fs.readdirSync(outDir).filter(f => f.endsWith('.html') && f !== `${date}.html`).sort().slice(-10)) {
    const html = fs.readFileSync(path.join(outDir, file), 'utf8');
    for (const m of html.matchAll(/<div class="title">[\s\S]*?<a [^>]*>([\s\S]*?)<\/a>/g)) titles.add(stripTags(m[1]).toLowerCase());
  }
  return titles;
}
function score(item) {
  const s = `${item.title} ${item.body}`.toLowerCase();
  const ai = /\b(ai|llm|agent|claude|codex|openai|gemini|model|inference|copilot|prompt)\b|인공지능|에이전트|모델|코덱스|클로드|제미나이/.test(s);
  const dev = /(code|coding|developer|rust|go |python|typescript|javascript|cli|github|database|kernel|linux|security|cve|browser|web|api|encryption|dns|bpf|코드|코딩|개발|도구|백엔드|아키텍처|노트북|점자|할당자|검색엔진)/.test(s);
  let n = 0; if (ai) n += 5; if (dev) n += 3; if (item.source === 'GeekNews') n += 1;
  if (/(politics|subway|tobacco|pasta|horse|pope|vatican|kid|front yard)/.test(s)) n -= 4;
  return n;
}
function shortDesc(title) {
  const s = title.toLowerCase();
  if (/agent|claude|codex|copilot/.test(s)) return '에이전트';
  if (/llm|model|ai/.test(s)) return 'AI모델';
  if (/security|cve|encrypt|secret|vpn/.test(s)) return '보안기술';
  if (/rust/.test(s)) return '러스트';
  if (/python/.test(s)) return '파이썬';
  if (/go\b|bpf/.test(s)) return 'Go도구';
  if (/cli/.test(s)) return 'CLI도구';
  if (/dns|ipv6/.test(s)) return '네트워크';
  if (/code|coding/.test(s)) return '코딩도구';
  return '개발소식';
}
function tagFor(item) {
  const s = item.title.toLowerCase();
  if (/(security|cve|encrypt|secret|vpn)/.test(s)) return ['SEC','sec','Security'];
  if (/\b(ai|llm|agent|claude|codex|openai|gemini|model|copilot)\b/.test(s)) return ['AI','ai','AI & Agents'];
  return ['DEV','dev','Developer Tools'];
}
function render(items) {
  const groups = { 'AI & Agents': [], 'Developer Tools': [], 'Security': [] };
  for (const item of items) groups[tagFor(item)[2]].push(item);
  const sections = Object.entries(groups).filter(([, arr]) => arr.length).map(([name, arr]) => `\n<div class="section">\n  <h2>${name}</h2>\n${arr.map(item => {
    const [label, cls] = tagFor(item);
    return `  <div class="card">\n    <div class="title"><span class="tag tag-${cls}">${label}</span> <a href="${esc(item.link)}" target="_blank">${esc(item.title)}</a></div>\n    <div class="meta">${esc(item.source)} / ${esc(item.meta)}</div>\n    <div class="desc">${esc(shortDesc(item.title))}</div>\n  </div>`;
  }).join('\n')}\n</div>`).join('\n');
  return `<!DOCTYPE html>\n<html lang="ko">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Daily Briefing — ${date}</title>\n<style>\n  :root { --bg: #0f1117; --card: #1a1d27; --accent: #6c8aff; --text: #e1e4eb; --muted: #8b8fa3; --border: #2a2d3a; --tag-ai: #ff6b6b; --tag-dev: #51cf66; --tag-sec: #da77f2; }\n  * { margin: 0; padding: 0; box-sizing: border-box; }\n  body { font-family: -apple-system, "Pretendard", sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; padding: 2rem 1rem; }\n  .container { max-width: 760px; margin: 0 auto; }\n  header { text-align: center; margin-bottom: 2.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); }\n  header h1 { font-size: 1.6rem; font-weight: 700; color: #fff; letter-spacing: -0.02em; }\n  header .date { color: var(--muted); font-size: 0.9rem; margin-top: 0.3rem; }\n  .section { margin-bottom: 2rem; }\n  .section h2 { font-size: 1.1rem; color: var(--accent); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }\n  .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 1rem 1.2rem; margin-bottom: 0.8rem; }\n  .card .title { font-weight: 600; font-size: 0.95rem; margin-bottom: 0.4rem; }\n  .card .title a { color: #fff; text-decoration: none; }\n  .card .title a:hover { color: var(--accent); }\n  .card .meta { font-size: 0.8rem; color: var(--muted); margin-bottom: 0.5rem; }\n  .card .desc { font-size: 0.88rem; color: var(--text); opacity: 0.85; }\n  .tag { display: inline-block; font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-right: 4px; text-transform: uppercase; }\n  .tag-ai { background: rgba(255,107,107,0.15); color: var(--tag-ai); }\n  .tag-dev { background: rgba(81,207,102,0.15); color: var(--tag-dev); }\n  .tag-sec { background: rgba(218,119,242,0.15); color: var(--tag-sec); }\n  footer { text-align: center; color: var(--muted); font-size: 0.75rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border); }\n</style>\n</head>\n<body>\n<div class="container">\n<header>\n  <h1>Daily Tech Briefing</h1>\n  <div class="date">${displayDate}</div>\n</header>\n${sections}\n<footer>\n  Sources: Hacker News, GeekNews (news.hada.io)\n</footer>\n</div>\n</body>\n</html>\n`;
}
function sh(cmd, args, opts={}) { return execFileSync(cmd, args, { cwd: root, stdio: opts.capture ? 'pipe' : 'inherit', encoding: 'utf8' }); }

const prev = loadPreviousTitles();
const raw = [...await fetchGeekNews().catch(e => (console.error('GeekNews fetch failed:', e.message), [])), ...await fetchHN().catch(e => (console.error('HN fetch failed:', e.message), []))];
function rankCandidates(items, { skipPrevious = true } = {}) {
  const seen = new Set();
  return items
    .filter(i => i.title && i.link)
    .filter(i => !skipPrevious || !prev.has(i.title.toLowerCase()))
    .filter(i => { const k = i.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .map(i => ({...i, _score: score(i)}))
    .sort((a,b) => b._score - a._score);
}
const scored = rankCandidates(raw);
let pool = scored.filter(i => i._score > 0);
if (pool.length < 7) pool = scored.filter(i => i._score > -4);
if (pool.length < 7) pool = rankCandidates(raw, { skipPrevious: false }).filter(i => i._score > -4);
const picked = pool.slice(0, 12);
if (picked.length < 7) throw new Error(`not enough items: ${picked.length}`);
const html = render(picked);
const out = path.join(outDir, `${date}.html`);
if (!noWrite) fs.writeFileSync(out, html);
console.log(`${Number(mm)}/${Number(dd)} 브리핑`);
console.log('');
for (const item of picked) console.log(`- ${stripTags(item.title)}, ${shortDesc(item.title)}`);
console.log('');
console.log(`https://daily-briefing-five.vercel.app/${dateParam}`);

if (!noDeploy) {
  sh('npm', ['run', 'build']);
  sh('git', ['add', `data/briefings/${date}.html`, 'scripts/run-daily-briefing.mjs', 'package.json']);
  const status = sh('git', ['status', '--short'], { capture: true });
  if (status.trim()) {
    try { sh('git', ['commit', '-m', `Add ${date} daily briefing`]); } catch (e) { console.error('git commit failed or no changes'); }
    sh('git', ['push']);
  }
  const url = `https://daily-briefing-five.vercel.app/${dateParam}`;
  await verifyUrlWithRetry(url, { log: message => console.error(message) });
}
