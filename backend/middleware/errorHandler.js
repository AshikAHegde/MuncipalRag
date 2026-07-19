export function errorHandler(error, _req, res, _next) {
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.message || "Request failed.",
    });
  }

  return res.status(500).json({
    success: false,
    error: "Unexpected server error.",
  });
}
