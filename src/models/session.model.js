import mongoose from "mongoose";
const sessionSchema = new mongoose.Schema(
  {
    userId: {
   type:mongoose.Schema.Types.ObjectId,
      ref:"User",
      required: [true, "userId is required"],
    },
    ip: {
      type: String,
      required: [true, "ip is required"],
    },
    userAgent: {
      type: String,
      required: [true, "user-agent is required"],
    },
    refreshHash: {
      type: String,
      required: true,
    },
    invoked: {
      type: Boolean,
      default:false
    }
  },
  { timestamps: true },
);


const Session = mongoose.model("Session", sessionSchema);

export default Session;
