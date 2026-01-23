import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { Pool } from 'pg';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: Transporter | null = null;

  constructor(
    private configService: ConfigService,
    @Inject('DATABASE_POOL') private pool: Pool,
  ) {
    this.initializeTransporter();
  }

  /**
   * Fetches email from address settings from the database.
   * Falls back to environment variables if database settings don't exist.
   */
  private async getFromAddress(): Promise<{ email: string; name: string }> {
    try {
      const { rows } = await this.pool.query(
        `SELECT key, value FROM wiki.settings WHERE key IN ('smtp_from_email', 'smtp_from_name')`
      );
      const settings = Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
      return {
        email: settings['smtp_from_email'] || this.configService.get('SMTP_FROM_EMAIL', 'no-reply@mobiusconsortium.org'),
        name: settings['smtp_from_name'] || this.configService.get('SMTP_FROM_NAME', 'MOBIUS Wiki'),
      };
    } catch (error) {
      // Fallback to env vars on error
      this.logger.warn(`Failed to fetch email settings from database: ${error.message}`);
      return {
        email: this.configService.get('SMTP_FROM_EMAIL', 'no-reply@mobiusconsortium.org'),
        name: this.configService.get('SMTP_FROM_NAME', 'MOBIUS Wiki'),
      };
    }
  }

  private initializeTransporter(): void {
    const transport = this.configService.get<string>('MAIL_TRANSPORT', 'smtp');

    if (transport === 'sendmail') {
      // Use local sendmail binary (for servers with sendmail/postfix configured)
      const sendmailPath = this.configService.get<string>('SENDMAIL_PATH', '/usr/sbin/sendmail');
      this.transporter = nodemailer.createTransport({
        sendmail: true,
        path: sendmailPath,
        newline: 'unix',
      });
      this.logger.log(`Using sendmail transport: ${sendmailPath}`);
      return;
    }

    // SMTP transport (default)
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const secure = this.configService.get<string>('SMTP_SECURE', 'false') === 'true';
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');

    if (!host) {
      this.logger.warn('SMTP_HOST not configured. Email functionality will be disabled.');
      return;
    }

    const transportOptions: nodemailer.TransportOptions = {
      host,
      port,
      secure,
    } as nodemailer.TransportOptions;

    // Only add auth if credentials are provided
    if (user && pass) {
      (transportOptions as any).auth = {
        user,
        pass,
      };
    }

    this.transporter = nodemailer.createTransport(transportOptions);

    // Verify connection on startup
    this.transporter.verify()
      .then(() => {
        this.logger.log(`SMTP connection established to ${host}:${port}`);
      })
      .catch((error) => {
        this.logger.error(`SMTP connection failed: ${error.message}`);
      });
  }

  async sendMail(options: SendMailOptions): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('Email not sent: Mail transport not configured');
      return false;
    }

    try {
      const fromAddress = await this.getFromAddress();
      const info = await this.transporter.sendMail({
        from: `"${fromAddress.name}" <${fromAddress.email}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      });

      this.logger.log(`Email sent to ${options.to}: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}: ${error.message}`);
      return false;
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }
}
