const express=require('express');
const  Mongoose = require('mongoose');
const app=express();
const ejsMate = require('ejs-mate');
const User=require('./models/user');
const Blog=require('./models/blog')
const path = require('path');
const expressSanitizer=require("express-sanitizer");
const flash = require('connect-flash');
const session= require('express-session');
const passport= require('passport');
const LocalStrategy=require('passport-local');

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))
app.use(express.urlencoded({extended:true}));
var bodyParser=require("body-parser");
app.use(bodyParser.urlencoded({extended: true}));
app.use(expressSanitizer()); 
app.use(express.static("public"));
const {ObjectId} = require('mongodb');

const MongoDBStore = require("connect-mongo")(session);
// const dbUrl = 'mongodb://localhost/Blogeek';
const dbUrl = 'mongodb+srv://noobabhi:abhishek@cluster0.k4cdjwr.mongodb.net/?retryWrites=true&w=majority';
Mongoose.connect(dbUrl,{
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex:true })
    .then(() =>{
        console.log("mongo open")
    })
    .catch(err =>{
        console.log("Oh no! mongo connection error!!")
        console.log(err)
    })

const secret = process.env.SECRET || 'thisshouldbeabettersecret!';

const store = new MongoDBStore({
    url: dbUrl,
    secret,
    touchAfter: 24 * 60 * 60
});

store.on("error", function (e) {
    console.log("SESSION STORE ERROR", e)
})

const sessionConfig = {
    store,
    name: 'session',
    secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // secure: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}
app.use(session(sessionConfig));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

const ExpressError=class ExpressError extends Error {
    constructor(message, statusCode) {
        super();
        this.message = message;
        this.statusCode = statusCode;
    }
}

const catchAsync=func => {
    return (req, res, next) => {
        func(req, res, next).catch(next);
    }
}
app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
})

const getPagination = (page) => {
    const limit = 1;
    const offset = page ? page * limit : 0;
  
    return { limit, offset };
  };


app.get('/',(req,res) => {
    if(!req.isAuthenticated()){
        req.flash('error', 'login/Signup to create your own Blogs....');
        res.render('index');
    }else{
        res.render('index');
    }
})

app.get('/register', (req,res) => {
    res.render('register');
})

app.post('/register', catchAsync(async (req,res)=>{
    try{
        const {email,username,password} = req.body;
        const user= new User({email,username});
        const registeredUser= await User.register(user,password);
        // console.log(user.email);
        req.login(registeredUser,err=>{
            if(err) return next(err);
            
            req.flash('success','Welcome to BloGeeK');
            res.redirect('/');
        });
    }catch(e){
        req.flash('error','Something Wrong! Try again');
        res.redirect('/register');
    }
}));

app.get('/login', (req,res)=>{
    res.render('login');
})

app.post('/login', passport.authenticate('local',{failureFlash: true, failureRedirect:'/login'}), (req,res)=>{
    req.flash('success','welcome back!');
    res.redirect('/');
})

app.get('/changePassword', (req, res)=>{
    res.render("changePassword.ejs")
})

app.post('/changePassword', function (req, res) {
    if(req.body.newpassword != req.body.confirmpassword){
        req.flash('error', 'Password not confirmed, Try Again carefully....');
        res.redirect('/login')
    }
    else{
        User.findOne({ username: req.body.username }, function(err, user) {
            if(err || !user){
                req.flash('error', 'User might not be registered, Try Again....')
                res.redirect('/login')
            }
            else{
                user.setPassword( req.body.newpassword, function(err, users)  { 
                    User.updateOne({ _id: users._id },{ hash: users.hash, salt: users.salt }, (err,result) => {
                        if (err) {
                            req.flash('error', 'An error occurred, Try Again....')
                            res.redirect('/login')
                        } else {
                            req.flash('success', 'Password Changed Successfully....')
                            res.redirect('/login')
                        }
                    })
                }) 
            }})
    }
    
 });

app.get('/logout',(req,res)=>{
    req.logout();
    req.flash('success','GoodBye!')
    res.redirect('/');
})

app.get("/read",function(req,res){
    const page = parseInt(req.query.page);
    
    const { limit, offset } = getPagination(page);
    
    Blog.paginate({}, {offset, limit}, function(err, data){
        if(err){
            req.flash('error', "Some error occurred while retrieving tutorials.");
            res.redirect('/');
        }
        else{
            const pageData = {
                blogs: data.docs,
                totalPages: data.totalPages,
                currentPage: data.page - 1,
            }
            
            res.render("read.ejs", {PageData : pageData});
        }
    })
    

    // Blog.find({},function(err, Blog){
    //     if(err) console.log(err);
    //     else            
    //         res.render("read.ejs",{Blog: Blog});
    //     })   
})


app.get("/myBlogs",function(req,res){
    if(!req.isAuthenticated()){
        req.flash('error', 'login/Signup to create your own Blogs....');
    }
    const page = (req.query.page) ? parseInt(req.query.page) : 0;
    
    const { limit, offset } = getPagination(page);
    
    Blog.paginate({author: req.user.username}, {offset, limit}, function(err, data){
        if(err){
            req.flash('error', "Some error occurred while retrieving tutorials.");
            res.redirect('/');
        }
        else{
            const pageData = {
                blogs: data.docs,
                totalPages: data.totalPages,
                currentPage: data.page - 1,
            }
            
            res.render("myBlogs.ejs", {PageData : pageData});
        }
    }) 
})


app.get("/create",function(req,res){
    if(!req.isAuthenticated()){
        req.flash('error', 'login/Signup to create your own Blogs....');
    }
    res.render('createBlog');
    // Blog.find({author: req.currentUser},function(err,Blog){
    //     if(err) console.log(err);
    //     else            
    //         res.render("myBlogs.ejs",{Blog:Blog});
    //     })   
})

app.post("/create", function(req, res){
    Blog.create({
        title: req.body.title,
        author: req.user.username,
        body: req.body.body,
        image: {
            caption: req.body.caption,
            link: req.body.link
        }
    }
    , function(err, blog){
        if(err){
            console.log(err);
            req.flash('error', 'An error occurred');
            res.redirect('/')
        }
        else{
            req.flash('success', 'Blog created successfully');
            res.redirect("/view/" + blog._id);
        }
    })
})


app.get("/edit/:id", function(req, res){
    
    Blog.findOne({_id : req.params.id}, function(err, blog){
        if(err){
            console.log(err);
            req.flash('error', 'An error occurred');
            res.redirect('/view/' + req.params.id)
        }
        else{
            res.render("edit.ejs",{Blog:blog});
        }
    })

})

app.post("/edit/:id", function(req, res){
    
    const updatedBlog = { $set: {
        title: req.body.title,
        author: req.user.username,
        body: req.body.body,
        image:{
            caption: req.body.caption,
            link: req.body.link
        }
    }};
    const id = req.params.id;
    Blog.updateOne({_id: ObjectId(id.toString())}, updatedBlog, function(err, blog){
        if(err){
            console.log(err);
            req.flash('error', 'Unable to edit, try again');
        }
        else{
            req.flash('success', 'Blog edited successfully');
        }
    })
    
    res.redirect("/view/" + req.params.id);

})

app.get("/delete/:id", function(req, res){
    
    res.render("delete.ejs", {id : req.params.id});

})

app.post("/delete/:id", function(req, res){
    
    const id = req.params.id
    Blog.deleteOne({_id: ObjectId(id.toString())}, function(err, blog){
        if(err)
        {
            console.log(err);
            req.flash('error', 'Unable to delete, try again');
        }
        else{
            req.flash('success', 'Blog deleted successfully');
            res.redirect('/myBlogs')
        }
    })

})


app.get("/view/:id", function(req, res){
    backURL=req.header('Referer') || '/';
    
    Blog.findOne({_id : req.params.id}, function(err, blog){
        if(err){
            console.log(err);
            req.flash('error', 'An error occurred');
            res.redirect(backURL);
        }
        else{
            res.render("view.ejs",{Blog:blog});
        }
    })
})


app.use((err, req, res, next) => {
    const { statusCode = 500 } = err;
    if (!err.message) err.message = 'Oh No, Something Went Wrong!'
    res.status(statusCode).render('err', { err });
})

app.listen(process.env.PORT||5000,() =>{
     console.log("server has started");
 })