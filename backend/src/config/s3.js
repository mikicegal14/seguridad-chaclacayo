const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const region = process.env.AWS_REGION || 'us-east-1';
const bucketName = process.env.S3_BUCKET_MEDIA;

let s3Client = null;

if (bucketName) {
  const clientConfig = { region };
  
  // If explicitly provided via env vars (e.g. local dev testing with IAM user)
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };
  }
  // Otherwise, on EC2 instances, AWS SDK v3 automatically resolves credentials from the EC2 Instance Metadata / IAM Role

  s3Client = new S3Client(clientConfig);
  console.log(`[S3 Storage] Configured S3 Media storage for bucket: ${bucketName} (region: ${region})`);
} else {
  console.log('[S3 Storage] S3_BUCKET_MEDIA not defined. Using local disk storage fallback (/uploads).');
}

/**
 * Check if S3 is active and configured
 */
const isS3Enabled = () => Boolean(s3Client && bucketName);

/**
 * Upload a buffer or file to S3
 * @param {Buffer} buffer - File buffer
 * @param {string} key - S3 object key (e.g., uploads/alert-123.jpg)
 * @param {string} contentType - MIME type (e.g., image/jpeg)
 */
const uploadBufferToS3 = async (buffer, key, contentType) => {
  if (!isS3Enabled()) {
    throw new Error('S3 is not configured');
  }

  // Remove leading slash if present for S3 key
  const cleanKey = key.startsWith('/') ? key.substring(1) : key;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cleanKey,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream'
  });

  await s3Client.send(command);
  return `/${cleanKey}`;
};

/**
 * Delete an object from S3
 * @param {string} key - S3 object key or relative path
 */
const deleteFromS3 = async (key) => {
  if (!isS3Enabled() || !key) return;

  try {
    const cleanKey = key.startsWith('/') ? key.substring(1) : key;
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: cleanKey
    });
    await s3Client.send(command);
  } catch (error) {
    console.error(`[S3 Storage] Error deleting ${key} from S3:`, error.message);
  }
};

module.exports = {
  s3Client,
  isS3Enabled,
  uploadBufferToS3,
  deleteFromS3,
  bucketName
};
