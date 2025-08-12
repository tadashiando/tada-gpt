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
        res.status(404).json({ error: "Assistent not found." });
        return;
      }

      const assistantData = assistantSnapshot.val();
      const customFunctions = assistantData.customFunctions || [];

      // Encontrar a função solicitada
      const targetFunction = customFunctions.find(
        (func: any) => func.name === functionName
      );
      if (!targetFunction) {
        res.status(404).json({ error: "Function not found." });
        return;
      }

      // Executar a função baseada no tipo
      let result;

      if (functionName === "buscar_produtos") {
        result = await executeBuscarProdutos(functionArgs, targetFunction);
      } else if (functionName === "verificar_estoque") {
        result = await executeVerificarEstoque(functionArgs, targetFunction);
      } else if (functionName === "analisar_imagem_produto") {
        result = await executeAnalisarImagem(functionArgs, targetFunction);
      } else {
        // Função genérica - chamar o endpoint do cliente
        result = await executeCustomFunction(functionArgs, targetFunction);
      }

      res.json({ result });
    } catch (error) {
      console.error("Error executing function: ", error);
      res.status(500).json({
        message: "Error executing function",
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
    const { categoria, preco_max, disponivel, palavra_chave } = args;

    // MOCK DATA - em produção isso viria do banco do cliente
    const produtos = [
      {
        id: 1,
        nome: "Smartphone XYZ",
        categoria: "eletrônicos",
        preco: 899.99,
        disponivel: true,
        tags: ["smartphone", "celular", "android"],
      },
      {
        id: 2,
        nome: "Notebook ABC",
        categoria: "eletrônicos",
        preco: 2499.99,
        disponivel: true,
        tags: ["notebook", "laptop", "computador"],
      },
      {
        id: 3,
        nome: "Camiseta Basic",
        categoria: "roupas",
        preco: 49.99,
        disponivel: false,
        tags: ["camiseta", "roupa", "algodão"],
      },
      {
        id: 4,
        nome: "Tênis Sport",
        categoria: "calçados",
        preco: 299.99,
        disponivel: true,
        tags: ["tênis", "esporte", "corrida"],
      },
      {
        id: 5,
        nome: "Fone Bluetooth",
        categoria: "eletrônicos",
        preco: 199.99,
        disponivel: true,
        tags: ["fone", "headphone", "bluetooth"],
      },
      {
        id: 6,
        nome: "Relógio Digital",
        categoria: "eletrônicos",
        preco: 159.99,
        disponivel: true,
        tags: ["relógio", "digital", "smartwatch"],
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

    // Filtrar por palavra-chave (busca em nome e tags)
    if (palavra_chave) {
      const palavraLower = palavra_chave.toLowerCase();
      resultado = resultado.filter(
        (p) =>
          p.nome.toLowerCase().includes(palavraLower) ||
          p.tags.some((tag) => tag.toLowerCase().includes(palavraLower))
      );
    }

    return {
      produtos: resultado,
      total: resultado.length,
      filtros_aplicados: { categoria, preco_max, disponivel, palavra_chave },
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
      return { erro: "Producto not found" };
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
        `Error in request: ${error.response?.status} - ${error.response?.statusText}`
      );
    }
    throw error;
  }
}

// Função para analisar imagem e buscar produtos similares
async function executeAnalisarImagem(args: any, functionConfig: any) {
  try {
    const { imagem_url, buscar_similares = true } = args;

    // Se o cliente tem endpoint customizado para análise, usa ele
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

    // Usar OpenAI Vision para analisar a imagem
    const openai = new (require("openai"))({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4o", // Modelo com suporte a vision
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analise esta imagem de produto e me diga:
              1. Que tipo de produto é (categoria)
              2. Características principais (cor, formato, estilo)
              3. Palavras-chave para busca
              4. Categoria sugerida (eletrônicos, roupas, calçados, decoração, etc.)
              
              Responda em formato JSON com as chaves: categoria, caracteristicas, palavras_chave, descricao`,
            },
            {
              type: "image_url",
              image_url: {
                url: imagem_url,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    let analise;
    try {
      // Tentar extrair JSON da resposta
      const conteudo = visionResponse.choices[0]?.message?.content || "";
      const jsonMatch = conteudo.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analise = JSON.parse(jsonMatch[0]);
      } else {
        // Se não conseguir extrair JSON, criar estrutura baseada no texto
        analise = {
          categoria: "produto",
          caracteristicas: ["analisado por IA"],
          palavras_chave: ["produto", "item"],
          descricao: conteudo,
        };
      }
    } catch (parseError) {
      console.warn("Error parsing JSON response", parseError);
      analise = {
        categoria: "produto",
        caracteristicas: ["produto identificado"],
        palavras_chave: ["item"],
        descricao:
          visionResponse.choices[0]?.message?.content || "Produto analisado",
      };
    }

    // Se solicitado, buscar produtos similares
    let produtos_similares = [];
    if (buscar_similares && analise.categoria) {
      try {
        // Primeiro tentar buscar pela categoria identificada
        let resultadoBusca = await executeBuscarProdutos(
          {
            categoria: analise.categoria.toLowerCase(),
            disponivel: true,
          },
          {}
        );

        // Se não encontrou, tentar pela categoria sugerida
        if (
          resultadoBusca.produtos.length === 0 &&
          analise.categoria_sugerida
        ) {
          resultadoBusca = await executeBuscarProdutos(
            {
              categoria: analise.categoria_sugerida.toLowerCase(),
              disponivel: true,
            },
            {}
          );
        }

        // Se ainda não encontrou, tentar por palavra-chave
        if (
          resultadoBusca.produtos.length === 0 &&
          analise.palavras_chave?.length > 0
        ) {
          resultadoBusca = await executeBuscarProdutos(
            {
              palavra_chave: analise.palavras_chave[0],
              disponivel: true,
            },
            {}
          );
        }

        produtos_similares = resultadoBusca.produtos || [];
      } catch (buscaError) {
        console.warn("Error searching for similar products", buscaError);
      }
    }

    return {
      analise: {
        imagem_analisada: imagem_url,
        ...analise,
      },
      produtos_similares,
      total_similares: produtos_similares.length,
      sugestao:
        produtos_similares.length > 0
          ? "Encontrei alguns produtos similares para você!"
          : "Não encontrei produtos similares no momento, mas posso ajudar você a encontrar algo parecido.",
    };
  } catch (error) {
    console.error("Erro na análise de imagem:", error);
    return {
      erro: "Não foi possível analisar a imagem no momento",
      detalhes: error instanceof Error ? error.message : "Erro desconhecido",
      sugestao:
        "Tente descrever o produto que você procura ou envie outra imagem",
    };
  }
}

export default router;
