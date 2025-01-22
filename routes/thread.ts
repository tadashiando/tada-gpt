import express, { Request, Response } from "express";
import OpenAi from "openai";
import crypto from "crypto";
import { database } from "../firebase";
import { ref, set, child, get, update, push } from "firebase/database";
import { authenticateToken } from "../middlewares/authentication";

const router = express.Router();
// Configuração do OpenAI
const client = new OpenAi({
  apiKey: process.env.OPENAI_API_KEY,
});
const threadsRef = ref(database, "threads");

router.post("/", authenticateToken, async (req: Request, res: Response) => {
  const { assistant } = req.body;
  try {
    const thread = await client.beta.threads.create();
    const uuid = crypto.randomUUID();

    await update(child(threadsRef, req.user.uid), {
      [uuid]: {
        threadId: thread.id,
        assistantId: assistant,
        createdAt: thread.created_at
      }
    });

    res.json({ thread });
  } catch (error) {
    console.error("Erro ao se comunicar com o GPT:", error);
    res.status(500).json({ error: "Erro interno ao se comunicar com o GPT." });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const thread = await client.beta.threads.retrieve(id);
    res.json({ assistant: thread });
  } catch (error) {
    console.error("Erro ao se comunicar com o GPT:", error);
    res.status(500).json({ error: "Erro interno ao se comunicar com o GPT." });
  }
});

router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    await get(child(threadsRef, req.user.uid)).then((snapshot) => {
      if (snapshot.exists()) {
        const threads = snapshot.val();
        res.json({ threads });
      }
    });
  } catch (error) {
    console.error("Erro ao recuperar lista de threads", error);
    res
      .status(500)
      .json({ error: "Erro interno ao se comunicar com Firebase" });
  }
});

export default router;
