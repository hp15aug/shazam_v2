import EventEmitter from "events";
import util from "util";

class LogStream extends EventEmitter {
  constructor() {
    super();
    this.buffer = [];
    this.maxBufferSize = 200;
  }

  push(entry) {
    this.buffer.push(entry);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
    this.emit("log", entry);
  }

  history() {
    return [...this.buffer];
  }
}

const formatArgs = (args) => util.format(...args);

const buildEntry = (type, args) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  message: formatArgs(args),
  timestamp: new Date().toISOString(),
});

const logStream = new LogStream();

const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

const wrapConsoleMethod = (methodName, type) => {
  console[methodName] = (...args) => {
    const entry = buildEntry(type, args);
    logStream.push(entry);
    originalConsole[methodName](...args);
  };
};

wrapConsoleMethod("log", "log");
wrapConsoleMethod("info", "info");
wrapConsoleMethod("warn", "warn");
wrapConsoleMethod("error", "error");

export { logStream };
