import bcrypt from "bcryptjs";
import Session from "../models/session.model.js";
import User from "../models/user.model.js";
import { verifyToken } from "../utils/token.js";
import BlackList from "../models/blacklist.model.js";

const verifyUser = async (req, res, next) => {
  try {
    const accessToken = req.cookies.access_token ||req.headers.authorization?.split(" ")[1];
      
    const refreshToken =
      req.cookies.refresh_token
    if (!accessToken && !refreshToken) {
      return res.status(401).json({
        message: "Unauthorized User",
        success: false,
      });
    }
    const blacklist = await BlackList.findOne({ token: refreshToken });
    if (blacklist) {
      return res.status(400).json({
        message: "Token Expired",
        success: false,
      });
    }
    const decoded = verifyToken(accessToken);
    if (!decoded) {
      return res.status(401).json({
        message: "Unauthorized User",
        success: false,
      });
    }
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(403).json({
        message: "Login First",
        success: false,
      });
    }
    
    const session = await Session.findOne({
      userId: user._id,
      ip:req.ip,
      userAgent:req.headers["user-agent"],
      invoked: false,
    })    
    if (!session) {
      return res.status(403).json({
        message: "Login First",
        success: false,
      });
    }
    const isValidSession = bcrypt.compareSync(refreshToken, session.refreshHash);
    if (!isValidSession) { 
      return res.status(403).json({
        message: "Login First",
        success: false,
      });
    }
    req.user = user;
    return next();
  } catch (error)
  {
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
};
const verifySystemUser = async (req, res, next) => {
  try {
    const accessToken =
      req.cookies.access_token || req.headers.authorization?.split(" ")[1];

    const refreshToken = req.cookies.refresh_token;
    if (!accessToken && !refreshToken) {
      return res.status(401).json({
        message: "Unauthorized User",
        success: false,
      });
    }
    const blacklist = await BlackList.findOne({ token: refreshToken })
    if (blacklist) {
      return res.status(400).json({
        message: "Token Expired",
        success: false,
      });
    }
    const decoded = verifyToken(accessToken);
    if (!decoded) {
      return res.status(401).json({
        message: "Unauthorized User",
        success: false,
      });
    }
    const user = await User.findById(decoded.userId).select("+systemUser");

    if (!user || !user.systemUser) {
      return res.status(403).json({
        message: "Login First",
        success: false,
      });
    }

    const session = await Session.findOne({
      userId: user._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      invoked: false,
    });
    if (!session) {
      return res.status(403).json({
        message: "Login First",
        success: false,
      });
    }
    const isValidSession = bcrypt.compareSync(
      refreshToken,
      session.refreshHash,
    );
    if (!isValidSession) {
      return res.status(403).json({
        message: "Login First",
        success: false,
      });
    }
    req.user = user;
    return next();
  } catch (error) {
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
};
export { verifyUser, verifySystemUser };