import express, { Request, Response } from "express";
import { equalTo, get, orderByChild, query, ref } from "firebase/database";
import OpenAi from "openai";
import { database } from "../firebase";
import { authenticateToken } from "../middlewares/authentication";

const router = express.Router();
// Configuração do OpenAI
const client = new OpenAi({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cria um novo assistente
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, instructions, description, tools, model } = req.body;

    if (!model || typeof model !== "string") {
      res.status(400).json({ error: "Modelo inválido ou ausente." });
      return;
    }

    const assistant = await client.beta.assistants.create({
      name,
      instructions,
      description,
      tools,
      model,
    });

    res.json({ assistant });
  } catch (error) {
    if (error instanceof Error) {
      console.error("Erro ao criar um novo assistente", error);
      res.status(500).json({
        message: "Erro ao criar um novo assistente",
        error: error.message,
      });
    } else {
      res.status(400).json({ message: error });
    }
  }
});

// Recupera um assistente com as suas threads
router.get(
  "/:assistantId",
  authenticateToken,
  async (req: Request, res: Response) => {
    const userThreadsRef = ref(database, "threads");

    try {
      const { assistantId } = req.params;
      const assistant = await client.beta.assistants.retrieve(assistantId);
      const threadsQuery = query(
        userThreadsRef,
        orderByChild("assistantId"),
        equalTo(assistantId)
      );
      const threadsSnapshot = await get(threadsQuery);
      const threadList = threadsSnapshot.val() || {};
      const threads = await Promise.all(
        Object.keys(threadList).map(async (threadKey) => {
          const thread = await client.beta.threads.retrieve(
            threadList[threadKey].threadId
          );
          const threadMessages = await client.beta.threads.messages.list(
            threadList[threadKey].threadId
          );
          return {
            thread,
            messages: threadMessages.data.reverse(),
          };
        })
      );

      res.json({ assistant, threads });
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          "Erro ao recuperar um assistente com suas threads",
          error
        );
        res.status(500).json({
          message: "Erro ao recuperar um assistente com suas threads",
          error: error.message,
        });
      } else {
        res.status(400).json({ message: error });
      }
    }
  }
);

// Recupera todos os assistentes
router.get("/", async (req: Request, res: Response) => {
  try {
    const assistants = await client.beta.assistants.list();
    res.json({ assistants });
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        "Erro ao recuperar uma lista de assistentes",
        error
      );
      res.status(500).json({
        message: "Erro ao recuperar uma lista de assistentes",
        error: error.message,
      });
    } else {
      res.status(400).json({ message: error });
    }
  }
});

export default router;
