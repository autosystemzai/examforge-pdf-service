import cors from "cors";
import express from "express";
import multer from "multer";
import { extractText } from "./extractText";
import creditsRouter from "./credits.routes";
import { payhipWebhook } from "./payhip.webhook";
import "./db"; // init Postgres pool ONCE

const app = express();

/* ---------- MIDDLEWARES ---------- */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true })); // safe fallback (form-encoded)

// ✅ CORS (MUST be before routes)
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://examforge-v0.vercel.app",
      "https://examforge-v0.vercel.app/",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// (Optional) respond to preflight quickly
app.options("*", cors());

const upload = multer(); // memory storage

/* ---------- ROUTES ---------- */

// health check (pratique pour tester Railway)
app.get("/health", (_req, res) => res.json({ ok: true }));

// existing PDF route
app.post("/extract-text", upload.single("file"), extractText);

// credits routes
app.use("/credits", creditsRouter);

// Payhip webhook + log minimal
app.post("/webhook/payhip", (req, res) => {
  console.log("[payhip webhook] headers:", req.headers["content-type"]);
  console.log("[payhip webhook] body keys:", Object.keys(req.body || {}));
  return payhipWebhook(req, res);
});

/* ---------- START SERVER ---------- */
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ PDF service running on port ${PORT}`);
});
