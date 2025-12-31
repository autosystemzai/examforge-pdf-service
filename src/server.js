"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const extractText_1 = require("./extractText");
const app = (0, express_1.default)();
const upload = (0, multer_1.default)(); // stockage mémoire (buffer)
app.post("/extract-text", upload.single("file"), extractText_1.extractText);
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`✅ PDF service running on port ${PORT}`);
});
