"use server";

import { verifyToken } from "@/lib/utils";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function getUser() {
  const token = (await cookies()).get("token")?.value;
  if (!token) return null;

  try {
    const decoded = await verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    return user || null; // just return null if user not found
  } catch {
    return null; // invalid token
  }
}

export default getUser;