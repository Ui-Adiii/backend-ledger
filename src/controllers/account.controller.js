import Account from "../models/account.model.js";

const createAccount = async (req, res) => {
  try {
    let { currency, status } = req.body;
    const { user } = req;
    if (!currency) currency = "INR";
    if (!status) status = "ACTIVE";

    const existedAccount = await Account.findOne({
      userId: user._id,
      currency,
      status,
    });

    if (existedAccount) {
      return res.status(400).json({
        message: "Account Already Exist",
        success: false,
      });
    }

    const account = await Account.create({
      userId: user._id,
      currency,
      status,
    });
    if (!account) {
      return res.status(400).json({
        message: "Account creation Failed",
        success: false,
      });
    }
    return res.status(201).json({
      message: "Account created Successfully",
      success: true,
      account,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
};

async function getUserAccounts(req, res) {
  try {
    const accounts = await Account.find({ userId: req.user._id });
    if (!accounts) {
      return res.status(400).json({
        message: "account not found",
        success: false,
      });
    }
    return res.status(200).json({
      message: "account fetched successful",
      success: true,
      accounts,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
      success: false,

    });
  }
}

async function getAccountBalance(req, res) {
 try {
   const { accountId } = req.params;
  
   const account = await Account.findOne({
     _id: accountId,
     userId: req.user._id,
   });

   if (!account) {
     return res.status(404).json({
       message: "Account not found",
       success:false
     });
   }

   const balance = await account.getBalance();

   return res.status(200).json({
     accountId: account._id,
     balance: balance,
     message: "balance fetched",
     success: true
   });
 } catch (error) {
  return res.status(500).json({
    message: error.message,
    success:false
  });
 }
}
export { createAccount, getUserAccounts, getAccountBalance };
