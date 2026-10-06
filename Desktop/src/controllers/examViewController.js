class ExamViewController {
  constructor(examSessionModel) {
    this.session = examSessionModel;
  }

  startExam(data) {
    this.session.setSession(data);
    return this.session;
  }

  endExam() {
    this.session.reset();
    return { status: "ended" };
  }
}

module.exports = ExamViewController;
