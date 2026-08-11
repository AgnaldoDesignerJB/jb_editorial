import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { title, category, objective, content, assignee, sentBy, sentAt, attachments } = req.body;

    // Monta os anexos para o formato exigido pelo Resend
    const formattedAttachments = (attachments || []).map(att => ({
      filename: att.name,
      path: att.dataUrl // O Resend aceita Data URLs ou buffers
    }));

    const emailResponse = await resend.emails.send({
      from: 'Editorial Joia Bank <onboarding@resend.dev>', // No plano gratuito, usa-se o domínio padrão do Resend
      to: ['marketing@joiabank.com.br'], // Substitua pelo e-mail do marketing
      subject: `[Marketing] Novo Artigo Concluído: ${title}`,
      html: `
        <h2>Novo Artigo Enviado para o Marketing</h2>
        <p><strong>Título:</strong> ${title}</p>
        <p><strong>Categoria:</strong> ${category}</p>
        <p><strong>Objetivo:</strong> ${objective}</p>
        <p><strong>Responsável:</strong> ${assignee || 'Não informado'}</p>
        <p><strong>Enviado por:</strong> ${sentBy} em ${sentAt}</p>
        <hr/>
        <h3>Rascunho do Artigo:</h3>
        <p style="white-space: pre-wrap;">${content}</p>
      `,
      attachments: formattedAttachments
    });

    return res.status(200).json({ success: true, emailResponse });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}