const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

module.exports = {
  getMe: (req, res, next) => {
    req.params.id = req.user.id;
    next();
  },

  updateMe: catchAsync(async (req, res, next) => {
    //Throw an error if user posts password data
    if (req.body.password || req.body.passwordConfirm) {
      return next(
        new AppError('You cannot update your password on this route, use /updatePassword', 401)
      );
    }

    //update user data
    const filteredFields = filterObj(req.body, 'name', 'email');
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      filteredFields,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      status: 'success',
      data: {
        updatedUser,
      },
    });
  }),

  deleteMe: catchAsync(async (req, res, next) => {
    await User.findByIdAndUpdate(req.user.id, { active: false });

    res.status(204).json({
      status: 'success',
      data: null,
    });
  }),

  //GET all users
  getAllUsers: factory.getAll(User),

  //GET user by id
  getUser: factory.getOne(User),

  //CREATE user
  createUser: (req, res) => {
    res.status(500).json({
      status: 'error',
      message: 'route not defined, use /signup instead',
    });
  },

  //PUT(update details about a user), do not use for updating passwords
  updateUser: factory.updateOne(User),

  //DELETE user
  deleteUser: factory.deleteOne(User),
};
