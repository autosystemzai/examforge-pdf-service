import express from "express";
import multer from "multer";
import { extractText } from "./extractText";
import creditsRouter from "./credits.routes";
import { payhipWebhook } from "./payhip.webhook";
import "./db"; // init Postgres pool ONCE

const app = express();

/* ---------- MIDDLEWARES ---------- */
app.use(express.json()); // REQUIRED for Payhip webhook

const upload = multer(); // memory storage

/* ---------- ROUTES ---------- */

// existing PDF route
app.post("/extract-text", upload.single("file"), extractText);

// credits routes
app.use("/credits", creditsRouter);

// Payhip webhook
app.post("/webhook/payhip", payhipWebhook);

/* ---------- START SERVER ---------- */
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ PDF service running on port ${PORT}`);
});
