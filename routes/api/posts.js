const express=require('express');
const router= express.Router();
const {check, validationResult} = require('express-validator');
const auth=require('../../middleware/auth');

const Post= require('../../models/Post');
const Profile=require('../../models/Profile');
const User=require('../../models/User');

const postLogger=require('../../logger/log');

//@route POST api/posts
//@desc Create a post
//@access Private
router.post('/', [auth, [
    check('text', 'Text is required').not().isEmpty()]],
    async (req,res)=>{
        postLogger.info(`User ${req.user.id} required to post`);
        const errors=validationResult(req);
        if(!errors.isEmpty()){
            errors.array().map(error=>postLogger.error(error.msg));
            return res.status(400).json({errors: errors.array()});
        }
        try {
            const user=await User.findById(req.user.id).select('-password');
            const newPost= new Post({
                text: req.body.text,
                name: user.name,
                avatar: user.avatar,
                user: req.user.id
            });
            const post = await newPost.save();
            postLogger.info(`Created post for user ${req.user.id}`);
            res.json(post);
        } catch (error) {
            postLogger.error(`There some errors while posting posts: ` + error);
            res.status(500).send('Server error');
        } 
    }
);

//@route GET api/posts
//@desc Get all posts
//@access Private

router.get('/', auth, async (req, res)=>{
    try {
        postLogger.info(`User ${req.user.id} required to get all posts`);
        const posts=await Post.find().sort({ date: -1 }); //sort the most recent post
        res.json(posts);
        postLogger.info(`Sent all posts to user ${req.user.id}`);
    } catch (error) {
        postLogger.error(`There some errors while sending all posts: ` + error);
        res.status(500).send('Server error');
    }
});

//@route GET api/posts/:id
//@desc Get posts by id
//@access Private

router.get('/:id', auth, async (req, res)=>{
    try {
        postLogger.info(`User ${req.user.id} required to get post by id ${req.params.id}`);
        const post=await Post.findById(req.params.id);
        if(!post){
            return res.status(404).json({msg: 'Post not found'});
        }
        res.json(post);
        postLogger.info(`Sent post has id ${req.params.id} to user ${req.user.id}`);
    } catch (error) {
        postLogger.error(`There some errors while sending post with id` + error);
        if(error.kind==='ObjectId'){
            return res.status(404).json({msg: 'Post not found'});
        }
        res.status(500).send('Server error');
    }
});

//@route Delete api/post/:id
//@desc Delete post
//@access Private

router.delete('/:id', auth, async (req, res)=>{
    try {
        postLogger.info(`User ${req.user.id} required to delete post with id ${req.params.id}`);
        const post=await Post.findById(req.params.id);

        if(!post){
            return res.status(404).json({msg: 'Post not found'});
        }

        //Check if user is matched
        if(post.user.toString() !== req.user.id){
            return res.status(401).json({msg: 'User not authrized'});
        }

        await post.remove();
        postLogger.info(`Deleted post ${req.params.id} of user ${req.user.id}`);
        res.json({msg: 'Removed'});
    } catch (error) {
        postLogger.error(`There some errors while sending post with id` + error);
        res.status(500).send('Server error');
    }
});

//@route Put  api/post/like/id
//@desc Add like
//@access Private

router.put('/like/:id', auth, async (req, res)=>{
    try {
        postLogger.info(`User ${req.user.id} required to like post ${req.params.id}`);
        const post= await Post.findById(req.params.id);

        //Check if the post has already liked by this user
        if(post.likes.filter(like=>like.user.toString()===req.user.id).length> 0){
            return res.status(400).json({msg: 'Post already liked'});
        }
        post.likes.unshift({user: req.user.id});
        await post.save();
        postLogger.info(`Added like from ${req.user.id} to post ${req.params.id}`);
        res.json(post.likes);
    } catch (error) {
        postLogger.error(`There some errors while liking` + error);
        res.status(500).send('Server error')
    }
});


//@route Put  api/post/unlike/id
//@desc Add like
//@access Private

router.put('/unlike/:id', auth, async (req, res)=>{
    try {
        postLogger.info(`User ${req.user.id} required to unlike post ${req.params.id}`);
        const post= await Post.findById(req.params.id);

        //Check if the post has already liked by this user
        if(post.likes.filter(like=>like.user.toString()===req.user.id).length === 0){
            return res.status(400).json({msg: 'Post has not yet been liked'});
        }
        //Get remove index
        const removeIndex=post.likes.map(like=>like.user.toString()).indexOf(req.user.id);
        post.likes.splice(removeIndex, 1);
        
        await post.save();
        postLogger.info(`Removed like from ${req.user.id} to post ${req.params.id}`);

        res.json(post.likes);
    } catch (error) {
        postLogger.error(`There some errors while unliking` + error);
        res.status(500).send('Server error')
    }
});


//@route POST api/posts/comment/:id
//@desc Comment on a post
//@access Private
router.post('/comment/:id', [auth, [
    check('text', 'Text is required').not().isEmpty()]], async (req,res)=>{
        postLogger.info(`User ${req.user.id} required to comment post ${req.params.id}`);
        const errors=validationResult(req);
        if(!errors.isEmpty()){
            errors.array().map(error=>postLogger.error(error.msg));
            return res.status(400).json({errors: errors.array()});
        }
        try {
            const user=await User.findById(req.user.id).select('-password');
            const post=await Post.findById(req.params.id);

            const newComment= {
                text: req.body.text,
                name: user.name,
                avatar: user.avatar,
                user: req.user.id
            };

            post.comments.unshift(newComment);
            await post.save();

            postLogger.info(`Added comment from ${req.user.id} to post ${req.params.id}`);

            res.json(post);
        } catch (error) {
            postLogger.error(`There some errors while commenting` + error);

            res.status(500).send('Server error');
        }
        
    });

//@route DELETE api/posts/comment/:id/:comment_id
//@desc Delete comment
//@access Private

router.delete('/comment/:id/:comment_id', auth, async (req,res)=>{
    try {
        postLogger.info(`User ${req.user.id} required to delete comment ${req.params.id} on post ${req.params.comment_id}`);

        const post=await Post.findById(req.params.id);

        const comment=post.comments.find(comment=>comment.id===req.params.comment_id);
        
        if(!comment){
            return res.status(404).json({msg: 'Comment does not exist'});
        }
        if(comment.user.toString()!==req.user.id){
            return res.status(401).json({msg: 'User not authorized'});
        }
        const removeIndex=post.comments.map(comment=>comment.user.toString()).indexOf(req.user.id);
        post.comments.splice(removeIndex, 1);
        
        await post.save();
        postLogger.info(`Deleted comment from ${req.user.id} to post ${req.params.id}`);

        res.json(post.comments);

    } catch (error) {
        postLogger.error(`There some errors while deleting comment` + error);
        res.status(500).send('Server error');
    }
})

module.exports=router;