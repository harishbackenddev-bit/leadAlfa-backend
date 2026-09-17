const resendVerificationEmail = (newCode) => {
  const ttl = Number(process.env.VERIFICATION_CODE_TTL_MINUTES) || 2;
  const ttlDisplay = `${ttl} minute${ttl === 1 ? "" : "s"}`;
  const logoUrl = process.env.APP_LOGO_URL || "https://creatrend.co.za/assets/HeaderLogo-L_gF-ssU.svg";
  const supportEmail = process.env.SUPPORT_EMAIL || "support@creatrend.co.za";

  return {
    subject: "Creatrend - Your New Verification Code",
    text: `Hello,\n\nYou requested a new verification code for your Creatrend account.\n\nYour new verification code is: ${newCode}\n\nNote: This code will expire in ${ttlDisplay}. Please do not share it with anyone.\n\nIf you did not request a new verification code, you can safely ignore this email.\n\n--------------------------------------------------\nNeed Help?\nFor additional help, contact ${supportEmail}.\n\nSecurity Notice:\nPlease be advised that Creatrend will never contact you via email to request or verify sensitive information, including your password, credit card details, or bank account numbers.\n\nIf you receive a suspicious email containing a link to update your account information, please refrain from clicking it. Instead, report the incident immediately by forwarding the email to ${supportEmail}.\n\nCreatrend PTY is a company registered in South Africa with company number 2025/46525.\n© ${new Date().getFullYear()} Creatrend. All rights reserved.`,
    html: `
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
              <span style="background-color: #e0e7ff; color: #3730a3; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">New Security Code</span>
            </div>
            <h2 style="color: #111827; margin-top: 0; font-size: 20px; font-weight: 600;">Your New Verification Code</h2>
            <p style="margin-bottom: 20px; color: #4b5563;">You requested a new verification code for your <strong>Creatrend</strong> account. Please use the code below:</p>

            <!-- Verification Code Box -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; color: #0f172a; letter-spacing: 6px; display: inline-block;">${newCode}</span>
            </div>

            <p style="font-size: 14px; color: #64748b; margin-bottom: 24px;">
              ⏳ This code will expire in <strong style="color: #334155;">${ttlDisplay}</strong>. For security, please do not share this code with anyone.
            </p>
            <p style="font-size: 14px; color: #94a3b8; margin-bottom: 24px;">
              If you did not request a new verification code, please ignore this email.
            </p>

            <!-- Security & Support Notice Box -->
            <div style="background-color: #f8fafc; border-left: 4px solid #64748b; padding: 16px 20px; border-radius: 4px; margin: 28px 0 0 0; font-size: 13px; color: #475569; line-height: 1.5;">
              <p style="margin: 0 0 10px 0;">For additional help, contact <a href="mailto:${supportEmail}" style="color: #2563eb; text-decoration: underline;">${supportEmail}</a>.</p>
              <p style="margin: 0 0 10px 0;"><strong>Security Notice:</strong> Please be advised that Creatrend will never contact you via email to request or verify sensitive information, including your password, credit card details, or bank account numbers.</p>
              <p style="margin: 0;">If you receive a suspicious email containing a link to update your account information, please refrain from clicking it. Instead, report the incident immediately by forwarding the email to <a href="mailto:${supportEmail}" style="color: #2563eb; text-decoration: underline;">${supportEmail}</a>.</p>
            </div>
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
    `,
  };
};

module.exports = resendVerificationEmail;
