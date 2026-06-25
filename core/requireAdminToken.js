function requireAdminToken(req, res, next) {
  // Support token from query param OR cookie
  const queryToken  = req.query.token;
  const cookieToken = parseCookie(req.headers.cookie || '', 'stokbot_admin_token');
  const token       = queryToken || cookieToken;

  if (token !== process.env.ADMIN_LOG_TOKEN) {
    // If it's a browser request (Accept: text/html), redirect to login
    if (req.headers.accept?.includes('text/html')) {
      return res.redirect('/admin/login.html');
    }
    return res.status(403).json({ error: 'Unauthorized' });
  }

  next();
}

function parseCookie(cookieStr, name) {
  const match = cookieStr.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

module.exports = { requireAdminToken };