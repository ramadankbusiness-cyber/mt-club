import auth from "./auth.js";

export function requireRole(...roles) {
  return (req, res, next) => {
    auth(req, res, () => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      next();
    });
  };
}

export function requireAdmin(req, res, next) {
  auth(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin only" });
    }
    next();
  });
}

export function requireLeaderOrAdmin(req, res, next) {
  auth(req, res, () => {
    if (req.user.role !== "admin" && req.user.role !== "leader") {
      return res.status(403).json({ message: "Admin or Leader only" });
    }
    next();
  });
}

export function requireMember(req, res, next) {
  auth(req, res, () => {
    if (!["admin", "leader", "member"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  });
}
