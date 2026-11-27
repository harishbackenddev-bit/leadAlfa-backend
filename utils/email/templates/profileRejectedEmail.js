const profileRejectedEmail = (name, reason, profileType = "Creator") => {
  const typeName = profileType === "Brand" ? "Brand Profile" : "Creator Profile";
  const subject = `Update on your ${typeName}`;
  const logoUrl = process.env.APP_LOGO_URL || "https://creatrend.co.za/assets/HeaderLogo-L_gF-ssU.svg";
  const text = `Hi ${name},\n\nUnfortunately, your ${typeName.toLowerCase()} request could not be approved at this time.\n\nReason: ${reason}\n\nYou can update your profile and try again.`;

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
              <span style="background-color: #fee2e2; color: #991b1b; font-size: 13px; font-weight: 700; padding: 6px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">Application Declined</span>
            </div>
            <h2 style="color: #111827; margin-top: 0; font-size: 20px; font-weight: 600;">Hi ${name},</h2>
            <p style="margin-bottom: 16px;">Unfortunately, your <strong>${typeName.toLowerCase()}</strong> request could not be approved at this time.</p>
            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 4px; margin: 20px 0; color: #7f1d1d;">
              <strong style="color: #991b1b;">Reason:</strong> ${reason}
            </div>
            <p style="margin-bottom: 0;">You can update your profile details and submit again for review.</p>
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

module.exports = profileRejectedEmail;
