export type FieldErrors = Record<string, string>;

type ApiErrorPayload = {
  error?: {
    message?: string;
    fieldErrors?: FieldErrors;
  };
};

export class WorkspaceApiError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: FieldErrors = {}
  ) {
    super(message);
    this.name = 'WorkspaceApiError';
  }
}

export async function requestWorkspaceApi<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => ({}))) as T & ApiErrorPayload;

  if (!response.ok) {
    throw new WorkspaceApiError(
      payload.error?.message || 'Не удалось выполнить операцию',
      payload.error?.fieldErrors
    );
  }

  return payload;
}

export function jsonRequest(method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): RequestInit {
  return {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}
