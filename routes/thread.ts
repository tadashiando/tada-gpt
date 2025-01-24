import express, { Request, Response } from "express";
import OpenAi from "openai";
import crypto from "crypto";
import { database } from "../firebase";
import { ref, child, get, update } from "firebase/database";
import { authenticateToken } from "../middlewares/authentication";

const router = express.Router();
// Configuração do OpenAI
const client = new OpenAi({
  apiKey: process.env.OPENAI_API_KEY,
});
const threadsRef = ref(database, "threads");

// Cria uma nova thread
router.post("/", authenticateToken, async (req: Request, res: Response) => {
  const { assistant } = req.body;
  try {
    const thread = await client.beta.threads.create();
    const uuid = crypto.randomUUID();

    await update(child(threadsRef, "/"), {
      [uuid]: {
        threadId: thread.id,
        assistantId: assistant,
        createdAt: thread.created_at,
      },
    });

    res.json({ thread });
  } catch (error) {
    if (error instanceof Error) {
      console.error("Erro ao criar a Thread no Firebase", error);
      res.status(500).json({
        message: "Erro ao criar a Thread no Firebase",
        error: error.message,
      });
    } else {
      res.status(400).json({ message: error });
    }
  }
});

// Recupera uma thread com as suas mensagens
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const thread = await client.beta.threads.retrieve(id);
    const threadMessages = await client.beta.threads.messages.list(id);
    const messages = threadMessages.data.reverse();
    res.json({ thread, messages });
  } catch (error) {
    if (error instanceof Error) {
      console.error("Erro ao recuperar a Thread", error);
      res.status(500).json({
        message: "Erro ao recuperar a Thread",
        error: error.message,
      });
    } else {
      res.status(400).json({ message: error });
    }
  }
});

// Recupera todas as threads
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    await get(child(threadsRef, "/")).then((snapshot) => {
      if (snapshot.exists()) {
        const threads = snapshot.val();
        res.json({ threads });
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error("Erro ao recuperar todas as Threads de Firebase", error);
      res.status(500).json({
        message: "Erro ao recuperar todas as Threads de Firebase",
        error: error.message,
      });
    } else {
      res.status(400).json({ message: error });
    }
  }
});

// Deleta uma thread
router.delete(
  "/:id",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const thread = await client.beta.threads.del(id);
      res.json({ thread });
    } catch (error) {
      if (error instanceof Error) {
        console.error("Erro ao deletar thread.", error);
        res.status(500).json({
          message: "Erro ao deletar thread.",
          error: error.message,
        });
      } else {
        res.status(400).json({ message: error });
      }
    }
  }
);

export default router;
