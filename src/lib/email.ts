import nodemailer from 'nodemailer';

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromName = process.env.SMTP_FROM_NAME || 'AutoPulse';

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function getFromAddress(): string {
  return process.env.SMTP_FROM || 'noreply@autopulse.app';
}

export function getFromName(): string {
  return process.env.SMTP_FROM_NAME || 'AutoPulse';
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function buildReminderHtml(params: {
  title: string;
  body: string;
  vehicleName: string;
  planName: string;
  severity: string;
}): string {
  const severityColor =
    params.severity === 'critical' ? '#ef4444' :
    params.severity === 'warning' ? '#f59e0b' : '#14b8a6';

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0c;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#121214;border-radius:12px;border:1px solid #262626;">
          <tr>
            <td style="padding:32px 24px 16px;text-align:center;border-bottom:1px solid #262626;">
              <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;">AutoPulse</h1>
              <p style="margin:4px 0 0;font-size:13px;color:#a3a3a3;">Цифровой бортовой журнал</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <div style="display:inline-block;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;color:#ffffff;background-color:${severityColor};margin-bottom:16px;">
                ${params.severity === 'critical' ? '🔴 Срочно' : params.severity === 'warning' ? '🟡 Внимание' : '🔵 Напоминание'}
              </div>
              <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">${params.title}</h2>
              <p style="margin:0 0 16px;font-size:15px;color:#d4d4d4;line-height:1.5;">${params.body}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a1e;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
                <tr>
                  <td style="font-size:12px;color:#a3a3a3;padding-bottom:4px;">Автомобиль</td>
                </tr>
                <tr>
                  <td style="font-size:15px;font-weight:600;color:#ffffff;">${params.vehicleName}</td>
                </tr>
                <tr>
                  <td style="font-size:12px;color:#a3a3a3;padding:8px 0 4px;">План ТО</td>
                </tr>
                <tr>
                  <td style="font-size:15px;font-weight:600;color:#ffffff;">${params.planName}</td>
                </tr>
              </table>
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard"
                 style="display:inline-block;padding:12px 24px;border-radius:8px;background-color:#14b8a6;color:#000000;font-size:14px;font-weight:700;text-decoration:none;">
                Открыть приборную панель
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;text-align:center;border-top:1px solid #262626;">
              <p style="margin:0;font-size:12px;color:#737373;">
                AutoPulse — сервис контроля обслуживания автомобиля<br/>
                Если вы не хотите получать email-уведомления, измените настройки в приложении.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const transport = getTransport();
  if (!transport) {
    console.warn('[Email] SMTP not configured — skipping email send');
    return false;
  }

  try {
    const info = await transport.sendMail({
      from: `"${getFromName()}" <${getFromAddress()}>`,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html || params.text,
    });

    console.log(`[Email] Sent to ${params.to}: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[Email] Failed to send to ${params.to}:`, err);
    return false;
  }
}
