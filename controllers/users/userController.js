const User = require("../../Models/userSchema");
const Category=require("../../Models/categorySchema")
const Product=require("../../Models/productSchema")
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
require("dotenv").config();
const util = require('util')
const STATUS_CODES= require("../../Models/status")


const pageNotFound = async (req, res) => {
    try {
        return res.render("page-404");
    } catch (error) {
        return res.redirect("/pageNotFound");
    }
};

const loadHomepage = async (req, res) => {

    try {
        const user = req.session.user
        
        const email = req.session.userEmail 

       
        const userData=await User.findOne({_id:user , isBlocked:false})
       
        return res.render('home',{user:userData})
      
    } catch (error) {
     
        res.status(STATUS_CODES.BAD_REQUEST).send('Server Error')
    }
};

const loadSignup = async (req, res) => {
    try {
        return res.render('signup');
    } catch (error) {
        
        return res.status(STATUS_CODES.SERVER_ERROR).send('Server Error');
    }
};

const loadVerifyOtp = async (req, res) => {
    try {
        return res.render('verify-otp', { message: null });
    } catch (error) {
        console.error('OTP page not loading:', error);
        return res.status(STATUS_CODES.SERVER_ERROR).send('Server Error');
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
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'OTP is required' });
        }

        if (otp !== req.session.userOtp) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Invalid OTP, please try again' });
        }

        const userData = req.session.userData;
        if (!userData || !userData.name || !userData.email || !userData.password) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'User data incomplete' });
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

        delete req.session.userOtp;

        return res.json({ success: true, redirectUrl: '/home' });
    } catch (error) {
        console.error('Error verifying OTP:', error.message);
        return res.status(STATUS_CODES.SERVER_ERROR).json({ success: false, message: 'An error occurred: ' + error.message });
    }
};

const resendOtp = async (req, res) => {
    try {
        if (!req.session.userData || !req.session.userData.email) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Session expired, please sign up again' });
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
        return res.status(STATUS_CODES.SERVER_ERROR).json({ success: false, message: 'An error occurred' });
    }
};

const loadlogin=async (req,res)=>{
    try {
      
     return res.render("login")

    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const login = async (req, res) => {
    try {
       
        const { email, password } = req.body;

        if (!email || !password) {
            return res.render("login", { message: "Email and password are required" });
        }

        const findUser = await User.findOne({email: email });


        if (!findUser) {
            return res.render("login", { message: "User not found" });
        }

        if (findUser.isBlocked) {
            return res.render("blocked", { message: "User is blocked by admin" });
        }
        if(!findUser.password){
            return res.render("login",{message:"Password not found for this user"})
        }

        const passwordMatch = await bcrypt.compare(password,findUser.password);

        if (!passwordMatch) {
            return res.render("login", { message: "Incorrect password" });
        }

        req.session.user = findUser._id;
        req.session.userEmail = findUser.email
        return res.redirect("/home");
    } catch (error) {
        console.error("Login error:", error);
      
    }
};


const logout=  async(req,res)=>{
    try {


       if(req.session.userEmail){
        delete req.session.user
        delete req.session.userEmail
       }
       return res.redirect('/login')
        
    } catch (error) {
        console.log("Logout error",error);
        res.redirect("/pageNotFound")
    }
}
const getShop = async (req, res) => {
    try {
        const email = req.session.userEmail;
       
        if (!email) {
            return res.redirect('/home');
        }

        const userData = await User.findOne({ email, isBlocked: false }).lean();
        if (!userData) {
            return res.redirect('/home');
        }

        const categories = await Category.find({ isListed: true }).lean();

        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        const searchQuery = req.query.search || ''; 
        const sortBy = req.query.sort || 'default'; 
        const categoryFilter = req.query.category || '';
        const minPrice = parseFloat(req.query.minPrice) || 0;
        const maxPrice = parseFloat(req.query.maxPrice) || Infinity;

        let query = { isBlocked: false };

        if (searchQuery) {
            query.productName = { $regex: searchQuery, $options: 'i' };
        }

        if (categoryFilter) {
            query.category = categoryFilter;
        }

        if (minPrice || maxPrice !== Infinity) {
            query.regularPrice = { $gte: minPrice, $lte: maxPrice };
        }

        let sortOption = {};
        switch (sortBy) {
            case 'price-low-to-high':
                sortOption = { regularPrice: 1 };
                break;
            case 'price-high-to-low':
                sortOption = { regularPrice: -1 };
                break;
            case 'aA-zZ':
                sortOption = { productName: 1 };
                break;
            case 'zZ-aA':
                sortOption = { productName: -1 };
                break;
            default:
                sortOption = { createdAt: -1 }; 
        }

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await Product.find(query)
            .populate('category')
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean();

        res.render("shop", {
            user: userData,
            products,
            categories, 
            currentPage: page,
            totalPages,
            searchQuery, 
            sortBy, 
            categoryFilter,
            minPrice,
            maxPrice, 
        });
    } catch (error) {
        console.error('Error in getShop', error.message);
        return res.status(STATUS_CODES.SERVER_ERROR).render("pageerror", { message: "An error occurred while loading the shop page." });
    }
};


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

