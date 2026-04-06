export class CliError extends Error {
  exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

export class ApiError extends CliError {
  method: string;
  requestPath: string;
  status: number;
  responseBody: unknown;

  constructor(method: string, requestPath: string, status: number, responseBody: unknown) {
    const details =
      typeof responseBody === "string"
        ? responseBody
        : responseBody
          ? JSON.stringify(responseBody)
          : "No response body";
    super(`${method.toUpperCase()} ${requestPath} failed (${status}): ${details}`, status === 408 ? 2 : 1);
    this.name = "ApiError";
    this.method = method.toUpperCase();
    this.requestPath = requestPath;
    this.status = status;
    this.responseBody = responseBody;
  }
}
