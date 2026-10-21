  const jwt = require("jsonwebtoken");
  const JWT_SECRET = process.env.JWT_SECRET;

  function getToken(req) {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    // The bearer token is the current client session. A cookie may belong to
    // an earlier account, so it must not override an explicit Authorization.
    return bearerToken || req.cookies?.auth;
  }

  const requireAuth = (requiredRole = "user") => {
    // 3. Return the actual middleware function Express expects
    return (req, res, next) => {
      const token = getToken(req);
      console.log("auth a");
      if (!token) return res.redirect("/login"); // <- redirect to login if no token
      console.log("auth b");
      jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
        if (err) {
          console.log("auth c");
          return res.status(403).json({ error: "Forbidden: Invalid token" });
        }

        if (decodedUser.role !== requiredRole) {
          console.log("auth d");
          return res
            .status(403)
            .json({ error: "Forbidden: Insufficient permissions" });
        }
        req.user = decodedUser;
        next();
      });
    };
  };


    const checkAuth = (requiredRole = "user") => {
    // 3. Return the actual middleware function Express expects
    return (req, res, next) => {
      const token = getToken(req);
      console.log("auth a");
      if (!token) return res.status(401).json({ error: "Not logged in" }); // <- return error if no token
      console.log("auth b");
      jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
        if (err) {
          console.log("auth c");
          return res.status(403).json({ error: "Forbidden: Invalid token" });
        }

        if (decodedUser.role !== requiredRole) {
          console.log("auth d");
          return res
            .status(403)
            .json({ error: "Forbidden: Insufficient permissions" });
        }
        req.user = decodedUser;
        next();
      });
    };
  };

  module.exports = { requireAuth, checkAuth };
