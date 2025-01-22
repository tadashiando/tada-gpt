import express, { Request, Response } from "express";
import OpenAi from "openai";

const router = express.Router();
// Configuração do OpenAI
const client = new OpenAi({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, instructions, tools, model } = req.body;

    if (!model || typeof model !== "string") {
      res.status(400).json({ error: "Modelo inválido ou ausente." });
      return;
    }

    const assistant = await client.beta.assistants.create({
      name,
      instructions,
      tools,
      model,
    });

    res.json({ assistant });
  } catch (error) {
    console.error("Erro ao se comunicar com o GPT:", error);
    res.status(500).json({ error: "Erro interno ao se comunicar com o GPT." });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const assistant = await client.beta.assistants.retrieve(id);
    res.json({ assistant });
  } catch (error) {
    console.error("Erro ao se comunicar com o GPT:", error);
    res.status(500).json({ error: "Erro interno ao se comunicar com o GPT." });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const assistants = await client.beta.assistants.list();
    res.json({ assistants });
  } catch (error) {
    console.error("Erro ao se comunicar com o GPT:", error);
    res.status(500).json({ error: "Erro interno ao se comunicar com o GPT." });
  }
})

export default router;
