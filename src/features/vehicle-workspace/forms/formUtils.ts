import type { ZodError } from 'zod';
import { WorkspaceApiError, type FieldErrors } from '../api/client';

export function todayInputValue(): string {
  return new Date().toISOString().split('T')[0];
}

export function fieldErrorsFromZod(error: ZodError): FieldErrors {
  return error.issues.reduce<FieldErrors>((errors, issue) => {
    const field = issue.path[0];
    if (field !== undefined && !errors[String(field)]) {
      errors[String(field)] = issue.message;
    }
    return errors;
  }, {});
}

export function fieldErrorsFromRequest(error: unknown, fallback: string): FieldErrors {
  if (error instanceof WorkspaceApiError) {
    return Object.keys(error.fieldErrors).length > 0
      ? error.fieldErrors
      : { general: error.message };
  }

  console.error(error);
  return { general: fallback };
}
