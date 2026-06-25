function requireAdminToken(req, res, next) {
  const queryToken  = req.query.token;
  const cookieToken = parseCookie(req.headers.cookie || '', 'stokbot_admin_token');
  const token       = queryToken || cookieToken;

  if (token !== process.env.ADMIN_LOG_TOKEN) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  next();
}

function parseCookie(cookieStr, name) {
  const match = cookieStr.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

module.exports = { requireAdminToken };