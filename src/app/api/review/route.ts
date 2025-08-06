import { NextRequest } from "next/server";
import { ChatAnthropic } from "@langchain/anthropic";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import path from "path";

const model = new ChatAnthropic({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.3,
  streaming: true,
});

const RESUME_REVIEW_PROMPT = `You are an expert resume reviewer with extensive experience in hiring and career coaching. 
Analyze the following resume content and provide a comprehensive review.

Resume Content:
{context}

Please provide:
1. Overall Score (1-10): Rate the resume's overall quality
2. Strengths: List 3-5 key strengths
3. Areas for Improvement: List 3-5 areas that need work
4. Specific Suggestions: Provide actionable recommendations
5. ATS Compatibility: Comment on how well this resume would perform with Applicant Tracking Systems
6. Industry Alignment: Assess how well the resume fits typical industry standards

Format your response in a structured manner with clear sections.`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const fileExtension = path.extname(file.name);

    if (!file || !(fileExtension === ".pdf" || fileExtension === ".docx")) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let loader: any;
    // 1. Load the document
    try {
      if (fileExtension === ".pdf") {
        loader = new PDFLoader(file);
      } else if (fileExtension === ".docx" || fileExtension === ".doc") {
        loader = new DocxLoader(file);
      }
    } catch (err) {
      console.log(">>>>>>>>>>>>err", err);
    }

    const rawDocs = await loader.load();
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const docs = await textSplitter.splitDocuments(rawDocs);
    const embeddings = new OpenAIEmbeddings();
    const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);

    const searchOut = await vectorStore.similaritySearchWithScore(
      "resume skills experience education",
      5
    );
    const context = searchOut
      .map(([doc, score]) => doc.pageContent)
      .join("\n\n");

    const stream = await model.stream([RESUME_REVIEW_PROMPT, context]);

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.content || "";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`)
          );
        }
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Resume review error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process resume",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
