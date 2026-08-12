export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido.'
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('GEMINI_API_KEY não encontrada nas variáveis de ambiente.');
    return res.status(500).json({
      success: false,
      error: 'A integração com a IA não está configurada no servidor.'
    });
  }

  try {
    const { texto, instrucaoUsuario = '', textoOriginal = '' } = req.body || {};

    if (typeof texto !== 'string' || !texto.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum texto foi enviado para revisão.'
      });
    }

    if (texto.length > 120000) {
      return res.status(413).json({
        success: false,
        error: 'O texto é muito grande para uma única revisão.'
      });
    }

    const instrucao = `
Você é um revisor profissional de língua portuguesa do Brasil.

Sua tarefa é revisar o texto fornecido SOMENTE nestes aspectos:
1. ortografia;
2. gramática;
3. concordância nominal e verbal;
4. regência;
5. pontuação;
6. uso correto de maiúsculas, minúsculas e acentuação;
7. organização básica de parágrafos e quebras de linha quando isso melhorar a leitura.

REGRAS OBRIGATÓRIAS:
- Preserve integralmente o sentido original.
- Preserve o vocabulário e a intenção do autor sempre que estiverem corretos.
- Não altere o tom de voz.
- Não faça reescrita criativa.
- Não torne o texto mais persuasivo.
- Não aplique SEO.
- Não acrescente informações, dados, argumentos ou exemplos.
- Não remova informações relevantes.
- Não transforme o texto em outro gênero textual.
- Não use Markdown no campo "textoCorrigido".
- Preserve títulos, subtítulos e listas quando estiverem claramente identificáveis.
- Use português brasileiro.
- Se o texto já estiver correto, devolva-o sem alterações desnecessárias.

No campo "feedback", informe de forma breve e objetiva o que foi corrigido.
No campo "textoCorrigido", devolva o texto completo revisado.

INSTRUÇÃO ADICIONAL DO USUÁRIO:
${instrucaoUsuario
  ? `O usuário pediu o seguinte ajuste pontual na revisão: "${instrucaoUsuario}".
     Dê prioridade a essa solicitação quando ela estiver relacionada à preservação de palavras, expressões, grafias intencionais, pontuação, gramática ou organização do texto.
     Não use essa solicitação para expandir a tarefa para SEO, tom de voz, persuasão ou criação de conteúdo novo.
     Se a solicitação pedir para preservar algo do texto original, preserve exatamente como solicitado.`
  : 'Nenhuma instrução adicional foi fornecida.'}

TEXTO ORIGINAL PARA REFERÊNCIA:
${textoOriginal && typeof textoOriginal === 'string'
  ? textoOriginal
  : 'Não fornecido.'}
`;

    const payload = {
      model: 'gemini-3.5-flash',
      store: false,
      input: `${instrucao}\n\nTEXTO ATUAL PARA REVISÃO:\n\n${texto}`,
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: {
          type: 'object',
          properties: {
            feedback: {
              type: 'string',
              description: 'Resumo curto e objetivo das correções realizadas.'
            },
            textoCorrigido: {
              type: 'string',
              description: 'Texto completo revisado, preservando sentido, intenção e estilo do autor.'
            }
          },
          required: ['feedback', 'textoCorrigido']
        }
      }
    };

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/interactions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro retornado pela Gemini API:', data);
      return res.status(response.status).json({
        success: false,
        error: data?.error?.message || 'Não foi possível concluir a revisão com a IA.'
      });
    }

    const outputText = (data.steps || [])
      .filter(step => step?.type === 'model_output')
      .flatMap(step => step?.content || [])
      .filter(item => item?.type === 'text' && typeof item.text === 'string')
      .map(item => item.text)
      .join('')
      .trim();

    if (!outputText) {
      console.error('Resposta da Gemini sem texto utilizável:', data);
      return res.status(502).json({
        success: false,
        error: 'A IA respondeu, mas não retornou um texto de revisão válido.'
      });
    }

    let revisao;
    try {
      revisao = JSON.parse(outputText);
    } catch (parseError) {
      console.error('Resposta JSON inválida da Gemini:', outputText);
      return res.status(502).json({
        success: false,
        error: 'A IA retornou uma resposta em formato inesperado.'
      });
    }

    if (
      typeof revisao?.feedback !== 'string' ||
      typeof revisao?.textoCorrigido !== 'string'
    ) {
      return res.status(502).json({
        success: false,
        error: 'A resposta da IA está incompleta.'
      });
    }

    return res.status(200).json({
      success: true,
      feedback: revisao.feedback,
      textoCorrigido: revisao.textoCorrigido,
      model: data.model || 'gemini-3.5-flash'
    });
  } catch (error) {
    console.error('Erro interno em revisar-ia.js:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao revisar o texto.'
    });
  }
}
