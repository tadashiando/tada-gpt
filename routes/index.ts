import express from "express";

import authRoutes from "./auth";
import chatRoutes from "./chat";
import namesRoutes from "./names";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/chat", chatRoutes);
router.use("/names", namesRoutes);

export default router;
