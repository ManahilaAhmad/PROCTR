import sys
import os
import time
import socket
import threading
import psutil
import ipaddress


class LANDetector:
    """
    Lab network validation and communication module.

    Responsibilities:
    - Validate that at least one active interface belongs to an allowed lab network.
    - Verify subnets using proper netmask/CIDR checks (supports CIDR and legacy prefix strings).
    - Detect unauthorized secondary adapters (hotspot/tether/VPN) and flag them.
    - Report violations via `violation_callback(code=..., title=..., severity=..., description=..., detected_value=...)`.

    Notes:
    - This module does NOT modify OS network state; it only detects and reports. The Electron/desktop layer
      can decide whether to actively block or disconnect interfaces based on these alerts.
    """

    def __init__(self, violation_callback=None, allowed_subnets=None, allowed_subnet_prefix="172.30.", check_interval=5):
        # Accept either a list of CIDR strings (recommended) or a legacy dotted-prefix string (e.g. "172.30.")
        self.callback = violation_callback
        self.check_interval = check_interval
        self.running = False
        self.thread = None
        self.flagged_signatures = set()

        # Normalize allowed subnets
        self._allowed_subnets_raw = allowed_subnets if allowed_subnets is not None else []
        # Backwards compatible single-prefix string
        self._legacy_prefix = allowed_subnet_prefix
        self.allowed_networks = []
        self._rebuild_allowed_networks()

    # -- Public API -------------------------------------------------
    @property
    def allowed_subnet_prefix(self):
        return self._legacy_prefix

    @allowed_subnet_prefix.setter
    def allowed_subnet_prefix(self, value):
        self._legacy_prefix = value
        self._rebuild_allowed_networks()

    def update_allowed_subnets(self, cidr_list):
        """Replace allowed subnets (list of CIDR strings, or dotted-prefix strings).

        Examples: ['172.30.0.0/16', '10.10.0.0/16'] or ['172.30.'] (legacy)
        """
        self._allowed_subnets_raw = cidr_list or []
        self._rebuild_allowed_networks()

    # -- Helpers ----------------------------------------------------
    def _prefix_to_network(self, prefix_str):
        """Convert legacy prefix like '172.30.' -> IPv4Network('172.30.0.0/16') by counting octets."""
        try:
            p = prefix_str.strip()
            if p.endswith('.'):
                parts = p.split('.')
                # remove last empty due to trailing dot
                parts = [part for part in parts if part != '']
                octets = len(parts)
                if octets == 1:
                    network = f"{parts[0]}.0.0.0/8"
                elif octets == 2:
                    network = f"{parts[0]}.{parts[1]}.0.0/16"
                elif octets == 3:
                    network = f"{parts[0]}.{parts[1]}.{parts[2]}.0/24"
                else:
                    # fallback: treat as /24
                    network = f"{parts[0]}.0.0.0/8"
                return ipaddress.IPv4Network(network)
            else:
                # if it's already CIDR or IP, attempt IPv4Network
                return ipaddress.IPv4Network(p, strict=False)
        except Exception:
            return None

    def _rebuild_allowed_networks(self):
        self.allowed_networks = []
        # 1) add explicit CIDR entries
        for raw in (self._allowed_subnets_raw or []):
            try:
                # allow both CIDR and dotted-prefix here
                if raw.endswith('.'):
                    net = self._prefix_to_network(raw)
                else:
                    net = ipaddress.IPv4Network(raw, strict=False)
                if net:
                    self.allowed_networks.append(net)
            except Exception:
                continue

        # 2) Add legacy single prefix mapping
        if self._legacy_prefix:
            net = self._prefix_to_network(self._legacy_prefix)
            if net:
                # do not duplicate
                if all(net != existing for existing in self.allowed_networks):
                    self.allowed_networks.append(net)

    def _ip_and_netmask_from_addr(self, addr):
        # addr is a psutil snicaddr - has .address and .netmask
        ip = addr.address
        netmask = getattr(addr, 'netmask', None)
        return ip, netmask

    def get_active_ipv4_interfaces(self):
        """Return dict iface -> dict(ip=..., netmask=...) for active non-loopback IPv4 interfaces."""
        active = {}
        try:
            stats = psutil.net_if_stats()
            addrs = psutil.net_if_addrs()
            for iface, addrs_list in addrs.items():
                # Skip down interfaces
                if iface in stats and not stats[iface].isup:
                    continue
                for a in addrs_list:
                    if a.family == socket.AF_INET:
                        ip, netmask = self._ip_and_netmask_from_addr(a)
                        if not ip or ip.startswith('127.') or ip == '0.0.0.0':
                            continue
                        active[iface] = { 'ip': ip, 'netmask': netmask }
        except Exception:
            pass
        return active

    def _ip_in_allowed_networks(self, ip_str, netmask=None):
        try:
            ip_obj = ipaddress.IPv4Address(ip_str)
            # First quick check: if any allowed network contains the IP
            for net in self.allowed_networks:
                if ip_obj in net:
                    return True

            # If netmask is provided, check the interface network against allowed networks
            if netmask:
                try:
                    # Convert netmask to prefix length if necessary
                    if '/' not in netmask and netmask.count('.') == 3:
                        # netmask like '255.255.0.0' -> determine prefix
                        prefixlen = ipaddress.IPv4Network(f'0.0.0.0/{netmask}').prefixlen
                        iface_net = ipaddress.IPv4Network(f"{ip_str}/{prefixlen}", strict=False)
                    elif '/' in netmask:
                        iface_net = ipaddress.IPv4Network(f"{ip_str}{netmask}", strict=False)
                    else:
                        # fallback assume /32
                        iface_net = ipaddress.IPv4Network(f"{ip_str}/32", strict=False)

                    for net in self.allowed_networks:
                        # allow if interface network is wholly within allowed net or overlaps
                        if iface_net.subnet_of(net) or iface_net.overlaps(net):
                            return True
                except Exception:
                    pass

            return False
        except Exception:
            return False

    # -- Lifecycle --------------------------------------------------
    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.thread.start()
        print(f"[LANDetector] Lab Subnet Engine Active — Allowed Networks: {self.allowed_networks}")

    def stop(self):
        self.running = False

    def _monitor_loop(self):
        while self.running:
            try:
                active_ifaces = self.get_active_ipv4_interfaces()

                # Determine if any active iface is allowed
                has_allowed = any(self._ip_in_allowed_networks(info['ip'], info.get('netmask')) for info in active_ifaces.values())

                # Detect suspicious adapters
                suspicious = []
                for iface, info in active_ifaces.items():
                    name = iface.lower()
                    ip = info['ip']
                    netmask = info.get('netmask')
                    allowed = self._ip_in_allowed_networks(ip, netmask)

                    # Heuristics for mobile tether / hotspot / vpn interface names
                    if (not allowed) and any(k in name for k in ['wi-fi', 'wifi', 'wireless', 'tether', 'hotspot', 'vpn', 'bluetooth', 'mobile', 'wwan', 'rndis']):
                        suspicious.append(f"{iface} ({ip})")

                # Compose violation events
                if not has_allowed and active_ifaces:
                    signature = tuple(sorted(f"{k}:{v['ip']}" for k, v in active_ifaces.items()))
                    if signature not in self.flagged_signatures:
                        self.flagged_signatures.add(signature)
                        current_ips = ", ".join(f"{k}: {v['ip']}" for k, v in active_ifaces.items())
                        msg = f"Active interfaces present but none within allowed lab networks. Interfaces: {current_ips}"
                        print(f"\n🚨 [LAN SUBNET BREACH — N1] {msg}")
                        if self.callback:
                            try:
                                self.callback(
                                    code='N1',
                                    title='Unauthorized Lab Subnet Connection',
                                    severity='CRITICAL',
                                    description='No active network interface belongs to an allowed lab subnet.',
                                    detected_value=msg
                                )
                            except Exception:
                                pass

                if suspicious:
                    sig = tuple(sorted(suspicious))
                    if sig not in self.flagged_signatures:
                        self.flagged_signatures.add(sig)
                        bad = ", ".join(suspicious)
                        msg = f"Unauthorized secondary network adapter detected: {bad}"
                        print(f"\n🚨 [MOBILE HOTSPOT BREACH — N1] {msg}")
                        if self.callback:
                            try:
                                self.callback(
                                    code='N1',
                                    title='Mobile Hotspot / Secondary Adapter Detected',
                                    severity='CRITICAL',
                                    description='A likely mobile hotspot/tether or VPN adapter was detected alongside or instead of lab network.',
                                    detected_value=msg
                                )
                            except Exception:
                                pass

            except Exception:
                pass

            time.sleep(self.check_interval)
