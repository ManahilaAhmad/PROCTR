class ResultsController {
  constructor() {
    this.results = [];
  }

  fetchResults(examId, studentId) {
    return { status: "success", results: this.results };
  }
}

module.exports = ResultsController;
