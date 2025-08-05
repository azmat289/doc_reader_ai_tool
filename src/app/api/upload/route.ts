import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Check file type
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Invalid file type. Only PDF and DOC files are allowed",
        },
        { status: 400 }
      );
    }

    // // Create docs directory if it doesn't exist
    // // const docsDir = path.join(process.cwd(), "docs");
    // const docsDir = path.join("/tmp");
    // if (!existsSync(docsDir)) {
    //   await mkdir(docsDir, { recursive: true });
    // }

    // // Generate unique filename
    // const timestamp = Date.now();
    const fileExtension = path.extname(file.name);
    // const fileName = `${timestamp}_${file.name.replace(
    //   /[^a-zA-Z0-9.-]/g,
    //   "_"
    // )}`;
    // const filePath = path.join(docsDir, `xyz${fileExtension}`);

    // // Convert file to buffer and save
    // const bytes = await file.arrayBuffer();
    // const buffer = Buffer.from(bytes);
    // await writeFile(filePath, buffer);

    await put(`xyz${fileExtension}`, file, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    revalidatePath("/");

    const response = {
      success: true,
      message: "File uploaded successfully",
      filename: `xyz${fileExtension}`,
      originalName: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error: "Failed to upload file",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const docsDir = path.join(process.cwd(), "docs");

    if (!existsSync(docsDir)) {
      return NextResponse.json({ files: [] });
    }

    // TODO: Return list of uploaded documents
    return NextResponse.json({
      message: "List uploaded documents",
      docsPath: docsDir,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to retrieve files",
      },
      { status: 500 }
    );
  }
}
