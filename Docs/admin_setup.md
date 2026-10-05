# Admin Foundation Setup

The Admin foundation adds a protected `admin` user role, lab/network management,
system security settings, user activation controls, and overview statistics.

## 1. Apply the Neon migration

From `backend/`, run `npm run migrate-admin`. This applies
`Database/migrations/001_admin_foundation.sql` to the database configured by
`DATABASE_URL`. Alternatively, run that SQL file in the Neon SQL editor. The
migration is transactional and safe to run once on an existing PROCTR database.

## 2. Configure the backend

Copy the relevant values from `backend/.env.example` into `backend/.env`. Add a
random `SESSION_SECRET` containing at least 32 characters. Do not commit the real
secret or Admin password.

When the backend is deployed behind a trusted reverse proxy, set `TRUST_PROXY=true`.
Keep it `false` when Express is directly exposed so clients cannot spoof their IP.

## 3. Create the first Admin account

Set these temporary environment variables in the terminal:

```powershell
$env:ADMIN_EMAIL='admin@your-university.edu'
$env:ADMIN_PASSWORD='use-a-unique-strong-password'
$env:ADMIN_FIRST_NAME='System'
$env:ADMIN_LAST_NAME='Admin'
npm run create-admin
```

Run the command from `backend/`. The password must contain at least 12 characters
and is stored only as a bcrypt hash. Remove the temporary variables from the shell
after creating the account.

## 4. Sign in

Open the web portal, select **System Administrator**, and use the account created
above. The Admin sidebar provides:

- Control Center
- Labs & Networks
- System Settings
- User Management

Lab network ranges use IPv4 CIDR notation, such as `192.168.18.0/24`. The network
range assigned to the scheduled lab is sent to the desktop security sensor when a
student joins an active session.
