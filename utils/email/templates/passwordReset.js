const passwordReset = (resetLink, ttlMinutes = 15) => {
  const ttlDisplay = `${ttlMinutes} minute${ttlMinutes === 1 ? "" : "s"}`;
  const logoUrl = process.env.APP_LOGO_URL || "https://creatrend.co.za/assets/HeaderLogo-L_gF-ssU.svg";

  return {
    subject: "Creatrend - Password Reset Request",
    text: `Hello,\n\nWe received a request to reset your password for your Creatrend account.\n\nTo reset your password, click the link below or paste it into your browser:\n${resetLink}\n\nThis link will expire in ${ttlDisplay} for security reasons.\n\nIf you did not request a password reset, you can safely ignore this email.\n\nBest regards,\nCreatrend Team`,
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
              <span style="background-color: #fee2e2; color: #991b1b; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">Password Reset</span>
            </div>
            <h2 style="color: #111827; margin-top: 0; font-size: 20px; font-weight: 600;">Reset Your Password</h2>
            <p style="margin-bottom: 20px; color: #4b5563;">We received a request to reset your password for your <strong>Creatrend</strong> account. Click the button below to set up a new password:</p>

            <!-- Reset Button -->
            <div style="text-align: center; margin: 28px 0;">
              <a href="${resetLink}" target="_blank" style="background-color: #111827; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 6px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">Reset Password</a>
            </div>

            <p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">Or copy and paste this link into your browser:</p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; word-break: break-all; font-size: 13px; color: #2563eb; margin-bottom: 24px;">
              <a href="${resetLink}" style="color: #2563eb; text-decoration: underline;">${resetLink}</a>
            </div>

            <p style="font-size: 14px; color: #64748b; margin-bottom: 24px;">
              ⏳ For security reasons, this link will expire in <strong style="color: #334155;">${ttlDisplay}</strong>.
            </p>
            <p style="font-size: 14px; color: #94a3b8; margin-bottom: 0;">
              If you did not request a password reset, please ignore this email. Your password will remain unchanged.
            </p>
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
    `,
  };
};

module.exports = passwordReset;
