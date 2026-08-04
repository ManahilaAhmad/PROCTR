class StudentModel {
  constructor() {
    this.userId = null;
    this.studentId = null;
    this.name = "";
    this.registrationNo = "";
    this.labRoom = "";
    this.ipAddress = "";
  }

  setStudent(data) {
    this.userId = data.userId || null;
    this.studentId = data.studentId || null;
    this.name = data.name || "";
    this.registrationNo = data.registrationNo || "";
    this.labRoom = data.labRoom || "";
    this.ipAddress = data.ipAddress || "";
  }
}

module.exports = StudentModel;
