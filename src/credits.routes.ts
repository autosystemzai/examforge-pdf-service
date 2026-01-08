import { Router } from "express";
import { pool } from "./db";

const router = Router();

function normalizeEmail(v: any): string {
  return String(v || "").trim().toLowerCase();
}

function toPositiveInt(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i <= 0) return null;
  return i;
}

/**
 * POST /credits/init
 * body: { email: string, plan: number }
 * plan = credits initial (ex: 3 / 10 / 30)
 */
router.post("/init", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const planNum = toPositiveInt(req.body?.plan);

  if (!email || !planNum) {
    return res.status(400).json({ error: "email and valid plan required" });
  }

  try {
    await pool.query(
      `
      INSERT INTO users_credits (email, credits, plan)
      VALUES ($1, $2, $2)
      ON CONFLICT (email)
      DO UPDATE SET credits = EXCLUDED.credits, plan = EXCLUDED.plan
      `,
      [email, planNum]
    );

    return res.json({ ok: true, email, credits: planNum, plan: planNum });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "db error" });
  }
});

/**
 * GET /credits/:email
 */
router.get("/:email", async (req, res) => {
  const email = normalizeEmail(req.params?.email);

  if (!email) {
    return res.status(400).json({ error: "email required" });
  }

  try {
    const result = await pool.query(
      "SELECT credits, plan FROM users_credits WHERE email = $1",
      [email]
    );

    if (result.rowCount === 0) {
      return res.json({ credits: 0, plan: 0 });
    }

    const row = result.rows[0];
    const credits = Number(row.credits) || 0;
    const plan = Number(row.plan) || 0;

    return res.json({ credits, plan });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "db error" });
  }
});

/**
 * POST /credits/use
 * body: { email: string }
 */
router.post("/use", async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!email) {
    return res.status(400).json({ error: "email required" });
  }

  try {
    const result = await pool.query(
      `
      UPDATE users_credits
      SET credits = credits - 1
      WHERE email = $1 AND credits > 0
      RETURNING credits, plan
      `,
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: "no credits" });
    }

    const credits = Number(result.rows[0].credits) || 0;
    const plan = Number(result.rows[0].plan) || 0;

    return res.json({ ok: true, credits, plan });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "db error" });
  }
});

export default router;
