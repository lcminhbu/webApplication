const express=require('express');
const router= express.Router();
const auth=require('../../middleware/auth');
const {check, validationResult}=require('express-validator');
const request=require('request');
const config=require('config');


const Profile=require('../../models/Profile');
const User =require('../../models/User');
const profileLogger=require('../../logger/log');
const { profile } = require('winston');

//@route GET api/profile/me
//@desc Get current user profile
//@access Private
router.get('/me', auth, async (req,res)=>{
    try {
        profileLogger.info(`User_id ${req.user.id} required profile`);
        const profile= await Profile.findOne({user: req.user.id}).populate('user', ['name', 'avatar']);

        if(!profile){
            profileLogger.info(`Sent non-profile response to user ${req.user.id}`);
            res.status(400).json({msg:'There is no profile for this user'});
        }
        profileLogger.info(`Sent self-profile to user ${req.user.id}`);
        res.json(profile);
    } catch (error) {
        profileLogger.error(`Error while sending self-profile` + error.message);
        res.status(500).send('Server error');
    }
});

//@route POST api/profile
//@desc Create or update user profile
//@access Private

router.post('/', [auth, [check('status', 'Status is required').not().isEmpty(),
 check('skills', 'Skills is required').not().isEmpty()]], async (req,res)=>{
    profileLogger.info(`User_id ${req.user.id} required create profile`);
    const errors=validationResult(req);
    if(!errors.isEmpty()){
        errors.array().map(error=>profileLogger(error.msg));
        res.status(400).json({errors: errors.array()});
    }
    const {
        company,
        website,
        location,
        bio,
        status,
        githubusername,
        skills,
        youtube,
        facebook,
        twitter,
        instagram,
        linkedin
                // spread the rest of the fields we don't need to check
      } = req.body;
    //Build profile object
    const profileFields={};
    profileFields.user=req.user.id;
    if(company) profileFields.company=company;
    if(website) profileFields.website=website;
    if(location) profileFields.location=location;
    if(bio) profileFields.bio=bio;
    if(status) profileFields.status=status;
    if(githubusername) profileFields.githubusername=githubusername;
    if(skills) {profileFields.skills=skills.split(',').map(skills=>skills.trim())};

    //build social object
    profileFields.social={};
    if(youtube) profileFields.social.youtube=youtube;
    if(twitter) profileFields.social.twitter=twitter;
    if(facebook) profileFields.social.facebook=facebook;
    if(linkedin) profileFields.social.linkedin=linkedin;
    if(instagram) profileFields.social.instagram=instagram;

    try {
        let profile= await Profile.findOne({user: req.user.id});
        if(profile){
            //update
            profile=await Profile.findOneAndUpdate({user: req.user.id},
                {$set: profileFields},
                {new: true});
            profileLogger.info(`Updated info for user ${req.user.id}`)
            return res.json(profile);
        }
        //create
        profile=new Profile(profileFields);
        await profile.save();
        profileLogger.info(`Created info for user ${req.user.id}`)

        res.json(profile);
    } catch (error) {
        profileLogger.error(`There some errors while creating profile `+error.message);
        res.status(500).send('Server error');
    }
})

//@route POST api/profile
//@desc Get all profile
//@access Public

router.get('/', async (req,res)=>{
    try {
        profileLogger.info(`Required to get all profiles`);
        const profiles = await Profile.find().populate('user', ['name', 'avatar']);
        profileLogger.info(`Sent all profile to user`);

        res.json(profiles);
    } catch (error) {
        profileLogger.error(`There some errors while sending all profiles: `+error);
        res.status(500).send('Server error');
    }
})

//@route POST api/profile by user id
//@desc Get profile by user id
//@access Public 

router.get('/user/:user_id', async (req,res)=>{
    try {
        profileLogger.info(`Required to get user ${req.params.user_id}'s profile`);
        const profile = await Profile.findOne({user: req.params.user_id}).populate('user', ['name', 'avatar']);
        if(!profile) return res.status(400).json({msg: 'There is no profile for this user'});
        profileLogger.info(`Sent ${req.params.user_id}'s profile`);

        res.json(profile);
    } catch (error) {
        profileLogger.error(`There some errors while sending user profile by id: `+ error);
        if(error.kind=='ObjectId'){
            return res.status(400).json({msg: 'Profile not found'});
        }
        res.status(500).send('Server error');
    }
})

//@route DELETE api/profile
//@desc Delete profile, user and posts 
//@access Private

router.delete('/', auth, async (req,res)=>{
    try {
        //Remove user posts 

        //Remove profile
        profileLogger.info(`User ${req.user.id} required to delete profile`);

        await Profile.findOneAndRemove({user: req.user.id});

        //Remove user
        await User.findOneAndRemove({_id: req.user.id});
        profileLogger.info(`User ${req.user.id} and profile deleted`);
        res.send('User deleted');
    } catch (error) {
        profileLogger.error(`There some errors while deleting ${req.user.id} profile: ` + error);
        res.status(500).send('Server error');
    }
})

//@route PUT api/profile/experience
//@desc add profile experience
//@access Private
router.put('/experience', [auth, check('title', 'Title is required').not().isEmpty(),
check('company', 'Company is required').not().isEmpty(),
check('from', 'From date is required').not().isEmpty()],async (req,res)=>{
    profileLogger.info(`User ${req.user.id} required to add experience`);
    const errors=validationResult(req);
    if(!errors.isEmpty()){
        errors.array().map(error=>profileLogger(error.msg));
        return res.status(400).json({errors: errors.array});
    }
    const {
        title,company, location, from, to, current, description}=req.body;
    const newExp={
        title,company, location, from, to, current, description
    }
    try {
        const profile=await Profile.findOne({user: req.user.id});
        profile.experience.unshift(newExp);
        await profile.save();
        profileLogger.info(`Saved experience for user ${req.user.id}`)
        res.json(profile);
    } catch (error) {
        profileLogger.error('There some error while updating experience: ' + error);
        res.status(500).send('Server error');
    }
})

//@route DELETE api/profile/experience/exp_id
//@desc Delete experience from profile
//@access Private
router.delete('/experience/:exp_id', auth, async (req, res)=>{
    try {
        profileLogger.info(`User ${req.user.id} required to delete experience ${req.params.exp_id}`);
        const profile=await Profile.findOne({user: req.user.id});
        //Get remove index
        const removeIndex=profile.experience.map(item=>item.id).indexOf(req.params.exp_id);
        profile.experience.splice(removeIndex, 1);
        await profile.save();
        profileLogger.info(`User ${req.user.id} deleted experience ${req.params.exp_id}`);

        res.json(profile);
    } catch (error) {
        profileLogger.error('There some error while deleting user experience: '+ error.message);
        res.status(500).send('Server error');
    }
})

//@route PUT api/profile/education
//@desc add profile education
//@access Private
router.put('/education', [auth, check('school', 'School is required').not().isEmpty(),
check('degree', 'Degree is required').not().isEmpty(),
check('fieldofstudy', 'Field of study is required').not().isEmpty(),
check('from', 'From date is required').not().isEmpty()],async (req,res)=>{

    profileLogger.info(`User ${req.user.id} required to add education`);

    const errors=validationResult(req);
    if(!errors.isEmpty()){
        errors.array().map(error=>profileLogger.error(error.msg));
        return res.status(400).json({errors: errors.array});
    }
    const {
        school, degree, fieldofstudy, from, to, current, description}=req.body;
    const newEdu={
        school, degree, fieldofstudy, from, to, current, description
    }
    try {
        const profile=await Profile.findOne({user: req.user.id});
        profile.education.unshift(newEdu);
        await profile.save();

        profileLogger.info(`Saved education for user ${req.user.id}`)

        res.json(profile);
    } catch (error) {
        profileLogger.error('There some error while adding user education: '+ error);
        res.status(500).send('Server error');
    }
})

//@route DELETE api/profile/education/edu_id
//@desc Delete education from profile
//@access Private

router.delete('/education/:edu_id', auth, async (req, res)=>{
    try {
        profileLogger.info(`User ${req.user.id} required to delete experience ${req.params.edu_id}`);

        const profile=await Profile.findOne({user: req.user.id});
        //Get remove index
        const removeIndex=profile.education.map(item=>item.id).indexOf(req.params.edu_id);
        profile.education.splice(removeIndex, 1);
        await profile.save();
        profileLogger.info(`User ${req.user.id} deleted education ${req.params.exp_id}`);

        res.json(profile);
    } catch (error) {
        profileLogger.error('There some error while deleting user education: '+ error);
        res.status(500).send('Server error');
    }
})

//@route GET api/profile/github/:username
//@desc Get user repos from github
//@access Public
router.get('/github/:username', (req, res)=>{
    try {
        profileLogger.info(`User ${req.user.id} required to get github repository`);
        const option={
            uri: `https://api.github.com/users/${req.params.username}/repos?per_page=5&sort=created:asc&client_id=${config.get('githubClientId')}&
            client_secret=${config.get('githubSecret')}`,
            method: 'GET',
            headers: {'user-agent': 'mode.js'}
        };

        request(option, (error, response, body)=>{
            if(error) profileLogger.error('There error while getting info from github' + error);
            if(response.statusCode !== 200) {
                return res.status(404).json({msg: 'No github profile found'});
            }
            res.json(JSON.parse(body));
            profileLogger.info(`Responsed github repository to user ${req.user.id}`);
        })
    } catch (error) {
        profileLogger.error('There some error while responsing github repository: '+ error);
        res.status(500).send('Server error');
    }
})

module.exports=router;