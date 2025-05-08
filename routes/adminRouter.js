const express=require("express");
const router=express.Router(); 
const uploads=require("../Middleware/multer")
const adminController = require("../controllers/admin/adminController");
const customerController=require("../controllers/admin/customerController")
const categoryController=require("../controllers/admin/categoryController");
const productController=require("../controllers/admin/productController")
const {userAuth,adminAuth}=require("../Middleware/auth")
const upload=require("../Middleware/multer")



router.get("/pageerror",adminController.pageerror);
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/dashboard",adminAuth,adminController.loadDashboard)
router.get("/logout",adminController.logout);


router.get("/customers",adminAuth,customerController.customerInfo);
router.get("/blockCustomer",adminAuth,customerController.blockCustomer);
router.get("/unblockCustomer",adminAuth,customerController.unblockCustomer );

//category
router.get("/category",adminAuth,categoryController.categoryInfo);
router.post("/addCategory",adminAuth,categoryController.addCategory)
router.get("/listCategory",adminAuth,categoryController.getListCategory);
router.get("/unlistCategory",adminAuth,categoryController.getUnlistCategory);
router.get("/editCategory",adminAuth,categoryController.getEditCategory)
router.post("/editCategory/:id",adminAuth,categoryController.editCategory)

//products
router.get("/addproducts",adminAuth,productController.getProductAddPage)
router.post("/addProducts",adminAuth,productController.addproducts)
router.get("/products",adminAuth,productController.getAllProducts);
router.get("/blockProduct",adminAuth,productController.blockProduct);
router.get("/unblockProduct",adminAuth,productController.unblockProduct);
router.get("/editProduct",adminAuth,productController.getEditProduct)
router.put("/editProduct/:id",adminAuth,productController.editProduct )



module.exports=router;
