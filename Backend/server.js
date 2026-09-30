import express from "express"
import "dotenv/config"
import cors from "cors"
import mongoose from "mongoose"
import chatRoutes from "./routes/chat.js"

const app = express()
const PORT = 8080

app.use(express.json())  
app.use(cors({
  origin: "http://localhost:5173" // swap with the actual production link
}))

app.use("/api", chatRoutes)

app.listen(PORT, ()=>{
    console.log(`server running on port ${PORT}`)
    connectDB()
}) 

const connectDB = async ()=>{
    try{
        await mongoose.connect(process.env.LOCAL_MONGODB_URI)
        console.log("Connected with database")
    } catch(err){
        console.log("Failed to connect with Db", err)
    }
}
