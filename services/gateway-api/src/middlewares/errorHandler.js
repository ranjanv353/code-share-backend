export default function errorHandler(err, req, res, next) {
  console.error(`[Gateway Error] ${err.message}`);
  res.status(err.response?.status || 500).json({
    error: err.message,
    details: err.response?.data ?? null,
  });
}