const profileClarificationEmail = (name, message, profileType = "Creator", actionUrl = null) => {
  const replyTo = process.env.ADMIN_EMAIL || "admin@creatrend.com";
  const typeName = profileType === "Brand" ? "Brand Profile" : "Creator Profile";
  const subject = `Clarification required for your ${typeName}`;
  const logoUrl = process.env.APP_LOGO_URL || "https://creatrend.co.za/assets/HeaderLogo-L_gF-ssU.svg";
  
  const frontendBase = String(process.env.FRONTEND_URL || "https://creatrend.co.za").replace(/\/$/, "");
  const defaultActionUrl = profileType === "Brand"
    ? `${frontendBase}/brand/campaigns`
    : `${frontendBase}/creator/campaigns`;
  const targetUrl = actionUrl || defaultActionUrl;

  const actionInstruction = profileType === "Brand"
    ? "Please visit your profile page to review the admin's notes and update your profile information:"
    : "Please visit your profile status page to review the admin's notes and re-upload any required verification documents (such as your residence permit or introduction video):";

  const text = `Hi ${name},\n\nWe need a bit more information to process your ${typeName.toLowerCase()}.\n\nDetails needed:\n${message}\n\n${actionInstruction}\n${targetUrl}\n\nIf you have any questions, you can also reply directly to this email at ${replyTo}.\n\nBest regards,\nCreatrend Team`;

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
              <span style="background-color: #fef3c7; color: #92400e; font-size: 13px; font-weight: 700; padding: 6px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">Action Required</span>
            </div>
            <h2 style="color: #111827; margin-top: 0; font-size: 20px; font-weight: 600;">Hi ${name},</h2>
            <p style="margin-bottom: 16px;">We need a bit more information to process your <strong>${typeName.toLowerCase()}</strong>.</p>
            <div style="background-color: #fffbe6; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin: 20px 0; color: #78350f;">
              <strong style="color: #92400e;">Details needed:</strong>
              <p style="margin: 8px 0 0 0; white-space: pre-wrap; color: #78350f;">${message}</p>
            </div>
            <p style="margin-bottom: 20px; color: #374151;">${actionInstruction}</p>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 28px 0;">
              <a href="${targetUrl}" target="_blank" style="background-color: #111827; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 6px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">Review &amp; Update Profile</a>
            </div>

            <p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">Or copy and paste this link into your browser:</p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; word-break: break-all; font-size: 13px; color: #2563eb; margin-bottom: 24px;">
              <a href="${targetUrl}" style="color: #2563eb; text-decoration: underline;">${targetUrl}</a>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-bottom: 0;">
              If you have any questions, you can also reply directly to this email at <a href="mailto:${replyTo}" style="color: #2563eb; text-decoration: underline;">${replyTo}</a>.
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
  `;
  return { subject, text, html, replyTo, targetUrl };
};

module.exports = profileClarificationEmail;
