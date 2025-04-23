const express= require("express");
const router=express.Router();
const userController=require("../controllers/users/userController");

router.get("/pageNotFound",userController.pageNotFound)
router.get("/home",userController.loadHomepage)


module.exports=router;