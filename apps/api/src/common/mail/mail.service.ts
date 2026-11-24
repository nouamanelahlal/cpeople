import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { AppConfigService } from '../config/app-config.js';

/**
 * Sending a notice (M09 / HR-04).
 *
 * Deliberately small. It takes a recipient, a subject, a line or two and a link,
 * and it never takes anything else — a leave e-mail carries who, when and a way
 * back into the application, and nothing about why somebody is away. An inbox is
 * forwarded, printed and read over shoulders, and "Nadia: chemotherapy, 3 days"
 * is not a sentence this system will ever put in one.
 *
 * A failure to send is logged and swallowed. The request itself has already been
 * saved, and losing an approval because a mail relay hiccupped would be far
 * worse than a missing notice: the work is waiting on the approver's screen
 * either way.
 */
export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  /** The one link a message carries, back into the application. */
  readonly link?: { readonly url: string; readonly label: string };
  readonly footer?: string;
}

@Injectable()
export class MailService {
  readonly #log = new Logger(MailService.name);
  #transport?: Transporter;

  constructor(private readonly config: AppConfigService) {}

  /** The address of a page in the web application, for a link in a message. */
  url(path: string): string {
    return `${this.config.mail.appUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  async send(message: MailMessage): Promise<boolean> {
    if (!message.to.trim()) {
      return false;
    }

    try {
      await this.#transporter().sendMail({
        from: this.config.mail.from,
        to: message.to,
        subject: message.subject,
        text: this.#text(message),
        html: this.#html(message),
      });

      return true;
    } catch (error) {
      this.#log.warn(`Could not send "${message.subject}" to ${message.to}: ${String(error)}`);
      return false;
    }
  }

  #transporter(): Transporter {
    // Local Mailpit has no credentials and no TLS, which is what makes it a
    // catcher rather than a relay. A deployed environment passes a real host.
    this.#transport ??= createTransport({
      host: this.config.mail.host,
      port: this.config.mail.port,
      secure: false,
      ignoreTLS: this.config.localDev,
    });

    return this.#transport;
  }

  #text(message: MailMessage): string {
    return [message.body, message.link ? `${message.link.label}: ${message.link.url}` : '', message.footer ?? '']
      .filter((line) => line !== '')
      .join('\n\n');
  }

  /**
   * One column, brand colours, no images and no tracking. Mail clients are not
   * browsers, so this stays as plain as it can while still looking like CPeople.
   */
  #html(message: MailMessage): string {
    const link = message.link
      ? `<p style="margin:24px 0 0"><a href="${escape(message.link.url)}" style="background:#0E7BB0;border-radius:10px;color:#ffffff;display:inline-block;font-weight:600;padding:12px 20px;text-decoration:none">${escape(message.link.label)}</a></p>`
      : '';

    const footer = message.footer
      ? `<p style="color:#8A90A2;font-size:12px;margin:32px 0 0">${escape(message.footer)}</p>`
      : '';

    return [
      '<div style="background:#F0F0F0;padding:32px 16px">',
      '<div style="background:#ffffff;border:1px solid #E3E7EE;border-radius:20px;color:#4E566B;font-family:Montserrat,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;margin:0 auto;max-width:560px;padding:32px">',
      `<h1 style="color:#0F1937;font-size:19px;font-weight:600;margin:0 0 16px">${escape(message.subject)}</h1>`,
      `<p style="margin:0">${escape(message.body)}</p>`,
      link,
      footer,
      '</div></div>',
    ].join('');
  }
}

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
