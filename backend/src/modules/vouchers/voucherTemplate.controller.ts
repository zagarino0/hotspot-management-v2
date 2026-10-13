import type { Request, Response, NextFunction } from "express";
import { pool } from "../../database/pool.js";

export async function getVoucherPrintTemplate(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      "SELECT name, html, width_mm AS \"widthMm\", height_mm AS \"heightMm\", updated_at AS \"updatedAt\" FROM voucher_print_template WHERE id = 1"
    );
    if (!result.rows[0]) return res.status(404).json({ message: "Modèle d'impression non configuré." });
    return res.json({ template: result.rows[0] });
  } catch (error) { return next(error); }
}

export async function saveVoucherPrintTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, html, widthMm, heightMm } = req.body ?? {};
    const width = Number(widthMm);
    const height = Number(heightMm);
    if (typeof name !== "string" || !name.trim() || name.length > 120 ||
        typeof html !== "string" || !html.trim() || html.length > 100000 ||
        !Number.isFinite(width) || width < 20 || width > 300 ||
        !Number.isFinite(height) || height < 10 || height > 300) {
      return res.status(400).json({ message: "Modèle invalide : nom, HTML et dimensions (20–300 mm × 10–300 mm) requis." });
    }
    const result = await pool.query(
      `INSERT INTO voucher_print_template (id, name, html, width_mm, height_mm, updated_at)
       VALUES (1, $1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, html = EXCLUDED.html,
         width_mm = EXCLUDED.width_mm, height_mm = EXCLUDED.height_mm, updated_at = NOW()
       RETURNING name, html, width_mm AS "widthMm", height_mm AS "heightMm", updated_at AS "updatedAt"`,
      [name.trim(), html, width, height]
    );
    return res.json({ template: result.rows[0] });
  } catch (error) { return next(error); }
}
