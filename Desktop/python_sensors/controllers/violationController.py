import os
import sys

# Add parent directory to python path if needed
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from python_sensors.config import VIOLATION_CODES

class ViolationController:
    """
    Controller responsible for evaluating, recording, and routing Hard Violations (H1 - H4b).
    """

    def __init__(self, violation_model):
        self.model = violation_model

    def handle_violation(self, code, detected_value=""):
        if code not in VIOLATION_CODES:
            print(f"[ViolationController] Unknown violation code: {code}")
            return None

        rule_info = VIOLATION_CODES[code]
        record = self.model.create_violation(
            code=rule_info["code"],
            title=rule_info["title"],
            severity=rule_info["severity"],
            description=rule_info["description"],
            detected_value=detected_value
        )
        return record
