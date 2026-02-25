function encodeToken(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeToken(token) {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    return JSON.parse(decoded);
  } catch (err) {
    return null;
  }
}

function authMiddleware(req, _res, next) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }
  const token = auth.slice("Bearer ".length);
  req.user = decodeToken(token);
  return next();
}

module.exports = {
  encodeToken,
  decodeToken,
  authMiddleware
};
