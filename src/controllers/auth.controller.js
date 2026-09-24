import bcrypt from "bcryptjs";
import Session from "../models/session.model.js";
import User from "../models/user.model.js";
import { generateToken, verifyToken } from "../utils/token.js";
import { sendRegistrationEmail } from "../services/email.service.js";
import BlackList from "../models/blacklist.model.js";

/**
 * - User Registration
 * - POST /api/v1/auth/register
 * - Body (JSON) - name , email(unique) , password
 */
const registerController = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const { ip } = req;
    const userAgent = req.headers["user-agent"];

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name , Email and Password is required",
        success: false,
      });
    }
    const exist = await User.findOne({ email });
    if (exist) {
      return res.status(400).json({
        message: "email already exist",
        success: false,
      });
    }
    const user = await User.create({
      name,
      email,
      password,
    });

    const refreshToken = generateToken(user._id, "7d");
    const accessToken = generateToken(user._id, "15m");
    const refreshHash = bcrypt.hashSync(refreshToken, 10);

    await Session.create({
      ip,
      userId: user._id,
      refreshHash,
      userAgent,
    });

    res
      .cookie("refresh_token", refreshToken, {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "strict",
      })
      .cookie("access_token", accessToken, {
        maxAge: 15 * 60 * 1000,
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "strict",
      })
      .status(201)
      .json({
        message: "user registered successfully",
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
        },
        success: true,
        token: accessToken,
      });
    await sendRegistrationEmail(user.email, user.name);
  } catch (error) {
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
};
/**
 * - User Login
 * - POST /api/v1/auth/login
 * - Body (JSON) - email , password
 */
const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;
    const { ip } = req;
    const userAgent = req.headers["user-agent"];

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and Password is required",
        success: false,
      });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(400).json({
        message: "Invalid email or password",
        success: false,
      });
    }

    const isValidPassword = await user.comparePassword(password);

    if (!isValidPassword) {
      return res.status(400).json({
        message: "Invalid email or password",
        success: false,
      });
    }
    const refreshToken = generateToken(user._id, "7d");
    const accessToken = generateToken(user._id, "15m");
    const refreshHash = bcrypt.hashSync(refreshToken, 10);
    const session = await Session.findOneAndUpdate(
      {
        userId: user._id,
        ip,
        userAgent,
      },
      {
        refreshHash,
        invoked: false,
      },
    );
    if (!session) {
      await Session.create({
        ip,
        userId: user._id,
        refreshHash,
        userAgent,
      });
    }
    return res
      .cookie("refresh_token", refreshToken, {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "strict",
      })
      .cookie("access_token", accessToken, {
        maxAge: 15 * 60 * 1000,
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "strict",
      })
      .status(200)
      .json({
        message: "Login successfully",
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
        },
        success: true,
        token: accessToken,
      });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
};
/**
 * - Rotate Token
 * - GET /api/v1/auth/rotate-token
 */
const rotateTokenController = async (req, res) => {
  try {
    const token = req.cookies.refresh_token;
    if (!token) {
      return res.status(401).json({
        message: "Unauthorized Access",
        success: false,
      });
    }
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId);

    const refreshToken = generateToken(user._id, "7d");
    const accessToken = generateToken(user._id, "15m");

    const refreshHash = bcrypt.hashSync(refreshToken, 10);
    const session = await Session.findOneAndUpdate(
      {
        userId: user._id,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        invoked: false,
      },
      {
        refreshHash,
      },
    );

    return res
      .cookie("refresh_token", refreshToken, {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "strict",
      })
      .cookie("access_token", accessToken, {
        maxAge: 15 * 60 * 1000,
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "strict",
      })
      .status(200)
      .json({
        message: "Token Rotated Successful",
        success: true,
        token: accessToken,
      });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
};
/**
 * - Logout
 * - GET /api/v1/auth/logout
 */
const logOutController = async (req, res) => {
  try {
    const { user } = req;
    const token = req.cookies.refresh_token;

    await BlackList.create({ token });
    await Session.findOneAndUpdate(
      {
        userId: user._id,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        invoked: false,
      },
      { invoked: true, refreshHash: null },
    );
    return res
      .status(200)
      .clearCookie("refresh_token")
      .clearCookie("access_token")
      .json({
        success: true,
        message: "Logout successful",
      });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
};
/**
 * - Logout from all devices
 * - GET /api/v1/auth/logout-all
 */
const logOutAllDeviceController = async (req, res) => {
  try {
    const { user } = req;
  
    const result = await Session.updateMany(
      {
        userId: user._id,
        invoked: false,
      },
      {
        invoked: true,
        refreshHash: null,
      },
    );
    return res
      .status(200)
      .clearCookie("refresh_token")
      .clearCookie("access_token")
      .json({
        success: true,
        message: `Logout successful from ${result.modifiedCount} devices`,
      });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
};

export {
  registerController,
  loginController,
  rotateTokenController,
  logOutController,
  logOutAllDeviceController,
};
