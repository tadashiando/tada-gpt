import express, { Request, Response } from "express";
import crypto from "crypto";
import { ref, child, get, update, set } from "firebase/database";
import { database } from "../firebase"; // Usando o mesmo que as outras rotas
import { authenticateToken } from "../middlewares/authentication";
import { ClientInfo } from "../types/database";

const router = express.Router();
const clientsRef = ref(database, "clients");

// Criar um novo cliente (só admin pode fazer)
router.post("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { name, email, plan = "basic", webhookUrl } = req.body;

    // Validações básicas
    if (!name || !email) {
      res.status(400).json({ error: "Nome e email são obrigatórios." });
      return;
    }

    const clientId = crypto.randomUUID();
    const clientInfo: ClientInfo = {
      name,
      email,
      plan: plan as "basic" | "premium" | "enterprise",
      status: "active",
      createdAt: Date.now(),
      webhookUrl,
    };

    // Salvar no Firebase usando a mesma estrutura das outras rotas
    await set(child(clientsRef, `${clientId}/info`), clientInfo);

    res.status(201).json({
      clientId,
      client: clientInfo,
      message: "Cliente criado com sucesso!",
    });
  } catch (error) {
    console.error("Erro ao criar cliente:", error);
    res.status(500).json({
      message: "Erro ao criar cliente",
      error: error instanceof Error ? error.message : error,
    });
  }
});

// Listar todos os clientes (só admin pode ver)
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const snapshot = await get(clientsRef);
    const clients = snapshot.val() || {};

    // Formatar resposta para mostrar só as infos dos clientes
    const clientList = Object.keys(clients).map((clientId) => ({
      id: clientId,
      ...clients[clientId].info,
    }));

    res.json({ clients: clientList });
  } catch (error) {
    console.error("Error fetching clients:", error);
    res.status(500).json({
      message: "Error fetching clients",
      error: error instanceof Error ? error.message : error,
    });
  }
});

// Buscar um cliente específico
router.get(
  "/:clientId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;
      const snapshot = await get(child(clientsRef, clientId));
      const client = snapshot.val();

      if (!client) {
        res.status(404).json({ error: "Client not found." });
        return;
      }

      res.json({
        id: clientId,
        ...client,
      });
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({
        message: "Error fetching client",
        error: error instanceof Error ? error.message : error,
      });
    }
  }
);

// Atualizar informações do cliente
router.put(
  "/:clientId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;
      const updates = req.body;

      // Verificar se cliente existe
      const snapshot = await get(child(clientsRef, clientId));
      if (!snapshot.exists()) {
        res.status(404).json({ error: "Client not found." });
        return;
      }

      // Atualizar apenas as informações do cliente
      await update(child(clientsRef, `${clientId}/info`), updates);

      res.json({
        message: "Client updated successfully!",
        clientId,
      });
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({
        message: "Error updating client",
        error: error instanceof Error ? error.message : error,
      });
    }
  }
);

export default router;
