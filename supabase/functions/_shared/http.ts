export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export function parseJson<T>(req: Request): Promise<T> {
  return req.json() as Promise<T>;
}

