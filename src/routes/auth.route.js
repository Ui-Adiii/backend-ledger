import express from "express"
import * as authController from "../controllers/auth.controller.js"
import {verifyUser} from "../middlewares/auth.middleware.js"
const authRouter = express.Router()

authRouter.post("/register",authController.registerController)
authRouter.post("/login",authController.loginController)
authRouter.get("/logout",verifyUser,authController.logOutController)
authRouter.get(
  "/logout-all",
  verifyUser,
  authController.logOutAllDeviceController,
);
authRouter.get("/rotate-token", authController.rotateTokenController);


export default authRouter