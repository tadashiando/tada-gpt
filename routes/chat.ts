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

    // AO FINALIZAR O STREAM, você pode decidir se quer enviar uma mensagem ou não
    run.on("end", async () => {
      // Você pode adicionar um final ou limpar a conexão da maneira que preferir
      res.write(`data: Streaming finalizado.\n\n`);
      res.end(); // Finaliza a conexão
    });
  } catch (error) {
    console.error("Erro ao se comunicar com o GPT:", error);
    res.status(500).json({ error: "Erro interno ao se comunicar com o GPT." });
  }
});

export default router;
