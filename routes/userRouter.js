const express = require("express")
const router = express.Router()
const passport = require("passport")
const userController = require("../controllers/users/userController")
const profileController=require("../controllers/users/profileController")
const productController=require("../controllers/users/productController")
const cartController=require("../controllers/users/cartContoller")
const wishlistController=require("../controllers/users/wishlistController")
const {userAuth,userLogin,isUserBlocked}=require("../Middleware/auth")
const checkoutController=require("../controllers/users/checkoutController")
const orderController = require("../controllers/users/orderController")



router.get("/pageNotFound", userController.pageNotFound);
router.get("/home",userController.loadHomepage);
router.get("/signup", userLogin, userController.loadSignup);
router.post("/signup",userLogin, userController.signup);
router.get("/verify-otp",userLogin,userController.loadVerifyOtp);
router.post("/verify-otp",userLogin,userController.verifyOtp);
router.post("/resend-otp",userLogin,userController.resendOtp);
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



router.get("/product-details/:id",isUserBlocked,userAuth,productController.getProductDetailPage)
router.post("/product-details/add-review/:id", isUserBlocked, productController.addProductReview)
router.get('/product-details/reviews/:id',isUserBlocked, productController.getProductReview);

    

//profile
router.get("/forgot-password",profileController.getForgotPassPage)
router.post("/forgot-email-valid",profileController.forgotEmailValid)
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp)
router.get("/reset-password",profileController.getResetPassPage);
router.post("/resend-forgot-otp",profileController.resendOtp)
router.post("/reset-password",profileController.postNewPassword);
router.get("/userProfile",userAuth,profileController.userProfile)
// router.get("/change-email",profileController.changeEmail)
// router.post("/change-email",profileController.changeEmailValid)
router.post("/update-name", profileController.updateName);
// router.post("/verify-email-otp", profileController.verifyEmailOtp)
// router.post("/update-email",profileController.updateEmail)
router.get("/change-password", profileController.changePassword);
router.post("/change-password", profileController.postChangePassword)
//  router.get("/change-password",profileController.changePassword)
// router.post("/change-password",profileController.changePasswordValid)
// router.get("/change-password-otp",profileController.changePassOtpPage)
// router.get("/change-email-otp",profileController.changeEmailOtpPage)
router.post("/verify-changepassword-otp",profileController.verifychangePassOtp)


//adress
router.get("/addAddress",userAuth,profileController.addAddress)
router.post("/addAddress",userAuth,profileController.postAddAddress)
router.get("/editAddress",userAuth,profileController.editAddress)
router.post("/editAddress",userAuth,profileController.postEditAddress)
router.delete("/deleteAddress",profileController.deleteAddress);

// cartPage

router.get("/cart",userAuth,cartController.getCartPage)
router.post('/add-to-cart', userAuth, cartController.addToCart);
router.put('/cart/update/:itemId', userAuth, cartController.updateCart);
router.delete('/cart/update/:itemId', userAuth, cartController.deleteItemFromCart);


router.get("/checkout",userAuth,checkoutController.getCheckOut)
router.post("/placeorder",checkoutController.placeOrder)
router.get("/checkout-addAddress",checkoutController.loadaddAddress)
router.post("/checkout-addAddress",checkoutController.postAddress)
router.get("/checkout-editAddress",checkoutController.loadeditAddress)
router.post("/checkout-editAddress",checkoutController.EditAddresspost)

router.post('/create-razorpay-order', checkoutController.createRazorpayOrder);
router.post('/verify-razorpay-payment',checkoutController.verifyRazorPayment);
router.get('/razorPayment',checkoutController.razorPayment);
router.post('/handle-payment-dismissal',checkoutController.handlePaymentDismissal)
router.post('/handle-payment-failure', checkoutController.handlePaymentFailure);
router.post('/retry-payment', checkoutController.retryPayment);
router.get('/transaction-failure',checkoutController.loadTransactionFailurePage);
router.get('/download-invoice/:orderId', userAuth, checkoutController.downloadInvoice);



router.get('/order-success/:orderId',checkoutController.orderSuccess)

router.get("/userProfile/order-details/:orderId",profileController.getOrderDetailsPage)
router.post('/orders/cancel/:orderId', orderController.cancelOrder);
router.post('/orders/return/:orderId',orderController.returnOrder)




//wishlist
router.get('/wishlist', userAuth, wishlistController.loadWishlist);
router.post('/addWishlist', userAuth, wishlistController.addWishlist);
router.delete('/removeFromWishlist', userAuth, wishlistController.removeFromWishlist);

module.exports = router;