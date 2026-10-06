class AuthController {
  constructor(studentModel) {
    this.student = studentModel;
  }

  login(credentials) {
    // Session login controller logic
    return { status: "success", student: this.student };
  }

  logout() {
    return { status: "logged_out" };
  }
}

module.exports = AuthController;
