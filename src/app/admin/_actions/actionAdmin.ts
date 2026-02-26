
"use server";

import prisma from "@/lib/prisma";
import generateVerificationCode, { generateToken } from "@/lib/utils";
import { sendVerificationAdminCode } from "@/mailtrap/emails";
import { cookies } from "next/headers";

// ======================== Supervisor Email Verification ========================
/**
 * Verifies a supervisor's email by sending a verification code.
 * @param email - Supervisor's email address.
 */
export async function actionVerifySupervisorEmail(email: string) {
  try {
    // ======================== Supervisor Lookup ========================
    // Use Promise.all to check if the supervisor is an admin or manager.
    const [findAdmin, findManager] = await Promise.all([
      prisma.admin.findUnique({ where: { email } }),
      prisma.manager.findUnique({ where: { email } }),
    ]).catch(() => {
      throw new Error("Server not responding");
    });

    const supervisor = findAdmin || findManager;
    if (!supervisor) throw new Error("Invalid email or credentials");

    // ======================== Code Generation ========================
    // Generate a random verification code and set an expiration time of 15 minutes.
    const randomCode = generateVerificationCode();
    const expirationDate = new Date(Date.now() + 15 * 60 * 1000);

    // ======================== Email Sending ========================
    // Send the verification code to the provided email address.
    try {
      await sendVerificationAdminCode(email, randomCode);
    } catch (err) {
      throw new Error("Error sending email");
    }

    // ======================== Cleanup Old Codes ========================
    // Remove old verification codes associated with the same supervisor.
    await prisma.verificationCode
      .deleteMany({
        where: {
          adminId: findAdmin?.id ?? undefined,
          managerId: findManager?.id ?? undefined,
        },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });

    // ======================== Save New Code ========================
    // Save the newly generated verification code with an expiration time.
    await prisma.verificationCode
      .create({
        data: {
          code: randomCode,
          expireIn: expirationDate,
          adminId: findAdmin ? findAdmin.id : null,
          managerId: findManager ? findManager.id : null,
        },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });

    return;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
}

// ======================== Supervisor Code Verification ========================
/**
 * Verifies the code sent to the supervisor's email.
 * @param code - Verification code entered by the supervisor.
 */
export async function actionVerifySupervisorCode(code: string) {
  try {
    // ======================== Code Verification ========================
    // Find the verification code and include the related admin or manager.
   const verificationCode = await prisma.verificationCode.findFirst({
  where: {
    code,
    expireIn: { gt: new Date() }, // still checks expiration
  },
  include: {
    admin: true,
    manager: true,
  },
});
if (!verificationCode) throw new Error("Invalid code or expired");

    // ======================== Cleanup Code ========================
    // Remove the verification code after successful verification.
    await prisma.verificationCode
      .delete({
        where: { id: verificationCode.id },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });

    const userId = verificationCode.admin?.id || verificationCode.manager?.id;
    const email =
      verificationCode.admin?.email || verificationCode.manager?.email;
    const role = verificationCode.admin ? "admin" : "manager";

    // ======================== Token Generation ========================
    // Generate a token using the user ID, role, and email.
    const token = generateToken(userId || "", role, email);

    // ======================== Set Cookie ========================
    // Store the token in an HTTP-only, secure cookie with a 7-day expiration.
    const cookieStore = await cookies();
    cookieStore.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // ======================== Redirect ========================
    // Redirect the user to the dashboard upon successful verification.
    return { redirect: "/dashboard" };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
}