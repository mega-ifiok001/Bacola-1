"use server";

import nodemailer from "nodemailer";
import {
  ADD_MANAGER_EMAIL_TEMPLATE,
  PASSWORD_RESET_REQUEST_TEMPLATE,
  PASSWORD_RESET_SUCCESS_TEMPLATE,
  REPLACE_EMAIL_TEMPLATE,
  VERIFICATION_EMAIL_TEMPLATE,
  VERIFICATION_EMAIL_TEMPLATE_ADMIN,
} from "./emailTemplates";

// ✅ Mailtrap SMTP Transporter (Email Testing)
const transporter = nodemailer.createTransport({
  host: process.env.MAILTRAP_HOST,
  port: Number(process.env.MAILTRAP_PORT),
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASS,
  },
});

// ✅ Common sender
const FROM_EMAIL = '"Bacola" <no-reply@bacola.com>';

// =============================
// VERIFICATION EMAIL (USER)
// =============================
export async function sendVerificationCode(email: string, code: string) {
  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: "Your Bacola verification code",
      html: VERIFICATION_EMAIL_TEMPLATE.replace(
        "{verificationCode}",
        code
      ),
    });

    console.log(`[DEV] Verification code sent to ${email}: ${code}`);
  } catch (err) {
    console.error("MAILTRAP SMTP ERROR:", err);
    throw new Error("Error sending code by email");
  }
}

// =============================
// VERIFICATION EMAIL (ADMIN)
// =============================
export async function sendVerificationAdminCode(
  email: string,
  code: string
) {
  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: "Verify your email",
      html: VERIFICATION_EMAIL_TEMPLATE_ADMIN.replace(
        "{verificationCode}",
        code
      ),
    });
  } catch (err) {
    console.error(err);
    throw new Error("Error sending admin verification email");
  }
}

// =============================
// WELCOME EMAIL
// =============================
export async function sendWelcomeEmail(email: string, name: string) {
  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: "Welcome to Bacola",
      html: `<h2>Welcome ${name}</h2><p>We're happy to have you at Bacola.</p>`,
    });
  } catch (err) {
    console.error(err);
    throw new Error("Error sending welcome email");
  }
}

// =============================
// PASSWORD RESET REQUEST
// =============================
export async function sendPasswordRestEmail(
  email: string,
  resetURL: string
) {
  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: "Reset your password",
      html: PASSWORD_RESET_REQUEST_TEMPLATE.replace(
        "{resetURL}",
        resetURL
      ),
    });
  } catch (err) {
    console.error(err);
    throw new Error("Error sending password reset email");
  }
}

// =============================
// PASSWORD RESET SUCCESS
// =============================
export async function sendResetSuccessEmail(email: string) {
  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: "Password Reset Successful",
      html: PASSWORD_RESET_SUCCESS_TEMPLATE,
    });
  } catch (err) {
    console.error(err);
    throw new Error("Error sending reset success email");
  }
}

// =============================
// REPLACE EMAIL
// =============================
export async function sendReplaceEmail(email: string) {
  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: "Notice: Replace your email",
      html: REPLACE_EMAIL_TEMPLATE.replace("{replaceEmail}", email),
    });
  } catch (err) {
    console.error(err);
    throw new Error("Error sending replace email");
  }
}

// =============================
// NEW MANAGER ADDED
// =============================
export async function sendNewManagerAdd(
  email: string,
  managerEmail: string
) {
  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: "Add new Manager email",
      html: ADD_MANAGER_EMAIL_TEMPLATE.replace(
        "{addManager}",
        managerEmail
      ),
    });
  } catch (err) {
    console.error(err);
    throw new Error("Error sending add manager email");
  }
}