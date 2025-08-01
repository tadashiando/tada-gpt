import express, { Request, Response } from "express";
import axios from "axios";
import { ref, child, get } from "firebase/database";
import { database } from "../firebase";
import { authenticateToken } from "../middlewares/authentication";

const router = express.Router();
const clientsRef = ref(database, "clients");

// Executar função customizada
router.post(
  "/execute/:clientId/:assistantId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { clientId, assistantId } = req.params;
      const { functionName, arguments: functionArgs } = req.body;

      // Buscar assistente e suas funções customizadas
      const assistantSnapshot = await get(
        child(clientsRef, `${clientId}/assistants/${assistantId}`)
      );
      if (!assistantSnapshot.exists()) {
        res.status(404).json({ error: "Assistente não encontrado." });
        return;
      }

      const assistantData = assistantSnapshot.val();
      const customFunctions = assistantData.customFunctions || [];

      // Encontrar a função solicitada
      const targetFunction = customFunctions.find(
        (func: any) => func.name === functionName
      );
      if (!targetFunction) {
        res.status(404).json({ error: "Função não encontrada." });
        return;
      }

      // Executar a função baseada no tipo
      let result;

      if (functionName === "buscar_produtos") {
        result = await executeBuscarProdutos(functionArgs, targetFunction);
      } else if (functionName === "verificar_estoque") {
        result = await executeVerificarEstoque(functionArgs, targetFunction);
      } else {
        // Função genérica - chamar o endpoint do cliente
        result = await executeCustomFunction(functionArgs, targetFunction);
      }

      res.json({ result });
    } catch (error) {
      console.error("Erro ao executar função:", error);
      res.status(500).json({
        message: "Erro ao executar função",
        error: error instanceof Error ? error.message : error,
      });
    }
  }
);

// Função para buscar produtos
async function executeBuscarProdutos(args: any, functionConfig: any) {
  try {
    // Se o cliente tem um endpoint customizado, usa ele
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

    // Caso contrário, simula dados para demonstração
    const { categoria, preco_max, disponivel } = args;

    // MOCK DATA - em produção isso viria do banco do cliente
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

    // Filtrar por categoria
    if (categoria) {
      resultado = resultado.filter((p) =>
        p.categoria.toLowerCase().includes(categoria.toLowerCase())
      );
    }

    // Filtrar por preço máximo
    if (preco_max) {
      resultado = resultado.filter((p) => p.preco <= preco_max);
    }

    // Filtrar por disponibilidade
    if (disponivel !== undefined) {
      resultado = resultado.filter((p) => p.disponivel === disponivel);
    }

    return {
      produtos: resultado,
      total: resultado.length,
      filtros_aplicados: { categoria, preco_max, disponivel },
    };
  } catch (error) {
    throw new Error(`Erro ao buscar produtos: ${error}`);
  }
}

// Função para verificar estoque
async function executeVerificarEstoque(args: any, functionConfig: any) {
  try {
    // Se o cliente tem um endpoint customizado, usa ele
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

    // MOCK DATA - em produção isso viria do banco do cliente
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
      // Buscar por nome (simulação)
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
      return { erro: "Produto não encontrado" };
    }

    return {
      produto_id,
      produto_nome,
      ...estoque,
      disponivel_para_venda: estoque.quantidade - estoque.reservados,
    };
  } catch (error) {
    throw new Error(`Erro ao verificar estoque: ${error}`);
  }
}

// Função genérica para endpoints customizados
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
      timeout: 10000, // 10 segundos timeout
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Erro na requisição: ${error.response?.status} - ${error.response?.statusText}`
      );
    }
    throw error;
  }
}

export default router;
