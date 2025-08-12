import express, { Request, Response } from "express";
import axios from "axios";
import { ref, child, get } from "firebase/database";
import OpenAi from "openai";
import { database } from "../firebase";

const router = express.Router();
const clientsRef = ref(database, "clients");

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
      res.status(400).json({ error: "Invalid or missing message." });
      return;
    }

    if (history && !Array.isArray(history)) {
      res.status(400).json({ error: "Invalid history." });
      return;
    }

    if (!model || typeof model !== "string") {
      res.status(400).json({ error: "Invalid or missing model." });
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
      console.error("Error sending message", error);
      res.status(500).json({
        message: "Error sending message",
        error: error.message,
      });
    } else {
      res.status(400).json({ message: error });
    }
  }
});

// Envia mensagens ao assistente (COM FUNCTION CALLING)
router.post("/assistant", async (req: Request, res: Response) => {
  try {
    const { message, thread, assistant, clientId, assistantId } = req.body;

    // Validação básica e interrupção caso necessário
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Invalid or missing message." });
      return;
    }

    if (!thread || typeof thread !== "string") {
      res.status(400).json({ error: "Invalid or missing thread." });
      return;
    }

    if (!assistant || typeof assistant !== "string") {
      res.status(400).json({ error: "Invalid or missing assistant ID." });
      return;
    }

    // Criar mensagem do usuário
    await client.beta.threads.messages.create(thread, {
      role: "user",
      content: message,
    });

    // Criar e executar run
    const run = await client.beta.threads.runs.createAndPoll(thread, {
      assistant_id: assistant,
    });

    // Lidar com diferentes status do run
    if (run.status === "completed") {
      const messages = await client.beta.threads.messages.list(run.thread_id);
      const reversedMessages = messages.data.reverse();
      res.json({ history: reversedMessages });
    } else if (run.status === "requires_action") {
      // FUNCTION CALLING: O assistente quer chamar uma função
      await handleFunctionCalling(
        run,
        thread,
        assistant,
        clientId,
        assistantId,
        res
      );
    } else {
      console.log("Run status:", run.status);
      res.status(500).json({
        error: "Internal error communicating with LLM.",
        status: run.status,
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error sending message to assistant", error);
      res.status(500).json({
        message: "Error sending message to assistant",
        error: error.message,
      });
    } else {
      res.status(400).json({ message: error });
    }
  }
});

// Função para lidar com function calling
async function handleFunctionCalling(
  run: any,
  threadId: string,
  assistantId: string,
  clientId: string,
  localAssistantId: string,
  res: Response
) {
  try {
    const toolCalls =
      run.required_action?.submit_tool_outputs?.tool_calls || [];
    const toolOutputs = [];

    // Executar cada função chamada pelo assistente
    for (const toolCall of toolCalls) {
      if (toolCall.type === "function") {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(`Executing function: ${functionName}`, functionArgs);

        try {
          // Executar a função usando nossa rota de function calling
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
          console.error(
            `Error executing function ${functionName}:`,
            functionError
          );
          toolOutputs.push({
            tool_call_id: toolCall.id,
            output: JSON.stringify({
              erro: `Failed to execute ${functionName}: ${functionError}`,
            }),
          });
        }
      }
    }

    // Submeter os resultados das funções de volta para o OpenAI
    const finalRun = await client.beta.threads.runs.submitToolOutputsAndPoll(
      threadId,
      run.id,
      { tool_outputs: toolOutputs }
    );

    if (finalRun.status === "completed") {
      const messages = await client.beta.threads.messages.list(threadId);
      const reversedMessages = messages.data.reverse();
      res.json({ history: reversedMessages });
    } else {
      res.status(500).json({
        error: "Error after executing functions",
        status: finalRun.status,
      });
    }
  } catch (error) {
    console.error("Error in function calling: ", error);
    res.status(500).json({
      error: "Error processing function calling",
      details: error instanceof Error ? error.message : error,
    });
  }
}

// Função auxiliar para executar function calls
async function executeFunctionCall(
  clientId: string,
  assistantId: string,
  functionName: string,
  functionArgs: any
) {
  // Buscar assistente e suas funções customizadas
  const assistantSnapshot = await get(
    child(clientsRef, `${clientId}/assistants/${assistantId}`)
  );
  if (!assistantSnapshot.exists()) {
    throw new Error("Assistant not found");
  }

  const assistantData = assistantSnapshot.val();
  const customFunctions = assistantData.customFunctions || [];

  // Encontrar a função solicitada
  const targetFunction = customFunctions.find(
    (func: any) => func.name === functionName
  );
  if (!targetFunction) {
    throw new Error("Function not found");
  }

  // Executar a função baseada no tipo (reutilizando a lógica da rota function-calling)
  if (functionName === "buscar_produtos") {
    return await executeBuscarProdutos(functionArgs, targetFunction);
  } else if (functionName === "verificar_estoque") {
    return await executeVerificarEstoque(functionArgs, targetFunction);
  } else {
    // Função genérica - chamar o endpoint do cliente
    return await executeCustomFunction(functionArgs, targetFunction);
  }
}

// Reutilizar as funções da rota function-calling
async function executeBuscarProdutos(args: any, functionConfig: any) {
  try {
    if (functionConfig.endpoint) {
      const response = await axios({
        method: functionConfig.method || "POST",
        url: functionConfig.endpoint,
        data: args,
        headers: {
          "Content-Type": "application/json",
          ...functionConfig.headers,
        },
      });
      return response.data;
    }

    const { categoria, preco_max, disponivel } = args;

    const produtos = [
      {
        id: 1,
        nome: "Smartphone XYZ",
        categoria: "eletrônicos",
        preco: 899.99,
        disponivel: true,
      },
      {
        id: 2,
        nome: "Notebook ABC",
        categoria: "eletrônicos",
        preco: 2499.99,
        disponivel: true,
      },
      {
        id: 3,
        nome: "Camiseta Basic",
        categoria: "roupas",
        preco: 49.99,
        disponivel: false,
      },
      {
        id: 4,
        nome: "Tênis Sport",
        categoria: "calçados",
        preco: 299.99,
        disponivel: true,
      },
    ];

    let resultado = produtos;

    if (categoria) {
      resultado = resultado.filter((p) =>
        p.categoria.toLowerCase().includes(categoria.toLowerCase())
      );
    }

    if (preco_max) {
      resultado = resultado.filter((p) => p.preco <= preco_max);
    }

    if (disponivel !== undefined) {
      resultado = resultado.filter((p) => p.disponivel === disponivel);
    }

    return {
      produtos: resultado,
      total: resultado.length,
      filtros_aplicados: { categoria, preco_max, disponivel },
    };
  } catch (error) {
    throw new Error(`Error searching for products: ${error}`);
  }
}

async function executeVerificarEstoque(args: any, functionConfig: any) {
  try {
    if (functionConfig.endpoint) {
      const response = await axios({
        method: functionConfig.method || "POST",
        url: functionConfig.endpoint,
        data: args,
        headers: {
          "Content-Type": "application/json",
          ...functionConfig.headers,
        },
      });
      return response.data;
    }

    const { produto_id, produto_nome } = args;

    const estoques = {
      1: { disponivel: true, quantidade: 15, reservados: 2 },
      2: { disponivel: true, quantidade: 8, reservados: 1 },
      3: { disponivel: false, quantidade: 0, reservados: 0 },
      4: { disponivel: true, quantidade: 25, reservados: 5 },
    };

    let estoque;
    if (produto_id) {
      estoque = estoques[produto_id as keyof typeof estoques];
    } else if (produto_nome) {
      const produtos = {
        "smartphone xyz": 1,
        "notebook abc": 2,
        "camiseta basic": 3,
        "tênis sport": 4,
      };
      const id = produtos[produto_nome.toLowerCase() as keyof typeof produtos];
      estoque = id ? estoques[id as keyof typeof estoques] : null;
    }

    if (!estoque) {
      return { erro: "Product not found" };
    }

    return {
      produto_id,
      produto_nome,
      ...estoque,
      disponivel_para_venda: estoque.quantidade - estoque.reservados,
    };
  } catch (error) {
    throw new Error(`Error verifying stock: ${error}`);
  }
}

async function executeCustomFunction(args: any, functionConfig: any) {
  try {
    const response = await axios({
      method: functionConfig.method || "POST",
      url: functionConfig.endpoint,
      data: args,
      headers: {
        "Content-Type": "application/json",
        ...functionConfig.headers,
      },
      timeout: 10000,
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Error in request: ${error.response?.status} - ${error.response?.statusText}`
      );
    }
    throw error;
  }
}

export default router;
