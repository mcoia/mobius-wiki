export interface AccountInvitationEmailOptions {
  userName: string;
  invitationUrl: string;
  expiresInDays: number;
}

export function generateAccountInvitationEmail(options: AccountInvitationEmailOptions): string {
  const { userName, invitationUrl, expiresInDays } = options;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to MOBIUS Wiki</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f7fa;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px; text-align: center; background-color: #003057; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">MOBIUS Wiki</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px 0; color: #003057; font-size: 20px; font-weight: 600;">You're Invited!</h2>

              <p style="margin: 0 0 16px 0; color: #333333; font-size: 16px; line-height: 1.5;">
                Hello ${userName},
              </p>

              <p style="margin: 0 0 24px 0; color: #333333; font-size: 16px; line-height: 1.5;">
                You've been invited to join MOBIUS Wiki. Click the button below to set up your password and activate your account:
              </p>

              <!-- Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding: 0 0 24px 0;">
                    <a href="${invitationUrl}" style="display: inline-block; padding: 14px 32px; background-color: #0097A7; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 500; border-radius: 6px;">
                      Set Your Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px 0; color: #666666; font-size: 14px; line-height: 1.5;">
                This invitation will expire in <strong>${expiresInDays} day${expiresInDays > 1 ? 's' : ''}</strong>.
              </p>

              <p style="margin: 0 0 24px 0; color: #666666; font-size: 14px; line-height: 1.5;">
                If you didn't expect this invitation or believe it was sent in error, you can safely ignore this email.
              </p>

              <!-- Fallback Link -->
              <div style="padding: 16px; background-color: #f5f7fa; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; color: #666666; font-size: 12px;">
                  If the button doesn't work, copy and paste this link into your browser:
                </p>
                <p style="margin: 0; word-break: break-all;">
                  <a href="${invitationUrl}" style="color: #0097A7; font-size: 12px; text-decoration: none;">${invitationUrl}</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f5f7fa; border-radius: 0 0 8px 8px; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; color: #666666; font-size: 12px; line-height: 1.5; text-align: center;">
                This is an automated message from MOBIUS Wiki.<br>
                Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

export function generateAccountInvitationText(options: AccountInvitationEmailOptions): string {
  const { userName, invitationUrl, expiresInDays } = options;

  return `
You're Invited to MOBIUS Wiki

Hello ${userName},

You've been invited to join MOBIUS Wiki. Visit the link below to set up your password and activate your account:

${invitationUrl}

This invitation will expire in ${expiresInDays} day${expiresInDays > 1 ? 's' : ''}.

If you didn't expect this invitation or believe it was sent in error, you can safely ignore this email.

---
This is an automated message from MOBIUS Wiki. Please do not reply to this email.
`.trim();
}
