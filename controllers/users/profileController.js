const User = require("../../Models/userSchema");
const bcrypt=require("bcrypt")
const nodemailer = require("nodemailer");
require("dotenv").config();

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
        res.status(500).json({ success: false, message: "An error occurred. Please try again." });
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
        res.status(200).json({success:true,message:"Resnd OTP succesfull"})

       }
    } catch (error) {
        console.error("Error in resend otp",error)
        res.status(500).json({success:false,message:'Internal ServerError'})
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

module.exports = {
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword
};