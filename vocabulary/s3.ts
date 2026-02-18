import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const S3_BUCKET = process.env.S3_BUCKET_NAME || "beewise-practice-recordings";
const S3_REGION = process.env.AWS_REGION || "us-east-1";
const SIGNED_URL_EXPIRES_IN = 3600;

const s3Client = new S3Client({
  region: S3_REGION,
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
