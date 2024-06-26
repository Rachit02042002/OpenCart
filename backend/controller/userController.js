const Errorhandler = require("../utils/errorhandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const User = require("../models/userModel");
const sendToken = require("../utils/jwtToken");
const sendEmail = require("../utils/sendEmail")
const crypto = require("crypto")
const cloudinary = require("cloudinary")

//Register a user

exports.registerUser = catchAsyncErrors(async(req,res,next)=>{
  const myCloud = await cloudinary.uploader.upload(req.body.avatar, {
    folder: "avatars",
    width: 150,
    crop: "scale",
  });
  

  const { name, email, password } = req.body;

  const user = await User.create({
    name,
    email,
    password,
    avatar: {
      public_id:"sample",
      url: "sample",
    },
  });

  sendToken(user, 201, res)
})


//Login user

exports.loginUser = catchAsyncErrors(async (req, res, next) => {

  const { email, password } = req.body;

  //checking if user has given password and email both

  if (!email || !password) {
    return next(new Errorhandler("Please enter Email and Password", 400))
  }
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return next(new Errorhandler("Invalid email or password", 401))
  }
  const isPasswordMatched = await user.comparePassword(password);

  if (!isPasswordMatched) {
    return next(new Errorhandler("Invalid email or password", 401))
  }

  sendToken(user, 200, res)
})


//Logout user

exports.logout = catchAsyncErrors(async (req, res, next) => {

  res.cookie("token", null, {
    expires: new Date(Date.now()),
    httpOnly: true
  })
  res.status(200).json({
    success: true,
    message: "Logges Out successfully"
  })
})


//forgot password

exports.forgotPassword = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new Errorhandler("User not found", 404));
  }

  // Get ResetPassword Token
  const resetToken = user.getResetPasswordToken();

  await user.save({ validateBeforeSave: false });

  const resetPasswordUrl = `${process.env.FRONTEND_URL}/password/reset/${resetToken}`;

  const message = `Your password reset token is :- \n\n ${resetPasswordUrl} \n\nIf you have not requested this email then, please ignore it.`;

  try {

    await sendEmail({
      email: user.email,
      subject: `Ecommerce Password Recovery`,
      message,
    });

    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email} successfully`,
    });
  } catch (error) {

    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save({ validateBeforeSave: false });

    return next(new Errorhandler(error.message, 500));
  }
});



exports.resetPassword = catchAsyncErrors(async (req, res, next) => {
  // creating token hash
  console.log("yes")
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });



  if (!user) {
    return next(
      new Errorhandler(
        "Reset Password Token is invalid or has been expired",
        400
      )
    );
  }

  if (req.body.password !== req.body.confirmPassword) {
    return next(new Errorhandler("Password does not match", 400));
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  sendToken(user, 200, res);
});


//get user details
exports.getUserDetails = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user.id)

  res.status(200).json({
    success: true,
    user
  })
})


//update user password

exports.updatePassword = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+password")

  const isPasswordMatched = await user.comparePassword(req.body.oldPassword);
  if (!isPasswordMatched) {
    return next(new Errorhandler("Old Password is incorrect", 401))
  }
  if (req.body.newPassword !== req.body.confirmPassword) {
    return next(new Errorhandler("Password doesn't match"), 400)
  }
  user.password = req.body.newPassword;
  await user.save();
  sendToken(user,200,res)
})


//update user profile
exports.updateProfile = catchAsyncErrors(async (req, res, next) => {

  const newUserData = {
    name:req.body.name,
    email:req.body.email
  }

  if(req.body.avatar!==""){
    const user = await User.findById(req.user.id);
    const imageId = user.avatar.public_id;
    await cloudinary.uploader.destroy(imageId);
    const myCloud = await cloudinary.uploader.upload(req.body.avatar, {
      folder: "avatars",
      width: 150,
      crop: "scale",
    });
    newUserData.avatar = {
      public_id:myCloud.public_id,
      url:myCloud.secure_url,
    }
  }
  const user = await User.findByIdAndUpdate(req.user.id,newUserData,{
    new:true,
    runValidators:true,
    usefindAndModify:false
  })
  res.status(200).json({
    success:true,
  })
})



// get all users(admin)

exports.getAllUsers = catchAsyncErrors(async(req,res,next)=>{
  const users = await User.find();
  res.status(200).json({
    success:true,
    users
  })
})

//get single user(admin)

exports.getSingleUser = catchAsyncErrors(async(req,res,next)=>{
  const user = await User.findById(req.params.id);

  if(!user){
    return next(new Errorhandler(`User does not exist with Id: ${req.params.id}`))
  }
  res.status(200).json({
    success:true,
    user
  })
})

//update user role(admin)
exports.updateUserRole = catchAsyncErrors(async (req, res, next) => {

  const newUserData = {
    name:req.body.name,
    email:req.body.email,
    role:req.body.role
  }
  const user = await User.findByIdAndUpdate(req.params.id,newUserData,{
    new:true,
    runValidators:true,
    usefindAndModify:false
  })
  if(!user){
    return next(new Errorhandler(`User does not exist with Id: ${req.params.id}`))
  }
  res.status(200).json({
    success:true,
  })
})

//delete user(admin)
exports.deleteUser = catchAsyncErrors(async (req, res, next) => {

  const user = await User.findById(req.params.id)
  if(!user){
    return next(new Errorhandler(`User does not exist with Id: ${req.params.id}`))
  }
  await user.deleteOne()
  res.status(200).json({
    success:true,
  })
})
