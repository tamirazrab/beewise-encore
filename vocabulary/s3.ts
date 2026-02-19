import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { secret } from "encore.dev/config";

// Use Encore secrets for AWS credentials and region
// const S3_BUCKET_SECRET = secret("S3_BUCKET_NAME");
const AWS_REGION_SECRET = secret("AWS_REGION");
const AWS_ACCESS_KEY_ID_SECRET = secret("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY_SECRET = secret("AWS_SECRET_ACCESS_KEY");

// const S3_BUCKET = S3_BUCKET_SECRET() || process.env.S3_BUCKET_NAME || "beewise-practice-recordings";
const S3_BUCKET = process.env.S3_BUCKET_NAME || "beewise-practice-recordings";
const S3_REGION = AWS_REGION_SECRET() || process.env.AWS_REGION || "us-east-1";
const SIGNED_URL_EXPIRES_IN = 3600;

// Get AWS credentials for S3 client
const accessKeyId = AWS_ACCESS_KEY_ID_SECRET() || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = AWS_SECRET_ACCESS_KEY_SECRET() || process.env.AWS_SECRET_ACCESS_KEY;

const s3Client = new S3Client({
  region: S3_REGION,
  ...(accessKeyId && secretAccessKey ? {
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  } : {}),
});

export function generateS3Key(userId: string, sessionId: string, recordingId: string): string {
  return `practice/${userId}/${sessionId}/${recordingId}.wav`;
}

export async function generateUploadSignedUrl(s3Key: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    ContentType: "audio/wav",
  });

  return await getSignedUrl(s3Client, command, { expiresIn: SIGNED_URL_EXPIRES_IN });
}

export async function generateDownloadSignedUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn: SIGNED_URL_EXPIRES_IN });
}
