import User from "../models/Users.js"
import passport from "passport";

const signup = async(req, res, next)=>{
    try{
        let {username, email, password} = req.body;
        let newUser = new User({email, username});

        const registeredUser = await User.register(newUser, password); 
        console.log(registeredUser);

        req.login(registeredUser, (err)=>{
            if(err) return next(err);

            return res.status(200).json({
                message:"Account Created Successfully",
                user:{
                    id: registeredUser._id,
                    username: registeredUser.username,
                    email: registeredUser.email,
                }
            });
        })
    } catch(err){
        return next(err);
    }
}

const login = async(req, res, next)=>{
    passport.authenticate("local", (err, user, info)=>{
        if(err) return next(err);
        if(!user){
            return res.status(401).json({message: info?.message || "Invalid username or password"});
        }

        req.login(user, (loginErr)=>{
            if(loginErr) return next(loginErr)

            return res.status(200).json({
                message:"Logged in successfully",
                user:{
                    id: user._id,
                    username: user.username,
                    email: user.email,
                }
            });
        });
    })(req, res, next);

}


const logout = async(req, res, next)=>{
    req.logout((err)=>{
        if(err){
            return next(err);
        }
        return res.status(200).json({ message: "Logged out successfully" });
    })
}

export {login, signup, logout};