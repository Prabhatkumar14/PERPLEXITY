import nodemailer from "nodemailer";

// Create transporter once to reuse connection (Faster)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendEmail = async ({ to, subject, text, html }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("❌ EMAIL_USER or EMAIL_PASS is missing in .env");
    throw new Error("Email credentials missing");
  }

  const mailOptions = {
    from: `"SeekrX Team" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html
  };

  try {
    console.log(`📧 Sending email to ${to}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Nodemailer Error:", error.message);
    if (error.message.includes('Invalid login')) {
      console.error("👉 TIP: Use a 'Google App Password', not your regular Gmail password.");
    }
    throw error;
  }
};

export default sendEmail;