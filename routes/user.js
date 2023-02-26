const express=require('express')

const router=express.Router()

const {userModel}=require('../models/user')

router.post('/register', async(req, res)=>{
    // const newUser= new userModel()
    // newUser.email=req.body.email
    // newUser.password=req.body.password
    // await newUser.save()
    // console.log(newUser);
    // res.send(newUser)
})

module.exports=router