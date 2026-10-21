import type { Request, Response } from 'express';

export function meRoute(request: Request, response: Response) {
  const subject = request.auth?.payload.sub ?? null;
  if (process.env.NODE_ENV === 'development') {
    console.log(`[auth] /api/v1/me subject: ${subject ?? '(missing)'}`);
  }

  response.json({
    subject,
    claims: request.auth?.payload ?? {},
  });
}
