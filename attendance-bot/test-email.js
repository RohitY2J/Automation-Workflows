const nodemailer = require('nodemailer');

const emailConfig = {
  service: 'gmail',
  auth: {
    user: 'rohitkauri13@gmail.com',
    pass: 'bjqi ffbu dzya yjde'
  }
};

(async () => {
  try {
    console.log('📧 Testing email configuration...');
    
    const transporter = nodemailer.createTransport(emailConfig);
    
    const mailOptions = {
      from: 'rohitkauri13@gmail.com',
      to: 'rohitkauri13@gmail.com',
      subject: 'Test Email - Attendance Bot JS Test',
      text: `This is a test email from Node.js script.
      
Time: ${new Date()}
Status: Email configuration working correctly!

This confirms that the email credentials are valid.`
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
  }
})();