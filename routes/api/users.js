const express=require('express');
const router= express.Router();
const gravatar=require('gravatar');
const bcrypt=require('bcryptjs');
const {check, validationResult}=require('express-validator');
const jwt=require('jsonwebtoken');
const User=require('../../models/User');
const config = require('config');

const userLog=require('../../logger/log.js');

//@route GET api/users
//@desc Register user
//@access Public
router.post('/',[
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({min:6}),
],
async (req,res)=>{
    const errors=validationResult(req);
    if(!errors.isEmpty()){
        return res.status(400).json({errors: errors.array()});
    }
    
    const {name, email, password}=req.body;

    try {
        //see if user exists
        let user=await User.findOne({ email });
        if(user) {
            userLog.error(`User ${email} already exists`);
            return res.status(400).json({error: [{msg: 'User already exists'}]});
        }

        //Get user gravatar
        const avatar=gravatar.url(email, {
            s:'200',
            r: 'pg',
            d: 'mm'
        })
        user =new User({
            name,
            email,
            avatar,
            password
        });

        //Encrypt password
        const salt=await bcrypt.genSalt(10);
        user.password=await bcrypt.hash(password, salt);

        //Save user to db
        await user.save();
        userLog.info(`User ${email} created!`);

        //Return jsonwebtoken
        const payload ={
            user: {
                id: user.id
            }
        }
        jwt.sign(payload, config.get('jwtSecret'), {expiresIn: 3600}, 
        (err,token)=>{
            if(err){
                userLog.error(err.message);
                throw err;
            }
            res.json({token});
            userLog.info(`Token created for user ${email}`);
        });

    }catch(error){
        userLog.error(`Server error while registering user: ${error}`);
        res.status(500).send('Server error');
    }
});

module.exports=router;