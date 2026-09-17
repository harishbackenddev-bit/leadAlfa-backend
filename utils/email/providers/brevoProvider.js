const axios = require("axios");

const sendEmail = async ({ to, subject, text, html }) => {
  const payload = {
    sender: {
      name: "Creatrend Support",
      email: process.env.EMAIL_FROM || "support@leedsalpha.io",
    },
    to: [{ email: to }],
    subject,
    textContent: text,
    htmlContent: html,
  };

  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      payload,
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error(
      "[Brevo Email] Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

module.exports = { sendEmail };
