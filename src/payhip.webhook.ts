import { Request, Response } from "express";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function payhipWebhook(req: Request, res: Response) {
  try {
    console.log("📦 Payhip webhook received:", JSON.stringify(req.body, null, 2));

    // ✅ FIX: Payhip real payload structure
    const email: string | undefined = req.body.email;
    const product_name: string =
      req.body.product_name ||
      req.body.product?.name ||
      "";

    if (!email || !product_name) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    let creditsToAdd = 0;

    // ✅ FIX: robust matching
    if (/30/.test(product_name)) creditsToAdd = 30;
    else if (/10/.test(product_name)) creditsToAdd = 10;
    else if (/3/.test(product_name)) creditsToAdd = 3;

    if (creditsToAdd === 0) {
      console.error("❌ Unknown product:", product_name);
      return res.status(400).json({ error: "Unknown product" });
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
      [email.toLowerCase(), creditsToAdd]
    );

    return res.json({ success: true, creditsAdded: creditsToAdd });
  } catch (err) {
    console.error("❌ Payhip webhook error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
