from python_sensors.config import VIOLATION_CODES

class HardViolationEngine:
    """
    Evaluates, classifies, and formats Hard Violations (H1 - H4b) for Person 1:
    - H1: USB Hardware Insertion
    - H2: Unauthorized Application Launch
    - H3: Extended Window Focus Loss
    - H4a: Clipboard Buffer Violation
    - H4b: Workspace & Document File Tampering
    """

    def __init__(self, logger):
        self.logger = logger

    def process_violation(self, code, detected_value=""):
        """Evaluates violation code, logs locally to SQLite, and returns payload."""
        if code not in VIOLATION_CODES:
            print(f"[Engine Warning] Unknown violation code: {code}")
            return None

        rule_info = VIOLATION_CODES[code]
        
        # Log to local SQLite database (with JSONL backup fallback)
        logged_record = self.logger.log_violation(
            code=rule_info["code"],
            title=rule_info["title"],
            severity=rule_info["severity"],
            description=rule_info["description"],
            detected_value=detected_value
        )

        return logged_record
