import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.js';

/**
 * Turning a page into a PDF (CLAUDE.md: Gotenberg, never a browser in the app).
 *
 * Gotenberg runs headless Chromium behind an HTTP call, which means the document
 * is laid out by the same engine that lays out the screen: one way of describing
 * a page, two ways of printing it. The application itself stays a web
 * application, with no browser inside it to keep alive.
 */
export interface PdfRequest {
  readonly html: string;
  /** Printed at the bottom of every page; Gotenberg fills in the numbers. */
  readonly footerHtml?: string;
  readonly marginsCm?: number;
}

@Injectable()
export class PdfService {
  readonly #url: string;
  readonly #logger = new Logger(PdfService.name);

  constructor(config: AppConfigService) {
    this.#url = config.gotenbergUrl;
  }

  async render(request: PdfRequest): Promise<Buffer> {
    const form = new FormData();
    form.set('index.html', new Blob([request.html], { type: 'text/html' }), 'index.html');

    if (request.footerHtml !== undefined) {
      form.set(
        'footer.html',
        new Blob([request.footerHtml], { type: 'text/html' }),
        'footer.html',
      );
    }

    const margin = String(request.marginsCm ?? 2);
    for (const side of ['marginTop', 'marginBottom', 'marginLeft', 'marginRight']) {
      form.set(side, margin);
    }
    // The document's own background — the watermark lives in it — has to survive
    // printing, which Chromium otherwise drops.
    form.set('printBackground', 'true');
    form.set('preferCssPageSize', 'false');
    form.set('paperWidth', '8.27');
    form.set('paperHeight', '11.7');

    let response: Response;

    try {
      response = await fetch(`${this.#url}/forms/chromium/convert/html`, {
        method: 'POST',
        body: form,
      });
    } catch (error) {
      this.#logger.error(`Gotenberg could not be reached at ${this.#url}`, error as Error);
      throw new ServiceUnavailableException('The document service is not answering.');
    }

    if (!response.ok) {
      const said = await response.text().catch(() => '');
      this.#logger.error(`Gotenberg answered ${response.status}: ${said.slice(0, 500)}`);
      throw new ServiceUnavailableException('The document could not be produced.');
    }

    return Buffer.from(await response.arrayBuffer());
  }
}
