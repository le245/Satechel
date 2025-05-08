const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../controllers/users/userController");
const profileController=require("../controllers/users/profileController")
const productController=require("../controllers/users/productController")

router.get("/pageNotFound", userController.pageNotFound);
router.get("/home", userController.loadHomepage);
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.get("/verify-otp", userController.loadVerifyOtp);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.get("/auth/google",passport.authenticate('google',{scope:['profile','email']}))
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    const user=req.user
    req.session.user = user._id;
    req.session.userEmail = user.email
    res.redirect('/home')
})
router.get("/login",userController.loadlogin)
router.post("/login",userController.login)


//home &shop
router.get('/home',userController.loadHomepage)
router.get("/logout",userController.logout)
router.get("/shop",userController.getShop)
router.get("/product-details/:id",productController.getProductDetailPage)

//profile
router.get("/forgot-password",profileController.getForgotPassPage)
router.post("/forgot-email-valid",profileController.forgotEmailValid)
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp)
router.get("/reset-password",profileController.getResetPassPage);
router.post("/resend-forgot-otp",profileController.resendOtp)
router.post("/reset-password",profileController.postNewPassword);
router.get("/userProfile",profileController.userProfile)
router.get("/change-email",profileController.changeEmail)
router.post("/change-email",profileController.changeEmailValid)
router.post("/verify-email-otp",profileController.verifyEmailOtp)
router.post("/update-email",profileController.updateEmail)
router.get("/change-password",profileController.changePassword)
router.post("/change-password",profileController.changePasswordValid)
router.post("/verify-password",profileController.verifychangePassOtp)

//adress
router.get("/addAddress",profileController.addAddress)
router.post("/addAddress",profileController.postAddAddress)
router.get("/editAddress",profileController.editAddress)
router.post("/editAddress",profileController.postEditAddress)
router.get("/deleteAddress",profileController.deleteAddress);



module.exports = router;