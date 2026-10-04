# Password recovery test setup

The recovery feature uses Gmail SMTP to send one-time reset links. Never put a normal Gmail password in the project and never commit the backend `.env` file.

## 1. Create a Gmail App Password

1. Sign in to the Google account that will send the emails.
2. Enable 2-Step Verification on that Google account.
3. Open Google Account > Security > App passwords.
4. Create an App Password named `PROCTR` and copy the generated 16-character value.

## 2. Configure the backend

Add these values to `backend/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=razashanawar42@gmail.com
SMTP_APP_PASSWORD=PASTE_THE_APP_PASSWORD_HERE
MAIL_FROM=PROCTR <razashanawar42@gmail.com>
FRONTEND_URL=http://localhost:5173
PASSWORD_RESET_MINUTES=20
```

Do not add spaces to the App Password value. If Vite runs on a different address, set `FRONTEND_URL` to that exact origin so the email link opens the correct website.

## 3. Verify Gmail authentication

From the backend directory, run:

```powershell
npm run verify-email
```

This verifies the SMTP login without sending an email.

## 4. Test the complete flow

1. Start the backend and website.
2. On the login page, select **Forgot password?**.
3. Enter `razashanawar42@gmail.com`.
4. Open the received Gmail message and follow its reset link.
5. Choose a password containing at least 8 characters.
6. Sign in as **Teacher** with the Gmail address and the new password.
7. Confirm that opening the same reset link again shows that it is invalid or expired.

The initial testing password created for this account is `password123`. Resetting it invalidates existing login tokens for the account.
