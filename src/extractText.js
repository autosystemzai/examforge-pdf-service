"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractText = extractText;
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const cleanText_1 = require("./cleanText");
async function extractText(req, res) {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({
                status: "ERROR",
                step: "C5",
                message: "NO_FILE_PROVIDED",
            });
        }
        const parsed = await (0, pdf_parse_1.default)(file.buffer);
        if (!parsed.text || !parsed.text.trim()) {
            return res.status(400).json({
                status: "ERROR",
                step: "C5",
                message: "PDF_EMPTY_OR_UNREADABLE",
            });
        }
        const cleanedText = (0, cleanText_1.cleanText)(parsed.text);
        return res.json({
            status: "OK",
            step: "C5",
            rawLength: parsed.text.length,
            cleanedLength: cleanedText.length,
            preview: cleanedText.slice(0, 300),
            cleanedText,
        });
    }
    catch (err) {
        console.error("C5 ERROR:", err);
        return res.status(500).json({
            status: "ERROR",
            step: "C5",
            message: (err === null || err === void 0 ? void 0 : err.message) || "C5_FAILED",
        });
    }
}
