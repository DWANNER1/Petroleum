function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

function canAccessSite(user, siteId) {
  if (!user) return false;
  if (user.role === "manager") return true;
  if (user.role === "service_tech") return user.siteIds?.includes(siteId);
  if (user.role === "operator") return user.siteIds?.includes(siteId);
  return false;
}

function requireSiteAccess(req, res, next) {
  const siteId = req.params.id || req.params.siteId || req.query.siteId;
  if (!siteId) return res.status(400).json({ error: "Missing siteId" });
  if (!canAccessSite(req.user, siteId)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}

module.exports = {
  requireAuth,
  requireSiteAccess,
  requireRole,
  canAccessSite
};
