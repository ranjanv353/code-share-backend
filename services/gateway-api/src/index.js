import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import  roomsRouter from "./routes/rooms.js";
import errorHandler from "./middlewares/errorHandler.js";
import { optionalAuthenticateJWT } from './middlewares/auth.js';


dotenv.config();

const app = express();

const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

app.use('/rooms', optionalAuthenticateJWT, roomsRouter);


app.get("/health", (req, res)=> res.send("Gateway API is running"));

app.use(errorHandler);

app.listen(PORT, ()=>{
    console.log(`Gateway API listening on port ${PORT}`);
});

