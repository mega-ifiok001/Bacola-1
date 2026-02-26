import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.MAILTRAP_HOST,
  port: Number(process.env.MAILTRAP_PORT),
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASS,
  },
});

export async function sendVerificationCode(email: string, code: string) {
  try {
    await transporter.sendMail({
      from: '"Bacola" <no-reply@bacola.com>',
      to: email,
      subject: "Your Bacola verification code",
      text: `Your verification code is: ${code}`,
    });

    console.log(`[DEV] Verification code sent to ${email}: ${code}`);
  } catch (err) {
    console.error("MAILTRAP SMTP ERROR:", err);
    throw new Error("Error sending code by email");
  }
}