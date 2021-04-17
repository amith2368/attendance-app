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
    googleId: String,
    role: String,
    batch: String,
});

const attendanceSchema = new mongoose.Schema({
    batch: String,
    course: String,
    deadline: String,
    postedBy: String,
    attendedBy: [String],
    attendedNo: Number
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);
const Attendance = mongoose.model("Attendance", attendanceSchema);


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
    callbackURL: "http://" + process.env.HOST + "/auth/google/attendance"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile.displayName);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
        user['username'] = profile.displayName;
        if (user['role'] === "student") {
            user['role'] = "student";
        }
        // if (user['batch'] === null) {
        //     user['batch'] = "null";
        // } 
        user.save();
        console.log(user);
        return cb(err, user);
    });
  }
));


//////////////////////////////////APP ROUTES/////////////////////////////////////////

app.get("/", function(req, res){
    res.render("home", {error: false});
});

app.get("/errlogin", function(req, res) {
    res.render("home", {error: true})
});

app.get("/dashboard", function(req, res) {
    if (req.isAuthenticated()) {
        console.log("Logged in");
        if (req.user.role === "teacher") {
            Attendance.find({postedBy: req.user.username }, function(err, found){
                console.log(found);
                let todayDeadline = found.filter(item => {
                    let n = item.deadline;
                    let res = n.split(/ |-|:/);
                    let dd = new Date(res[0],res[1] - 1, res[2], res[3], res[4]);
                    let current = new Date() 
                    return current < dd;
                })
                res.render("dashboard", {user: req.user, attendance: found }); 
            });
        } else if (req.user.role === "student" && req.user.batch) {
            Attendance.find({batch: req.user.batch }, function(err, found){
                console.log(req.user);
                console.log(found);
                let todayDeadline = found.filter(item => {
                    let n = item.deadline;
                    let res = n.split(/ |-|:/);
                    let dd = new Date(res[0],res[1] - 1, res[2], res[3], res[4]);
                    let current = new Date() 
                    return current < dd;
                });

                let expiredDeadline = found.filter(item => {
                    let n = item.deadline;
                    let res = n.split(/ |-|:/);
                    let dd = new Date(res[0],res[1] - 1, res[2], res[3], res[4]);
                    let current = new Date() 
                    return current > dd;
                });

                console.log(todayDeadline);
                res.render("dashboard", {user: req.user, attendance: todayDeadline, expired: expiredDeadline }); 
            });    
        } else {
            res.render("dashboard", {user: req.user });
        }
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
    console.log(req.body);
    User.register({username: req.body.username}, req.body.password, function(err, user){
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            user['email'] = req.body.email;
            user['role'] = "student";
            user['batch'] = req.body.batch;
            user.save();
            console.log(user);
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
        password: req.body.password,
    });

    req.login(user, function(err){
        if (err) {
            console.login(err)
        } else {
            passport.authenticate("local", {failureRedirect: "/errlogin"})(req, res, function(){
                res.redirect("/dashboard");
            });
        }
    });
});

app.get("/submit", function(req, res) {
    if (req.isAuthenticated()) {
        res.render("submit",  {user: req.user, details: false});
    } else {
        res.redirect("/");
    }
});

app.post("/googleEdit", function(req, res) {
    User.findOne({username: req.user.username},(err, user) => {
        if (err) {
            console.log(err);
        } else {
            user["role"] = "student";
            user["batch"] = req.body.batch;
            user.save();
            res.redirect("/dashboard");
        }
    });
    
});

app.get("/edit/:attID", function(req, res) {
    Attendance.findById(req.params.attID, function (err, foundAtt){
        if (err) {
            console.log(err);
        } else {
            if(foundAtt) {
                res.render("submit", {user: req.user, details: foundAtt});
            }
        }
    })
});

app.get("/delete/:attID", function(req, res) {
    Attendance.findByIdAndDelete(req.params.attID, (err) => {
        if (err) {
            console.log(err);
        } else {
            console.log("Deleted");
            res.redirect("/dashboard");
        }   
    })
});

app.get("/detail/:attID", function(req, res) {
    Attendance.findById(req.params.attID, function(err, foundAtt){
        if (err) {
            console.log(err)
        } else {
            res.render("detail", {element: foundAtt});
        }
    });
});

app.post("/submit", function(req, res) {
    console.log(req.body); 
    const attendance = new Attendance({
        batch: req.body.batch,
        course: req.body.course,
        deadline: req.body.dd,
        postedBy: req.user.username
    });
    attendance.save();
    res.redirect("/dashboard");
});

app.post("/edit/:attID", function(req, res) {
    Attendance.findByIdAndUpdate(req.params.attID, 
        {
            batch: req.body.batch,
            course: req.body.course,
            deadline: req.body.dd 
        }, (err, updated) => {
            if(err) {
                console.log(err);
            } else {
                console.log("Updated" + updated);
                res.redirect("/dashboard");
            }
        });
});



app.post("/giveAtt/:attID", function(req, res) {
    console.log("Given Attendance" + req.params.attID);
    Attendance.findById(req.params.attID, function (err, foundAtt){
        if (err) {
            console.log(err)
        } else {
            if(foundAtt) {
                foundAtt['attendedBy'].push(req.user.username);
                foundAtt.save();
                console.log(foundAtt);
                res.redirect("/dashboard");
            }
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
