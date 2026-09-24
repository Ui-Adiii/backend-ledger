
import mongoose from 'mongoose';

const ledgerSchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: [true, 'accountId is required'],
    index: true,
    immutable: true,
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: [true, 'transactionId is required'],
    index: true,
    immutable: true,
  },
  amount: {
    type: Number,
    required: [true, 'amount is required'],
    min: [1, 'amount should be greater than 0'],
    immutable: true,
  },
  type: {
    type: String,
    enum: {
      values: ['CREDIT', 'DEBIT'],
      message: 'Type can be CREDIT or DEBIT',
    },
    required: [true, 'type is required'],
    immutable: true,
  }
}, { timestamps: true });


const preventLedgerModification =()=> {
  throw new Error(
    "Ledger entries are immutable and cannot be modified or deleted",
  );
}

ledgerSchema.pre("findOneAndUpdate", preventLedgerModification);
ledgerSchema.pre("findOneAndDelete", preventLedgerModification);
ledgerSchema.pre("findOneAndReplace", preventLedgerModification);
ledgerSchema.pre("updateOne", preventLedgerModification);
ledgerSchema.pre("updateMany", preventLedgerModification);
ledgerSchema.pre("deleteOne", preventLedgerModification);
ledgerSchema.pre("deleteMany", preventLedgerModification);
ledgerSchema.pre("remove", preventLedgerModification);


const Ledger = mongoose.model('Ledger', ledgerSchema);
export default Ledger;