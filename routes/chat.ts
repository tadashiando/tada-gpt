import express, { Request, Response } from "express";
import OpenAi from "openai";

const router = express.Router();
// Configuração do OpenAI
const client = new OpenAi({
  apiKey: process.env.OPENAI_API_KEY,
});

// Envia mensagens junto com o histórico
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

    let response;
    // Requisição ao OpenAI
    if (model.startsWith("dall")) {
      response = await client.images.generate({
        model,
        prompt: message,
        n: 1,
        size: "1024x1024",
      });

      // Atualizando o histórico com a resposta do bot
      messages.push({
        role: "assistant",
        content: response.data,
      });
    } else {
      response = await client.chat.completions.create({
        model,
        messages,
      });
  
      // Atualizando o histórico com a resposta do bot
      messages.push({
        role: "assistant",
        content: response.choices?.[0]?.message?.content,
      });
    }

    res.json({ response, history: messages });
  } catch (error) {
    if (error instanceof Error) {
      console.error("Erro ao enviar mensagem", error);
      res.status(500).json({
        message: "Erro ao enviar mensagem",
        error: error.message,
      });
    } else {
      res.status(400).json({ message: error });
    }
  }
});

// Envia mensagens ao assistente
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

    // Requisição ao OpenAI
    await client.beta.threads.messages.create(thread, {
      role: "user",
      content: message,
    });

    const run = await client.beta.threads.runs.createAndPoll(thread, {
      assistant_id: assistant,
    });

    if (run.status === "completed") {
      const messages = await client.beta.threads.messages.list(run.thread_id);
      const reversedMessages = messages.data.reverse();
      res.json({ history: reversedMessages });
    } else {
      console.log(run.status);
      res
        .status(500)
        .json({ error: "Erro interno ao se comunicar com o GPT." });
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        "Erro ao enviar mensagem ao assistente",
        error
      );
      res.status(500).json({
        message: "Erro ao enviar mensagem ao assistente",
        error: error.message,
      });
    } else {
      res.status(400).json({ message: error });
    }
  }
});

/* router.post("/assistant", async (req: Request, res: Response) => {
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

    // Configurando a resposta para streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Criação da mensagem para o OpenAI
    await client.beta.threads.messages.create(thread, {
      role: "user",
      content: message,
    });

    // Streaming para obter resposta do OpenAI
    const run = client.beta.threads.runs.stream(thread, {
      assistant_id: assistant,
    });

    run.on("textCreated", (text) => {
      console.log(text);

      res.write(`data: ${text}\n\n`);
    });

    run.on("textDelta", (textDelta) => {
      res.write(`data: ${textDelta.value}\n\n`);
    });

    run.on("toolCallCreated", (toolCall) => {
      res.write(`data: Assistant called a tool: ${toolCall.type}\n\n`);
    });

    run.on("toolCallDelta", (toolCallDelta) => {
      if (toolCallDelta.type === "code_interpreter") {
        if (toolCallDelta.code_interpreter.input) {
          res.write(
            `data: Code input: ${toolCallDelta.code_interpreter.input}\n\n`
          );
        }
        if (toolCallDelta.code_interpreter.outputs) {
          toolCallDelta.code_interpreter.outputs.forEach((output) => {
            if (output.type === "logs") {
              res.write(`data: Log output: ${output.logs}\n\n`);
            }
          });
        }
      }
    });

    run.on("error", (error) => {
      console.error("Error in streaming: ", error);
      res.write(`data: Error occurred: ${error.message}\n\n`);
      res.end();
    });

    run.on("end", async () => {
      res.write(`data: Streaming finalizado.\n\n`);
      res.end(); // Finaliza a conexão
    });
  } catch (error) {
    console.error("Erro ao se comunicar com o GPT:", error);
    res.status(500).json({ error: "Erro interno ao se comunicar com o GPT." });
  }
}); */

export default router;
