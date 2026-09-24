import express from 'express';
import cookieParse from "cookie-parser"
import cors from "cors"
import { rateLimit } from "express-rate-limit";
import router from './routes/index.js';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  limit: 100, 
  standardHeaders: "draft-8", 
  legacyHeaders: false, 
  ipv6Subnet: 56
});

const app = express();

app.use(limiter);
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ["POST", "PUT", "UPDATE", "DELETE", "PATCH", "GET"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }))
app.use(cookieParse())
app.get("/health", (req, res) => { 
  return res.status(200).json({
    message:"api is working",
    success: true
  })
})
app.use("/api/v1",router)
export default app