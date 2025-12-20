
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
      where: { name: 'Hyceman' }
  });

  if (user) {
      console.log('Updating user:', user.id);
      await prisma.user.update({
          where: { id: user.id },
          data: { 
              jklmUsername: 'Hyceman',
              displayName: 'Hyceman'
          }
      });
      console.log('User updated with JKLM username!');
  } else {
      console.log('User Hyceman not found.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
