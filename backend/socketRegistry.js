/**
 * socketRegistry.js — Single shared Socket.IO server instance.
 *
 * server.js creates the actual `io` instance once at startup and registers
 * it here via setIO(). Any controller that needs to push a live event to
 * connected clients (teacher live-monitoring dashboards) imports getIO()
 * from this module instead of holding its own separate reference.
 *
 * Room convention: every live exam session broadcasts to a room named
 * `session:<SESSION_CODE>` (session_code is always upper-cased). Teacher
 * clients join this room after creating/opening the Live Control Room.
 */

let ioInstance = null;

export const setIO = (io) => {
  ioInstance = io;
};

export const getIO = () => ioInstance;

/**
 * Convenience helper — safely emit to a session room.
 * No-ops (and warns once) if Socket.IO hasn't been initialized yet,
 * so controllers never need to null-check getIO() themselves.
 */
export const emitToSession = (sessionCode, eventName, payload) => {
  if (!ioInstance) {
    console.warn(`[Socket] Tried to emit "${eventName}" but Socket.IO is not initialized.`);
    return;
  }
  if (!sessionCode) {
    console.warn(`[Socket] Tried to emit "${eventName}" without a session code — skipped.`);
    return;
  }
  const room = `session:${String(sessionCode).trim().toUpperCase()}`;
  ioInstance.to(room).emit(eventName, payload);
};
