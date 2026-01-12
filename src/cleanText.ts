// src/cleanText.ts
export function cleanText(raw: string): string {
  if (!raw) return "";

  const PAGE_BREAK = "<<<PAGE_BREAK>>>";

  let text = raw;

  /* =====================
   * 1) Normalisation
   * ===================== */
  text = text.replace(/\r/g, "");
  text = text.replace(/\u00A0/g, " "); // NBSP
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/[^\S\n]+/g, " "); // espaces multiples hors \n

  // Dé-césure PDF: "eco-\nnomie" => "economie"
  text = text.replace(/-\n(\p{L})/gu, "$1");

  /* =====================
   * 2) Split pages
   * ===================== */
  const rawPages = text.includes(PAGE_BREAK) ? text.split(PAGE_BREAK) : [text];

  const normalizeLineKey = (l: string) =>
    l.trim().replace(/[ \t]+/g, " ").toLowerCase();

  const isIsolatedPageNumber = (l: string) => {
    const s = l.trim();
    if (!s) return true;
    if (/^\d{1,4}$/.test(s)) return true; // "12"
    if (/^(page|p\.?)\s*\d{1,4}$/i.test(s)) return true; // "page 12", "p.12"
    if (/^ص\s*\d{1,4}$/i.test(s)) return true; // "ص 12"
    return false;
  };

  /* =====================
   * 3) Rehydrate lines (critical)
   * - If a page comes as a single huge line (because pagerender joined by spaces),
   *   we recreate likely line breaks so TOC + headers are detectable.
   * ===================== */
  const rehydratePage = (p: string) => {
    const trimmed = p.replace(/\n{3,}/g, "\n\n").trim();
    if (!trimmed) return trimmed;

    const lines = trimmed.split("\n").map((x) => x.trim()).filter(Boolean);

    // If already has reasonable line structure, keep it
    if (lines.length >= 6) return trimmed;

    // If it is a single long line, inject breaks before common structural markers
    if (lines.length <= 2 && trimmed.length >= 600) {
      let s = trimmed;

      // Break before Arabic structural headers
      s = s.replace(
        /\s+(الجزء|الفصل|الباب|المبحث|المطلب|تمهيد|مقدمة)\b/g,
        "\n$1"
      );

      // Break before common English headers
      s = s.replace(/\s+(part|chapter|contents|table of contents)\b/gi, "\n$1");

      // Break before numbered lesson patterns like: "1)" or "١)" or "1-" / "١-"
      s = s.replace(
        /(\s)([\d\u0660-\u0669]{1,3})\s*([)\-–—])\s*/g,
        "\n$2$3 "
      );

      // Break before "عنوان .... 12" style when merged
      // (helps TOC streak)
      s = s.replace(/\s+(\.{3,}\s*[\d\u0660-\u0669]{1,4})/g, "\n$1");

      // Break before page-number-leading titles like: "77٦- ..."
      s = s.replace(
        /(\s)([\d\u0660-\u0669]{1,4})(?=\s*[\p{L}\p{Script=Arabic}])/gu,
        "\n$2"
      );

      return s;
    }

    return trimmed;
  };

  /* =====================
   * 4) Prepare pages (light)
   * ===================== */
  let pages = rawPages
    .map(rehydratePage)
    .map((p) => p.replace(/\n{3,}/g, "\n\n").trim())
    .filter((p) => p.length > 20);

  /* =====================
   * 5) Detect & remove TOC pages
   * ===================== */
  const looksLikeTOCPage = (p: string) => {
    const lower = p.toLowerCase();
    const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);

    if (lines.length < 10) return false;

    const hasKeyword =
      /sommaire|table des matières|table des matieres|contents|table of contents/.test(lower) ||
      /فهرس|المحتويات|جدول المحتويات|قائمة المحتويات/.test(p);

    const dotted = (p.match(/\.{3,}/g) || []).length;
    const endsWithNum = lines.filter((l) => /[\d\u0660-\u0669]{1,4}\s*$/.test(l)).length;
    const shortLines = lines.filter((l) => l.length < 80).length;

    const strong =
      dotted >= 6 ||
      (lines.length >= 12 &&
        endsWithNum >= Math.ceil(lines.length * 0.45) &&
        shortLines >= Math.ceil(lines.length * 0.6));

    return hasKeyword || strong;
  };

  pages = pages.filter((p) => !looksLikeTOCPage(p));

  /* =====================
   * 6) Header/footer frequency by page
   * ===================== */
  const perPageLines = pages.map((p) =>
    p.split("\n").map((l) => l.trim()).filter(Boolean)
  );

  const PAGES_COUNT = Math.max(1, perPageLines.length);
  const REP_THRESHOLD =
    PAGES_COUNT >= 10 ? Math.ceil(PAGES_COUNT * 0.5) : Math.ceil(PAGES_COUNT * 0.7);

  const headerFooterFreq = new Map<string, number>();

  for (const lines of perPageLines) {
    const head = lines.slice(0, 3);
    const tail = lines.slice(-3);

    const uniq = new Set<string>();
    for (const l of [...head, ...tail]) {
      const key = normalizeLineKey(l);
      if (key.length < 8 || key.length > 100) continue;
      uniq.add(key);
    }

    for (const key of uniq) {
      headerFooterFreq.set(key, (headerFooterFreq.get(key) ?? 0) + 1);
    }
  }

  const isRepeatingHeaderFooter = (l: string) => {
    const key = normalizeLineKey(l);
    return (headerFooterFreq.get(key) ?? 0) >= REP_THRESHOLD;
  };

  /* =====================
   * 7) Remove isolated page nums + repeating headers/footers
   * ===================== */
  const cleanedPagesLines: string[][] = perPageLines.map((lines) => {
    const out: string[] = [];
    for (const l0 of lines) {
      const l = l0.replace(/[ \t]+/g, " ").trim();
      if (!l) continue;

      if (isIsolatedPageNumber(l)) continue;
      if (isRepeatingHeaderFooter(l)) continue;

      out.push(l);
    }
    return out;
  });

  /* =====================
   * 8) Strip TOC streaks that survived
   * ===================== */
  const isTocLine = (l: string) => {
    if (!l) return false;
    if (/\.\.{3,}\s*[\d\u0660-\u0669]{1,4}$/.test(l)) return true;
    if (/(الفصل|الباب|المبحث|المطلب)\s+.*\s+[\d\u0660-\u0669]{1,4}$/.test(l)) return true;
    if (/^[\p{L}\p{Script=Arabic}].*\s+[\d\u0660-\u0669]{1,4}$/u.test(l) && l.length <= 80) return true;
    return false;
  };

  const afterTocStrip: string[] = [];
  let tocStreak = 0;
  let skippingToc = false;

  for (const pageLines of cleanedPagesLines) {
    for (const l of pageLines) {
      if (isTocLine(l)) tocStreak++;
      else tocStreak = Math.max(0, tocStreak - 1);

      if (tocStreak >= 6) skippingToc = true;

      // leave TOC once we see a real paragraph
      if (skippingToc && !isTocLine(l) && l.length >= 140) {
        skippingToc = false;
        tocStreak = 0;
      }

      if (!skippingToc) afterTocStrip.push(l);
    }
    afterTocStrip.push(""); // keep page structure
  }

  /* =====================
   * 9) Noise filter (not aggressive)
   * ===================== */
  const keepShortLine = (l: string) => {
    // keep legal references
    if (/(المادة|مادة)\s*\(?\s*[\d\u0660-\u0669]{1,4}\s*\)?/i.test(l)) return true;
    if (/(article|art\.)\s*[\d\u0660-\u0669]{1,4}/i.test(l)) return true;

    // keep if has 2 “heavy” words
    const toks = l.split(/\s+/).filter((t) => t.length >= 4);
    return toks.length >= 2;
  };

  let lines = afterTocStrip
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => (l.length >= 18 ? true : keepShortLine(l)));

  /* =====================
   * 10) Controlled dedupe (max 2 occurrences)
   * ===================== */
  const seenCount = new Map<string, number>();
  lines = lines.filter((l) => {
    const key = normalizeLineKey(l);
    const c = (seenCount.get(key) ?? 0) + 1;
    seenCount.set(key, c);
    return c <= 2;
  });

  /* =====================
   * 11) Recompose
   * ===================== */
  text = lines.join("\n");
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  /* =====================
   * 12) Safe limit with distributed sampling (coverage)
   * ===================== */
  const MAX_CHARS = 200000;
  if (text.length > MAX_CHARS) {
    const k = 5;
    const window = Math.floor(MAX_CHARS / k);

    if (text.length <= window) return text.slice(0, MAX_CHARS);

    const maxStart = Math.max(0, text.length - window);
    const step = k <= 1 ? 0 : Math.floor(maxStart / (k - 1));

    const parts: string[] = [];
    for (let i = 0; i < k; i++) {
      const start = Math.min(maxStart, i * step);
      parts.push(text.slice(start, start + window));
    }
    text = parts.join("\n\n");
  }

  return text;
}
