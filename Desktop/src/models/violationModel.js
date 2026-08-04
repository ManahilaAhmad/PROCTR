class ViolationModel {
  constructor() {
    this.violations = [];
  }

  addViolation(violation) {
    const record = {
      id: Date.now(),
      code: violation.code || "UNKNOWN",
      title: violation.title || "Violation Alert",
      severity: violation.severity || "HIGH",
      description: violation.description || "",
      detectedValue: violation.detected_value || "",
      timestamp: violation.timestamp || new Date().toISOString()
    };
    this.violations.unshift(record);
    return record;
  }

  getViolations() {
    return this.violations;
  }

  clear() {
    this.violations = [];
  }
}

module.exports = ViolationModel;
