
import mongoose from "mongoose";
import Account from "../models/account.model.js";
import Ledger from "../models/ledger.model.js";
import Transaction from "../models/transaction.model.js";
import { sendTransactionEmail } from "../services/email.service.js";

const sendExistingTransactionResponse = (res, existedTransaction) => {
  switch (existedTransaction.status) {
    case "SUCCESS":
      return res.status(200).json({
        message: "Transaction already completed",
        success: true,
        data: existedTransaction,
      });
    case "PENDING":
      return res.status(200).json({
        message: "Transaction is already pending",
        success: true,
      });
    case "FAILED":
      return res.status(400).json({
        message: "Transaction has failed",
        success: false,
      });
    case "REVERSED":
      return res.status(400).json({
        message: "Transaction has been reversed",
        success: false,
      });
    default:
      return res.status(400).json({
        message: "Transaction already exists with this idempotencyKey",
        success: false,
      });
  }
};

/**
 * - Create a new transaction
 * THE 10-STEP TRANSFER FLOW:
 * 1. Validate request
 * 2. Validate idempotency key
 * 3. Check account status
 * 4. Derive sender balance from ledger
 * 5. Create transaction (PENDING)
 * 6. Create DEBIT ledger entry
 * 7. Create CREDIT ledger entry
 * 8. Mark transaction COMPLETED
 * 9. Commit MongoDB session
 * 10. Send email notification
 */
const createTransactions = async(req, res) => { 
  try {
    const { fromAccount, toAccount, amount, idempotencyKey } = req.body;
    if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
      return res.status(400).json({
        message: "fromAccount, toAccount, amount and idempotencyKey are required",
        success: false,
      });
    }
    if (fromAccount === toAccount) { 
      return res.status(404).json({
        message: "You can't send money to your self",
        success: false,
      });
    }
    const fromAccountUser = await Account.findById(fromAccount);
    if (!fromAccountUser) {
      return res.status(404).json({
        message: "fromAccount not found",
        success: false,
      });
    }    
    if (fromAccountUser.userId.toString() !== req.user._id.toString()) {
      return res.status(400).json({
        message: "You can't perform that operation",
        success: false,
      });
    }
    const toAccountUser = await Account.findById(toAccount);
    if (!toAccountUser) {
      return res.status(404).json({
        message: "toAccount not found",
        success: false,
      });
    }

    const existedTransaction = await Transaction.findOne({ idempotencyKey });
    if (existedTransaction) {
      return sendExistingTransactionResponse(res, existedTransaction);
    }

    if (fromAccountUser.status !== "ACTIVE" || toAccountUser.status !== "ACTIVE") {
      return res.status(400).json({
        message: "Both accounts must be ACTIVE to perform a transaction",
        success: false,
      });
    }

    const fromAccountBalance = await fromAccountUser.getBalance();

    if (fromAccountBalance < amount) {
      return res.status(400).json({
        message: "Insufficient balance in fromAccount",
        success: false,
      });
    }

    let newTransaction, debitLedgerEntry, creditLedgerEntry;
    let session;
    try {
      session = await mongoose.startSession();
      await session.startTransaction();

      newTransaction = (
        await Transaction.create(
          [
            {
              fromAccount,
              toAccount,
              amount,
              idempotencyKey,
            },
          ],
          { session },
        )
      )[0];

      debitLedgerEntry = await Ledger.create(
        [
          {
            accountId: fromAccount,
            transactionId: newTransaction._id,
            type: "DEBIT",
            amount,
          },
        ],
        { session },
      );
      // await (() => {
      //   return new Promise((resolve) => setTimeout(resolve, 15 * 1000));
      // })();
      creditLedgerEntry = await Ledger.create(
        [
          {
            accountId: toAccount,
            transactionId: newTransaction._id,
            type: "CREDIT",
            amount,
          },
        ],
        { session },
      );

      const updatedTransaction = await Transaction.findByIdAndUpdate(
        newTransaction._id,
        { status: "SUCCESS" },
        {
          session,
          new: true,
        },
      );

      await session.commitTransaction();
      session.endSession();

      res.status(201).json({
        message: "Transaction completed successfully",
        success: true,
        data: {
          transaction: updatedTransaction,
          debitLedgerEntry: debitLedgerEntry[0],
          creditLedgerEntry: creditLedgerEntry[0],
        },
      });
    } catch (error) {
      if (session || session.inTransaction()) {
        await session.abortTransaction().catch(() => {});
        session.endSession();
      }

      const isDuplicateKey =
        error?.code === 11000 ||
        error?.codeName === "DuplicateKey" ||
        error?.writeErrors?.[0]?.code === 11000;

      if (isDuplicateKey) {
        const winnerTransaction = await Transaction.findOne({ idempotencyKey });
        if (winnerTransaction) {
          return sendExistingTransactionResponse(res, winnerTransaction);
        }
      }

      return res.status(400).json({
        message:
          "Transaction is Pending due to some issue, please retry after sometime",
        success: false,
      });
    }
    try {
      await sendTransactionEmail(req.user.email, req.user.name, amount, toAccount);
    } catch (emailError) {
      console.error("Failed to send transaction email:", emailError.message);
    }
  } catch (error) {
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
}


const createInitialFundsTransaction = async (req, res) => {
  let session;
  try {
     const { toAccount, amount, idempotencyKey } = req.body;

     if (!toAccount || !amount || !idempotencyKey) {
       return res.status(400).json({
         message: "toAccount, amount and idempotencyKey are required",
         success:false
       });
    }    
    const existedTransaction = await Transaction.findOne({ idempotencyKey });
    if (existedTransaction) {
      return sendExistingTransactionResponse(res, existedTransaction);
    }
    

    const toUserAccount = await Account.findById(toAccount);
    
     if (!toUserAccount) {
       return res.status(400).json({
         message: "Invalid toAccount",
         success:false
       });
     }

     
     const fromUserAccount = await Account.findOne({
       userId: req.user._id,
      });

     if (!fromUserAccount) {
       return res.status(400).json({
         message: "System user account not found",
         success:false
       });
     }

     session = await mongoose.startSession();
     session.startTransaction();

     const transaction = new Transaction({
       fromAccount: fromUserAccount._id,
       toAccount,
       amount,
       idempotencyKey,
       status: "PENDING",
     });
    //  const debitLedgerEntry = await Ledger.create(
    //    [
    //      {
    //        accountId: fromUserAccount._id,
    //        amount: amount,
    //        transactionId: transaction._id,
    //        type: "DEBIT",
    //      },
    //    ],
    //    { session },
    //  );

     const creditLedgerEntry = await Ledger.create(
       [
         {
           accountId: toAccount,
           amount: amount,
           transactionId: transaction._id,
           type: "CREDIT",
         },
       ],
       { session },
     );

     transaction.status = "SUCCESS";
     await transaction.save({ session });

     await session.commitTransaction();
     session.endSession();

     return res.status(201).json({
       message: "Initial funds transaction completed successfully",
       transaction,
       success:true
     });

  } catch (error) {
    if (session || session.inTransaction()) {
      await session.abortTransaction().catch(() => {});
      session.endSession();
    }

    const isDuplicateKey =
      error?.code === 11000 ||
      error?.codeName === "DuplicateKey" ||
      error?.writeErrors?.[0]?.code === 11000;

    if (isDuplicateKey) {
      const winnerTransaction = await Transaction.findOne({ idempotencyKey });
      if (winnerTransaction) {
        return sendExistingTransactionResponse(res, winnerTransaction);
      }
    }

    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
}


export { createTransactions, createInitialFundsTransaction };
