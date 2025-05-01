const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../controllers/users/userController");
const profileController=require("../controllers/users/profileController")

router.get("/pageNotFound", userController.pageNotFound);
router.get("/home", userController.loadHomepage);
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.get("/verify-otp", userController.loadVerifyOtp);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.get("/auth/google",passport.authenticate('google',{scope:['profile','email']}))
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect('/home')
})
router.get("/login",userController.loadlogin)
router.post("/login",userController.login)


//home &shop
router.get('/home',userController.loadHomepage)
router.get("/logout",userController.logout)

//profile
router.get("/forgot-password",profileController.getForgotPassPage)
router.post("/forgot-email-valid",profileController.forgotEmailValid)
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp)
router.get("/reset-password",profileController.getResetPassPage);
router.post("/resend-forgot-otp",profileController.resendOtp)
router.post("/reset-password",profileController.postNewPassword);



module.exports = router;