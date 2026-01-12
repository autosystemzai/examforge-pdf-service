// src/extractText.ts
import pdfParse from "pdf-parse";
import { cleanText } from "./cleanText";
import { buildTeachability } from "./teachability";
import { Request, Response } from "express";

const PAGE_BREAK = "\n<<<PAGE_BREAK>>>\n";

type PdfTextItem = {
  str?: string;
  transform?: number[]; // [a,b,c,d,e,f] where e=x, f=y (pdfjs)
};

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const arr = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

function countArabicChars(s: string): number {
  // Arabic block + Arabic supplement + presentation forms (good enough)
  const m = s.match(
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g
  );
  return m ? m.length : 0;
}

export async function extractText(req: Request, res: Response) {
  try {
    const file = req.file as Express.Multer.File | undefined;

    if (!file) {
      return res.status(400).json({
        status: "ERROR",
        step: "C5",
        message: "NO_FILE_PROVIDED",
      });
    }

    const parsed = await pdfParse(file.buffer, {
      pagerender: async (pageData: any) => {
        const textContent = await pageData.getTextContent();
        const items: PdfTextItem[] = (textContent?.items || []) as PdfTextItem[];

        // Extract tokens with coords + pseudo font size
        const tokens = items
          .map((it) => {
            const s = (it.str ?? "").toString().replace(/\s+/g, " ").trim();
            const tr = it.transform || [];
            const x = typeof tr[4] === "number" ? tr[4] : 0;
            const y = typeof tr[5] === "number" ? tr[5] : 0;

            // Approx font size / scale:
            // pdfjs transform: a and d often relate to font size/scale
            const fs = Math.max(Math.abs(tr[0] ?? 0), Math.abs(tr[3] ?? 0));

            return { s, x, y, fs };
          })
          .filter((t) => t.s.length > 0);

        if (tokens.length === 0) return PAGE_BREAK;

        // Dynamic Y tolerance based on median font size
        const fsMed = median(tokens.map((t) => t.fs).filter((n) => n > 0));
        const Y_TOL = Math.max(2, Math.round(fsMed * 0.6) || 2);

        // Bucket by line (y rounded)
        const buckets = new Map<number, { x: number; s: string; fs: number }[]>();
        for (const t of tokens) {
          const yKey = Math.round(t.y / Y_TOL) * Y_TOL;
          const arr = buckets.get(yKey) ?? [];
          arr.push({ x: t.x, s: t.s, fs: t.fs });
          buckets.set(yKey, arr);
        }

        // Sort lines top->bottom (higher y first)
        const ys = Array.from(buckets.keys()).sort((a, b) => b - a);

        const lines: string[] = [];
        let prevY: number | null = null;

        for (const y of ys) {
          const lineTokens = buckets.get(y)!;

          // Detect RTL if line is mostly Arabic
          const ar = lineTokens.reduce((acc, t) => acc + countArabicChars(t.s), 0);
          const totalLen = lineTokens.reduce((acc, t) => acc + t.s.length, 0);
          const isRTL = ar >= Math.max(6, Math.floor(totalLen * 0.25)); // heuristic

          // Sort tokens by x depending on direction
          lineTokens.sort((a, b) => (isRTL ? b.x - a.x : a.x - b.x));

          const line = lineTokens
            .map((t) => t.s)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();

          if (!line) continue;

          // Insert paragraph breaks based on vertical gap (helps structure)
          if (prevY !== null) {
            const gap = Math.abs(prevY - y);
            // big gap => new paragraph
            const gapThreshold = Math.max(10, fsMed * 1.6 || 16);
            if (gap >= gapThreshold) lines.push("");
          }

          lines.push(line);
          prevY = y;
        }

        const pageText = lines.join("\n").trim();
        return pageText + PAGE_BREAK;
      },
    });

    if (!parsed.text || !parsed.text.trim()) {
      return res.status(400).json({
        status: "ERROR",
        step: "C5",
        message: "PDF_EMPTY_OR_UNREADABLE",
      });
    }

    const cleanedText = cleanText(parsed.text);

    // ✅ NEW: teachability filter (select only pedagogical parts)
    const teach = buildTeachability(cleanedText);

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.json({
      status: "OK",
      step: "C5",
      rawLength: parsed.text.length,
      cleanedLength: cleanedText.length,

      // same as before
      preview: cleanedText.slice(0, 300),
      cleanedText,

      // ✅ NEW: outputs for examforge
      selectedText: teach.selectedText,
      selectedCount: teach.selectedParas.length,
      paragraphsCount: teach.paragraphs.length,
      cutFrontMatterUntilPage: teach.cutFrontMatterUntilPage,
      flagsCount: teach.flagsCount,
      mojibakeRatio: teach.mojibakeRatio,

      // OPTIONAL (debug only):
      // selectedParas: teach.selectedParas,
    });
  } catch (err: any) {
    console.error("C5 ERROR:", err);
    return res.status(500).json({
      status: "ERROR",
      step: "C5",
      message: err?.message || "C5_FAILED",
    });
  }
}
