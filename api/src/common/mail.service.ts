import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger('MailService');
  private transporter: Transporter | null = null;
  private readonly from: string;
  private readonly appOrigin: string;

  constructor(private readonly cfg: ConfigService) {
    const user = cfg.get<string>('MAIL_USER');
    const pass = cfg.get<string>('MAIL_PASS');
    this.from = cfg.get<string>('MAIL_FROM') ?? user ?? 'no-reply@qianka.local';
    this.appOrigin = cfg.get<string>('APP_ORIGIN') ?? 'http://localhost:7110';

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host: cfg.get<string>('MAIL_HOST') ?? 'smtp.qq.com',
        port: Number(cfg.get<number>('MAIL_PORT') ?? 465),
        secure: true,
        auth: { user, pass },
      });
      this.logger.log(`SMTP ready · from=${this.from}`);
    } else {
      this.logger.warn('MAIL_USER / MAIL_PASS 未配置 · dev 模式：邮件仅打印到日志');
    }
  }

  async sendVerifyEmail(to: string, token: string): Promise<void> {
    const link = `${this.appOrigin}/verify-email?token=${token}`;
    const subject = '千卡日记 · 验证你的邮箱';
    const html = this.wrap(
      '欢迎写下第一页',
      `<p>感谢注册千卡日记。点下面的按钮激活账号，链接 24 小时内有效：</p>`,
      link,
      '激活账号',
    );
    await this.send(to, subject, html, link);
  }

  async sendResetEmail(to: string, token: string): Promise<void> {
    const link = `${this.appOrigin}/reset?token=${token}`;
    const subject = '千卡日记 · 重置密码';
    const html = this.wrap(
      '重置你的密码',
      `<p>收到你的密码重置请求，点下面按钮设置新密码，链接 30 分钟内有效。<br/>如果不是你本人操作，请忽略此邮件。</p>`,
      link,
      '设置新密码',
    );
    await this.send(to, subject, html, link);
  }

  private async send(to: string, subject: string, html: string, plainLink: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[DEV-MAIL] to=${to} · ${subject}`);
      this.logger.log(`[DEV-MAIL] LINK -> ${plainLink}`);
      return;
    }
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html,
        text: `${subject}\n\n${plainLink}`,
      });
      this.logger.log(`mail sent to=${to} · id=${info.messageId}`);
    } catch (e: unknown) {
      this.logger.error(`mail send failed: ${(e as Error).message}`);
      throw e;
    }
  }

  private wrap(title: string, body: string, href: string, button: string): string {
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:32px 20px;background:#fff8f5;font-family:PingFang SC,-apple-system,Segoe UI,sans-serif;color:#1f1b19;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 4px 12px rgba(29,25,23,.04);">
    <p style="font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#a53314;margin:0 0 8px;">千卡日记 · Qianka Diary</p>
    <h1 style="font-size:28px;line-height:36px;margin:0 0 16px;font-weight:600;">${title}</h1>
    ${body}
    <p style="margin:32px 0;">
      <a href="${href}" style="display:inline-block;padding:14px 28px;background:#a53314;color:#ffffff;border-radius:10px;font-size:17px;text-decoration:none;">${button}</a>
    </p>
    <p style="font-size:13px;color:#58413c;">如果按钮无法点击，请复制以下链接到浏览器：<br/><span style="word-break:break-all;color:#8c716a;">${href}</span></p>
    <hr style="border:0;border-top:1px solid #e0bfb7;margin:32px 0;"/>
    <p style="font-size:11px;color:#8c716a;margin:0;">此邮件由系统自动发送，请勿直接回复。<br/>AI 内容仅供参考，不构成医疗建议。</p>
  </div>
</body></html>`;
  }
}
