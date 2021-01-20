const nodemailer = require('nodemailer');

const sendEmail = async options => {
  //create a Transporter
  const transporter = nodemailer.createTransport({
    // service:'Gmail' using gmail as service, not advisable in production
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  //define the email options
  const mailOptions = {
    from: 'Jon <jon@iolabs.com>',
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  //actually send the email
  await transporter.sendMail(mailOptions)
};

module.exports = sendEmail