import axios from "axios";

const sendEmail = async ({ to, subject, html }) => {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  if (!BREVO_API_KEY) {
    console.warn("⚠️ BREVO_API_KEY is missing.");
    return;
  }

  try {
    console.log(`📧 Sending email via Brevo to ${to}...`);
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { name: "SeekrX", email: process.env.EMAIL_USER || "ankitrajsingh843483@gmail.com" }, 
        to: [{ email: to }],
        subject: subject,
        htmlContent: html,
      },
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("✅ Email sent via Brevo:", response.data.messageId);
    return response.data;
  } catch (error) {
    console.error("❌ Brevo API Error:", error.response?.data || error.message);
  }
};

export default sendEmail;