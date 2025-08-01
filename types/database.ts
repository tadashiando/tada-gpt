// Interfaces para a estrutura do banco de dados

export interface ClientInfo {
  name: string;
  email: string;
  plan: "basic" | "premium" | "enterprise";
  status: "active" | "inactive" | "suspended";
  createdAt: number;
  webhookUrl?: string;
}

export interface ClientAssistant {
  openaiAssistantId: string;
  name: string;
  instructions: string;
  model: string;
  tools: string[];
  customFunctions?: CustomFunction[]; // NOVO: funções customizadas
  status: "active" | "inactive";
  createdAt: number;
}

// NOVO: Interface para funções customizadas
export interface CustomFunction {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  endpoint: string; // URL do webhook/API do cliente
  method: "GET" | "POST";
  headers?: Record<string, string>;
}

export interface Conversation {
  threadId: string;
  assistantId: string;
  externalUserId: string; // ID do usuário no ManyChat
  status: "active" | "completed" | "abandoned";
  startedAt: number;
  lastActivity: number;
  autoDeleteAt: number; // 24h após última atividade
}

export interface DatabaseStructure {
  clients: {
    [clientId: string]: {
      info: ClientInfo;
      assistants: {
        [assistantId: string]: ClientAssistant;
      };
      conversations: {
        [conversationId: string]: Conversation;
      };
    };
  };
  // Manter estrutura atual para compatibilidade
  threads: {
    [threadId: string]: {
      threadId: string;
      assistantId: string;
      createdAt: number;
    };
  };
}
