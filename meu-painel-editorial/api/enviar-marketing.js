import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido'
    });
  }

  try {
    const {
      title,
      category,
      objective,
      content,
      assignee,
      sentBy,
      sentAt,
      attachments
    } = req.body;

    // Validação mínima
    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Título do artigo não informado'
      });
    }

    // Converte os anexos em Base64 puro para o formato aceito pelo Resend
    const formattedAttachments = (attachments || []).map(att => {
      if (!att?.name || !att?.dataUrl) {
        throw new Error('Anexo inválido ou incompleto');
      }

      // Remove o prefixo:
      // data:image/png;base64,
      // data:application/pdf;base64,
      // etc.
      const commaIndex = att.dataUrl.indexOf(',');

      const base64Content =
        commaIndex >= 0
          ? att.dataUrl.slice(commaIndex + 1)
          : att.dataUrl;

      return {
        filename: att.name,
        content: base64Content
      };
    });

    const { data, error } = await resend.emails.send({
      from: 'Editorial Joia Bank <onboarding@resend.dev>',

      // E-mail usado atualmente para os testes
      to: ['design.alphaminerals@gmail.com'],

      subject: `[Marketing] Novo Artigo Concluído: ${title}`,

      html: `
        <h2>Novo Artigo Enviado para o Marketing</h2>

        <p>
          <strong>Título:</strong>
          ${title}
        </p>

        <p>
          <strong>Categoria:</strong>
          ${category || 'Não informada'}
        </p>

        <p>
          <strong>Objetivo:</strong>
          ${objective || 'Não informado'}
        </p>

        <p>
          <strong>Responsável:</strong>
          ${assignee || 'Não informado'}
        </p>

        <p>
          <strong>Enviado por:</strong>
          ${sentBy || 'Não informado'}
        </p>

        <p>
          <strong>Data do envio:</strong>
          ${sentAt || 'Não informada'}
        </p>

        <hr/>

        <h3>Rascunho do Artigo</h3>

        <p style="white-space: pre-wrap;">
          ${content || 'Nenhum conteúdo informado.'}
        </p>
      `,

      attachments: formattedAttachments
    });

    // O Resend pode retornar erro sem lançar exception
    if (error) {
      console.error('Erro retornado pelo Resend:', error);

      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao enviar o e-mail pelo Resend',
        details: error
      });
    }

    console.log('E-mail enviado com sucesso:', data);

    return res.status(200).json({
      success: true,
      message: 'E-mail enviado com sucesso',
      emailId: data?.id
    });

  } catch (error) {
    console.error('Erro interno ao enviar para o marketing:', error);

    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno no envio do e-mail'
    });
  }
}
