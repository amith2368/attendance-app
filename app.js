require('dotenv').config();
const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");


/////////////////////////////////EXPRESS/////////////////////////////////////////////
//Express Configs for content and styling properties
const app = express();
app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(express.urlencoded({extended: true}));

///////////////////////////EXPRESS SESSIONS AND PASSPORT INITALS////////////////////////
app.use(session({
    secret: "Our little secret",
    resave: false,
    saveUninitialized: false,

}));

app.use(passport.initialize());
app.use(passport.session());

///////////////////////////MONGOOSE DATABASE SETTINGS//////////////////////////////////

mongoose.connect("mongodb+srv://admin-amith:muscat555@cluster0.l2802.mongodb.net/attendanceDB", {useNewUrlParser: true, useUnifiedTopology: true});

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    googleId: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);
// const user = new User({
//     email: "Bruh",
//     password: "12345"
// });
// user.save();

// CHANGE: USE "createStrategy" INSTEAD OF "authenticate"
passport.use(User.createStrategy());

// use static serialize and deserialize of model for passport session support
passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/attendance"
  },
  function(accessToken, refreshToken, profile, cb) {
      console.log(profile.displayName);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
        user['username'] = profile.displayName;
        user.save();
        console.log(user);
        return cb(err, user);
    });
  }
));


//////////////////////////////////APP ROUTES/////////////////////////////////////////

app.get("/", function(req, res){
    res.render("home");
});


app.get("/dashboard", function(req, res) {
    if (req.isAuthenticated()) {
        res.render("dashboard", {user: req.user});
    } else {
        res.redirect("/");
    }
});

app.get("/auth/google", 
    passport.authenticate("google", {scope: ["profile"] })
);

app.get('/auth/google/attendance', 
  passport.authenticate('google', { failureRedirect: '/home' }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/dashboard");
  });


app.post("/register", function(req, res) {
    User.register({username: req.body.username}, req.body.password, function(err, user){
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function(){
                res.redirect("/dashboard");
            });
        }
    });

});


app.post("/login", function (req, res) {
    const user = new User({
        username: req.body.username,
        email: req.body.email,
        password: req.body.password
    });

    req.login(user, function(err){
        if (err) {
            console.login(err)
        } else {
            passport.authenticate("local")(req, res, function(){
                res.redirect("/dashboard");
            });
        }
    });
});

app.get("/register", function(req, res) {
    res.render("register");
}); 

app.get("/logout", function(req, res) {
    console.log("logged Out");
    req.logout();
    res.redirect("/");
});


app.listen(process.env.PORT || 3000, function(){
    console.log("The App has started running successfully");
});
