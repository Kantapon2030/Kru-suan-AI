export function successResponse(res, data, message = 'Success', statusCode = 200, meta = null) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta && { meta }),
  });
}

export function errorResponse(res, message = 'An error occurred', statusCode = 400, errors = null) {
  return res.status(statusCode).json({
    success: false,
    error: message,
    ...(errors && { errors }),
  });
}
