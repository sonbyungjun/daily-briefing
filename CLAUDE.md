# Daily Briefing Website

## 프로젝트 개요
매일 생성되는 AI/개발 트렌드 브리핑을 웹으로 열람할 수 있는 사이트.

## 기술 스택
- **프레임워크**: Next.js 15 (App Router)
- **스타일링**: Tailwind CSS
- **배포**: Vercel
- **언어**: TypeScript

## 데이터 소스
- 브리핑 HTML 파일: `/Users/sanghyuk/.openclaw/workspace/briefing/` 디렉토리
- 파일 형식: `YYYY-MM-DD.html` (예: `2026-03-06.html`)
- 현재 31개 파일 존재 (2026-02-03 ~ 2026-03-06)
- 각 HTML 파일은 독립적인 브리핑 페이지 (스타일 포함)

## URL 구조
- `/` — 메인 페이지 (최신 브리핑 + 아카이브 목록)
- `/YYYYMMDD` — 일자별 브리핑 상세 (예: `/20260306`)

## 페이지 요구사항

### 메인 페이지 (`/`)
- 최신 브리핑 요약 표시
- 날짜별 아카이브 목록 (최신순)
- 각 날짜 클릭 시 해당 브리핑 페이지로 이동

### 브리핑 상세 페이지 (`/YYYYMMDD`)
- 해당 날짜의 브리핑 내용 표시
- HTML 파일의 콘텐츠를 파싱하여 Next.js 컴포넌트로 렌더링
- 이전/다음 브리핑 네비게이션
- 메인으로 돌아가기 링크

## 데이터 처리
- 빌드 시점에 briefing 디렉토리의 HTML 파일을 읽어서 정적 생성 (SSG)
- HTML 파싱: 각 파일에서 제목, 날짜, 섹션(AI & LLM, Agent & Dev Tools, Security, Notable), 아이템(제목, 링크, 출처, 설명) 추출
- `generateStaticParams`로 모든 날짜의 페이지를 사전 생성

## 디자인
- 다크 테마 (기존 브리핑 HTML의 #0f0f0f 배경 톤 유지)
- 미니멀하고 읽기 쉬운 레이아웃
- 모바일 반응형
- 섹션별 색상 구분 (AI: 보라, DEV: 파랑, SEC: 빨강, HOT: 주황)

## 브리핑 HTML 구조 예시
```html
<div class="section">
  <div class="section-title">AI &amp; LLM</div>
  <div class="item">
    <div class="item-title">
      <span class="badge badge-hot">HOT</span>
      <span class="badge badge-ai">AI</span>
      <a href="https://..." target="_blank">제목</a>
    </div>
    <div class="item-meta">출처 | HN 565p</div>
    <div class="item-desc">설명...</div>
  </div>
</div>
```

## 빌드 & 배포
- `npm run build` → Vercel 배포
- briefing 디렉토리를 프로젝트에 복사하거나 심볼릭 링크로 연결
- Vercel 배포 시 `data/` 디렉토리에 브리핑 파일 포함

## 중요사항
- 프로젝트 초기화: `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --use-npm`
- briefing HTML 파일들을 `data/briefings/` 디렉토리로 복사해서 프로젝트에 포함
- 파서가 견고해야 함 — HTML 구조가 약간 달라도 동작해야 함
