// components/portal/UploadMock.client.tsx
"use client";

export default function UploadMock() {
  return (
    <div className="mt-3">
      <form className="flex items-center gap-3" onSubmit={(e) => e.preventDefault()}>
        <input
          type="file"
          className="block w-full text-sm file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border file:bg-gray-50 hover:file:bg-gray-100"
        />
        <button
          className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          type="button"
          onClick={() => alert("Upload mock – koppel later aan storage")}
        >
          Upload
        </button>
      </form>
    </div>
  );
}
