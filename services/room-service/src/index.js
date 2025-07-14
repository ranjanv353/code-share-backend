import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import roomRoutes from "./routes/rooms.js"

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/rooms', roomRoutes);

app.get('/health', (req,res) => {res.send("Room service is running")});

app.use((err, req, res, next) => {
  console.error('[Room Service Error]', err);
  res.status(500).json({
    error: err.message || 'Internal Server Error'
  });
});

app.listen(PORT, ()=>{
    console.log(`Room service is listening on port ${PORT}`);
});


