import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authenticate } from "./middleware/auth.js";
import { checkDatabase } from "./database/health.js";
import authRoutes from "./routes/auth.routes.js";
import clientRoutes from "./routes/client.routes.js";
import routerRoutes from "./modules/routers/router.routes.js";
import sessionRoutes from "./modules/sessions/session.routes.js";
import siteRoutes from "./modules/sites/site.routes.js";
import accessPointRoutes from "./modules/access-points/accessPoint.routes.js";
import planRoutes from "./modules/plans/plan.routes.js";
import voucherRoutes from "./modules/vouchers/voucher.routes.js";
import saleRoutes from "./modules/sales/sale.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import roleRoutes from "./modules/roles/role.routes.js";
import mikrotikRoutes from "./modules/mikrotik/mikrotik.routes.js";

const app = express();

/*
 * ============================================================
 * GLOBAL MIDDLEWARES
 * ============================================================
 */

app.use(helmet());

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(morgan("dev"));

/*
 * ============================================================
 * API ROUTES
 * ============================================================
 */



/*
 * /api/auth reste public : c'est lui qui délivre le token.
 * Tout le reste de l'API exige un JWT valide.
 */
app.use("/api/auth", authRoutes);

app.use("/api/clients", authenticate, clientRoutes);
app.use("/api/routers", authenticate, routerRoutes);
app.use("/api/sessions", authenticate, sessionRoutes);
app.use("/api/sites", authenticate, siteRoutes);
app.use("/api/access-points", authenticate, accessPointRoutes);
app.use("/api/plans", authenticate, planRoutes);
app.use("/api/vouchers", authenticate, voucherRoutes);
app.use("/api/sales", authenticate, saleRoutes);
app.use("/api/users", authenticate, userRoutes);
app.use("/api/roles", authenticate, roleRoutes);
app.use("/api/mikrotik", authenticate, mikrotikRoutes);
/*
 * ============================================================
 * SYSTEM
 * ============================================================
 */

app.get("/", (_req, res) => {
  res.status(200).json({
    name: "HOTSPOT MANAGEMENT V2",
    version: "2.0.0",
    status: "online",
  });
});

/*
 * ============================================================
 * DATABASE HEALTH
 * ============================================================
 */

app.get("/health/db", async (_req, res, next) => {
  try {
    const database = await checkDatabase();

    res.status(200).json({
      status: "ok",
      database,
    });
  } catch (error) {
    next(error);
  }
});

/*
 * ============================================================
 * ERROR HANDLING
 * ============================================================
 */

app.use(notFound);
app.use(errorHandler);

export default app;