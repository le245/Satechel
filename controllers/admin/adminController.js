const User = require("../../Models/userSchema");
const bcrypt = require("bcrypt");

const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect("/admin/dashboard");
    }
    res.render("adminlogin.ejs", { message: req.session.message || null });

    req.session.message = null;
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            req.session.message = "Email and password are required.";
            return res.redirect("/admin/login");
        }

        const admin = await User.findOne({ email, isAdmin: true });
        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                req.session.admin = admin._id; // Store admin ID for security
                return res.redirect("/admin/dashboard");
            } else {
                req.session.message = "Invalid password";
                return res.redirect("/admin/login");
            }
        } else {
            req.session.message = "Admin not found";
            return res.redirect("/admin/login");
        }
    } catch (error) {
        console.error("Login error:", error.message);
        req.session.message = "Server error during login";
        return res.redirect("/admin/login");
    }
};

const loadDashboard = async (req, res) => {
    if (req.session.admin) {
        try {
            res.render("dashboard");
        } catch (error) {
            console.error("Error rendering dashboard:", error.message);
            res.redirect("/pageerror");
        }
    } else {
        res.redirect("/admin/login");
    }
};

const pageerror = async (req, res) => {
    try {
        res.render("pageerror");
    } catch (error) {
        console.error("Error rendering pageerror:", error.message);

        res.status(500).send("Internal Server Error");
    }
};

const logout = async (req, res) => {
    try {
        req.session.destroy((error) => {
            if (error) {
                console.error("Error destroying session:", error.message);
                return res.redirect("/pageerror");
            }
            res.clearCookie("connect.sid"); 
            res.redirect("/admin/login");
        });
    } catch (error) {
        console.error("Unexpected error during logout:", error.message);
        res.redirect("/pageerror");
    }
};

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
};