import pdfParse from "pdf-parse";
import { cleanText } from "./cleanText";
import { Request, Response } from "express";

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

    const parsed = await pdfParse(file.buffer);

    if (!parsed.text || !parsed.text.trim()) {
      return res.status(400).json({
        status: "ERROR",
        step: "C5",
        message: "PDF_EMPTY_OR_UNREADABLE",
      });
    }

    const cleanedText = cleanText(parsed.text);

    return res.json({
      status: "OK",
      step: "C5",
      rawLength: parsed.text.length,
      cleanedLength: cleanedText.length,
      preview: cleanedText.slice(0, 300),
      cleanedText,
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
