const User = require("../../Models/userSchema");

const customerInfo = async (req, res) => {
    try {
        let search = "";
        if (req.query.search) {
            search = req.query.search;
        }

        let page = 1;
        if (req.query.page) {
            page = parseInt(req.query.page, 10);
        }
        const limit = 5;

        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        })
        .sort({ createdAt: -1 }) 
        .limit(limit)
        .skip((page - 1) * limit)
        .exec();

        const count = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        }).countDocuments();

        const totalPages = Math.ceil(count / limit);

        res.render('customers', {
            userData,
            totalPages,
            currentPage: page,
            search
        });
    } catch (error) {
   
        res.redirect("/admin/pageerror");
    }
};

const blockCustomer = async (req, res) => {
    try {
        const userId = req.query.id;
        await User.updateOne({ _id: userId }, { isBlocked: true });
        res.redirect("/admin/customers");
    } catch (error) {
       
        res.redirect("/admin/pageerror");
    }
};


const unblockCustomer = async (req, res) => {
    try {
        const userId = req.query.id;
        await User.updateOne({ _id: userId }, { isBlocked: false });
        res.redirect("/admin/customers");
    } catch (error) {
       
        res.redirect("/admin/pageerror");
    }
};



module.exports = {
    customerInfo,
    blockCustomer,
    unblockCustomer,
    
   
};




