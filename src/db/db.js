import mongoose from "mongoose"
import Account from "../models/account.model.js"
import Ledger from "../models/ledger.model.js"
import Transaction from "../models/transaction.model.js"

const connectDb = async () => { 
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('db connected successfully');
    await Promise.all([
      Account.syncIndexes(),
      Ledger.syncIndexes(),
      Transaction.syncIndexes(),
    ]);
    console.log('db indexes synced successfully');
  } catch (error) {
    console.error(error.message);
    if (error?.code === 11000 || error?.codeName === "DuplicateKey") {
      console.error("A unique index build failed because duplicate idempotencyKey documents exist. Remove the duplicates and restart.");
    }
    process.exit(1);
  }
}
export default connectDb;