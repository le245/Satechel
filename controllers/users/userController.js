const User = require("../../Models/userSchema");
const Category=require("../../Models/categorySchema")
const Product=require("../../Models/productSchema")
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
require("dotenv").config();
const util = require('util')

const pageNotFound = async (req, res) => {
    try {
        return res.render("page-404");
    } catch (error) {
        return res.redirect("/pageNotFound");
    }
};

const loadHomepage = async (req, res) => {

    try {
        const email = req.session.userEmail 
        const category=await Category.find({isListed:true})
        let productData=await Product.find()
        let userData;
        if(email){
             userData= await User.findOne({email:email})
            res.render("home",{user:userData})

        }else{
              return res.render('home',{user:userData})  
        }
        // console.log('user data',userData)
    } catch (error) {
        console.log("Home page not loading :",error)
        res.status(500).send('Server Error')
    }
};

const loadSignup = async (req, res) => {
    try {
        return res.render('signup', { error: null });
    } catch (error) {
        console.error('Signup page not loading:', error);
        return res.status(500).send('Server Error');
    }
};

const loadVerifyOtp = async (req, res) => {
    try {
        return res.render('verify-otp', { message: null });
    } catch (error) {
        console.error('OTP page not loading:', error);
        return res.status(500).send('Server Error');
    }
};

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        });

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP: ${otp}</b>`
        });

        return info.accepted.length > 0;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
}

const signup = async (req, res) => {
    try {
        console.log('Signup request body:', req.body);
        const { name, email, password, confirmPassword } = req.body;

        if (!name || !email || !password || !confirmPassword) {
            return res.json({ success: false, message: "All fields are required" });
        }

        if (password !== confirmPassword) {
            return res.json({ success: false, message: "Passwords do not match" });
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.json({ success: false, message: "User already exists" });
        }

        const otp = generateOtp();
        console.log("OTP Sent:", otp);
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.json({ success: false, message: "Error sending email. Try again later." });
        }

        req.session.userOtp = otp;
        req.session.userData = { name, email, password };

        
        setTimeout(() => {
            delete req.session.userOtp;
            console.log("OTP expired for:", email);
        }, 120000);

        return res.json({ success: true, message: "OTP sent successfully!", redirectUrl: "/verify-otp" });
    } catch (error) {
        console.error("Signup Error:", error);
        return res.json({ success: false, message: "Internal server error" });
    }
};

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        return passwordHash;
    } catch (error) {
        throw new Error('Error hashing password: ' + error.message);
    }
};

const verifyOtp = async (req, res) => {
    try {
        console.log('Verify OTP request body:', req.body);
        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({ success: false, message: 'OTP is required' });
        }

        if (otp !== req.session.userOtp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP, please try again' });
        }

        const userData = req.session.userData;
        if (!userData || !userData.name || !userData.email || !userData.password) {
            return res.status(400).json({ success: false, message: 'User data incomplete' });
        }

        const passwordHash = await securePassword(userData.password);
        const saveUserData = new User({
            name: userData.name,
            email: userData.email,
            password: passwordHash,
            wallet: 0,
            isAdmin: false
        });

        await saveUserData.save();
        req.session.user = saveUserData._id;
        req.session.userEmail = userData.email
        // req.session.userLogged = true
        delete req.session.userData;
        delete req.session.userOtp;

        return res.json({ success: true, redirectUrl: '/home' });
    } catch (error) {
        console.error('Error verifying OTP:', error.message);
        return res.status(500).json({ success: false, message: 'An error occurred: ' + error.message });
    }
};

const resendOtp = async (req, res) => {
    try {
        if (!req.session.userData || !req.session.userData.email) {
            return res.status(400).json({ success: false, message: 'Session expired, please sign up again' });
        }

        const newOtp = generateOtp();
        const emailSent = await sendVerificationEmail(req.session.userData.email, newOtp);
        if (!emailSent) {
            return res.json({ success: false, message: "Error sending email. Try again later." });
        }

        req.session.userOtp = newOtp;

        setTimeout(() => {
            delete req.session.userOtp;
            console.log("OTP expired for:", req.session.userData.email);
        }, 120000);

        console.log("New OTP sent:", newOtp);
        return res.json({ success: true, message: 'New OTP sent successfully!' });
    } catch (error) {
        console.error('Error resending OTP:', error.message);
        return res.status(500).json({ success: false, message: 'An error occurred' });
    }
};

const loadlogin=async (req,res)=>{
    try {
        if(!req.session.user){
            return res.render("login")
        }else{
            res.redirect("/home")
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const login = async (req, res) => {
    try {
       
        if (req.session.user) {
            return res.redirect("/home");
        }

        const { email, password } = req.body;

        if (!email || !password) {
            return res.render("login", { message: "Email and password are required" });
        }

        const findUser = await User.findOne({ isAdmin: 0, email: email });

        if (!findUser) {
            return res.render("login", { message: "User not found" });
        }

        if (findUser.isBlocked) {
            return res.render("login", { message: "User is blocked by admin" });
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);

        if (!passwordMatch) {
            return res.render("login", { message: "Incorrect password" });
        }

        req.session.user = findUser._id;
        req.session.userEmail = findUser.email
        return res.redirect("/home");
    } catch (error) {
        console.error("Login error:", error);
        return res.render("login", { message: "Login failed. Please try again later" });
    }
};

const logout=  async(req,res)=>{
    try {
        req.session.destroy((error)=>{
            if(error){
                
                console.log("Session destruction error",error.message);
                return res.redirect("/pageNotFound")
            }
            return res.redirect("/login")
        })
        
    } catch (error) {
        console.log("Logout error",error);
        res.redirect("/pageNotFound")
    }

}
const getShop = async(req,res)=>{
    try {
        const email = req.session.userEmail 
        
        if(!email){
       
            return res.redirect('/home')
        }
        // const category=await Category.find({isListed:true})   

        const products=await Product.find({isBlocked : false})
    .populate('category')
    .exec();
    
 
            let userData= await User.findOne({email:email})
            res.render("shop",{user:userData,products})

        
    } catch (error) {
        console.error('Error get shop:', error.message);
        return res.status(500).json({ success: false, message: 'An error occurred' });
    }
}

module.exports = {
    loadHomepage,
    pageNotFound,
    loadSignup,
    loadVerifyOtp,
    signup,
    verifyOtp,
    securePassword,
    resendOtp,
    loadlogin,
    login,
    logout,
    getShop
};