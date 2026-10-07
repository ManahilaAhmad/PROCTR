module.exports = {
  APP_NAME: "PROCTR Desktop",
  VERSION: "1.0.0",
  DEFAULT_API_URL: process.env.PROCTR_API_BASE || "http://localhost:5000/api",
  DEFAULT_WS_URL: (process.env.PROCTR_API_BASE || "http://localhost:5000/api").replace(/^http/, "ws").replace(/\/api\/?$/, ""),
  EXAM_BASE_DIR: "C:\\PROCTR_Exams",
  IPC_EVENTS: {
    SENSOR_EVENT: "sensor-event",
    CLOSE_WARNING: "app-close-warning",
    START_EXAM: "start-exam",
    STOP_SENSORS: "stop-sensors"
  }
};
