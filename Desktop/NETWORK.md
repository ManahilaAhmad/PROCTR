# Run PROCTR Desktop on a LAN

The backend listens on all network interfaces (`0.0.0.0`) on port `5000`. To connect a desktop client on another computer:

1. Start the backend on the host computer with `npm start` from `PROCTR/backend`.
2. Find that computer's LAN IPv4 address with `ipconfig` (for example, `192.168.1.20`).
3. Allow inbound TCP port `5000` through the host computer's firewall for the private network.
4. On each client computer, run `PROCTR/Desktop/start-network.ps1 -BackendHost 192.168.1.20` from PowerShell, replacing the example address with the backend host's address.

The launcher sets `PROCTR_API_BASE` for the Electron process, and the desktop app uses that host for API requests and Socket.IO. The regular `npm start` command continues to use `localhost` for development on one computer. Keep the backend host on the same trusted private network as the exam clients.
