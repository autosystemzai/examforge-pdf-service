import express from "express";
import multer from "multer";
import { extractText } from "./extractText";
import creditsRouter from "./credits.routes";
import { payhipWebhook } from "./payhip.webhook";
import "./db"; // init Postgres pool ONCE

const app = express();

/* ---------- MIDDLEWARES ---------- */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ✅ BUILD DEBUG
const BUILD_ID =
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  `local-${Date.now()}`;

// ✅ HARD CORS (reflect origin) - MUST be before routes
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;

  res.setHeader("x-examcraft-build", BUILD_ID);

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
});

// ✅ Multer config (IMPORTANT)
// Ajuste la taille selon ton besoin. 25MB est safe pour la plupart des cours.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
    files: 1,
  },
});

/* ---------- ROUTES ---------- */

// health check
app.get("/health", (_req, res) => {
  res.json({ ok: true, build: BUILD_ID });
});

// PDF route
app.post("/extract-text", (req, res, next) => {
  upload.single("file")(req as any, res as any, (err: any) => {
    if (err) {
      // ✅ Always return JSON (so your Next route won't crash on JSON.parse)
      const code =
        err?.code === "LIMIT_FILE_SIZE" ? 413 : 400;

      return res.status(code).json({
        status: "ERROR",
        step: "C5",
        message:
          err?.code === "LIMIT_FILE_SIZE"
            ? "FILE_TOO_LARGE"
            : "UPLOAD_FAILED",
        details: err?.message || String(err),
        build: BUILD_ID,
      });
    }
    next();
  });
}, extractText);

// credits routes
app.use("/credits", creditsRouter);

// Payhip webhook + log minimal
app.post("/webhook/payhip", (req, res) => {
  console.log("[payhip webhook] headers:", req.headers["content-type"]);
  console.log("[payhip webhook] body keys:", Object.keys(req.body || {}));
  return payhipWebhook(req, res);
});

/* ---------- GLOBAL ERROR HANDLER (optional but good) ---------- */
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("UNHANDLED ERROR:", err);
  return res.status(500).json({
    status: "ERROR",
    message: "INTERNAL_ERROR",
    details: err?.message || String(err),
    build: BUILD_ID,
  });
});

/* ---------- START SERVER ---------- */
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ PDF service running on port ${PORT} (build=${BUILD_ID})`);
});
