import { Router } from "express";
import { pool } from "./db";

const router = Router();

/**
 * POST /credits/init
 * body: { email: string, plan: number }
 */
router.post("/init", async (req, res) => {
  const { email, plan } = req.body;

  if (!email || !plan) {
    return res.status(400).json({ error: "email and plan required" });
  }

  try {
    await pool.query(
      `
      INSERT INTO users_credits (email, credits, plan)
      VALUES ($1, $2, $2)
      ON CONFLICT (email)
      DO UPDATE SET credits = EXCLUDED.credits, plan = EXCLUDED.plan
      `,
      [email.toLowerCase(), plan]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db error" });
  }
});

/**
 * GET /credits/:email
 */
router.get("/:email", async (req, res) => {
  const { email } = req.params;

  try {
    const result = await pool.query(
      "SELECT credits, plan FROM users_credits WHERE email = $1",
      [email.toLowerCase()]
    );

    if (result.rowCount === 0) {
      return res.json({ credits: 0 });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db error" });
  }
});

/**
 * POST /credits/use
 * body: { email: string }
 */
router.post("/use", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "email required" });
  }

  try {
    const result = await pool.query(
      `
      UPDATE users_credits
      SET credits = credits - 1
      WHERE email = $1 AND credits > 0
      RETURNING credits
      `,
      [email.toLowerCase()]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: "no credits" });
    }

    res.json({ ok: true, credits: result.rows[0].credits });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db error" });
  }
});

export default router;
