import type { Request, Response } from 'express';

import { logDebug } from '../logging';

export function meRoute(request: Request, response: Response) {
  const subject = request.auth?.payload.sub ?? null;
  logDebug('authenticated_user_request', { subject: subject ?? '(missing)' });

  response.json({
    subject,
    claims: request.auth?.payload ?? {},
  });
}
