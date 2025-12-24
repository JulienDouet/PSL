import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';

/**
 * Require admin access for API routes
 * Throws if not authenticated or not admin
 */
export async function requireAdmin() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized: Not logged in');
  }
  
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true, name: true }
  });
  
  if (!user?.isAdmin) {
    throw new Error('Forbidden: Admin access required');
  }
  
  return { userId: session.user.id, userName: user.name };
}
