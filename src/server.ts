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

// ✅ BUILD DEBUG (to confirm Railway is running THIS code)
const BUILD_ID =
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  `local-${Date.now()}`;

// ✅ HARD CORS (reflect origin) - MUST be before routes
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;

  // debug header (must appear in iwr)
  res.setHeader("x-examcraft-build", BUILD_ID);

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else {
    // curl/postman
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
});

const upload = multer(); // memory storage

/* ---------- ROUTES ---------- */

// health check
app.get("/health", (_req, res) => {
  res.json({ ok: true, build: BUILD_ID });
});

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
  console.log(`✅ PDF service running on port ${PORT} (build=${BUILD_ID})`);
});
