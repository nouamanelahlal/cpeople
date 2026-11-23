import { ApiError, apiStream } from '../../../lib/api';

/**
 * One document, as the browser sees it (HR-01 spec 6.7).
 *
 * The API holds the bytes and decides who may have them; the browser cannot ask
 * it directly, because the access token is in an httpOnly cookie that only this
 * application can open. So this asks on the reader's behalf and passes the answer
 * through — headers and all — without ever putting the file on disk here.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
): Promise<Response> {
  const { documentId } = await params;

  try {
    const answer = await apiStream(`/documents/${documentId}/content`);

    if (!answer.ok || !answer.body) {
      return new Response(null, { status: answer.status });
    }

    const headers = new Headers();
    for (const header of ['content-type', 'content-disposition', 'content-length']) {
      const value = answer.headers.get(header);
      if (value) headers.set(header, value);
    }
    // A document is one person's, so no shared cache may keep a copy of it.
    headers.set('cache-control', 'private, no-store');

    return new Response(answer.body, { status: 200, headers });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 502;
    return new Response(null, { status });
  }
}
