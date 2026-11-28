// Turns the presenter guide into something you can print and carry.
//
//   pnpm demo:guide
//
// The same way the application makes a contract: Gotenberg, which is already in
// the local stack, renders the HTML with headless Chromium. No new dependency,
// and the screenshots travel inside the file.
//
// The Markdown it reads is ours, so the subset handled here is the subset the
// guide uses: headings, paragraphs, lists, tables, images, block quotes, fenced
// code, checkboxes, bold, italic, inline code and links. If you write something
// fancier in the guide, teach it to this file at the same time.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const GOTENBERG = process.env.GOTENBERG_URL?.trim() || 'http://localhost:3001';

// Which document to build. A bare name is a guide in this folder, so
// `pnpm demo:guide` keeps working; a name with a slash is a path from the
// repository root, for anything else worth printing — a status, a report.
const name = process.argv[2] ?? 'HR-01-presenter-guide';
const base = name.includes('/') ? resolve(here, '..', '..', name) : resolve(here, name);
const source = readFileSync(`${base}.md`, 'utf8');
const { html, images } = render(source);

const form = new FormData();
form.set('index.html', new Blob([page(html)], { type: 'text/html' }), 'index.html');
form.set(
  'footer.html',
  new Blob([footer()], { type: 'text/html' }),
  'footer.html',
);

for (const image of images) {
  const name = image.split('/').pop();

  form.set(name, new Blob([readFileSync(resolve(here, image))], { type: 'image/png' }), name);
}

form.set('marginTop', '1.4');
form.set('marginBottom', '1.4');
form.set('marginLeft', '1.4');
form.set('marginRight', '1.4');
form.set('printBackground', 'true');
form.set('paperWidth', '8.27');
form.set('paperHeight', '11.7');

const response = await fetch(`${GOTENBERG}/forms/chromium/convert/html`, {
  method: 'POST',
  body: form,
});

if (!response.ok) {
  console.error(
    `build-pdf: Gotenberg answered ${response.status}.\n` +
      'Is the local stack up?  docker compose -f infra/docker/docker-compose.yml up -d',
  );
  console.error((await response.text()).slice(0, 500));
  process.exit(1);
}

const out = `${base}.pdf`;
writeFileSync(out, Buffer.from(await response.arrayBuffer()));

console.log(`build-pdf: wrote ${out} (${images.length} screenshots)`);

/** Markdown → HTML, for the subset the guide is written in. */
function render(markdown) {
  const images = new Set();
  const out = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');

  let inCode = false;
  let code = [];
  let list = null;
  let table = null;
  let quote = [];

  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };

  const closeTable = () => {
    if (table) {
      out.push('</tbody></table>');
      table = null;
    }
  };

  const closeQuote = () => {
    if (quote.length > 0) {
      out.push(`<blockquote>${quote.map((line) => `<p>${inline(line)}</p>`).join('')}</blockquote>`);
      quote = [];
    }
  };

  const closeAll = () => {
    closeList();
    closeTable();
    closeQuote();
  };

  const inline = (text) =>
    escape(text)
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_whole, alt, src) => {
        images.add(src);
        // Gotenberg keeps uploaded files beside index.html with no folders, so
        // the page refers to each screenshot by its name alone.
        return `<img src="${src.split('/').pop()}" alt="${alt}" />`;
      })
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/\[ \]/g, '☐')
      .replace(/\[x\]/gi, '☑');

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith('```')) {
      if (inCode) {
        out.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`);
        code = [];
      } else {
        closeAll();
      }
      inCode = !inCode;
      continue;
    }

    if (inCode) {
      code.push(raw);
      continue;
    }

    if (line === '') {
      closeAll();
      continue;
    }

    if (line === '---') {
      closeAll();
      out.push('<hr />');
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeAll();
      const level = heading[1].length;
      // Every section after the first starts a fresh page, so a presenter can
      // turn one page per step instead of hunting down a column.
      const fresh = level === 2 && out.some((piece) => piece.startsWith('<h2'));
      out.push(
        `<h${level}${fresh ? ' class="new-page"' : ''}>${inline(heading[2])}</h${level}>`,
      );
      continue;
    }

    if (line.startsWith('> ')) {
      closeList();
      closeTable();
      quote.push(line.slice(2));
      continue;
    }

    // A table: the header row, then the dashes, then the body.
    if (line.startsWith('|')) {
      closeList();
      closeQuote();
      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());

      if (/^\|[\s|:-]+\|$/.test(line)) {
        continue;
      }

      if (!table) {
        out.push('<table><thead><tr>');
        out.push(cells.map((cell) => `<th>${inline(cell)}</th>`).join(''));
        out.push('</tr></thead><tbody>');
        table = true;
        continue;
      }

      out.push(`<tr>${cells.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`);
      continue;
    }

    const bullet = /^(\s*)[-*]\s+(.*)$/.exec(line);
    const numbered = /^(\s*)\d+\.\s+(.*)$/.exec(line);

    if (bullet || numbered) {
      closeTable();
      closeQuote();
      const want = bullet ? 'ul' : 'ol';

      if (list !== want) {
        closeList();
        out.push(`<${want}>`);
        list = want;
      }

      out.push(`<li>${inline((bullet ?? numbered)[2])}</li>`);
      continue;
    }

    closeList();
    closeTable();
    closeQuote();
    out.push(`<p>${inline(line)}</p>`);
  }

  closeAll();
  if (inCode) out.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`);

  return { html: out.join('\n'), images: [...images] };
}

/** The printed page: ConSAP's own colours, and room to write in the margin. */
function page(body) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>HR-01 presenter guide</title>
    <style>
      :root {
        --navy: #0f1937;
        --blue: #0e7bb0;
        --body: #4e566b;
        --line: #e3e7ee;
        --quiet: #f6f8fb;
      }
      body {
        font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        font-size: 10.5pt;
        line-height: 1.55;
        color: var(--navy);
        margin: 0;
      }
      h1 { font-size: 22pt; font-weight: 600; margin: 0 0 6pt; }
      h2 {
        font-size: 15pt;
        font-weight: 600;
        margin: 22pt 0 6pt;
        padding-top: 8pt;
        border-top: 2px solid var(--line);
        break-after: avoid;
      }
      /* A presenter turns one page per section, so each starts on its own. */
      h2.new-page { break-before: page; border-top: 0; padding-top: 0; margin-top: 0; }
      h3 { font-size: 12pt; font-weight: 600; margin: 14pt 0 4pt; break-after: avoid; }
      p { margin: 0 0 7pt; }
      a { color: var(--blue); text-decoration: none; }
      hr { border: 0; border-top: 1px solid var(--line); margin: 16pt 0; }
      ul, ol { margin: 0 0 8pt; padding-inline-start: 18pt; }
      li { margin-bottom: 3pt; }
      code {
        font-family: Consolas, 'Courier New', monospace;
        font-size: 9.5pt;
        background: var(--quiet);
        padding: 1pt 3pt;
        border-radius: 3pt;
      }
      pre {
        background: var(--navy);
        color: #eef3f8;
        padding: 8pt 10pt;
        border-radius: 6pt;
        break-inside: avoid;
      }
      pre code { background: none; color: inherit; font-size: 10pt; }
      blockquote {
        margin: 8pt 0;
        padding: 7pt 12pt;
        background: #e6f3fa;
        border-inline-start: 3pt solid var(--blue);
        border-radius: 0 6pt 6pt 0;
        break-inside: avoid;
      }
      blockquote p:last-child { margin-bottom: 0; }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 8pt 0 12pt;
        font-size: 9.5pt;
        break-inside: avoid;
      }
      th, td {
        border: 1px solid var(--line);
        padding: 5pt 7pt;
        text-align: start;
        vertical-align: top;
      }
      th { background: var(--quiet); font-weight: 600; }
      img {
        max-width: 100%;
        border: 1px solid var(--line);
        border-radius: 5pt;
        margin: 4pt 0 10pt;
        break-inside: avoid;
      }
      /* Each scene starts on a fresh page, so the presenter can turn one page
         per scene instead of hunting mid-sheet. */
      h2 { break-before: page; }
      h1 + p + h2 { break-before: auto; }
    </style>
  </head>
  <body>
${body}
  </body>
</html>`;
}

function footer() {
  return `<!doctype html>
<html>
  <head>
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 8pt; color: #4e566b; margin: 0; width: 100%; }
      .row { display: flex; justify-content: space-between; padding: 0 1.4cm; }
    </style>
  </head>
  <body>
    <div class="row">
      <span>CPeople — HR-01 presenter guide — 23 November 2026</span>
      <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>
  </body>
</html>`;
}

function escape(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
