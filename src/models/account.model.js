import mongoose from "mongoose";
import Ledger from "./ledger.model.js";
const accountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userId is required"],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ["ACTIVE", "FROZEN", "CLOSED"],
        message: "Status can be ACTIVE, FROZEN or CLOSED",
      },
      default: "ACTIVE",
    },
    currency: {
      type: String,
      default: "INR",
    },
  },
  { timestamps: true },
);

accountSchema.methods.getBalance = async function () {
  
  const balanceData = await Ledger.aggregate([
    { $match: { accountId: this._id } },
    {
      $group: {
        _id: null,
        totalCredit: {
          $sum: {
            $cond: [
              { $eq: ["$type", "CREDIT"] }, "$amount", 0
            ],
          }
        },
        totalDebit: {
          $sum: {
            $cond: [
              { $eq: ["$type", "DEBIT"] }, "$amount", 0
            ],
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        balance: { $subtract: ["$totalCredit", "$totalDebit"] }
      }
    }
  ])  
  return balanceData[0]?.balance || 0;
}

accountSchema.index({ userId: 1, status: 1 })
const Account = mongoose.model("Account", accountSchema);

export default Account;
