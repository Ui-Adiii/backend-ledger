import express from "express"
import authRouter from "./auth.route.js"
import accountRouter from "./account.route.js"
import transactionRouter from "./transaction.route.js"

const router = express.Router()

router.use("/auth", authRouter);
router.use("/account", accountRouter);
router.use("/transaction", transactionRouter);

export default router