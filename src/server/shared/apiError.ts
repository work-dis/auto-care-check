import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function apiErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const field = issue.path[0];
      if (field !== undefined) fieldErrors[String(field)] = issue.message;
    }
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Проверьте введённые данные',
          fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
        },
      },
      { status: error.status },
    );
  }

  console.error(fallbackMessage, error);
  return NextResponse.json(
    { error: { code: 'SERVER_ERROR', message: fallbackMessage } },
    { status: 500 },
  );
}
