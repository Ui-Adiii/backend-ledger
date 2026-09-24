import app from "./src/app.js";
import connectDb from "./src/db/db.js";
import dotenv from "dotenv";
dotenv.config();

await connectDb();


const PORT = process.env.PORT || 8000;
app.listen(PORT,()=> console.log(`Server Started on : ${PORT}`))