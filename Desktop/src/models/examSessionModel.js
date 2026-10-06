class ExamSessionModel {
  constructor() {
    self.examId = null;
    self.courseCode = "";
    self.examType = "";
    self.durationMins = 0;
    self.workspacePath = "";
    self.status = "IDLE"; // IDLE, ACTIVE, COMPLETED, PAUSED
  }

  setSession(data) {
    this.examId = data.examId || null;
    this.courseCode = data.courseCode || "";
    this.examType = data.examType || "";
    this.durationMins = data.durationMins || 0;
    this.workspacePath = data.workspacePath || "";
    this.status = data.status || "ACTIVE";
  }

  reset() {
    this.examId = null;
    this.status = "IDLE";
  }
}

module.exports = ExamSessionModel;
