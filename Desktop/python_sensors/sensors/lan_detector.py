import sys
import os
import time
import socket
import threading
import psutil

class LANDetector:
    """
    Sensor 6: Lab LAN Subnet Integrity & Anti-Tethering Detector (N1 Violation)

    Features:
    - Verifies that student PC is connected to the official University Lab LAN Subnet (e.g. 172.30.x.x).
    - Detects unauthorized secondary network interfaces (e.g. Mobile Wi-Fi Hotspot, USB Phone Tethering, VPN Tunnels).
    - Triggers N1 Violation alert if non-lab network or secondary hotspot interface is activated during exam.
    """

    def __init__(self, violation_callback=None, allowed_subnet_prefix="172.30.", check_interval=5):
        self.callback = violation_callback
        self.allowed_subnet_prefix = allowed_subnet_prefix
        self.check_interval = check_interval
        self.running = False
        self.thread = None
        self.flagged_interfaces = set()

    def get_active_ipv4_addresses(self):
        """Returns a dict of interface_name -> ip_address for all active non-loopback IPv4 interfaces."""
        active_addrs = {}
        try:
            stats = psutil.net_if_stats()
            addrs = psutil.net_if_addrs()

            for iface_name, iface_addrs in addrs.items():
                # Check if interface is UP
                if iface_name in stats and not stats[iface_name].isup:
                    continue

                for addr in iface_addrs:
                    if addr.family == socket.AF_INET:
                        ip = addr.address
                        if ip and not ip.startswith("127.") and ip != "0.0.0.0":
                            active_addrs[iface_name] = ip
        except Exception:
            pass
        return active_addrs

    def start(self):
        """Starts LAN subnet monitoring loop in a background thread."""
        self.running = True
        self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.thread.start()
        print(f"[LANDetector] Lab Subnet Engine Active — Monitoring Subnet Prefix '{self.allowed_subnet_prefix}'.")

    def stop(self):
        """Stops LAN subnet monitoring loop."""
        self.running = False

    def _monitor_loop(self):
        while self.running:
            try:
                active_interfaces = self.get_active_ipv4_addresses()
                
                # Check 1: Verify at least one active interface is on University Lab Subnet
                has_lab_connection = any(ip.startswith(self.allowed_subnet_prefix) for ip in active_interfaces.values())

                # Check 2: Check for unauthorized secondary network adapters (e.g. Wi-Fi Hotspot / USB Tethering)
                unauthorized_adapters = []
                for iface_name, ip in active_interfaces.items():
                    iface_lower = iface_name.lower()
                    # Flag if IP is outside lab subnet and not standard local docker/vbox
                    is_lab_ip = ip.startswith(self.allowed_subnet_prefix)
                    is_suspicious_iface = any(kw in iface_lower for kw in ["wi-fi", "wifi", "wireless", "tether", "vpn", "hotspot", "bluetooth"])

                    if not is_lab_ip and is_suspicious_iface:
                        unauthorized_adapters.append(f"{iface_name} ({ip})")

                # Trigger Violation if no lab connection OR unauthorized hotspot/adapter active
                if not has_lab_connection and active_interfaces:
                    current_ips = ", ".join(f"{k}: {v}" for k, v in active_interfaces.items())
                    key = f"NO_LAB_SUBNET_{current_ips}"
                    if key not in self.flagged_interfaces:
                        self.flagged_interfaces.add(key)
                        log_msg = f"Student PC IP ({current_ips}) is outside official Lab Subnet '{self.allowed_subnet_prefix}'"
                        print(f"\n🚨 [LAN SUBNET BREACH — N1] {log_msg}")
                        if self.callback:
                            try:
                                self.callback(
                                    code="N1",
                                    title="Unauthorized Lab Subnet Connection",
                                    severity="CRITICAL",
                                    description="Student device connected outside official University Lab network subnet.",
                                    detected_value=log_msg
                                )
                            except Exception:
                                pass

                elif unauthorized_adapters:
                    bad_adapters_str = ", ".join(unauthorized_adapters)
                    key = f"HOTSPOT_{bad_adapters_str}"
                    if key not in self.flagged_interfaces:
                        self.flagged_interfaces.add(key)
                        log_msg = f"Unauthorized secondary network adapter / mobile hotspot detected: {bad_adapters_str}"
                        print(f"\n🚨 [MOBILE HOTSPOT BREACH — N1] {log_msg}")
                        if self.callback:
                            try:
                                self.callback(
                                    code="N1",
                                    title="Mobile Hotspot / Secondary Adapter Detected",
                                    severity="CRITICAL",
                                    description="Student activated secondary network interface or mobile tethering during exam.",
                                    detected_value=log_msg
                                )
                            except Exception:
                                pass

            except Exception:
                pass

            time.sleep(self.check_interval)
