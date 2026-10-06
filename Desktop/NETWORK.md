# Run PROCTR Desktop locally or on a lab LAN

## Single laptop / presentation mode

Start the backend and Desktop normally. No network configuration is needed:

```powershell
# backend
npm start

# Desktop
npm start
```

Desktop defaults to `http://localhost:5000/api`, so this remains the quickest
way to present or test the project on one laptop.

## Lab LAN mode

1. On the dedicated backend PC, start `PROCTR/backend` with `npm start`.
2. Find its private LAN IPv4 address using `ipconfig`, for example
   `192.168.1.20`.
3. Allow inbound TCP port `5000` in Windows Firewall on that backend PC for
   the private network profile.
4. On every student/teacher Desktop client PC, open PowerShell in
   `PROCTR/Desktop` and run:

```powershell
.\start-network.ps1 -BackendHost 192.168.1.20
```

The launcher gives the Electron main process, renderer, Socket.IO connection,
question-paper fetches, and submission queue the same backend address. Do not
use `localhost` on client PCs because it would point to that individual client
machine rather than the backend PC.

Keep all devices on the same trusted lab network and configure the lab's CIDR
range in the Admin module before conducting an exam.
