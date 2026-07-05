import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/jwt';

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  let hasToken = false;

  if (token) {
    try {
      const payload = verifyToken(token);
      hasToken = !!payload;
    } catch {
      hasToken = false;
    }
  }

  if (hasToken) {
    redirect('/dashboard');
  }

  redirect('/login');
}
