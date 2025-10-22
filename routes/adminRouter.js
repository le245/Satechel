const express=require("express");
const router=express.Router(); 
const uploads=require("../Middleware/multer")
const adminController = require("../controllers/admin/adminController");
const customerController=require("../controllers/admin/customerController")
const categoryController=require("../controllers/admin/categoryController");
const productController=require("../controllers/admin/productController")
const orderController=require("../controllers/admin/orderController")
const couponController=require("../controllers/admin/couponController")
const offerController=require("../controllers/admin/offerController")
const {isAuthenticated,isLogin}=require("../Middleware/adminAuth")
const upload=require("../Middleware/multer")



router.get("/pageerror",adminController.pageerror);
router.get("/login",isLogin,adminController.loadLogin);
router.post("/login",isLogin,adminController.login);
router.get("/dashboard",isAuthenticated,adminController.loadDashboard)
router.get("/logout",adminController.logout);


router.get(
  '/dashboard/analytics',
  isAuthenticated,
  adminController.getAnalyticsData
);
router.get(
  '/dashboard/top-performers',
  isAuthenticated,
  adminController.getTopPerformers
);
router.get(
  '/sales-report',
  isAuthenticated,
  adminController.generateSalesReport
);
router.get(
  '/download/excel',
  isAuthenticated,
  adminController.downloadExcelReport
);
router.get('/download/pdf', isAuthenticated, adminController.downloadPDFReport);


router.get("/customers",isAuthenticated,customerController.customerInfo);
router.get("/blockCustomer",isAuthenticated,customerController.blockCustomer);
router.get("/unblockCustomer",isAuthenticated,customerController.unblockCustomer );

//category
router.get("/category",isAuthenticated,categoryController.categoryInfo);
router.post("/addCategory",isAuthenticated,categoryController.addCategory)
router.get("/listCategory",isAuthenticated,categoryController.listCategory);
router.get("/unlistCategory",isAuthenticated,categoryController.unlistCategory);
router.get("/editCategory",isAuthenticated,categoryController.getEditCategory)
router.post("/editCategory/:id",isAuthenticated,categoryController.editCategory)

//products
router.get("/addproducts",isAuthenticated,productController.getProductAddPage)
router.post("/addProducts",isAuthenticated,productController.addproducts)
router.get("/products",isAuthenticated,productController.getAllProducts);
router.get("/blockProduct",isAuthenticated,productController.blockProduct);
router.get("/unblockProduct",isAuthenticated,productController.unblockProduct);
router.get("/editProduct",isAuthenticated,productController.getEditProduct)
router.put("/editProduct/:id",isAuthenticated,productController.editProduct )

//orders 
router.get('/orders', isAuthenticated, orderController.getListOfOrders);
router.get('/orders/orderDetails/:orderId', isAuthenticated, orderController. getOrderDetailsPage);
router.post( '/updateOrderStatus/:orderId',isAuthenticated, orderController.updateStatus);
router.post('/approve-return', isAuthenticated, orderController.approveReturn);
router.post('/reject-return', isAuthenticated, orderController.rejectReturn);

//Coupon;
router.get('/Coupon',isAuthenticated,couponController.loadCoupon)
router.post('/Coupon',isAuthenticated,couponController.createCoupon)
router.put('/Coupon/:couponId',isAuthenticated,couponController.editCoupon)
router.delete('/Coupon/:couponId',isAuthenticated,couponController.deleteCoupon)


//offer
router.get('/offer',isAuthenticated,offerController.loadOffer);
router.get('/offer-list', isAuthenticated, offerController.offerList);
router.post('/offer',isAuthenticated,offerController.addoffer);
router.put('/offer-update/:offerId',isAuthenticated,offerController.updateOffer);
router.delete('/offer-remove/:offerId',isAuthenticated,offerController.removeOffer)

module.exports=router;
