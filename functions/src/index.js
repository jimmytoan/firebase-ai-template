const { onCall } = require("firebase-functions/v2/https")
const { initializeApp } = require("firebase-admin/app")
const { getStorage } = require("firebase-admin/storage")
const { GoogleGenerativeAI } = require("@google/generative-ai")
const pdfParse = require('pdf-parse')

// Initialize Firebase Admin
initializeApp()
console.log('Firebase Admin initialized')

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
console.log('Gemini AI initialized')

async function analyzeImage(imageBytes) {
  try {
    console.log('Starting image analysis')
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" })
    console.log('Gemini model loaded for image analysis')
    
    const prompt = "Describe this image in detail, including what you see and any notable elements."
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBytes.toString('base64')
        }
      }
    ])
    
    console.log('Image analysis completed successfully')
    return result.response.text()
  } catch (error) {
    console.error('Error in analyzeImage:', error)
    throw error
  }
}

async function analyzePDF(pdfBuffer) {
  try {
    console.log('Starting PDF analysis')
    
    // Parse PDF to text
    console.log('Parsing PDF content')
    const pdfData = await pdfParse(pdfBuffer)
    const pdfText = pdfData.text
    console.log('PDF parsed successfully, text length:', pdfText.length)

    // Truncate text if too long (Gemini has token limits)
    const maxChars = 30000
    const truncatedText = pdfText.length > maxChars 
      ? pdfText.substring(0, maxChars) + '...(truncated)'
      : pdfText
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" })
    console.log('Gemini model loaded for PDF analysis')
    
    const prompt = `Please provide a comprehensive summary of the following text, including key points and main ideas:

Text to analyze:
${truncatedText}`
    
    const result = await model.generateContent([prompt])
    
    console.log('PDF analysis completed successfully')
    return result.response.text()
  } catch (error) {
    console.error('Error in analyzePDF:', error)
    if (error.name === 'InvalidPDFException') {
      throw new Error('Invalid or corrupted PDF file')
    }
    throw error
  }
}

exports.uploadFiles = onCall({ maxInstances: 10 }, async (request) => {
  console.log('Upload function started')
  console.log('Request data:', JSON.stringify({
    filesCount: request.data?.files?.length,
    auth: !!request.auth
  }))

  const { files } = request.data
  
  if (!files || !Array.isArray(files)) {
    console.error('Invalid files data received')
    throw new Error('Invalid files data')
  }

  try {
    console.log('Getting storage bucket')
    const storage = getStorage()
    const bucket = storage.bucket()
    console.log('Storage bucket obtained')

    const uploadPromises = files.map(async (fileData, index) => {
      const { name, type, base64 } = fileData
      console.log(`Processing file ${index + 1}/${files.length}:`, { name, type })
      
      try {
        const buffer = Buffer.from(base64, 'base64')
        console.log(`File ${name} converted to buffer, size:`, buffer.length)

        const filePath = `uploads/${Date.now()}-${name}`
        const file = bucket.file(filePath)
        
        console.log(`Starting upload for ${name} to path: ${filePath}`)
        await file.save(buffer)
        console.log(`File ${name} uploaded successfully`)

        let analysis = ''
        if (type.startsWith('image/')) {
          console.log(`Starting image analysis for ${name}`)
          analysis = await analyzeImage(buffer)
        } else if (type === 'application/pdf') {
          console.log(`Starting PDF analysis for ${name}`)
          analysis = await analyzePDF(buffer)
        }
        console.log(`Analysis completed for ${name}`)

        return {
          name,
          path: filePath,
          type,
          analysis
        }
      } catch (error) {
        console.error(`Error processing file ${name}:`, error)
        throw error
      }
    })

    console.log('Waiting for all uploads to complete')
    const uploadedFiles = await Promise.all(uploadPromises)
    console.log('All uploads completed successfully')
    
    return {
      success: true,
      files: uploadedFiles
    }
  } catch (error) {
    console.error('Upload function error:', error)
    console.error('Error stack:', error.stack)
    throw new Error(`Upload failed: ${error.message}`)
  }
}) 