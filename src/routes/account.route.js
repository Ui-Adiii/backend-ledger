import express from "express";
import { verifyUser } from "../middlewares/auth.middleware.js";
import * as accountController from "../controllers/account.controller.js";

const accountRouter = express.Router();

accountRouter.post("/create", verifyUser, accountController.createAccount);
accountRouter.get("/accounts", verifyUser, accountController.getUserAccounts);
accountRouter.get("/balance/:accountId",verifyUser,accountController.getAccountBalance,);
export default accountRouter;
