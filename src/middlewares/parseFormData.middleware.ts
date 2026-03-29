import { Request, Response, NextFunction } from 'express';

export function parseFormJsonFields(req: Request, _res: Response, next: NextFunction) {
  if (!req.body || typeof req.body !== 'object') return next();

  const body = req.body as Record<string, any>;

  Object.keys(body).forEach((key) => {
    const val = body[key];
    if (typeof val !== 'string') return;

    const trimmed = val.trim();

    // Parse JSON objects/arrays
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        body[key] = JSON.parse(trimmed);
        return;
      } catch (e) {
        return;
      }
    }

    // Parse booleans
    if (trimmed === 'true' || trimmed === 'false') {
      body[key] = trimmed === 'true';
      return;
    }

    // Parse numbers when appropriate (simple heuristic)
    if (trimmed !== '' && !Number.isNaN(Number(trimmed))) {
      body[key] = Number(trimmed);
      return;
    }
  });

  next();
}
