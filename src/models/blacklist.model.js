import mongoose from "mongoose";

const blackListSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: [true, "Token is required to blacklist"],
      unique: [true, "Token is already blacklisted"],
    },
  },
  { timestamps: true },
);

blackListSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 60 * 60 * 24 * 7, 
  },
);

const BlackList = mongoose.model("BlackList", blackListSchema);

export default BlackList;