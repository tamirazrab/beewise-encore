import "dotenv/config"
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime"

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
})

async function run() {
  const command = new ConverseCommand({
    modelId: "openai.gpt-oss-120b-1:0",
    messages: [
      {
        role: "user",
        content: [
          { text: "Explain quantum computing in simple terms." }
        ]
      }
    ],
    inferenceConfig: {
      maxTokens: 512,
      temperature: 0.7
    }
  })

  const response = await client.send(command)
  console.log(JSON.stringify(response, null, 2))
  if (response.output?.message?.content) {
    const text = response.output.message.content
      .filter((block) => block.text != null)
      .map((block) => block.text)
      .join("")
    console.log("\n--- Model reply ---\n", text)
  }
}

run().catch(console.error)
