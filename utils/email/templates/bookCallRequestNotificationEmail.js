const bookCallRequestNotificationEmail = ({
  name,
  businessEmail,
  companyName,
  companyWebsite,
  publicId,
  createdAt,
}) => {
  const logoUrl =
    process.env.APP_LOGO_URL ||
    "https://creatrend.co.za/assets/HeaderLogo-L_gF-ssU.svg";
  const formattedDate = createdAt
    ? new Date(createdAt).toUTCString()
    : new Date().toUTCString();

  const subject = `[Creatrend Call Request] New Book a Call Request - ${publicId}`;
  const text = `New Book a Call Request Received (${publicId})\n\nName: ${name}\nBusiness Email: ${businessEmail}\nCompany Name: ${companyName}\nCompany Website: ${companyWebsite}\nSubmitted At: ${formattedDate}\n\nIMPORTANT INSTRUCTION FOR ADMIN:\nThis is a request to be contacted for a call. The actual call must be scheduled externally by Creatrend admin.\n\nYou can view and manage this request in the Creatrend Admin Dashboard.`;

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
              <span style="background-color: #fef3c7; color: #92400e; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">Discovery Call Request</span>
            </div>
            <h2 style="color: #111827; margin-top: 0; font-size: 20px; font-weight: 600;">New Book a Call Request (${publicId})</h2>
            <p style="margin-bottom: 8px;"><strong>Requester Name:</strong> ${name}</p>
            <p style="margin-bottom: 8px;"><strong>Business Email:</strong> <a href="mailto:${businessEmail}" style="color: #2563eb;">${businessEmail}</a></p>
            <p style="margin-bottom: 8px;"><strong>Company Name:</strong> ${companyName}</p>
            <p style="margin-bottom: 16px;"><strong>Company Website:</strong> <a href="${companyWebsite}" target="_blank" style="color: #2563eb;">${companyWebsite}</a></p>
            <p style="margin-bottom: 16px; font-size: 13px; color: #6b7280;">Submitted At: ${formattedDate}</p>

            <!-- Important Admin Notice Box -->
            <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 4px; color: #1e40af; font-size: 14px;">
              <strong>Admin Instruction:</strong> This is a request to be contacted for a call. The actual call must be scheduled externally by Creatrend admin.
            </div>

            <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">You can view and manage this request in the Creatrend Admin Dashboard.</p>
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

module.exports = bookCallRequestNotificationEmail;
