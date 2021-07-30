const express=require('express');
const router= express.Router();
const auth=require('../../middleware/auth');
const User=require('../../models/User');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const config = require('config');
const {check, validationResult}=require('express-validator');

const authLogger=require('../../logger/log');
//@route GET api/auth
//@desc Test route
//@access Public 
router.get('/', auth, async (req,res)=>{
    try {
        authLogger.info(`User ${req.user.id} required to get auth`);
        const user=await User.findById(req.user.id);
        authLogger.info(`Sent info to user ${req.user.id}`);
        res.json(user);
    } catch (error) {
        authLogger.error(`There some error while sending auth to user`);
        res.status(500).send('Server error!!');  
    }
});

//@route GET api/auth
//@desc authenicate user & get token
//@access Public 
router.post('/',[
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists(),
],
async (req,res)=>{

    const errors=validationResult(req);
    if(!errors.isEmpty()){
        return res.status(400).json({errors: errors.array()});
    }
    
    const {email, password}=req.body;
    authLogger.info(`User ${email} required to login`);

    try {
        let user=await User.findOne({ email });
        if(!user){
           return res.status(400).json({error: [{msg: 'Invalid credentials'}]});
        }

        const isMatch=await bcrypt.compare(password, user.password);
        if(!isMatch){
            return res.status(400).json({error: [{msg: 'Invalid credentials'}]});
        }
        //Return jsonwebtoken
        const payload ={
            user: {
                id: user.id
            }
        }
        jwt.sign(payload, config.get('jwtSecret'), {expiresIn: 360000}, 
        (err,token)=>{
            if(err) throw err;
            authLogger.info(`Sent webtoken to user ${email}`);
            res.json({token});
        });

    }catch(error){
        authLogger.error(`There some error with logging in: `+ error);
        res.status(500).send('Server error');
    }
});

module.exports=router;