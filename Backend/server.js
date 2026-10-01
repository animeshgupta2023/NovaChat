import express from "express"
import "dotenv/config"
import cors from "cors"
import mongoose from "mongoose"
import passport from "passport"
import LocalStrategy from "passport-local"
import session from "express-session";

import User from "./models/Users.js"
import chatRoutes from "./routes/chat.js"
import userRoutes from "./routes/user.js"

const app = express()
const PORT = 8080

app.use(express.json())  


app.use(cors({
        origin: "http://localhost:5173", // swap with the actual production link
        credentials: true,
    })
);

app.use(
    session({
        secret: process.env.SESSION_SECRET || "novachat_secret_key",
        resave: false,
        saveUninitialized: false,
        cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        secure: false, // Set to true if running over HTTPS in production
        },
    })
)


app.use(passport.initialize()); // this is a middleware that initializes the passport for the each request.
app.use(passport.session()); // because of this in a single session a we can identify the user

passport.use(new LocalStrategy(User.authenticate())); // use static authenticate method of model in local Strategy
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use("/api", chatRoutes)
app.use("/auth", userRoutes)
 
app.all(/.*/, (req, res, next) => {
    next(new ExpressError(404, "page not found!"));
});

// centralized error handler
app.use((err, req, res, next)=>{
    console.error("Credentialized Error: ", err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error"
    });
});

const connectDB = async ()=>{
    try{
        await mongoose.connect(process.env.LOCAL_MONGODB_URI)
        console.log("Connected with database")
    } catch(err){
        console.log("Failed to connect with Db", err)
    }
}

app.listen(PORT, ()=>{
    console.log(`server running on port ${PORT}`)
    connectDB()
}) 