import mongoose from "mongoose"
import bcrypt from "bcryptjs"
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is Required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Name is Required"],
      trim: true,
      unique: [true, "Email already exist"],
      lowercase: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Invalid Email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Name is Required"],
      minlength: [true, "Minimum length of password should be 6"],
      select: false,
    },
    systemUser: {
      type: Boolean,
      default: false,
      immutable: true,
      select: false,
    },
  },
  { timestamps: true },
);

userSchema.pre("save",async function() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
})

userSchema.methods.comparePassword = async function (password) {  
  return await bcrypt.compare(password, this.password);
}


const User = mongoose.model("User", userSchema)

export default User;