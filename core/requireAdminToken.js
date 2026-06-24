function requireAdminToken(req, res, next) {
  if (req.query.token !== process.env.ADMIN_LOG_TOKEN) {
    return res.status(403).end();
  }
  next();
}

module.exports = { requireAdminToken };