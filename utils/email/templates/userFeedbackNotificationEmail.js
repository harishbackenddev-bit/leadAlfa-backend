const userFeedbackNotificationEmail = ({
  publicId,
  type,
  description,
  pageUrl,
  userName,
  userEmail,
  createdAt,
}) => {
  const logoUrl =
    process.env.APP_LOGO_URL ||
    "https://creatrend.co.za/assets/HeaderLogo-L_gF-ssU.svg";
  const formattedDate = createdAt
    ? new Date(createdAt).toUTCString()
    : new Date().toUTCString();

  const isBug = type === "bug";
  const typeLabel = isBug ? "Bug Report" : "User Feedback";

  const subject = `[Creatrend] New ${typeLabel} - ${publicId}`;
  const text = `New ${typeLabel} Received (${publicId})\n\nSubmitted By: ${userName} (${userEmail})\nType: ${typeLabel}\nPage URL: ${pageUrl || "N/A"}\nSubmitted At: ${formattedDate}\n\nDescription:\n${description}\n\nYou can view and manage this report in the Creatrend Admin Dashboard.`;

  const badgeBg = isBug ? "#fee2e2" : "#e0e7ff";
  const badgeColor = isBug ? "#991b1b" : "#3730a3";

  const html = `
    <div style="background-color: #f4f6f9; padding: 30px 15px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e5e7eb;">
        <!-- Header -->
        <tr>
          <td style="background-color: #ffffff; padding: 24px 32px; text-align: center; border-bottom: 1px solid #f1f5f9;">
            <img src="${logoUrl}" alt="Creatrend" height="40" style="height: 40px; max-height: 40px; width: auto; border: 0; display: inline-block; vertical-align: middle;" />
          </td>
        </tr>
        <!-- Body Content -->
        <tr>
          <td style="padding: 32px; color: #374151; font-size: 16px; line-height: 1.6;">
            <div style="margin-bottom: 16px;">
              <span style="background-color: ${badgeBg}; color: ${badgeColor}; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">${typeLabel}</span>
            </div>
            <h2 style="color: #111827; margin-top: 0; font-size: 20px; font-weight: 600;">New ${typeLabel} (${publicId})</h2>
            <p style="margin-bottom: 8px;"><strong>Submitted By:</strong> ${userName} (&lt;<a href="mailto:${userEmail}" style="color: #2563eb;">${userEmail}</a>&gt;)</p>
            <p style="margin-bottom: 8px;"><strong>Report Type:</strong> ${typeLabel}</p>
            <p style="margin-bottom: 8px;"><strong>Page / Route:</strong> ${pageUrl ? `<code style="background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #0f172a;">${pageUrl}</code>` : "N/A"}</p>
            <p style="margin-bottom: 16px; font-size: 13px; color: #6b7280;">Submitted At: ${formattedDate}</p>

            <!-- Description Box -->
            <div style="background-color: #f9fafb; border-left: 4px solid ${isBug ? "#ef4444" : "#6366f1"}; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; white-space: pre-wrap; color: #1f2937;">${description}</p>
            </div>

            <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">You can view and manage this report in the Creatrend Admin Dashboard.</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color: #f9fafb; padding: 20px 32px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; line-height: 1.5;">
            <p style="margin: 0 0 4px 0;">Creatrend PTY is a company registered in South Africa with company number 2025/46525.</p>
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} Creatrend. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </div>
  `;

  return { subject, text, html };
};

module.exports = userFeedbackNotificationEmail;
