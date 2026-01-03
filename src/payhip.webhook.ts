import { Request, Response } from "express";
import { Pool } from "pg";

// Reuse DATABASE_URL from Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function payhipWebhook(req: Request, res: Response) {
  try {
    console.log("📦 Payhip webhook received:", req.body);

    const { email, product_name } = req.body;

    if (!email || !product_name) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    // Map produit → crédits
    let creditsToAdd = 0;

    if (product_name.includes("3")) creditsToAdd = 3;
    else if (product_name.includes("10")) creditsToAdd = 10;
    else if (product_name.includes("30")) creditsToAdd = 30;

    if (creditsToAdd === 0) {
      return res.status(400).json({ error: "Unknown product" });
    }

    await pool.query(
      `
      INSERT INTO users_credits (email, credits, plan, "created-at")
      VALUES ($1, $2, $2, now())
      ON CONFLICT (email)
      DO UPDATE
        SET credits = users_credits.credits + EXCLUDED.credits
      `,
      [email, creditsToAdd]
    );

    return res.json({ success: true, creditsAdded: creditsToAdd });
  } catch (err) {
    console.error("❌ Payhip webhook error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
