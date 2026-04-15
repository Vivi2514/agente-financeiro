import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function requireCurrentUser() {
  const session = await auth();

  const sessionUserId = session?.user?.id;
  const sessionEmail = session?.user?.email;

  if (sessionUserId) {
    const user = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      throw new Error("Usuário autenticado não encontrado no banco.");
    }

    return user;
  }

  if (sessionEmail) {
    const user = await prisma.user.findUnique({
      where: { email: sessionEmail },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      throw new Error("Usuário autenticado não encontrado no banco.");
    }

    return user;
  }

  throw new Error("Usuário não autenticado.");
}

export async function requireCurrentUserId() {
  const user = await requireCurrentUser();
  return user.id;
}