"use client";
import { useState } from "react";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [searchResults, setSearchResults] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (
      file &&
      (file.type === "application/pdf" ||
        file.name.endsWith(".doc") ||
        file.name.endsWith(".docx"))
    ) {
      setSelectedFile(file);
      setIsLoading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/review", {
          // Replace with your server's upload endpoint
          method: "POST",
          body: formData,
        });
        if (!response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let streamedResults = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                streamedResults += data.content;
                setSearchResults(streamedResults);
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
        setIsLoading(false);
      } catch (error) {
        console.error("File upload error:", error);
        // alert("Failed to upload file");
      }
    } else {
      alert("Please select a PDF or DOC file");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="w-40"></div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex-1 text-center">
            Evaluate your resume in seconds
          </h1>
          <a
            href="/"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 font-medium"
          >
            Document Search(AI)
          </a>
        </div>

        {/* File Upload Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Upload (.docx/.pdf)
          </h2>
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              className="w-full text-gray-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {selectedFile && (
              <p className="mt-2 text-green-600 dark:text-green-400">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>
        </div>

        {/* Results Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Score and suggestions
          </h2>
          <textarea
            value={searchResults}
            readOnly
            placeholder={
              isLoading
                ? "Processing the resume"
                : "Resume evalution points to be shown here"
            }
            className="w-full h-64 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
          />
        </div>
      </div>
    </div>
  );
}
