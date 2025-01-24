import express from "express";

import assistantRoutes from "./assistant";
import authRoutes from "./auth";
import chatRoutes from "./chat";
import namesRoutes from "./names";
import threadRoutes from "./thread";

const router = express.Router();

router.use("/assistant", assistantRoutes);
router.use("/auth", authRoutes);
router.use("/chat", chatRoutes);
router.use("/names", namesRoutes);
router.use("/thread", threadRoutes);

export default router;
