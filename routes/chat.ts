import express, { Request, Response } from "express";
import OpenAi from "openai";

const router = express.Router();
// Configuração do OpenAI
const client = new OpenAi({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { message, history, model } = req.body;

    // Validação básica e interrupção caso necessário
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Mensagem inválida ou ausente." });
      return;
    }

    if (history && !Array.isArray(history)) {
      res.status(400).json({ error: "Histórico inválido." });
      return;
    }

    if (!model || typeof model !== "string") {
      res.status(400).json({ error: "Modelo inválido ou ausente." });
      return;
    }

    // Se não houver erros nas validações
    const messages = history || [];
    messages.push({ role: "user", content: message });

    // Requisição ao OpenAI
    const response = await client.chat.completions.create({
      model,
      messages,
    });

    // Atualizando o histórico com a resposta do bot
    messages.push({
      role: "assistant",
      content: response.choices?.[0]?.message?.content,
    });

    res.json({ response, history: messages });
  } catch (error) {
    console.error("Erro ao se comunicar com o GPT:", error);
    res.status(500).json({ error: "Erro interno ao se comunicar com o GPT." });
  }
});

router.post("/assistant", async (req: Request, res: Response) => {
  try {
    const { message, thread, assistant } = req.body;

    // Validação básica e interrupção caso necessário
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Mensagem inválida ou ausente." });
      return;
    }

    if (!thread || typeof thread !== "string") {
      res.status(400).json({ error: "Thread inválido ou ausente." });
      return;
    }

    if (!assistant || typeof assistant !== "string") {
      res.status(400).json({ error: "Id de assistente inválido ou ausente." });
      return;
    }

    // Se não houver erros nas validações
    const messages = [];
    messages.push({ role: "user", content: message });

    // Requisição ao OpenAI
    const response = await client.beta.threads.messages.create(thread, {
      role: "user",
      content: message,
    });

    let run = await client.beta.threads.runs.createAndPoll(thread, {
      assistant_id: assistant,
    });

    if (run.status === "completed") {
      const messages = await client.beta.threads.messages.list(run.thread_id);
      const reversedMessages = messages.data.reverse();
      res.json({ response, history: reversedMessages });
    } else {
      console.log(run.status);
      res.status(500).json({ error: "Erro interno ao se comunicar com o GPT." });
    }

  } catch (error) {
    console.error("Erro ao se comunicar com o GPT:", error);
    res.status(500).json({ error: "Erro interno ao se comunicar com o GPT." });
  }
});

export default router;
