import express from "express";
import multer from "multer";
import { extractText } from "./extractText";

const app = express();
const upload = multer(); // stockage mémoire (buffer)

app.post("/extract-text", upload.single("file"), extractText);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ PDF service running on port ${PORT}`);
});
