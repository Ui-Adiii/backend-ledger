import express from "express";
import { createInitialFundsTransaction, createTransactions } from "../controllers/transaction.controller.js";
import {verifySystemUser, verifyUser} from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/create", verifyUser, createTransactions);
router.post("/initial-funds", verifySystemUser, createInitialFundsTransaction);

export default router;