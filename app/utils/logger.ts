import fs from "fs";
import path from "path";
import { format } from "date-fns";

// Log levels
enum LogLevel {
  INFO = "INFO",
  DEBUG = "DEBUG",
  WARN = "WARN",
  ERROR = "ERROR",
}

// Logger utility
class Logger {
  private logFilePath: string;

  constructor() {
    const logDir = path.resolve(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true }); // Ensure the logs directory exists
    }

    const timestamp = format(new Date(), "yyyy-MM-dd");
    this.logFilePath = path.join(logDir, `dropx-${timestamp}.log`);
  }

  private writeLog(level: LogLevel, message: string, meta?: Record<string, any>) {
    const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");
    const logEntry = `[${timestamp}] [${level}] ${message}${
      meta ? ` | Meta: ${JSON.stringify(meta, null, 2)}` : ""
    }\n`;

    // Write log to file
    fs.appendFileSync(this.logFilePath, logEntry);

    // Output to console for immediate feedback
    if (level === LogLevel.ERROR) {
      console.error(logEntry);
    } else if (level === LogLevel.WARN) {
      console.warn(logEntry);
    } else {
      console.log(logEntry);
    }
  }

  info(message: string, meta?: Record<string, any>) {
    this.writeLog(LogLevel.INFO, message, meta);
  }

  debug(message: string, meta?: Record<string, any>) {
    this.writeLog(LogLevel.DEBUG, message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.writeLog(LogLevel.WARN, message, meta);
  }

  error(message: string, meta?: Record<string, any>) {
    this.writeLog(LogLevel.ERROR, message, meta);
  }

  /**
   * ✅ Track API requests for debugging
   */
  logApiRequest(endpoint: string, method: string, statusCode: number, payload?: any) {
    this.writeLog(LogLevel.INFO, `API Request: ${method} ${endpoint} - Status: ${statusCode}`, { payload });
  }

  /**
   * ✅ Track merchant sync operations
   */
  logMerchantSync(email: string, status: string, meta?: any) {
    this.writeLog(LogLevel.INFO, `Merchant Sync: ${email} - Status: ${status}`, meta);
  }

  /**
   * ✅ Track product sync operations
   */
  logProductSync(productId: string, shopDomain: string, status: string, meta?: any) {
    this.writeLog(LogLevel.INFO, `Product Sync: ${productId} for ${shopDomain} - Status: ${status}`, meta);
  }
}

// Export a singleton instance
const logger = new Logger();

export default logger;