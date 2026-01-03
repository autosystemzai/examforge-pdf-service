import express from "express";
import multer from "multer";
import { extractText } from "./extractText";
import creditsRouter from "./credits.routes";
import "./db"; // initializes Postgres pool ONCE

const app = express();
app.use(express.json()); // for JSON bodies

const upload = multer(); // memory storage

// existing route (unchanged)
app.post("/extract-text", upload.single("file"), extractText);

// credits routes
app.use("/credits", creditsRouter);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ PDF service running on port ${PORT}`);
});
