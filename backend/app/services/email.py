import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings
import asyncio


async def send_password_reset_email(to_email: str, reset_url: str) -> None:
    if not settings.SMTP_USER:
        # Dev mode: just print
        print(f"[DEV] Password reset link for {to_email}: {reset_url}")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your Jotter password"
    msg["From"] = settings.FROM_EMAIL
    msg["To"] = to_email

    html = f"""
    <html><body style="font-family:sans-serif;background:#0c0c10;color:#f0f0f4;padding:40px">
      <div style="max-width:480px;margin:0 auto;background:#141418;border:1px solid #27272a;border-radius:16px;padding:32px">
        <h2 style="color:#6366f1;margin-top:0">Reset your password</h2>
        <p>Click the button below to set a new password. This link expires in 1 hour.</p>
        <a href="{reset_url}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;margin:16px 0">
          Reset Password
        </a>
        <p style="color:#71717a;font-size:13px;margin-top:24px">
          If you didn't request this, you can safely ignore this email.
          <br><br>
          <strong>Important:</strong> After resetting, you'll need your recovery key to access your encrypted notes.
        </p>
      </div>
    </body></html>
    """
    msg.attach(MIMEText(html, "html"))

    def _send():
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
            smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASS)
            smtp.sendmail(settings.FROM_EMAIL, to_email, msg.as_string())

    await asyncio.to_thread(_send)
