import express from "express";
import multer from "multer";
import { Pool } from "pg";
import { extractText } from "./extractText";

// ---------- Postgres ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test connexion DB au démarrage
pool.query("select 1")
  .then(() => console.log("✅ Postgres connected"))
  .catch((err) => console.error("❌ Postgres connection error", err));

// ---------- Express ----------
const app = express();
const upload = multer(); // stockage mémoire (buffer)

app.post("/extract-text", upload.single("file"), extractText);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ PDF service running on port ${PORT}`);
});
