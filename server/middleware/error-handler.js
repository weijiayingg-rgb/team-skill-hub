class AppError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Internal server error';

  if (statusCode === 500) {
    console.error('[Error]', err);
  }

  res.status(statusCode).json({
    success: false,
    error: { code, message },
  });
}

function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `路由不存在: ${req.method} ${req.path}` },
  });
}

module.exports = { AppError, errorHandler, notFound };
