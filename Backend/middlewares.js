const isLoggedIn = (req, res, next)=>{
    if(!req.isAuthenticated()){
        return res.status(401).json({
            success: false,
            message: "Unauthorized: Please log in to access this resource",
        })
    }
    next();
}



export {isLoggedIn};