import { Request, Response } from "express";
import { pool } from "./db";

function normalizeEmail(v: any): string {
  return String(v || "").trim().toLowerCase();
}

function extractProductName(body: any): string {
  // Payhip paid payload usually: body.items = [{ product_name: "Pack 10", ... }]
  const firstItemName =
    Array.isArray(body?.items) && body.items.length > 0
      ? String(body.items[0]?.product_name || "").trim()
      : "";

  const fallbacks = [
    body?.product_name,
    body?.product?.name,
  ]
    .map((x: any) => String(x || "").trim())
    .filter(Boolean);

  return firstItemName || fallbacks[0] || "";
}

function creditsFromProductName(name: string): number {
  const s = name.toLowerCase();

  // IMPORTANT order: 30 then 10 then 3
  if (/\b30\b/.test(s) || s.includes("30")) return 30;
  if (/\b10\b/.test(s) || s.includes("10")) return 10;
  if (/\b3\b/.test(s) || s.includes("3")) return 3;

  return 0;
}

export async function payhipWebhook(req: Request, res: Response) {
  try {
    console.log("📦 Payhip webhook received:", JSON.stringify(req.body, null, 2));

    const email = normalizeEmail(req.body?.email || req.body?.customer_email);
    const productName = extractProductName(req.body);

    if (!email) {
      // ACK 200 to avoid endless retries; also logs help debug
      console.error("❌ Payhip webhook: missing email", req.body);
      return res.status(200).json({ ok: false, error: "missing_email" });
    }

    if (!productName) {
      console.error("❌ Payhip webhook: missing product name", req.body);
      return res.status(200).json({ ok: false, error: "missing_product_name" });
    }

    const creditsToAdd = creditsFromProductName(productName);

    if (creditsToAdd === 0) {
      console.error("❌ Unknown product:", productName);
      // ACK 200 so Payhip doesn't keep retrying forever
      return res.status(200).json({ ok: true, added: 0, reason: "unknown_product", productName });
    }

    await pool.query(
      `
      INSERT INTO users_credits (email, credits, plan, created_at)
      VALUES ($1, $2, $2, now())
      ON CONFLICT (email)
      DO UPDATE
        SET credits = users_credits.credits + EXCLUDED.credits,
            plan = EXCLUDED.plan
      `,
      [email, creditsToAdd]
    );

    console.log("✅ Credits added:", { email, creditsToAdd, productName });
    return res.status(200).json({ ok: true, email, added: creditsToAdd });
  } catch (err) {
    console.error("❌ Payhip webhook error:", err);
    // ACK 200 to prevent retries storm (V0 pragmatic)
    return res.status(200).json({ ok: false, error: "server_error_but_acked" });
  }
}
