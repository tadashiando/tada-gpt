import express from "express";

import assistantRoutes from "./assistant";
import authRoutes from "./auth";
import chatRoutes from "./chat";
import clientRoutes from "./clients";
import clientAssistantRoutes from "./client-assistants";
import conversationRoutes from "./conversations";
import functionCallingRoutes from "./function-calling";
import namesRoutes from "./names";
import threadRoutes from "./thread";

const router = express.Router();

router.use("/assistant", assistantRoutes);
router.use("/auth", authRoutes);
router.use("/chat", chatRoutes);
router.use("/clients", clientRoutes);
router.use("/clients", clientAssistantRoutes);
router.use("/clients", conversationRoutes);
router.use("/functions", functionCallingRoutes);
router.use("/names", namesRoutes);
router.use("/thread", threadRoutes);

export default router;
