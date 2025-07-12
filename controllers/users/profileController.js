const User = require("../../Models/userSchema");
const Address= require("../../Models/addressSchema")
const Order= require("../../Models/orderSchema")
const bcrypt=require("bcrypt")
const nodemailer = require("nodemailer");
const env=require("dotenv").config();
const session =require("express-session");
const Product = require("../../Models/productSchema");
const STATUS_CODES= require("../../Models/status")



function generateOtp() {
    const digits = "1234567890";
    let otp = "";
    for (let i = 0; i < 6; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
}

const sendVerificationEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
        });

        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Your OTP for Password Reset",
            text: `Your OTP is ${otp}`,
            html: `<b><h4>Your OTP: ${otp}</h4></b>`,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email Sent:", info.messageId);
        return true;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
};


const securePassword=async(password)=>{
    try{
        const passwordHash=await bcrypt.hash(password,10);
        return passwordHash;
    } catch(error){
        console.log("Error in securePassword",error)
        throw new Error("failed to hash password")

    }

}

const getForgotPassPage = async (req, res) => {
    try {
       return res.render("forgot-password");
    } catch (error) {
        console.error("Error in getForgotPassPage:", error);
        res.redirect("/pageNotFound");
    }
};

const forgotEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        const findUser = await User.findOne({ email: email });

        if (findUser) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);

            if (emailSent) {
                req.session.userOtp = {
                    otp: otp,
                    expires: Date.now() + 5 * 60 * 1000, 
                };
                req.session.email = email;
                console.log("OTP:", otp);
                res.render("forgetPass-otp");
            } else {
                res.json({ success: false, message: "Failed to send OTP. Please try again." });
            }
        } else {
            res.render("forgot-password", {
                message: "User with this email does not exist.",
            });
        }
    } catch (error) {
        console.error("Error in forgotEmailValid:", error);
        res.redirect("/pageNotFound");
    }
};

const verifyForgotPassOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        const userOtp = req.session.userOtp;

        if (!userOtp) {
            return res.json({ success: false, message: "No OTP found. Please request a new OTP." });
        }

        if (userOtp.expires < Date.now()) {
            return res.json({ success: false, message: "OTP expired. Please request a new OTP." });
        }

        console.log("Entered OTP:", enteredOtp);
        console.log("Stored OTP:", userOtp.otp);

        if (enteredOtp === userOtp.otp) {
            return res.json({ success: true, redirectUrl: "/reset-password" });
        } else {
            return res.json({ success: false, message: "OTP not matching." });
        }
    } catch (error) {
        console.error("Error in verifyForgotPassOtp:", error);
        res.status(STATUS_CODES.SERVER_ERROR).json({ success: false, message: "An error occurred. Please try again." });
    }
};

const getResetPassPage=async(req,res)=>{
    try {
        res.render("reset-password");

    } catch (error) {
        res.redirect("/pageNotFound")
        
    }
}

const resendOtp=async(req,res)=>{
    try {
       const otp=generateOtp();
       req.session.userOtp=otp;
       const email=req.session.email;
       console.log("Resending OTP to email:",email)
       const emailSent=await sendVerificationEmail(email,otp);
       if(emailSent){
        console.log("Resend OTP:",otp);
        res.status(STATUS_CODES.OK).json({success:true,message:"Resnd OTP succesfull"})

       }
    } catch (error) {
        console.error("Error in resend otp",error)
        res.status(STATUS_CODES.SERVER_ERROR).json({success:false,message:'Internal ServerError'})
    }
}


const postNewPassword = async (req, res) => {
    try {
        const { newPass1, newPass2 } = req.body;
        const email = req.session.email;

       
        if (!email) {
            return res.render("forgot-password", { message: "Session expired. Please restart the password reset process." });
        }

     
        if (!req.session.userOtp || req.session.userOtp.expires < Date.now()) {
            return res.render("forgot-password", { message: "OTP expired. Please request a new OTP." });
        }

      
        if (!newPass1 || !newPass2) {
            return res.render("reset-password", { message: "Passwords cannot be empty." });
        }

        if (newPass1.length < 6) {
            return res.render("reset-password", { message: "Password must be at least 6 characters long." });
        }

        if (newPass1 === newPass2) {
          
            const user = await User.findOne({ email: email });
            if (!user) {
                return res.render("reset-password", { message: "User not found." });
            }

       
            const passwordHash = await securePassword(newPass1);

           
            const updateResult = await User.updateOne(
                { email: email },
                { $set: { password: passwordHash } }
            );

            
            if (updateResult.modifiedCount === 0) {
                return res.render("reset-password", { message: "Failed to update password. Please try again." });
            }

         
            req.session.email = null;
            req.session.userOtp = null;

            res.redirect("/login");
        } else {
            res.render("reset-password", { message: "Passwords do not match." });
        }
    } catch (error) {
        console.error("Error in postNewPassword:", error.message);
        res.render("reset-password", { message: "An error occurred. Please try again." });
    }
};


const userProfile = async (req, res) => {
  try {
    const userId = req.session.user;

    const userData = await User.findById(userId)
     await User.populate(userData, {
  path: 'walletHistory.productId',
  select: 'productName',
});

    if (!userData) {
      console.log("User not found");
      return res.redirect("/pageNotFound");
    }

    const addressData = await Address.findOne({ userId });

    const walletPage = parseInt(req.query.walletPage) || 1;
    const walletLimit = 5;
    const walletSkip = (walletPage - 1) * walletLimit;

    const orderPage = parseInt(req.query.orderPage) || 1;
    const orderLimit = 5;
    const orderSkip = (orderPage - 1) * orderLimit;

    const orders = await Order.find({ userId })
      .populate({
        path: 'items.productId',
        model: 'Product',
        select: 'productName regularPrice',
      })
      .sort({ createOn: -1 })
      .skip(orderSkip)
      .limit(orderLimit);

    const totalOrders = await Order.countDocuments({ userId });
    const totalOrderPages = Math.ceil(totalOrders / orderLimit);

    const history = userData.walletHistory || [];

    // Sort and paginate
    const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
    const paginatedHistory = sortedHistory.slice(walletSkip, walletSkip + walletLimit);
    const totalWalletPages = Math.ceil(history.length / walletLimit);

    res.render('profile', {
      user: { ...userData.toObject(), walletHistory: paginatedHistory },
      userAddress: addressData,
      orders,
      walletPagination: {
        walletPage,
        walletLimit,
        totalWalletTransactions: history.length,
        totalWalletPages,
      },
      orderPagination: {
        orderPage,
        orderLimit,
        totalOrders,
        totalOrderPages,
      },
    });

  } catch (error) {
    console.error("Error loading profile:", error.message);
    res.redirect("/pageNotFound");
  }
};



const changeEmail=async(req,res)=>{
    try {
       
        res.render("change-email")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const changeEmailValid=async(req,res)=>{
    try {
        const {email}=req.body;
        const userExists=await User.findOne({email})
        if(userExists){
            const otp=generateOtp();
            const emailSent=await sendVerificationEmail(email,otp);
            if(emailSent){
                req.session.userOtp=otp;
                req.session.userData=req.body;
                req.session.email=email;
                res.render("change-email-otp")
                console.log("Email sent:",email);
                console.log("OTP",otp)
            }else{
                res.json("email-error")
            }
        }else{
            res.render("change-email",{
                message:"User with this email not exist "
            })
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}
const  verifyEmailOtp=async(req,res)=>{
    try {
        const enteredOtp=req.body.otp
        if(enteredOtp===req.session.userOtp){
            req.sessionuserData=req.body.userData;
            req.render("new-email",{
                userData:req.session.userData,

            })
        }else{
            res.render("change-email.otp-",{
                message:"OTP not matching",
                userData:req.session.userData
            });
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const updateEmail=async(req,res)=>{
    try {
        const newEmail = req.body.newEmail;
        const userId=req.session.user;
        await User.findByIdAndUpdate(userId,{email:newEmail});
        return res.redirect("/userProfile")


    } catch (error) {
        res.redirect("/pageNotFound")
    }
}
const changePassword=async(req,res)=>{
    try {
       
        res.render("change-password")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const changePasswordValid = async (req, res) => {
    try {
        const { email } = req.body;

       
        const userExists = await User.findOne({ email });
        if (!userExists) {
            return res.status(STATUS_CODES.NOT_FOUND).json({
                success: false,
                message: "No user found with this email ",
            });
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);

        if (emailSent) {
            req.session.userOtp = otp;
            req.session.userData = req.body;
            req.session.email = email;
            console.log('OTP:', otp);

            return res.status(STATUS_CODES.OK).json({
                success: true,
                redirectUrl: '/change-password-otp',
            });
        } else {
            return res.status(STATUS_CODES.SERVER_ERROR).json({
                success: false,
                message: "Failed to send OTP. Please try again.",
            });
        }
    } catch (error) {
        console.error("Error in changePasswordValid:", error);
        return res.status(STATUS_CODES.SERVER_ERROR).json({
            success: false,
            message: "An error occurred. Please try again later.",
        });
    }
};


const changePassOtpPage = (req,res) =>{
    try {

        return res.render('change-password-otp')
        
    } catch (error) {
         console.log("Error in change passsword otp page",Error);
        res.redirect("/pageNotFound")
    }
}
const changeEmailOtpPage = (req,res) =>{
    try {

        return res.render('change-email-otp')
        
    } catch (error) {
         console.log("Error in change passsword otp page",Error);
        res.redirect("/pageNotFound")
    }
}


const verifychangePassOtp=async(req,res)=>{
    try {
        const enteredOtp=req.body.otp
        if(enteredOtp===req.session.userOtp){
            res.json({success:true,redirectUrl:"/reset-password"})
        }else{
            res.json({success:false,message:"Otp not matching"})
        }
    } catch (error) {
        res.status(STATUS_CODES.SERVER_ERROR).json({success:false,message:"An error occured. Please try again later"})
    }
}


const addAddress=async(req,res)=>{
    try{
        const user=req.session.user
        res.render("add-address",{user:user})
    }catch(error){
        res.redirect("/pageNotFound")
    }
}
const postAddAddress=async(req,res)=>{
    try{
 const userId = req.session.user;
    const userData = await User.findById(userId);
    const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;

    const userAddress = await Address.findOne({ userId: userData._id });
    if (!userAddress) {
      const newAddress = new Address({
        userId: userData._id,
        address: [{ addressType, name, city, landMark, state, pincode, phone, altPhone }],
      });
      await newAddress.save();
    } else {
      userAddress.address.push({ addressType, name, city, landMark, state, pincode, phone, altPhone });
      await userAddress.save();
    }
    res.redirect('/userProfile');
  } catch (error) {
    console.error('Error adding address:', error);
    res.redirect('/pageNotFound');
  }
}


const editAddress=async(req,res)=>{
    try{

        const addressId=req.query.id;
        const user=req.session.user;
        const currAddress= await Address.findOne({

            "address._id":addressId,

        })
        if(!currAddress){
            return res.redirect("/pageNotFound")
        }
        const addressData=currAddress.address.find((item)=>{
            return item._id.toString()===addressId.toString()
        })
        if(!addressData){
            return res.redirect("/pageNotFound")
        }
    res.render("edit-address",{address:addressData,user:user})



    }catch(error){
        console.error("Error in edit address",error)
        res.redirect("/pageNotFound")
    }
}

const postEditAddress=async(req,res)=>{
    try {
        const data=req.body;
        const addressId=req.query.id;
        const user=req.session.user;
        const findAddress=await Address.findOne({"address._id":addressId})
       if(!findAddress){
        res.redirect("/pageNotFound")
       }
       await Address.updateOne(
        {"address._id":addressId},
            {$set:{

            "address.$":{

                _id:addressId,
                addressType:data.addressType,
                name:data.name,
                city:data.city,
                landMark:data.landMark,
                state:data.state,
                pincode:data.pincode,
                phone:data.phone,
                altPhone:data.altPhone
            }


        }}
       )
    res.redirect("/userProfile")

    } catch (error) {
        console.error("Error in edit address",error)
        res.redirect("/pageNotFound")
    }
}



const deleteAddress=async(req,res)=>{
    try {
        const addressId=req.query.id;
        const findAddress=await Address.findOne({"address._id":addressId})
        if(!findAddress){
            return res.status(STATUS_CODES.NOT_FOUND).send("Address not found")
        }
        await Address.updateOne({
            
            "address._id":addressId
        },
     {
        $pull:{
            address:{
            _id:addressId,

        }

    }
}
)
res.redirect("/userProfile")

    } catch (error) {
       
  console.error("Error in delete address ",error)
  res.redirect("/pageNotFound")
}
}

const getOrderDetailsPage = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user;

    if (!userId) {
      return res.redirect('/login');
    }

    const order = await Order.findOne({ orderId, userId })
      .populate({
        path: 'items.productId',
        model: 'Product',
      })
      .populate({
        path: 'address',
        model: 'Address',
      });

    if (!order) {
      return res.status(STATUS_CODES.NOT_FOUND).render('not-found', { message: 'Order not found' });
    }

   

    let selectedAddress = null;
    if (order.address && order.selectedAddressId) {
      selectedAddress = order.address.address.find(
        (addr) => addr._id.toString() === order.selectedAddressId.toString()
      );
    }

    res.render('order-details', {
      order,
      user: userId,
      selectedAddress, 
    });
  } catch (error) {
    console.error('Error loading order details:', error.message, error.stack);
    res.status(STATUS_CODES.SERVER_ERROR).render('error', { message: 'Internal Server Error' });
  }
};





module.exports = {
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,//
    userProfile,
    changeEmail,
    changeEmailValid,
    verifyEmailOtp,
    updateEmail,
    changePassword,
    changePasswordValid,
    verifychangePassOtp,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
    deleteAddress,
    getOrderDetailsPage,
    changePassOtpPage,
    changeEmailOtpPage

};

