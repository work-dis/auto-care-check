import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home() {
  const cookieStore = await cookies();
  const hasToken = cookieStore.has('auth_token');

  if (hasToken) {
    redirect('/dashboard');
  }

  redirect('/login');
}
