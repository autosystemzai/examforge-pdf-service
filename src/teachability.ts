// src/teachability.ts
export type Para = {
  id: string;       // p01-03
  page: number;     // 1-based
  text: string;
  score: number;
  flags: string[];
};

const PAGE_BREAK = "<<<PAGE_BREAK>>>";

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMatches(s: string, re: RegExp): number {
  const m = s.match(re);
  return m ? m.length : 0;
}

function mojibakeScore(s: string): number {
  // simple: ratio of replacement chars and box-drawing / weird latin blocks
  const bad =
    countMatches(s, /�/g) +
    countMatches(s, /[ÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß]/g) +
    countMatches(s, /[│┘┐┌└├┤┬┴┼]/g);
  const denom = Math.max(1, s.length);
  return bad / denom; // 0..1
}

function splitPages(cleanedText: string): string[] {
  return cleanedText
    .split(PAGE_BREAK)
    .map((p) => p.replace(/\n{3,}/g, "\n\n").trim())
    .filter((p) => p.length > 0);
}

function pageToParagraphs(pageText: string): string[] {
  const lines = pageText
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const paras: string[] = [];
  let buf: string[] = [];

  const isHeading = (l: string) => {
    if (l.length > 90) return false;
    if (/[.!?؟]$/.test(l)) return false;
    return /(chapitre|section|partie|cours|lesson|الفصل|القسم|الباب|المبحث|المطلب|تمهيد|مقدمة)/i.test(l)
      || /^[\d\u0660-\u0669]{1,3}\s*[\)\.\-–—]/.test(l);
  };

  const isListItem = (l: string) =>
    /^(\-|•|\*|[0-9]{1,2}[\)\.\-]|[IVX]+\.)\s+/.test(l) ||
    /^[\d\u0660-\u0669]{1,2}[\)\.\-]\s+/.test(l);

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];

    if (isHeading(l)) {
      if (buf.length) {
        paras.push(buf.join(" ").trim());
        buf = [];
      }
      paras.push(l);
      continue;
    }

    if (isListItem(l)) {
      if (buf.length) {
        paras.push(buf.join(" ").trim());
        buf = [];
      }
      paras.push(l);
      continue;
    }

    buf.push(l);

    const ends = /[.!?؟:]$/.test(l);
    const next = lines[i + 1];
    const nextLooksNew =
      next && (isHeading(next) || isListItem(next) || next.length < 40);

    if (ends && nextLooksNew) {
      paras.push(buf.join(" ").trim());
      buf = [];
    }
  }

  if (buf.length) paras.push(buf.join(" ").trim());

  // keep only non-trivial
  return paras.filter((p) => p.length >= 40);
}

function looksLikeTOCLine(l: string): boolean {
  if (/\.\.{3,}\s*[\d\u0660-\u0669]{1,4}\s*$/.test(l)) return true;
  if (/\s[\d\u0660-\u0669]{1,4}\s*$/.test(l) && l.length <= 90) return true;
  return false;
}

function isCopyrightLike(p: string): boolean {
  return /(all rights reserved|copyright|isbn|éditeur|edition|imprim|حقوق الطبع|جميع الحقوق محفوظة|دار النشر)/i.test(p);
}

function isPrefaceLike(p: string): boolean {
  return /(avant-propos|préface|remerciements|acknowledg|dedicace|مقدمة|تمهيد|شكر|إهداء)/i.test(p);
}

function isBiblioLike(p: string): boolean {
  return /(bibliographie|références|references|index|المراجع|فهرس|قائمة المراجع)/i.test(p);
}

function pedagogicalMarkers(p: string): number {
  let s = 0;

  // FR / EN
  if (/(définition|on appelle|on note|propriété|théorème|remarque|exemple|méthode|étapes|résumé|definition|example|method|steps|rule)/i.test(p)) s += 3;

  // AR
  if (/(تعريف|يعرف|ملاحظة|مثال|قاعدة|نظرية|خاصية|استنتاج|خطوات|ملخص|شرح|تفسير)/.test(p)) s += 3;

  // logique
  if (/(si\s+.*alors|donc|ainsi|par conséquent|⇒|->|إذا.+فإن)/i.test(p)) s += 2;

  // structure explicative
  if (/:/.test(p) && p.length > 80) s += 1;
  if (/(\-|•|\*|[0-9]{1,2}[\)\.\-])\s+/.test(p)) s += 1;

  // droit / structure académique (souvent pédagogique)
  if (/(article|chapitre|section|المادة|الفصل|المبحث|المطلب)/i.test(p) && p.length > 90) s += 1;

  return s;
}

function scoreParagraph(p: string): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  const len = p.length;
  if (len >= 90 && len <= 900) score += 2;
  else if (len < 60) score -= 2;
  else if (len > 1500) score -= 1;

  // penalties
  if (looksLikeTOCLine(p)) {
    score -= 6;
    flags.push("toc_like");
  }
  if (isCopyrightLike(p)) {
    score -= 6;
    flags.push("copyright_like");
  }
  if (isPrefaceLike(p)) {
    score -= 4;
    flags.push("preface_like");
  }
  if (isBiblioLike(p)) {
    score -= 4;
    flags.push("biblio_like");
  }

  // low content
  const letterish = countMatches(p, /[A-Za-zÀ-ÿ\u0600-\u06FF]/g);
  if (letterish < 20) score -= 3;

  // pedagogical bonus
  score += pedagogicalMarkers(p);

  return { score, flags };
}

export function buildTeachability(cleanedText: string) {
  const pages = splitPages(cleanedText);

  const paras: Para[] = [];
  pages.forEach((pageText, idx) => {
    const pageNum = idx + 1;
    const pageParas = pageToParagraphs(pageText);

    pageParas.forEach((t, j) => {
      const { score, flags } = scoreParagraph(t);
      paras.push({
        id: `p${String(pageNum).padStart(2, "0")}-${String(j + 1).padStart(2, "0")}`,
        page: pageNum,
        text: t,
        score,
        flags,
      });
    });
  });

  // Drop front-matter pages automatically
  const maxCheckPages = Math.min(8, pages.length);
  let cutUntil = 0;

  for (let page = 1; page <= maxCheckPages; page++) {
    const pageParas = paras.filter((p) => p.page === page);
    if (pageParas.length === 0) continue;

    const avg = pageParas.reduce((a, x) => a + x.score, 0) / pageParas.length;
    const bad = pageParas.filter((x) =>
      x.flags.includes("toc_like") ||
      x.flags.includes("copyright_like") ||
      x.flags.includes("preface_like")
    ).length;

    const badRatio = bad / pageParas.length;

    if (avg < -1.0 && badRatio > 0.35) cutUntil = page;
    else break;
  }

  const parasNoFront = cutUntil > 0 ? paras.filter((p) => p.page > cutUntil) : paras;

  // Sort by score desc + light diversity
  const sorted = [...parasNoFront].sort((a, b) => b.score - a.score);

  const picked: Para[] = [];
  const seen = new Set<string>();

  for (const p of sorted) {
    if (picked.length >= 120) break;      // V0: 120 paras max
    if (p.score < 1) break;               // stop once not pedagogical

    const k = normalizeKey(p.text).slice(0, 90);
    if (seen.has(k)) continue;

    // avoid ultra short headings unless they contain ":" or arabic comma
    if (p.text.length < 65 && !/[:،]/.test(p.text)) continue;

    picked.push(p);
    seen.add(k);
  }

  const selectedText = picked
    .map((p) => `[${p.id} | Page ${p.page}]\n${p.text}`)
    .join("\n\n");

  // stats
  const flagsCount: Record<string, number> = {};
  for (const p of paras) {
    for (const f of p.flags) flagsCount[f] = (flagsCount[f] ?? 0) + 1;
  }

  const moj = mojibakeScore(cleanedText);

  return {
    paragraphs: paras,
    selectedParas: picked,
    selectedText,
    cutFrontMatterUntilPage: cutUntil,
    flagsCount,
    mojibakeRatio: moj,
  };
}
