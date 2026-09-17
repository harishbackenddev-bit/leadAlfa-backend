const contactRequestNotificationEmail = ({
  name,
  email,
  inquiryLabel,
  message,
  publicId,
}) => {
  const subject = `[Creatrend Inquiry] ${inquiryLabel} from ${name} (${publicId})`;
  const logoUrl = process.env.APP_LOGO_URL || "https://creatrend.co.za/assets/HeaderLogo-L_gF-ssU.svg";
  const text = `New Contact Request Received (${publicId})\n\nName: ${name}\nEmail: ${email}\nInquiry Type: ${inquiryLabel}\n\nMessage:\n${message}`;

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
              <span style="background-color: #dbeafe; color: #1e40af; font-size: 13px; font-weight: 700; padding: 6px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">${inquiryLabel}</span>
            </div>
            <h2 style="color: #111827; margin-top: 0; font-size: 20px; font-weight: 600;">New Contact Request (${publicId})</h2>
            <p style="margin-bottom: 8px;"><strong>From:</strong> ${name} (&lt;<a href="mailto:${email}" style="color: #2563eb;">${email}</a>&gt;)</p>
            <p style="margin-bottom: 16px;"><strong>Inquiry Type:</strong> ${inquiryLabel}</p>
            <div style="background-color: #f9fafb; border-left: 4px solid #2563eb; padding: 16px; margin: 16px 0; border-radius: 4px;">
              <p style="margin: 0; white-space: pre-wrap; color: #1f2937;">${message}</p>
            </div>
            <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">You can view and manage this request in the Creatrend Admin Dashboard.</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} Creatrend. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </div>
  `;

  return { subject, text, html };
};

module.exports = contactRequestNotificationEmail;
