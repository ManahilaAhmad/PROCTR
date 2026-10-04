import sys
import os
import unittest

# Add project root (parent of python_sensors) so `import python_sensors` works
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from python_sensors.sensors.lan_detector import LANDetector


class TestLANDetector(unittest.TestCase):

    def test_prefix_legacy_and_cidr(self):
        d = LANDetector(violation_callback=None, allowed_subnets=None, allowed_subnet_prefix="172.30.")
        # legacy prefix should allow 172.30.x.x
        self.assertTrue(d._ip_in_allowed_networks("172.30.5.10"))
        self.assertFalse(d._ip_in_allowed_networks("10.0.0.5"))

        # add explicit CIDR and test
        d.update_allowed_subnets(["10.10.0.0/16"])
        self.assertTrue(d._ip_in_allowed_networks("10.10.5.1"))
        self.assertFalse(d._ip_in_allowed_networks("10.11.1.1"))

    def test_netmask_check(self):
        d = LANDetector(violation_callback=None, allowed_subnets=["192.168.1.0/24"], allowed_subnet_prefix=None)
        # IP inside the /24
        self.assertTrue(d._ip_in_allowed_networks("192.168.1.50", "255.255.255.0"))
        # IP outside
        self.assertFalse(d._ip_in_allowed_networks("192.168.2.50", "255.255.255.0"))

    def test_update_allowed_subnets_with_mixed(self):
        d = LANDetector(violation_callback=None, allowed_subnets=["172.20.0.0/16"], allowed_subnet_prefix="172.30.")
        # should contain both networks initially
        nets = [str(n) for n in d.allowed_networks]
        self.assertTrue(any(n.startswith("172.20.") or n.startswith("172.30.") for n in nets))

        d.update_allowed_subnets(["10.0.0.0/8"])
        self.assertTrue(d._ip_in_allowed_networks("10.1.2.3"))
        self.assertFalse(d._ip_in_allowed_networks("172.20.1.1"))


if __name__ == '__main__':
    unittest.main()
