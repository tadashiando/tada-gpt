import express, { Request, Response } from "express";
import crypto from "crypto";
import { ref, child, get, set, update } from "firebase/database";
import OpenAi from "openai";
import { database } from "../firebase";
import { authenticateToken } from "../middlewares/authentication";
import { ClientAssistant } from "../types/database";

const router = express.Router();
const clientsRef = ref(database, "clients");

// Configuração do OpenAI
const client = new OpenAi({
  apiKey: process.env.OPENAI_API_KEY,
});

// Criar assistente para um cliente específico
router.post(
  "/:clientId/assistants",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;
      const {
        name,
        instructions,
        description,
        tools = [],
        model = "gpt-4-turbo",
        customFunctions = [],
      } = req.body;

      // Verificar se cliente existe
      const clientSnapshot = await get(child(clientsRef, clientId));
      if (!clientSnapshot.exists()) {
        res.status(404).json({ error: "Cliente não encontrado." });
        return;
      }

      // Validações básicas
      if (!name || !instructions) {
        res.status(400).json({ error: "Nome e instruções são obrigatórios." });
        return;
      }

      // Preparar tools para o OpenAI (incluindo funções customizadas)
      const openaiTools = [
        ...tools,
        ...customFunctions.map((func: any) => ({
          type: "function",
          function: {
            name: func.name,
            description: func.description,
            parameters: func.parameters,
          },
        })),
      ];

      // Criar assistente no OpenAI
      const openaiAssistant = await client.beta.assistants.create({
        name,
        instructions,
        description,
        tools: openaiTools,
        model,
      });

      // Salvar no Firebase
      const assistantId = crypto.randomUUID();
      const assistantData: ClientAssistant = {
        openaiAssistantId: openaiAssistant.id,
        name,
        instructions,
        model,
        tools: tools.map((tool: any) =>
          typeof tool === "string" ? tool : tool.type
        ),
        customFunctions, // NOVO: salvar funções customizadas
        status: "active",
        createdAt: Date.now(),
      };

      await set(
        child(clientsRef, `${clientId}/assistants/${assistantId}`),
        assistantData
      );

      res.status(201).json({
        assistantId,
        assistant: {
          ...assistantData,
          openaiData: openaiAssistant,
        },
        message: "Assistente criado com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao criar assistente:", error);
      res.status(500).json({
        message: "Erro ao criar assistente",
        error: error instanceof Error ? error.message : error,
      });
    }
  }
);

// Listar assistentes de um cliente
router.get(
  "/:clientId/assistants",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;

      // Verificar se cliente existe
      const clientSnapshot = await get(child(clientsRef, clientId));
      if (!clientSnapshot.exists()) {
        res.status(404).json({ error: "Cliente não encontrado." });
        return;
      }

      // Buscar assistentes do cliente
      const assistantsSnapshot = await get(
        child(clientsRef, `${clientId}/assistants`)
      );
      const assistants = assistantsSnapshot.val() || {};

      const assistantList = Object.keys(assistants).map((assistantId) => ({
        id: assistantId,
        ...assistants[assistantId],
      }));

      res.json({
        clientId,
        assistants: assistantList,
      });
    } catch (error) {
      console.error("Erro ao listar assistentes:", error);
      res.status(500).json({
        message: "Erro ao listar assistentes",
        error: error instanceof Error ? error.message : error,
      });
    }
  }
);

// Buscar assistente específico de um cliente
router.get(
  "/:clientId/assistants/:assistantId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { clientId, assistantId } = req.params;

      // Buscar assistente no Firebase
      const assistantSnapshot = await get(
        child(clientsRef, `${clientId}/assistants/${assistantId}`)
      );
      if (!assistantSnapshot.exists()) {
        res.status(404).json({ error: "Assistente não encontrado." });
        return;
      }

      const assistantData = assistantSnapshot.val();

      // Buscar dados atualizados do OpenAI
      try {
        const openaiAssistant = await client.beta.assistants.retrieve(
          assistantData.openaiAssistantId
        );

        res.json({
          id: assistantId,
          clientId,
          ...assistantData,
          openaiData: openaiAssistant,
        });
      } catch (openaiError) {
        // Se não conseguir buscar do OpenAI, retorna só os dados do Firebase
        res.json({
          id: assistantId,
          clientId,
          ...assistantData,
          warning: "Não foi possível buscar dados atualizados do OpenAI",
        });
      }
    } catch (error) {
      console.error("Erro ao buscar assistente:", error);
      res.status(500).json({
        message: "Erro ao buscar assistente",
        error: error instanceof Error ? error.message : error,
      });
    }
  }
);

// Atualizar assistente
router.put(
  "/:clientId/assistants/:assistantId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { clientId, assistantId } = req.params;
      const updates = req.body;

      // Buscar assistente atual
      const assistantSnapshot = await get(
        child(clientsRef, `${clientId}/assistants/${assistantId}`)
      );
      if (!assistantSnapshot.exists()) {
        res.status(404).json({ error: "Assistente não encontrado." });
        return;
      }

      const currentAssistant = assistantSnapshot.val();

      // Atualizar no OpenAI se necessário
      if (
        updates.name ||
        updates.instructions ||
        updates.tools ||
        updates.model
      ) {
        await client.beta.assistants.update(
          currentAssistant.openaiAssistantId,
          {
            name: updates.name || currentAssistant.name,
            instructions: updates.instructions || currentAssistant.instructions,
            tools: updates.tools || currentAssistant.tools,
            model: updates.model || currentAssistant.model,
          }
        );
      }

      // Atualizar no Firebase
      await update(
        child(clientsRef, `${clientId}/assistants/${assistantId}`),
        updates
      );

      res.json({
        message: "Assistente atualizado com sucesso!",
        assistantId,
        clientId,
      });
    } catch (error) {
      console.error("Erro ao atualizar assistente:", error);
      res.status(500).json({
        message: "Erro ao atualizar assistente",
        error: error instanceof Error ? error.message : error,
      });
    }
  }
);

// Deletar assistente
router.delete(
  "/:clientId/assistants/:assistantId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { clientId, assistantId } = req.params;

      // Buscar assistente
      const assistantSnapshot = await get(
        child(clientsRef, `${clientId}/assistants/${assistantId}`)
      );
      if (!assistantSnapshot.exists()) {
        res.status(404).json({ error: "Assistente não encontrado." });
        return;
      }

      const assistantData = assistantSnapshot.val();

      // Deletar do OpenAI
      try {
        await client.beta.assistants.del(assistantData.openaiAssistantId);
      } catch (openaiError) {
        console.warn("Erro ao deletar assistente do OpenAI:", openaiError);
        // Continua mesmo se não conseguir deletar do OpenAI
      }

      // Marcar como inativo no Firebase (não deletar completamente para manter histórico)
      await update(child(clientsRef, `${clientId}/assistants/${assistantId}`), {
        status: "deleted",
        deletedAt: Date.now(),
      });

      res.json({
        message: "Assistente deletado com sucesso!",
        assistantId,
        clientId,
      });
    } catch (error) {
      console.error("Erro ao deletar assistente:", error);
      res.status(500).json({
        message: "Erro ao deletar assistente",
        error: error instanceof Error ? error.message : error,
      });
    }
  }
);

export default router;
