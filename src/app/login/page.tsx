'use client';

import { Suspense } from 'react';
import LoginForm from './LoginForm';

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-teal-500 border-neutral-800" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LoginForm />
    </Suspense>
  );
}
