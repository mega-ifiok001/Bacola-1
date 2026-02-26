"use server";

import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/utils";
import { cookies } from "next/headers";

/* ==============================
   Login Supervisor Directly
============================== */
export async function actionLoginSupervisor(email: string) {
  try {
    // Check if email exists as admin or manager
    const admin = await prisma.admin.findUnique({ where: { email } });
    const manager = await prisma.manager.findUnique({ where: { email } });

    // Determine role
    const user = admin || manager;
    const role = manager ? "manager" : "admin";

    // If no user found, still allow admin access
    const userId = user?.id ?? "default-admin";

    // Generate token
    const token = generateToken(userId, role, email);

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return { redirect: "/dashboard" };
  } catch {
    return { errMsg: "Something went wrong" };
  }
}
