const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const mailgun = require('mailgun-js');
require('dotenv').config();

const app = express();
const port = 3002;

app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB:', err));

// Create a schema for the form data that allows any field
const formDataSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

// Create a model based on the schema, specifying the collection name
const FormData = mongoose.model('FormData', formDataSchema, 'Qualiconvert_seo_onboarding_submissions');

// Initialize Mailgun
const mg = mailgun({apiKey: process.env.MAILGUN_API_KEY, domain: process.env.MAILGUN_DOMAIN});

app.post('/api/submit-form', async (req, res) => {
  try {
    const formData = req.body;
    console.log('Received form data:', formData);

    // Create a new document in MongoDB with all received fields
    const newFormData = new FormData(formData);
    const savedData = await newFormData.save();

    console.log('Form data saved successfully:', savedData);

    // Prepare email content
    const emailContent = Object.entries(formData)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    // Add Terms & Conditions confirmation to the email
    // const termsLink = 'https://onboarding.qualiconvert.com/terms';
    // const termsConfirmation = `\n\nHere is the link for the terms and conditions which you have accepted for Qualiconvert. This is for your review: ${termsLink}`;

    console.log('Preparing to send email to:', formData.email);

    // Send email using Mailgun
    const data = {
      from: 'Qualiconvert <noreply@qualiconvert.com>',
      to: formData.email, // Use the email from the form data
      subject: 'New Onboarding SEO Form Submission',
      text: `Thank you for submitting your onboarding SEO form`
    };

    mg.messages().send(data, function (error, body) {
      if (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ message: 'Error sending email', error: error.message });
      } else {
        console.log('Email sent successfully. Mailgun response:', body);
        res.status(200).json({ message: 'Form submitted successfully', savedData });
      }
    });

  } catch (error) {
    console.error('Error in submit-form route:', error);
    res.status(500).json({ message: 'Error submitting form', error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
