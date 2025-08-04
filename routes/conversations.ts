import express, { Request, Response } from "express";
import crypto from "crypto";
import { ref, child, get, set, update, remove } from "firebase/database";
import OpenAi from "openai";
import { database } from "../firebase";
import { authenticateToken } from "../middlewares/authentication";
import { Conversation } from "../types/database";

const router = express.Router();
const clientsRef = ref(database, "clients");

// Configuração do OpenAI
const client = new OpenAi({
  apiKey: process.env.OPENAI_API_KEY,
});

// Iniciar nova conversa descartável
router.post(
  "/:clientId/conversations/start",
  async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;
      const {
        assistantId,
        externalUserId,
        expiresIn = 60, // 60 minutos por padrão
        maxMessages = 50, // máximo 50 mensagens por conversa
      } = req.body;

      // Verificar se cliente e assistente existem
      const clientSnapshot = await get(child(clientsRef, clientId));
      if (!clientSnapshot.exists()) {
        res.status(404).json({ error: "Cliente não encontrado." });
        return;
      }

      const assistantSnapshot = await get(
        child(clientsRef, `${clientId}/assistants/${assistantId}`)
      );
      if (!assistantSnapshot.exists()) {
        res.status(404).json({ error: "Assistente não encontrado." });
        return;
      }

      const assistantData = assistantSnapshot.val();

      // Verificar se já existe uma conversa ativa para este usuário externo
      const existingConversations = await get(
        child(clientsRef, `${clientId}/conversations`)
      );
      const conversations = existingConversations.val() || {};

      // Procurar conversa ativa existente
      const activeConversation = Object.keys(conversations).find((convId) => {
        const conv = conversations[convId];
        return (
          conv.externalUserId === externalUserId &&
          conv.status === "active" &&
          Date.now() < conv.autoDeleteAt
        );
      });

      if (activeConversation) {
        // Retornar conversa existente
        const conv = conversations[activeConversation];
        res.json({
          conversationId: activeConversation,
          threadId: conv.threadId,
          message: "Conversa ativa encontrada. Continuando...",
          expiresAt: conv.autoDeleteAt,
          timeRemaining: Math.max(0, conv.autoDeleteAt - Date.now()),
        });
        return;
      }

      // Criar nova thread no OpenAI
      const thread = await client.beta.threads.create();

      // Criar nova conversa
      const conversationId = crypto.randomUUID();
      const now = Date.now();
      const expiresAt = now + expiresIn * 60 * 1000; // converter minutos para ms

      const conversation: Conversation = {
        threadId: thread.id,
        assistantId: assistantData.openaiAssistantId,
        externalUserId,
        status: "active",
        startedAt: now,
        lastActivity: now,
        autoDeleteAt: expiresAt,
        expiresIn,
        messageCount: 0,
        maxMessages,
      };

      // Salvar no Firebase
      await set(
        child(clientsRef, `${clientId}/conversations/${conversationId}`),
        conversation
      );

      res.status(201).json({
        conversationId,
        threadId: thread.id,
        message: "Nova conversa iniciada com sucesso!",
        expiresAt,
        timeRemaining: expiresIn * 60 * 1000,
        maxMessages,
      });
    } catch (error) {
      console.error("Erro ao iniciar conversa:", error);
      res.status(500).json({
        message: "Erro ao iniciar conversa",
        error: error instanceof Error ? error.message : error,
      });
    }
  }
);

// Enviar mensagem em conversa descartável
router.post(
  "/:clientId/conversations/:conversationId/message",
  async (req: Request, res: Response) => {
    try {
      const { clientId, conversationId } = req.params;
      const { message } = req.body;

      if (!message || typeof message !== "string") {
        res.status(400).json({ error: "Mensagem inválida ou ausente." });
        return;
      }

      // Buscar conversa
      const conversationSnapshot = await get(
        child(clientsRef, `${clientId}/conversations/${conversationId}`)
      );
      if (!conversationSnapshot.exists()) {
        res.status(404).json({ error: "Conversa não encontrada." });
        return;
      }

      const conversation = conversationSnapshot.val();

      // Verificar se conversa ainda está ativa
      if (conversation.status !== "active") {
        res.status(400).json({ error: "Conversa não está ativa." });
        return;
      }

      // Verificar se conversa não expirou
      if (Date.now() > conversation.autoDeleteAt) {
        // Marcar como expirada
        await update(
          child(clientsRef, `${clientId}/conversations/${conversationId}`),
          {
            status: "expired",
          }
        );
        res.status(400).json({ error: "Conversa expirou." });
        return;
      }

      // Verificar limite de mensagens
      if (conversation.messageCount >= conversation.maxMessages) {
        await update(
          child(clientsRef, `${clientId}/conversations/${conversationId}`),
          {
            status: "completed",
          }
        );
        res.status(400).json({ error: "Limite de mensagens atingido." });
        return;
      }

      // Buscar dados do assistente para function calling
      const assistantSnapshot = await get(
        child(clientsRef, `${clientId}/assistants`)
      );
      const assistants = assistantSnapshot.val() || {};
      const assistantId = Object.keys(assistants).find(
        (id) => assistants[id].openaiAssistantId === conversation.assistantId
      );

      // Criar mensagem do usuário
      await client.beta.threads.messages.create(conversation.threadId, {
        role: "user",
        content: message,
      });

      // Executar run com function calling
      const run = await client.beta.threads.runs.createAndPoll(
        conversation.threadId,
        {
          assistant_id: conversation.assistantId,
        }
      );

      let finalMessages;

      if (run.status === "completed") {
        const messages = await client.beta.threads.messages.list(
          conversation.threadId
        );
        finalMessages = messages.data.reverse();
      } else if (run.status === "requires_action") {
        // Lidar com function calling
        finalMessages = await handleFunctionCalling(
          run,
          conversation.threadId,
          conversation.assistantId,
          clientId,
          assistantId
        );
      } else {
        res.status(500).json({
          error: "Erro ao processar mensagem",
          status: run.status,
        });
        return;
      }

      // Atualizar conversa
      const now = Date.now();
      const newExpiresAt = now + conversation.expiresIn * 60 * 1000;
      await update(
        child(clientsRef, `${clientId}/conversations/${conversationId}`),
        {
          lastActivity: now,
          autoDeleteAt: newExpiresAt, // estender expiração
          messageCount: (conversation.messageCount || 0) + 1,
        }
      );

      res.json({
        history: finalMessages,
        conversationStatus: {
          expiresAt: newExpiresAt,
          timeRemaining: conversation.expiresIn * 60 * 1000,
          messagesUsed: (conversation.messageCount || 0) + 1,
          messagesRemaining:
            conversation.maxMessages - (conversation.messageCount || 0) - 1,
        },
      });
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      res.status(500).json({
        message: "Erro ao enviar mensagem",
        error: error instanceof Error ? error.message : error,
      });
    }
  }
);

// Encerrar conversa manualmente
router.post(
  "/:clientId/conversations/:conversationId/end",
  async (req: Request, res: Response) => {
    try {
      const { clientId, conversationId } = req.params;
      const { reason = "manual" } = req.body; // manual, completed, abandoned

      // Marcar conversa como encerrada
      await update(
        child(clientsRef, `${clientId}/conversations/${conversationId}`),
        {
          status: reason === "manual" ? "completed" : reason,
          endedAt: Date.now(),
        }
      );

      res.json({
        message: "Conversa encerrada com sucesso!",
        reason,
      });
    } catch (error) {
      console.error("Erro ao encerrar conversa:", error);
      res.status(500).json({
        message: "Erro ao encerrar conversa",
        error: error instanceof Error ? error.message : error,
      });
    }
  }
);

// Limpar conversas expiradas (rota para cron job)
router.delete(
  "/:clientId/conversations/cleanup",
  async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;
      const now = Date.now();

      const conversationsSnapshot = await get(
        child(clientsRef, `${clientId}/conversations`)
      );
      const conversations = conversationsSnapshot.val() || {};

      let cleaned = 0;
      const cleanupPromises = [];

      for (const conversationId of Object.keys(conversations)) {
        const conversation = conversations[conversationId];

        // Remover conversas expiradas há mais de 24h
        if (conversation.autoDeleteAt < now - 24 * 60 * 60 * 1000) {
          // Deletar thread do OpenAI
          try {
            await client.beta.threads.del(conversation.threadId);
          } catch (openaiError) {
            console.warn(
              `Erro ao deletar thread ${conversation.threadId}:`,
              openaiError
            );
          }

          // Remover do Firebase
          cleanupPromises.push(
            remove(
              child(clientsRef, `${clientId}/conversations/${conversationId}`)
            )
          );
          cleaned++;
        }
        // Marcar como expiradas as que passaram do prazo
        else if (
          conversation.autoDeleteAt < now &&
          conversation.status === "active"
        ) {
          cleanupPromises.push(
            update(
              child(clientsRef, `${clientId}/conversations/${conversationId}`),
              {
                status: "expired",
              }
            )
          );
        }
      }

      await Promise.all(cleanupPromises);

      res.json({
        message: "Limpeza concluída",
        conversationsRemoved: cleaned,
      });
    } catch (error) {
      console.error("Erro na limpeza:", error);
      res.status(500).json({
        message: "Erro na limpeza",
        error: error instanceof Error ? error.message : error,
      });
    }
  }
);

// Function calling helper (reutilizado do chat.ts)
async function handleFunctionCalling(
  run: any,
  threadId: string,
  openaiAssistantId: string,
  clientId: string,
  localAssistantId: string
) {
  const toolCalls = run.required_action?.submit_tool_outputs?.tool_calls || [];
  const toolOutputs = [];

  for (const toolCall of toolCalls) {
    if (toolCall.type === "function") {
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);

      try {
        const functionResult = await executeFunctionCall(
          clientId,
          localAssistantId,
          functionName,
          functionArgs
        );

        toolOutputs.push({
          tool_call_id: toolCall.id,
          output: JSON.stringify(functionResult),
        });
      } catch (functionError) {
        toolOutputs.push({
          tool_call_id: toolCall.id,
          output: JSON.stringify({
            erro: `Falha ao executar ${functionName}: ${functionError}`,
          }),
        });
      }
    }
  }

  const finalRun = await client.beta.threads.runs.submitToolOutputsAndPoll(
    threadId,
    run.id,
    { tool_outputs: toolOutputs }
  );

  if (finalRun.status === "completed") {
    const messages = await client.beta.threads.messages.list(threadId);
    return messages.data.reverse();
  } else {
    throw new Error(`Erro após executar funções: ${finalRun.status}`);
  }
}

// Função auxiliar reutilizada
async function executeFunctionCall(
  clientId: string,
  assistantId: string,
  functionName: string,
  functionArgs: any
) {
  const assistantSnapshot = await get(
    child(clientsRef, `${clientId}/assistants/${assistantId}`)
  );
  if (!assistantSnapshot.exists()) {
    throw new Error("Assistente não encontrado");
  }

  const assistantData = assistantSnapshot.val();
  const customFunctions = assistantData.customFunctions || [];
  const targetFunction = customFunctions.find(
    (func: any) => func.name === functionName
  );

  if (!targetFunction) {
    throw new Error("Função não encontrada");
  }

  // Executar função (mock data)
  if (functionName === "buscar_produtos") {
    const { categoria, preco_max, disponivel, palavra_chave } = functionArgs;
    const produtos = [
      {
        id: 1,
        nome: "Smartphone XYZ",
        categoria: "eletrônicos",
        preco: 899.99,
        disponivel: true,
        tags: ["smartphone", "celular"],
      },
      {
        id: 2,
        nome: "Notebook ABC",
        categoria: "eletrônicos",
        preco: 2499.99,
        disponivel: true,
        tags: ["notebook", "laptop"],
      },
      {
        id: 3,
        nome: "Camiseta Basic",
        categoria: "roupas",
        preco: 49.99,
        disponivel: false,
        tags: ["camiseta", "roupa"],
      },
      {
        id: 4,
        nome: "Tênis Sport",
        categoria: "calçados",
        preco: 299.99,
        disponivel: true,
        tags: ["tênis", "esporte"],
      },
      {
        id: 5,
        nome: "Fone Bluetooth",
        categoria: "eletrônicos",
        preco: 199.99,
        disponivel: true,
        tags: ["fone", "headphone"],
      },
    ];

    let resultado = produtos;
    if (categoria)
      resultado = resultado.filter((p) =>
        p.categoria.toLowerCase().includes(categoria.toLowerCase())
      );
    if (preco_max) resultado = resultado.filter((p) => p.preco <= preco_max);
    if (disponivel !== undefined)
      resultado = resultado.filter((p) => p.disponivel === disponivel);
    if (palavra_chave) {
      const palavraLower = palavra_chave.toLowerCase();
      resultado = resultado.filter(
        (p) =>
          p.nome.toLowerCase().includes(palavraLower) ||
          p.tags.some((tag) => tag.toLowerCase().includes(palavraLower))
      );
    }

    return { produtos: resultado, total: resultado.length };
  }

  if (functionName === "verificar_estoque") {
    const estoques = {
      1: { disponivel: true, quantidade: 15, reservados: 2 },
      2: { disponivel: true, quantidade: 8, reservados: 1 },
      3: { disponivel: false, quantidade: 0, reservados: 0 },
      4: { disponivel: true, quantidade: 25, reservados: 5 },
      5: { disponivel: true, quantidade: 12, reservados: 1 },
    };

    const estoque = estoques[functionArgs.produto_id as keyof typeof estoques];
    return estoque || { erro: "Produto não encontrado" };
  }

  if (functionName === "analisar_imagem_produto") {
    // Para demo, simular análise de imagem
    return {
      analise: {
        imagem_analisada: functionArgs.imagem_url,
        categoria: "eletrônicos",
        caracteristicas: [
          "produto tecnológico",
          "cor escura",
          "formato retangular",
        ],
        palavras_chave: ["smartphone", "celular", "eletrônico"],
        descricao: "Produto eletrônico identificado na imagem",
      },
      produtos_similares: [
        {
          id: 1,
          nome: "Smartphone XYZ",
          categoria: "eletrônicos",
          preco: 899.99,
          disponivel: true,
        },
        {
          id: 5,
          nome: "Fone Bluetooth",
          categoria: "eletrônicos",
          preco: 199.99,
          disponivel: true,
        },
      ],
      total_similares: 2,
      sugestao: "Encontrei alguns produtos similares para você!",
    };
  }

  throw new Error("Função não implementada");
}

export default router;
