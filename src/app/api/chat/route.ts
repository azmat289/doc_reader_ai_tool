import { NextRequest, NextResponse } from "next/server";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";

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

    const { answer } = await docReader(message);

    // TODO: Implement actual chat logic here
    const chatResponse = {
      id: `chat_${Date.now()}`,
      message: answer,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(chatResponse);
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

const docReader = async (userMessage: string) => {
  let loader;
  // 1. Load the document
  try {
    loader = new PDFLoader("docs/xyz.pdf"); // Or DocxLoader for .docx
  } catch (err) {
    loader = new DocxLoader("docs/xyz.docx");
  }

  const rawDocs = await loader.load();

  // 2. Split documents into chunks
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const docs = await textSplitter.splitDocuments(rawDocs);

  // 3. Create embeddings and vector store
  const embeddings = new OpenAIEmbeddings();
  const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);

  // 4. Create a retrieval chain and execute query
  const query = userMessage || "Weather and its Elements";

  // Debug: Check total documents
  console.log("Total document chunks:", docs.length);
  console.log("Sample chunk:", docs[0]?.pageContent?.substring(0, 200));

  // Get more relevant documents with scores
  const searchOut = await vectorStore.similaritySearchWithScore(query, 4);

  console.log(
    "Search results with scores:",
    searchOut.map(([doc, score]) => ({
      score,
      content: doc.pageContent.substring(0, 100),
    }))
  );

  // 5. Use retrieved documents as context for LLM
  const context = searchOut.map(([doc, score]) => doc.pageContent).join("\n\n");

  console.log("Context length:", context.length);
  console.log("Context preview:", context.substring(0, 300));

  const messages = [
    new SystemMessage(
      `You are an assistant that answers questions based on the provided context. 
      Use ONLY the information from the context below to answer the question. 
      If the information is not available in the context, say "The information is not available in the provided context."
      
      Context:\n${context}`
    ),
    new HumanMessage(query),
  ];

  const response = await model.invoke(messages);

  console.log("LLM Response:", response.content);

  return {
    // retrievedDocs: searchOut,
    answer: response.content,
    // context: context,
  };
};

export async function GET() {
  // TODO: Return list of chat sessions
  return NextResponse.json({ chats: [] });
}
