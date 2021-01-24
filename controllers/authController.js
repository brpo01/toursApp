const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const sendEmail = require('../utils/email');

const LoginToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    //pass in the payload and the secret key to create a jwt signature
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = LoginToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
  res.cookie('jwt', token, cookieOptions); //save our jwt token in the cookie storage, so it is non-accessible and cannot be manipulated

  user.password = undefined;
  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordCreatedAt: req.body.passwordCreatedAt,
    role: req.body.role,
  });

  // const newUser = await User.create(req.body);

  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  //1. check if email and password exists & is provided
  if (!email || !password) {
    return next(new AppError('Please provide email & password', 400));
  }
  //2. check if user exists and password exists
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect Email or password', 401));
  }
  //3. If everything is okay, allow user login & send token to client
  createSendToken(user, 200, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  //get token & check if it is there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(new AppError('Please you have to login to get access!'));
  }

  //verification token using payload and the headers i.e user._id
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  //check if user exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('User no longer exists!', 401));
  }

  //check if current user changed password after token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password, please login again', 401)
    );
  }

  //Grant access to user, if all of these tests pass
  res.locals.user = currentUser;
  req.user = currentUser;
  next();
});

exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET 
      );

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 3) Check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};


//authorization of user roles & permissions
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permissions to perform this action!', 403)
      );
    }
    next();
  };
};

//forgot-password functionality
exports.forgotPassword = catchAsync(async (req, res, next) => {
  //get user based on email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('User must have an email address', 404));
  }

  //generate random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  //send it to user's email
  try {
    const resetUrl = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/resetPassword/${resetToken}`;

    const message = `Forgot your password, submit a PATCH request with your password & passwordconfirm to ${resetUrl}.\n If you didnt forget your password, please ignore`;

    await sendEmail({
      email: user.email,
      subject: 'Your password reset token, valid for 10mins',
      message,
    });

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new AppError('There was an error', 500));
  }
});

//reset-password functionality
exports.resetPassword = catchAsync(async (req, res, next) => {
  //Get User based on token, compare encrypted and unencrypted token, and confirm if the token hasn't expired
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  //if the token hasn't expired, and there is a user, set the newpassword
  if (!user) {
    return next(new AppError('User does not exist or token has expired', 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  //update passwordChangedAt property for user
  //This gets implemented in the userModel as we're working with a pre save middleware(thin controllers, fat models)

  //login user based on JWT
  createSendToken(user, 200, res);
});

//update password functionality
exports.updatePassword = catchAsync(async (req, res, next) => {
  //get user from collection
  const user = await User.findById(req.user.id).select('+password');

  //check if posted password is correct
  if (!(await user.correctPassword(req.body.newPassword, user.password))) {
    return next(
      new AppError('The password you have entered is incorrect', 401)
    );
  }

  //if so update the password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  //log in user, send JWT
  createSendToken(user, 200, res);
});
