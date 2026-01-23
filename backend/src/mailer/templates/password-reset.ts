export interface PasswordResetEmailOptions {
  userName: string;
  resetUrl: string;
  expiresInHours: number;
}

export function generatePasswordResetEmail(options: PasswordResetEmailOptions): string {
  const { userName, resetUrl, expiresInHours } = options;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset - MOBIUS Wiki</title>
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
              <h2 style="margin: 0 0 16px 0; color: #003057; font-size: 20px; font-weight: 600;">Password Reset Request</h2>

              <p style="margin: 0 0 16px 0; color: #333333; font-size: 16px; line-height: 1.5;">
                Hello ${userName},
              </p>

              <p style="margin: 0 0 24px 0; color: #333333; font-size: 16px; line-height: 1.5;">
                We received a request to reset your password for your MOBIUS Wiki account. Click the button below to create a new password:
              </p>

              <!-- Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding: 0 0 24px 0;">
                    <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #0097A7; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 500; border-radius: 6px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px 0; color: #666666; font-size: 14px; line-height: 1.5;">
                This link will expire in <strong>${expiresInHours} hour${expiresInHours > 1 ? 's' : ''}</strong>.
              </p>

              <p style="margin: 0 0 24px 0; color: #666666; font-size: 14px; line-height: 1.5;">
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>

              <!-- Fallback Link -->
              <div style="padding: 16px; background-color: #f5f7fa; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; color: #666666; font-size: 12px;">
                  If the button doesn't work, copy and paste this link into your browser:
                </p>
                <p style="margin: 0; word-break: break-all;">
                  <a href="${resetUrl}" style="color: #0097A7; font-size: 12px; text-decoration: none;">${resetUrl}</a>
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

export function generatePasswordResetText(options: PasswordResetEmailOptions): string {
  const { userName, resetUrl, expiresInHours } = options;

  return `
Password Reset Request - MOBIUS Wiki

Hello ${userName},

We received a request to reset your password for your MOBIUS Wiki account.

To reset your password, visit the following link:
${resetUrl}

This link will expire in ${expiresInHours} hour${expiresInHours > 1 ? 's' : ''}.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

---
This is an automated message from MOBIUS Wiki. Please do not reply to this email.
`.trim();
}
