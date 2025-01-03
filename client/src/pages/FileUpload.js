import React, { useState } from 'react'
import { Box, Typography, Paper, Button, List, ListItem, ListItemIcon, ListItemText, LinearProgress, Alert } from '@mui/material'
import { CloudUpload as CloudUploadIcon, InsertDriveFile as InsertDriveFileIcon } from '@mui/icons-material'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getStorage, ref, getDownloadURL } from 'firebase/storage'

function FileUpload() {
  const [files, setFiles] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState(null)
  const [analysisResults, setAnalysisResults] = useState([])

  function handleFileChange(event) {
    const selectedFiles = Array.from(event.target.files)
    setFiles(selectedFiles)
  }

  async function handleUpload() {
    if (!files.length) return setError('Please select files to upload')
    
    setIsUploading(true)
    setError(null)
    setAnalysisResults([])
    
    try {
      const filePromises = files.map(async file => {
        const base64 = await convertFileToBase64(file)
        return {
          name: file.name,
          type: file.type,
          size: file.size,
          base64: base64.split(',')[1]
        }
      })

      const fileData = await Promise.all(filePromises)
      
      const functions = getFunctions()
      const uploadFiles = httpsCallable(functions, 'uploadFiles')
      const result = await uploadFiles({ files: fileData })

      setAnalysisResults(result.data.files)
      setFiles([])
      setUploadProgress(100)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsUploading(false)
    }
  }

  function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result)
      reader.onerror = error => reject(error)
    })
  }

  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        File Upload
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <input
          type="file"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
          id="file-input"
        />
        <label htmlFor="file-input">
          <Button
            variant="outlined"
            component="span"
            startIcon={<CloudUploadIcon />}
            fullWidth
          >
            Select Files
          </Button>
        </label>

        {files.length > 0 && (
          <List>
            {files.map((file, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  <InsertDriveFileIcon />
                </ListItemIcon>
                <ListItemText 
                  primary={file.name}
                  secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
                />
              </ListItem>
            ))}
          </List>
        )}

        {isUploading && (
          <LinearProgress 
            variant="determinate" 
            value={uploadProgress} 
            sx={{ mt: 2 }}
          />
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={!files.length || isUploading}
          startIcon={<CloudUploadIcon />}
          sx={{ mt: 2 }}
          fullWidth
        >
          Upload Files
        </Button>
      </Paper>

      {/* Analysis Results */}
      {analysisResults.length > 0 && (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Analysis Results
          </Typography>
          {analysisResults.map((file, index) => (
            <Box key={index} sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                {file.name}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {file.analysis}
              </Typography>
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  )
}

export default FileUpload 