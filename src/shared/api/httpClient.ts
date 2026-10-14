export class HttpError extends Error {
  status: number;

  constructor(status: number) {
    super(`Request failed with status ${status}`);
    this.name = "HttpError";
    this.status = status;
  }
}

const buildUrl = (path: string): string =>
  new URL(path, window.location.origin).toString();

export const requestJson = async (
  path: string,
  init?: RequestInit,
): Promise<unknown> => {
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    throw new HttpError(response.status);
  }

  return response.json();
};
