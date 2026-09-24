import mongoose from "mongoose"

const transactionSchema = new mongoose.Schema({
  fromAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Account",
    index: true,
    required:[true,"fromAccount is required"]
  },
  toAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Account",
    index: true,
    required: [true, "toAccount is required"]
  },
  amount: {
    type: Number,
    required: [true, "amount is required"],
    min: [1, "amount should be greater than 0"],
  },
  status: {
    type: String,
    enum: {
      values: ["PENDING", "SUCCESS", "FAILED","REVERSED"],
      message: "Status can be PENDING, SUCCESS, FAILED or REVERSED",
    },
    default: "PENDING",
  },
  idempotencyKey: {
    type: String,
    unique: true,
    required: [true, "idempotencyKey is required"],
  },
}, { timestamps: true })


const Transaction = mongoose.model("Transaction", transactionSchema)

export default Transaction