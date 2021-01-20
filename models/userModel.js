const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please tell us your name!'],
  },
  email: {
    type: String,
    required: [true, 'Please input your email address'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email address'],
  },
  photo: String,
  role: {
    type: String,
    enum: {
      values: ['admin', 'user', 'guide', 'leadguide'],
      message: 'You must either be an admin, user, guide or lead-guide',
    },
    default: 'user',
  },
  password: {
    type: String,
    required: [true, 'Please input a valid password'],
    minlength: 8,
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm yourpassword'],
    validate: {
      //this only works on save, create
      validator: function (el) {
        return el === this.password;
      },
      message: 'Passwords are not the same!',
    },
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

//how to encrypt your password
userSchema.pre('save', async function (next) {
  //only runs this function if password is actually modified
  if (!this.isModified('password')) return next();

  //hash the password with a cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  this.passwordConfirm = undefined; //delete passwordConfirm field
  next();
});

//update passwordChangedAt property for user
userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  /*token issued after password changed, date has to be pushed back by one second so it doesn't trigger an error
  refer to changedPasswordAfter instance method for better insight*/
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

//query middleware for deleting user and setting removing all accts set to false
userSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});

//compare the userpassword inputed and the userpassword in the db
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  //check if the password was changed after the token was issued
  if (this.passwordChangedAt) {
    const changedTimeStamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    // console.log(JWTTimestamp, changedTimeStamp)
    return JWTTimestamp < changedTimeStamp; //this means the token was issued before the password was changed
  }

  //if password wasn't changed after token was issued
  return false;
};

//create a password reset token and send it to the user's email
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  // console.log(resetToken, this.passwordResetToken)
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; //means password reset token expires in 10mins.

  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
