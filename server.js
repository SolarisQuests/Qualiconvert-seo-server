const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const mailgun = require('mailgun-js');
require('dotenv').config();

const PDFDocument = require('pdfkit'); // Added for PDF generation
const fs = require('fs'); // File system for handling files

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

    /* Start PDF geenration code */
     // Generate PDF
     const pdfPath = './SEO_Form.pdf';
     const doc = new PDFDocument();
     const pdfStream = fs.createWriteStream(pdfPath);
     doc.pipe(pdfStream);
 
    // Add a title with styling
    doc.fontSize(16).font('Helvetica-Bold').text('SEO Form Submission From Client', {
      underline: true,
      align: 'center',
    });
    doc.moveDown(2); // Add some vertical spacing
 
     /*Object.entries(savedData.toObject()).forEach(([key, value]) => {
       doc.text(`${key}: ${value}`, { lineGap: 2 });
     });*/
     // Filter out unwanted fields

     const fieldMapping = {
        practiceName: 'Practice Name',
        contactName: 'Contact Name',
        businessEmail : 'Business Email',
        description : 'Brief description about your practice',
        services : 'Main Services',
        location : 'Which markets do you operate in',
        city : 'City',
        state : 'State',
        zip : 'ZIP',
        seasonalTrends : 'Seasonal trends that affect your business',
        idealCustomers : 'Who are your ideal customers',
        customerChoice : 'Why do your best customers',
        uniqueFeatures : 'What makes you different from your competitors',
        competitors : 'Who are your main competitors',
        websiteSuccess : 'How do you measure the success of your website',
        nonConversionReason : 'Why do you think somebody who may land on your website does not convert',
        importantActions : 'Which actions on the website are most important to you',
        digitalMarketingHistory : 'Have you invested in any digital marketing activities in the past',
        seoOptimization : 'Has your website been optimized for SEO in the past?',
        targetKeywords : 'For optimization purposes, please provide target keywords',
        seoReporting : 'If applicable, please share any reporting, keyword research, ..'  
        // Add other mappings as needed
      };


    const excludedFields = ['_id', 'createdAt', 'updatedAt', '__v','email'];
    const filteredData = Object.entries(savedData.toObject()).filter(
      ([key]) => !excludedFields.includes(key)
    );

    filteredData.forEach(([key, value]) => {
      const displayName = fieldMapping[key] || key.replace(/_/g, ' '); // If no mapping, use the original key name
       doc
        .fontSize(12)
        .font('Helvetica')
        .text(displayName+' : ', { continued: true }) // Bold key
        .font('Helvetica-Bold')
        .text(` ${value}`, { indent: 20, lineGap: 4 }); // Regular value with spacing
    });

    // Add footer for branding or additional notes
    doc.moveDown(2);
    doc
      .fontSize(10)
      .font('Helvetica-Oblique')
      .text('All rights reserved @Qualiconvert', { align: 'center' });
 
     doc.end();

     await new Promise((resolve, reject) => {
       pdfStream.on('finish', resolve);
       pdfStream.on('error', reject);
     });
 
     console.log('PDF generated successfully.');
    /* End PDF generation code */

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
      to:'sriram@legaciestechno.com',
     // to: formData.email, // Use the email from the form data
     // cc: 'audiologyplustech@gmail.com',
      //bcc:'noreply@auxoinnovations.com,anthony@auxoinnovations.com', 
      subject: 'New Onboarding SEO Form Submission',
      text: `Thank you for submitting your onboarding SEO form. Here are the details you provided:\n\n${emailContent}`,
      attachment: pdfPath, // Attached the generated PDF
    };

    mg.messages().send(data, function (error, body) {
      // Clean up the PDF file after email is sent
      fs.unlink(pdfPath, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting PDF file:', unlinkErr);
        else console.log('Temporary PDF file deleted.');
      });
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
