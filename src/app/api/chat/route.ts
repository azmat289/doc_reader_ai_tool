import { NextRequest, NextResponse } from "next/server";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import fetch from "node-fetch";

const model = new ChatAnthropic({
  model: "claude-3-5-sonnet-20240620",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  temperature: 0,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const { stream } = await docReader(message);

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.content || '';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
        }
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error(JSON.stringify(error));
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

const docReader = async (query: string) => {
  let loader;
  // 1. Load the document
  try {
    const res = await fetch(
      "https://p2ms6irlxq6pgrwz.public.blob.vercel-storage.com/xyz.pdf"
    );
    const blob = <Blob>await res.blob();
    loader = new PDFLoader(blob); // Or DocxLoader for .docx
  } catch (err) {
    console.error(JSON.stringify(err));
    const res = await fetch(
      "https://p2ms6irlxq6pgrwz.public.blob.vercel-storage.com/xyz.docx"
    );
    const blob = <Blob>await res.blob();
    loader = new DocxLoader(blob);
  }

  const rawDocs = await loader.load();

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const docs = await textSplitter.splitDocuments(rawDocs);

  const embeddings = new OpenAIEmbeddings();
  const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);

  // Get more relevant documents with scores
  const searchOut = await vectorStore.similaritySearchWithScore(query, 4);

  // Use retrieved documents as context for LLM
  const context = searchOut.map(([doc, score]) => doc.pageContent).join("\n\n");

  const messages = [
    new SystemMessage(
      `You are an assistant that answers questions based on the provided context. 
      Use ONLY the information from the context below to answer the question. 
      If the information is not available in the context, say "The information is not available in the provided context."
      
      Context:\n${context}`
    ),
    new HumanMessage(query),
  ];

  const stream = await model.stream(messages);

  return {
    stream,
  };
};

export async function GET() {
  // TODO: Return list of chat sessions
  return NextResponse.json({ chats: [] });
}
