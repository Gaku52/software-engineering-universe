# File Upload

> File upload is one of the most complex areas in web forms. This guide systematically covers production-quality file upload implementation — from drag & drop, progress display, previews, and direct S3 uploads to image resizing, chunked uploads, and security measures. It covers every pattern needed in real projects, from frontend to backend.

## What You Will Learn

- [ ] Understand the fundamentals of the HTML5 File API and the detailed behavior of `<input type="file">`
- [ ] Learn drag & drop upload implementation patterns
- [ ] Implement progress-bar uploads using XMLHttpRequest and the Fetch API
- [ ] Understand direct uploads via S3 presigned URLs
- [ ] Learn image preview, resizing, and validation implementation
- [ ] Understand the mechanics and implementation of chunked uploads (split uploads)
- [ ] Learn UX design and implementation for multi-file uploads
- [ ] Learn server-side best practices for receiving, validating, and saving files
- [ ] Implement security measures (MIME validation, virus scanning, path traversal prevention)
- [ ] Understand architecture design for large-scale file uploads

---

## Prerequisites

To get the most out of this chapter, it is recommended that you have prior knowledge of the following:

- **Validation Patterns**: Understand the validation design with Zod schemas and error handling patterns covered in `./01-validation-patterns.md`
- **Fetch API and multipart/form-data**: Understand the basics of HTTP requests, especially how to send files using `FormData` and the role of the Content-Type header
- **Browser File API**: Understand the basic usage of browser-native APIs such as `File`, `Blob`, `FileReader`, and `URL.createObjectURL()`

---

## 1. HTML5 File API Fundamentals

### 1.1 Basics of `<input type="file">`

The most fundamental element of file upload is the HTML `<input type="file">`. Correctly understanding the attributes and behavior this simple element provides is the foundation for implementing advanced upload functionality.

```html
<!-- Basic file input -->
<input type="file" name="document" />

<!-- Allow multiple file selection -->
<input type="file" name="photos" multiple />

<!-- Restrict accepted file types -->
<input type="file" accept=".pdf,.doc,.docx" />
<input type="file" accept="image/*" />
<input type="file" accept="image/jpeg,image/png,image/webp" />
<input type="file" accept="video/*" />
<input type="file" accept="audio/*" />

<!-- Launch camera directly (mobile) -->
<input type="file" accept="image/*" capture="environment" />
<input type="file" accept="image/*" capture="user" />
<input type="file" accept="video/*" capture="environment" />

<!-- Directory selection (Chrome/Edge) -->
<input type="file" webkitdirectory />
```

### 1.2 Details of the accept Attribute

The `accept` attribute filters the browser's file selection dialog, but note that it is not a security constraint. Users can bypass the filter by selecting "All Files", so server-side validation is mandatory.

```typescript
// List of formats that can be specified with the accept attribute
const acceptFormats = {
  // Specification by MIME type
  'image/jpeg': 'JPEG image',
  'image/png': 'PNG image',
  'image/webp': 'WebP image',
  'image/gif': 'GIF image',
  'image/svg+xml': 'SVG image',
  'application/pdf': 'PDF file',
  'application/json': 'JSON file',
  'text/csv': 'CSV file',
  'text/plain': 'Text file',
  'application/zip': 'ZIP archive',
  'video/mp4': 'MP4 video',
  'audio/mpeg': 'MP3 audio',

  // Specification by wildcard
  'image/*': 'All image formats',
  'video/*': 'All video formats',
  'audio/*': 'All audio formats',

  // Specification by extension
  '.pdf': 'PDF file',
  '.xlsx': 'Excel file',
  '.docx': 'Word file',
  '.pptx': 'PowerPoint file',
};
```

### 1.3 File Object and FileList

Understanding the structure of the File object and FileList obtainable from `<input type="file">` is important.

```typescript
// Properties of the File object
interface FileInfo {
  name: string;            // File name (e.g., "photo.jpg")
  size: number;            // File size (bytes)
  type: string;            // MIME type (e.g., "image/jpeg")
  lastModified: number;    // Last modified date/time (UNIX timestamp)
  webkitRelativePath: string; // Relative path when using webkitdirectory
}

// Working with FileList
function handleFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = input.files; // FileList object

  if (!files || files.length === 0) {
    console.log('No files selected');
    return;
  }

  // FileList is not an array but is iterable
  // Can be converted to an array with Array.from()
  const fileArray = Array.from(files);

  fileArray.forEach(file => {
    console.log(`Name: ${file.name}`);
    console.log(`Size: ${formatFileSize(file.size)}`);
    console.log(`Type: ${file.type}`);
    console.log(`Last modified: ${new Date(file.lastModified).toLocaleString()}`);
  });
}

// File size formatting function
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
```

### 1.4 FileReader API

The FileReader API allows reading file contents in the browser. It is indispensable for preview display and client-side processing.

```typescript
// List of FileReader read methods
class FileReaderExample {
  // Read a text file
  readAsText(file: File, encoding = 'UTF-8'): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file, encoding);
    });
  }

  // Read an image as a Data URL (for preview)
  readAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  // Read as binary data
  readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  // Read with progress
  readWithProgress(
    file: File,
    onProgress: (percent: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
```

### 1.5 Blob API and File Operations

Blob (Binary Large Object) is the parent class of the File object and is used for manipulating binary data.

```typescript
// Creating and working with Blobs
class BlobOperations {
  // Create a Blob from text
  createTextBlob(content: string, type = 'text/plain'): Blob {
    return new Blob([content], { type });
  }

  // Create a Blob from JSON
  createJsonBlob(data: unknown): Blob {
    const json = JSON.stringify(data, null, 2);
    return new Blob([json], { type: 'application/json' });
  }

  // Slice a Blob (read partially)
  sliceBlob(blob: Blob, start: number, end: number): Blob {
    return blob.slice(start, end, blob.type);
  }

  // Convert Blob to File
  blobToFile(blob: Blob, filename: string): File {
    return new File([blob], filename, {
      type: blob.type,
      lastModified: Date.now(),
    });
  }

  // Create and revoke Blob URLs
  createObjectURL(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  revokeObjectURL(url: string): void {
    URL.revokeObjectURL(url);
  }

  // Convert ArrayBuffer to Blob
  arrayBufferToBlob(buffer: ArrayBuffer, type: string): Blob {
    return new Blob([buffer], { type });
  }

  // Download a Blob
  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
```

---

## 2. Basic File Upload Implementation

### 2.1 React Hook Form + File Input

This shows the implementation pattern for a basic file upload form using React Hook Form.

```typescript
import { useForm, SubmitHandler } from 'react-hook-form';
import { useState, useCallback } from 'react';

// Form type definition
interface UploadFormData {
  title: string;
  description: string;
  category: string;
  file: FileList;
}

// Validation rules
const FILE_VALIDATION = {
  maxSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'] as const,
};

function FileUploadForm() {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'uploading' | 'success' | 'error'
  >('idle');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    reset,
    setError,
  } = useForm<UploadFormData>();

  // Watch file changes to generate preview
  const watchFile = watch('file');

  React.useEffect(() => {
    if (watchFile?.[0]) {
      const file = watchFile[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }, [watchFile]);

  const onSubmit: SubmitHandler<UploadFormData> = async (data) => {
    try {
      setUploadStatus('uploading');
      const formData = new FormData();
      formData.append('file', data.file[0]);
      formData.append('title', data.title);
      formData.append('description', data.description);
      formData.append('category', data.category);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        // Do not set the Content-Type header
        // The browser automatically sets multipart/form-data
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      const result = await response.json();
      setUploadStatus('success');
      reset();
      setPreview(null);
      console.log('Upload successful:', result);
    } catch (error) {
      setUploadStatus('error');
      setError('root', {
        message: error instanceof Error ? error.message : 'Upload error',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Title input */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          type="text"
          {...register('title', {
            required: 'Title is required',
            maxLength: { value: 100, message: 'Must be 100 characters or less' },
          })}
          className="mt-1 block w-full border rounded-md px-3 py-2"
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
        )}
      </div>

      {/* Description input */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          {...register('description', {
            maxLength: { value: 500, message: 'Must be 500 characters or less' },
          })}
          className="mt-1 block w-full border rounded-md px-3 py-2"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      {/* Category selection */}
      <div>
        <label htmlFor="category" className="block text-sm font-medium">
          Category
        </label>
        <select
          id="category"
          {...register('category', { required: 'Please select a category' })}
          className="mt-1 block w-full border rounded-md px-3 py-2"
        >
          <option value="">Select...</option>
          <option value="profile">Profile Image</option>
          <option value="document">Document</option>
          <option value="gallery">Gallery</option>
        </select>
        {errors.category && (
          <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
        )}
      </div>

      {/* File input */}
      <div>
        <label htmlFor="file" className="block text-sm font-medium">
          File
        </label>
        <input
          id="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          {...register('file', {
            required: 'Please select a file',
            validate: {
              size: (files) =>
                !files[0] ||
                files[0].size <= FILE_VALIDATION.maxSize ||
                `File size must be ${formatFileSize(FILE_VALIDATION.maxSize)} or less`,
              type: (files) =>
                !files[0] ||
                (FILE_VALIDATION.allowedTypes as readonly string[]).includes(
                  files[0].type
                ) ||
                'Only JPEG, PNG, and WebP formats are supported',
              notEmpty: (files) =>
                !files[0] ||
                files[0].size > 0 ||
                'Empty files cannot be uploaded',
            },
          })}
          className="mt-1 block w-full text-sm file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0 file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {errors.file && (
          <p className="mt-1 text-sm text-red-600">{errors.file.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          JPEG, PNG, WebP (max 5MB)
        </p>
      </div>

      {/* Preview */}
      {preview && (
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">Preview:</p>
          <img
            src={preview}
            alt="Preview"
            className="max-w-xs max-h-48 object-contain rounded-lg border"
          />
        </div>
      )}

      {/* Error message */}
      {errors.root && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{errors.root.message}</p>
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md
          hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Uploading...' : 'Upload'}
      </button>

      {/* Status display */}
      {uploadStatus === 'success' && (
        <p className="text-sm text-green-600">Upload complete</p>
      )}
    </form>
  );
}
```

### 2.2 Advanced FormData Usage

FormData is the core API for file uploads, building data in the `multipart/form-data` format.

```typescript
// Advanced FormData usage
class FormDataBuilder {
  private formData: FormData;

  constructor() {
    this.formData = new FormData();
  }

  // Add a single file
  addFile(key: string, file: File): this {
    this.formData.append(key, file, file.name);
    return this;
  }

  // Add multiple files (multiple values under the same key)
  addFiles(key: string, files: File[]): this {
    files.forEach(file => {
      this.formData.append(key, file, file.name);
    });
    return this;
  }

  // Add a Blob (with a specified filename)
  addBlob(key: string, blob: Blob, filename: string): this {
    this.formData.append(key, blob, filename);
    return this;
  }

  // Add text data
  addField(key: string, value: string | number | boolean): this {
    this.formData.append(key, String(value));
    return this;
  }

  // Add JSON data as a field
  addJson(key: string, data: unknown): this {
    this.formData.append(key, JSON.stringify(data));
    return this;
  }

  // Log FormData contents (for debugging)
  debug(): void {
    for (const [key, value] of this.formData.entries()) {
      if (value instanceof File) {
        console.log(`${key}: [File] ${value.name} (${formatFileSize(value.size)})`);
      } else {
        console.log(`${key}: ${value}`);
      }
    }
  }

  build(): FormData {
    return this.formData;
  }
}

// Usage example
async function uploadWithMetadata(
  files: File[],
  metadata: { userId: string; tags: string[] }
) {
  const formData = new FormDataBuilder()
    .addFiles('files', files)
    .addField('userId', metadata.userId)
    .addJson('tags', metadata.tags)
    .addField('uploadedAt', new Date().toISOString())
    .build();

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
    // Note: do not set Content-Type
    // The browser automatically sets it with the boundary parameter
  });

  return response.json();
}
```

### 2.3 Fetch API vs XMLHttpRequest Comparison

Understanding the differences between the Fetch API and XMLHttpRequest for file uploads is important.

```typescript
// Upload with Fetch API
// Pros: Modern Promise-based API, simpler code
// Cons: Does not natively support upload progress
async function uploadWithFetch(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(60000), // 60-second timeout
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Upload with XMLHttpRequest
// Pros: Supports upload progress events
// Cons: Callback-based, somewhat verbose
function uploadWithXHR(
  file: File,
  options: {
    onProgress?: (percent: number) => void;
    onComplete?: (result: UploadResult) => void;
    onError?: (error: Error) => void;
    timeout?: number;
  }
): { abort: () => void } {
  const xhr = new XMLHttpRequest();
  const formData = new FormData();
  formData.append('file', file);

  // Upload progress
  xhr.upload.addEventListener('progress', (event) => {
    if (event.lengthComputable) {
      const percent = Math.round((event.loaded / event.total) * 100);
      options.onProgress?.(percent);
    }
  });

  // Complete
  xhr.addEventListener('load', () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      const result = JSON.parse(xhr.responseText);
      options.onComplete?.(result);
    } else {
      options.onError?.(new Error(`Upload failed: ${xhr.status}`));
    }
  });

  // Error
  xhr.addEventListener('error', () => {
    options.onError?.(new Error('Network error during upload'));
  });

  // Timeout
  xhr.addEventListener('timeout', () => {
    options.onError?.(new Error('Upload timeout'));
  });

  xhr.timeout = options.timeout ?? 60000;
  xhr.open('POST', '/api/upload');
  xhr.send(formData);

  return { abort: () => xhr.abort() };
}

// Getting progress with Fetch API + ReadableStream (download only)
// Note: Fetch API cannot get upload progress,
// but can get response download progress
async function fetchWithDownloadProgress(url: string): Promise<Blob> {
  const response = await fetch(url);
  const contentLength = Number(response.headers.get('content-length'));
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let receivedLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedLength += value.length;

    if (contentLength) {
      const percent = Math.round((receivedLength / contentLength) * 100);
      console.log(`Download progress: ${percent}%`);
    }
  }

  return new Blob(chunks);
}
```

| Feature | Fetch API | XMLHttpRequest |
|---------|-----------|---------------|
| Promise support | Native | Requires manual wrapping |
| Upload progress | Not supported | `upload.onprogress` |
| Download progress | ReadableStream | `onprogress` |
| Cancellation | AbortController | `abort()` |
| Timeout | AbortSignal.timeout() | `timeout` property |
| Streaming | ReadableStream | Not supported |
| Service Worker | Supported | Limited |
| Syntax | Concise | Verbose |
| Browser compatibility | No IE | All browsers |

---

## 3. Drag & Drop Upload

### 3.1 HTML5 Drag and Drop API Basics

Drag & drop is a feature that greatly improves the UX of file uploads. Understanding the mechanics of the HTML5 Drag and Drop API is important.

```typescript
// Implementation with plain HTML5 Drag and Drop API
function createDropZone(element: HTMLElement) {
  // Handling drag events
  // Important: dragover and dragenter must call preventDefault()
  // Without this, the drop event will not fire

  let dragCounter = 0; // Counter to handle dragenter/dragleave on nested child elements

  element.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    element.classList.add('drag-active');
  });

  element.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter === 0) {
      element.classList.remove('drag-active');
    }
  });

  element.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Set dropEffect to change the cursor
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  element.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    element.classList.remove('drag-active');

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
  });

  // Prevent drag on the entire window (suppress browser default behavior)
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
}

function handleFiles(files: File[]) {
  files.forEach(file => {
    console.log(`Dropped: ${file.name} (${formatFileSize(file.size)})`);
  });
}
```

### 3.2 Advanced Implementation with react-dropzone

```typescript
import { useDropzone, FileRejection, DropEvent } from 'react-dropzone';
import { useState, useCallback, useMemo, useEffect } from 'react';

// Upload file type definition
interface UploadFile {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  url?: string;
}

// Dropzone configuration type
interface DropzoneConfig {
  maxFiles: number;
  maxSize: number;
  acceptedTypes: Record<string, string[]>;
  onUpload: (files: File[]) => Promise<void>;
}

function AdvancedFileDropzone({ maxFiles, maxSize, acceptedTypes, onUpload }: DropzoneConfig) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);

  // Handler when files are added
  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      // Check that existing file count + new file count doesn't exceed maxFiles
      const remainingSlots = maxFiles - uploadFiles.length;
      const filesToAdd = acceptedFiles.slice(0, remainingSlots);

      if (acceptedFiles.length > remainingSlots) {
        toast.warning(
          `Maximum ${maxFiles} files allowed. ${acceptedFiles.length - remainingSlots} file(s) were excluded.`
        );
      }

      // Add accepted files to state
      const newUploadFiles: UploadFile[] = filesToAdd.map(file => ({
        id: crypto.randomUUID(),
        file,
        preview: file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : '',
        status: 'pending' as const,
        progress: 0,
      }));

      setUploadFiles(prev => [...prev, ...newUploadFiles]);

      // Display errors for rejected files
      rejectedFiles.forEach(({ file, errors }) => {
        const messages = errors.map(e => {
          switch (e.code) {
            case 'file-too-large':
              return `${file.name}: File is too large (max ${formatFileSize(maxSize)})`;
            case 'file-invalid-type':
              return `${file.name}: Unsupported file format`;
            case 'too-many-files':
              return `Number of files exceeds the limit`;
            default:
              return `${file.name}: ${e.message}`;
          }
        });
        messages.forEach(msg => toast.error(msg));
      });
    },
    [uploadFiles.length, maxFiles, maxSize]
  );

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
    isFocused,
    open,
  } = useDropzone({
    accept: acceptedTypes,
    maxSize,
    maxFiles: maxFiles - uploadFiles.length,
    onDrop,
    noClick: false,
    noKeyboard: false,
    preventDropOnDocument: true,
    // Custom validation for drag & drop
    validator: (file) => {
      // Check that the filename doesn't contain special characters
      const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
      if (invalidChars.test(file.name)) {
        return {
          code: 'invalid-filename',
          message: 'The filename contains invalid characters',
        };
      }
      return null;
    },
  });

  // Drop zone styles
  const dropzoneStyle = useMemo(() => {
    let className = 'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ';
    if (isDragReject) {
      className += 'border-red-500 bg-red-50 ';
    } else if (isDragAccept) {
      className += 'border-green-500 bg-green-50 ';
    } else if (isDragActive) {
      className += 'border-blue-500 bg-blue-50 ';
    } else if (isFocused) {
      className += 'border-blue-400 bg-blue-25 ';
    } else {
      className += 'border-gray-300 hover:border-gray-400 ';
    }
    return className;
  }, [isDragActive, isDragAccept, isDragReject, isFocused]);

  // Remove a file
  const removeFile = useCallback((id: string) => {
    setUploadFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  }, []);

  // Upload all files
  const uploadAll = useCallback(async () => {
    const pendingFiles = uploadFiles.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    for (const uploadFile of pendingFiles) {
      setUploadFiles(prev =>
        prev.map(f =>
          f.id === uploadFile.id ? { ...f, status: 'uploading' as const } : f
        )
      );

      try {
        await onUpload([uploadFile.file]);
        setUploadFiles(prev =>
          prev.map(f =>
            f.id === uploadFile.id
              ? { ...f, status: 'success' as const, progress: 100 }
              : f
          )
        );
      } catch (error) {
        setUploadFiles(prev =>
          prev.map(f =>
            f.id === uploadFile.id
              ? {
                  ...f,
                  status: 'error' as const,
                  error: error instanceof Error ? error.message : 'Upload failed',
                }
              : f
          )
        );
      }
    }
  }, [uploadFiles, onUpload]);

  // Prevent memory leaks: release Object URLs on component unmount
  useEffect(() => {
    return () => {
      uploadFiles.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [uploadFiles]);

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div {...getRootProps()} className={dropzoneStyle}>
        <input {...getInputProps()} />
        <div className="space-y-3">
          {/* Icon */}
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          {isDragReject ? (
            <p className="text-red-600 font-medium">
              This file format is not supported
            </p>
          ) : isDragActive ? (
            <p className="text-blue-600 font-medium">Drop files here</p>
          ) : (
            <>
              <p className="text-gray-600">
                Drag & drop files here, or
                <button
                  type="button"
                  onClick={open}
                  className="text-blue-600 hover:text-blue-700 font-medium mx-1"
                >
                  click to select
                </button>
              </p>
              <p className="text-xs text-gray-500">
                JPEG, PNG, WebP (max {formatFileSize(maxSize)}, up to {maxFiles} files)
              </p>
            </>
          )}
        </div>
      </div>

      {/* File list */}
      {uploadFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">
              Files ({uploadFiles.length}/{maxFiles})
            </h4>
            <button
              type="button"
              onClick={uploadAll}
              disabled={!uploadFiles.some(f => f.status === 'pending')}
              className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
            >
              Upload All
            </button>
          </div>

          {uploadFiles.map(uploadFile => (
            <FileListItem
              key={uploadFile.id}
              file={uploadFile}
              onRemove={() => removeFile(uploadFile.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Each item in the file list
function FileListItem({
  file,
  onRemove,
}: {
  file: UploadFile;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      {/* Preview */}
      {file.preview ? (
        <img
          src={file.preview}
          alt={file.file.name}
          className="w-12 h-12 object-cover rounded"
        />
      ) : (
        <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
          <span className="text-xs text-gray-500">FILE</span>
        </div>
      )}

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.file.name}</p>
        <p className="text-xs text-gray-500">{formatFileSize(file.file.size)}</p>

        {/* Progress bar */}
        {file.status === 'uploading' && (
          <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${file.progress}%` }}
            />
          </div>
        )}

        {/* Error message */}
        {file.status === 'error' && (
          <p className="text-xs text-red-600 mt-1">{file.error}</p>
        )}
      </div>

      {/* Status icon / remove button */}
      <div className="flex-shrink-0">
        {file.status === 'success' ? (
          <span className="text-green-500">Done</span>
        ) : file.status === 'uploading' ? (
          <span className="text-blue-500">Uploading...</span>
        ) : (
          <button
            type="button"
            onClick={onRemove}
            className="text-gray-400 hover:text-red-500 transition-colors"
            aria-label="Remove file"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  );
}
```

### 3.3 Full-Page Drag & Drop Overlay

Expanding the drag & drop area to cover the entire page is a pattern adopted by many applications.

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';

// Custom hook to detect page-wide drag & drop
function usePageDragDrop(onFilesDropped: (files: File[]) => void) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;

    // Check if files are being dragged
    if (e.dataTransfer?.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;

    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        onFilesDropped(Array.from(files));
      }
    },
    [onFilesDropped]
  );

  useEffect(() => {
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  return isDragging;
}

// Drag & drop overlay component
function DragDropOverlay({ onFilesDropped }: { onFilesDropped: (files: File[]) => void }) {
  const isDragging = usePageDragDrop(onFilesDropped);

  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 z-50 bg-blue-500/20 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white rounded-2xl p-12 shadow-2xl border-2 border-dashed border-blue-500">
        <div className="text-center space-y-4">
          <svg
            className="mx-auto h-16 w-16 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-xl font-semibold text-blue-700">
            Drop files here to upload
          </p>
          <p className="text-sm text-blue-500">
            Supported formats: JPEG, PNG, WebP, PDF
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

## 4. Upload with Progress

### 4.1 Getting Progress with XMLHttpRequest

A progress bar is an important UI element that visually communicates upload progress to users. It is implemented using the `upload.onprogress` event of XMLHttpRequest.

```typescript
import { useState, useRef, useCallback } from 'react';

// Upload state type definition
interface UploadState {
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error' | 'cancelled';
  progress: number;      // 0-100
  loaded: number;        // Bytes uploaded
  total: number;         // Total bytes
  speed: number;         // Bytes/second
  remainingTime: number; // Remaining seconds
  error?: string;
  result?: UploadResult;
}

interface UploadResult {
  url: string;
  key: string;
  size: number;
  mimeType: string;
}

// Advanced file upload hook
function useFileUpload(uploadUrl: string) {
  const [state, setState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    loaded: 0,
    total: 0,
    speed: 0,
    remainingTime: 0,
  });

  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastLoadedRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const upload = useCallback(
    async (file: File): Promise<UploadResult> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        startTimeRef.current = Date.now();
        lastLoadedRef.current = 0;
        lastTimeRef.current = Date.now();

        // Upload progress event
        xhr.upload.addEventListener('progress', (event) => {
          if (!event.lengthComputable) return;

          const now = Date.now();
          const elapsedSinceLastUpdate = (now - lastTimeRef.current) / 1000;

          // Speed calculation (moving average)
          let speed = 0;
          if (elapsedSinceLastUpdate > 0) {
            const bytesInPeriod = event.loaded - lastLoadedRef.current;
            speed = bytesInPeriod / elapsedSinceLastUpdate;
          }

          // Remaining time calculation
          const remaining = event.total - event.loaded;
          const remainingTime = speed > 0 ? remaining / speed : 0;

          setState({
            status: 'uploading',
            progress: Math.round((event.loaded / event.total) * 100),
            loaded: event.loaded,
            total: event.total,
            speed,
            remainingTime,
          });

          lastLoadedRef.current = event.loaded;
          lastTimeRef.current = now;
        });

        // Waiting for server processing after upload completes
        xhr.upload.addEventListener('load', () => {
          setState(prev => ({
            ...prev,
            status: 'processing',
            progress: 100,
          }));
        });

        // Response received
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const result = JSON.parse(xhr.responseText) as UploadResult;
            setState(prev => ({
              ...prev,
              status: 'success',
              result,
            }));
            resolve(result);
          } else {
            const errorMessage = `Upload failed: ${xhr.status} ${xhr.statusText}`;
            setState(prev => ({
              ...prev,
              status: 'error',
              error: errorMessage,
            }));
            reject(new Error(errorMessage));
          }
        });

        // Network error
        xhr.addEventListener('error', () => {
          const errorMessage = 'A network error occurred';
          setState(prev => ({
            ...prev,
            status: 'error',
            error: errorMessage,
          }));
          reject(new Error(errorMessage));
        });

        // Cancel
        xhr.addEventListener('abort', () => {
          setState(prev => ({
            ...prev,
            status: 'cancelled',
          }));
          reject(new Error('Upload was cancelled'));
        });

        // Timeout
        xhr.addEventListener('timeout', () => {
          const errorMessage = 'Upload timed out';
          setState(prev => ({
            ...prev,
            status: 'error',
            error: errorMessage,
          }));
          reject(new Error(errorMessage));
        });

        // Build FormData
        const formData = new FormData();
        formData.append('file', file);

        // Request settings
        xhr.timeout = 5 * 60 * 1000; // 5 minutes
        xhr.open('POST', uploadUrl);
        xhr.send(formData);
      });
    },
    [uploadUrl]
  );

  // Cancel functionality
  const cancel = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
  }, []);

  // Reset functionality
  const reset = useCallback(() => {
    cancel();
    setState({
      status: 'idle',
      progress: 0,
      loaded: 0,
      total: 0,
      speed: 0,
      remainingTime: 0,
    });
  }, [cancel]);

  return { state, upload, cancel, reset };
}
```

### 4.2 Feature-Rich Progress Display Component

```typescript
// Detailed progress display component
function UploadProgressDisplay({ state }: { state: UploadState }) {
  if (state.status === 'idle') return null;

  const getStatusColor = () => {
    switch (state.status) {
      case 'uploading': return 'bg-blue-500';
      case 'processing': return 'bg-yellow-500';
      case 'success': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'cancelled': return 'bg-gray-500';
      default: return 'bg-gray-300';
    }
  };

  const getStatusMessage = () => {
    switch (state.status) {
      case 'uploading':
        return `Uploading... ${state.progress}%`;
      case 'processing':
        return 'Processing on server...';
      case 'success':
        return 'Upload complete';
      case 'error':
        return state.error || 'An error occurred';
      case 'cancelled':
        return 'Cancelled';
      default:
        return '';
    }
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return 'Calculating...';
    return `${formatFileSize(bytesPerSecond)}/s`;
  };

  const formatTime = (seconds: number): string => {
    if (seconds <= 0 || !isFinite(seconds)) return 'Calculating...';
    if (seconds < 60) return `${Math.ceil(seconds)}s remaining`;
    if (seconds < 3600) return `${Math.ceil(seconds / 60)}m remaining`;
    return `${Math.ceil(seconds / 3600)}h remaining`;
  };

  return (
    <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
      {/* Status message */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{getStatusMessage()}</span>
        {state.status === 'uploading' && (
          <span className="text-gray-500">
            {formatFileSize(state.loaded)} / {formatFileSize(state.total)}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ${getStatusColor()}`}
          style={{ width: `${state.progress}%` }}
        />
      </div>

      {/* Detailed info */}
      {state.status === 'uploading' && (
        <div className="flex justify-between text-xs text-gray-500">
          <span>Speed: {formatSpeed(state.speed)}</span>
          <span>{formatTime(state.remainingTime)}</span>
        </div>
      )}

      {/* Processing animation */}
      {state.status === 'processing' && (
        <div className="flex items-center gap-2 text-xs text-yellow-600">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4"
              fill="none" opacity="0.25"
            />
            <path
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>Optimizing and resizing image...</span>
        </div>
      )}
    </div>
  );
}

// Circular progress display
function CircularProgress({
  progress,
  size = 64,
  strokeWidth = 4,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300"
        />
      </svg>
      <span className="absolute text-xs font-semibold">{progress}%</span>
    </div>
  );
}
```

### 4.3 Parallel and Sequential Multi-File Upload

```typescript
// Upload multiple files simultaneously (with concurrency limit)
async function uploadFilesWithConcurrency(
  files: File[],
  uploadFn: (file: File) => Promise<UploadResult>,
  options: {
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
    onFileComplete?: (file: File, result: UploadResult) => void;
    onFileError?: (file: File, error: Error) => void;
  } = {}
): Promise<Map<string, UploadResult | Error>> {
  const { concurrency = 3, onProgress, onFileComplete, onFileError } = options;
  const results = new Map<string, UploadResult | Error>();
  let completedCount = 0;

  // Semaphore implementation (limit concurrent uploads)
  const semaphore = {
    count: concurrency,
    queue: [] as (() => void)[],
    acquire(): Promise<void> {
      return new Promise(resolve => {
        if (this.count > 0) {
          this.count--;
          resolve();
        } else {
          this.queue.push(resolve);
        }
      });
    },
    release(): void {
      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        next();
      } else {
        this.count++;
      }
    },
  };

  const uploadWithSemaphore = async (file: File) => {
    await semaphore.acquire();
    try {
      const result = await uploadFn(file);
      results.set(file.name, result);
      onFileComplete?.(file, result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      results.set(file.name, err);
      onFileError?.(file, err);
    } finally {
      completedCount++;
      onProgress?.(completedCount, files.length);
      semaphore.release();
    }
  };

  await Promise.all(files.map(uploadWithSemaphore));
  return results;
}

// Parallel upload hook for React
function useMultiFileUpload(options: {
  uploadUrl: string;
  concurrency?: number;
}) {
  const [files, setFiles] = useState<Map<string, {
    file: File;
    status: 'pending' | 'uploading' | 'success' | 'error';
    progress: number;
    error?: string;
    result?: UploadResult;
  }>>(new Map());

  const [overallProgress, setOverallProgress] = useState(0);

  const addFiles = useCallback((newFiles: File[]) => {
    setFiles(prev => {
      const next = new Map(prev);
      newFiles.forEach(file => {
        next.set(file.name, {
          file,
          status: 'pending',
          progress: 0,
        });
      });
      return next;
    });
  }, []);

  const uploadAll = useCallback(async () => {
    const pendingFiles = Array.from(files.entries())
      .filter(([, f]) => f.status === 'pending')
      .map(([, f]) => f.file);

    if (pendingFiles.length === 0) return;

    await uploadFilesWithConcurrency(
      pendingFiles,
      async (file) => {
        setFiles(prev => {
          const next = new Map(prev);
          const entry = next.get(file.name);
          if (entry) {
            entry.status = 'uploading';
          }
          return next;
        });

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(options.uploadUrl, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
        return response.json();
      },
      {
        concurrency: options.concurrency ?? 3,
        onProgress: (completed, total) => {
          setOverallProgress(Math.round((completed / total) * 100));
        },
        onFileComplete: (file, result) => {
          setFiles(prev => {
            const next = new Map(prev);
            const entry = next.get(file.name);
            if (entry) {
              entry.status = 'success';
              entry.progress = 100;
              entry.result = result;
            }
            return next;
          });
        },
        onFileError: (file, error) => {
          setFiles(prev => {
            const next = new Map(prev);
            const entry = next.get(file.name);
            if (entry) {
              entry.status = 'error';
              entry.error = error.message;
            }
            return next;
          });
        },
      }
    );
  }, [files, options.uploadUrl, options.concurrency]);

  return { files, addFiles, uploadAll, overallProgress };
}
```

---

## 5. Direct S3 Upload (Presigned URLs)

### 5.1 Architecture Overview

Direct upload using S3 presigned URLs is an architecture that significantly reduces server load. Since files are uploaded directly from the client to S3 without going through the application server, it achieves bandwidth savings and improved scalability.

```
Direct S3 Upload Flow:

  [Client]                  [App Server]              [AWS S3]
      |                         |                         |
      |-- 1. Request URL ------>|                         |
      |                         |-- 2. Sign PutObject --> |
      |                         |<-- 3. Presigned URL --- |
      |<-- 4. Presigned URL ----|                         |
      |                         |                         |
      |-- 5. PUT file directly --------------------------------->|
      |<-- 6. 200 OK --------------------------------------------|
      |                         |                         |
      |-- 7. Notify complete -->|                         |
      |                         |-- 8. Save metadata --> |
      |<-- 9. Done response ----|                         |

Benefits:
- Saves server bandwidth
- Handles large files without timeouts
- Improved scalability
- Easy CDN integration

Drawbacks:
- CORS configuration required
- AWS endpoint exposed to client
- Server-side file processing cannot happen immediately
```

### 5.2 Server-Side: Presigned URL Generation

```typescript
// Next.js App Router: app/api/upload/presign/route.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import crypto from 'crypto';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Request validation schema
const presignRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().regex(/^(image|video|audio|application)\//),
  fileSize: z.number().positive().max(100 * 1024 * 1024), // Max 100MB
});

// Allowed file types
const ALLOWED_CONTENT_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'application/pdf': ['.pdf'],
  'video/mp4': ['.mp4'],
};

// Maximum file sizes (by Content-Type)
const MAX_FILE_SIZES: Record<string, number> = {
  'image/': 10 * 1024 * 1024,    // Images: 10MB
  'video/': 100 * 1024 * 1024,   // Videos: 100MB
  'application/pdf': 50 * 1024 * 1024, // PDF: 50MB
};

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const validation = presignRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { filename, contentType, fileSize } = validation.data;

    // Validate Content-Type
    if (!ALLOWED_CONTENT_TYPES[contentType]) {
      return NextResponse.json(
        { error: `Unsupported file format: ${contentType}` },
        { status: 400 }
      );
    }

    // Validate file size (by Content-Type)
    const maxSize = Object.entries(MAX_FILE_SIZES).find(
      ([prefix]) => contentType.startsWith(prefix)
    )?.[1] ?? 10 * 1024 * 1024;

    if (fileSize > maxSize) {
      return NextResponse.json(
        { error: `File size exceeds the limit (${formatFileSize(maxSize)})` },
        { status: 400 }
      );
    }

    // Generate a safe filename
    const sanitizedFilename = filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100);
    const uniqueId = crypto.randomUUID();
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const key = `uploads/${session.user.id}/${date}/${uniqueId}/${sanitizedFilename}`;

    // Generate presigned URL
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      ContentType: contentType,
      ContentLength: fileSize,
      // Metadata
      Metadata: {
        'uploaded-by': session.user.id,
        'original-filename': encodeURIComponent(filename),
        'upload-timestamp': new Date().toISOString(),
      },
      // Server-side encryption
      ServerSideEncryption: 'AES256',
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 900, // Expires in 15 minutes
    });

    // Save upload record to DB (status: pending)
    // await db.upload.create({
    //   data: {
    //     key,
    //     userId: session.user.id,
    //     filename,
    //     contentType,
    //     fileSize,
    //     status: 'pending',
    //   },
    // });

    return NextResponse.json({
      presignedUrl,
      key,
      expiresAt: new Date(Date.now() + 900 * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Presign URL generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate URL' },
      { status: 500 }
    );
  }
}
```

### 5.3 S3 CORS Configuration

Without proper CORS configuration on the S3 bucket, direct uploads from browsers will be blocked.

```json
// S3 bucket CORS configuration
{
  "CORSRules": [
    {
      "AllowedOrigins": [
        "https://yourdomain.com",
        "https://staging.yourdomain.com"
      ],
      "AllowedMethods": ["PUT", "POST", "GET", "HEAD"],
      "AllowedHeaders": [
        "Content-Type",
        "Content-Length",
        "x-amz-meta-*",
        "x-amz-server-side-encryption"
      ],
      "ExposeHeaders": ["ETag", "x-amz-request-id"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

```typescript
// CORS configuration with AWS CDK
import * as s3 from 'aws-cdk-lib/aws-s3';

const uploadBucket = new s3.Bucket(this, 'UploadBucket', {
  bucketName: 'my-app-uploads',
  cors: [
    {
      allowedOrigins: ['https://yourdomain.com'],
      allowedMethods: [
        s3.HttpMethods.PUT,
        s3.HttpMethods.POST,
        s3.HttpMethods.GET,
        s3.HttpMethods.HEAD,
      ],
      allowedHeaders: ['*'],
      exposedHeaders: ['ETag', 'x-amz-request-id'],
      maxAge: 3600,
    },
  ],
  encryption: s3.BucketEncryption.S3_MANAGED,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  lifecycleRules: [
    {
      // Delete incomplete multipart uploads after 7 days
      abortIncompleteMultipartUploadAfter: Duration.days(7),
    },
    {
      // Delete temporary upload folder after 30 days
      prefix: 'uploads/temp/',
      expiration: Duration.days(30),
    },
  ],
});
```

### 5.4 Client-Side: Direct S3 Upload Implementation

```typescript
// Client-side implementation of direct S3 upload
interface S3UploadOptions {
  file: File;
  onProgress?: (percent: number) => void;
  onComplete?: (url: string) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

async function uploadToS3({
  file,
  onProgress,
  onComplete,
  onError,
  signal,
}: S3UploadOptions): Promise<string> {
  try {
    // 1. Get presigned URL
    const presignResponse = await fetch('/api/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        fileSize: file.size,
      }),
      signal,
    });

    if (!presignResponse.ok) {
      const error = await presignResponse.json();
      throw new Error(error.error || 'Failed to get presigned URL');
    }

    const { presignedUrl, key } = await presignResponse.json();

    // 2. Upload directly to S3 (using XMLHttpRequest for progress)
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Handle AbortSignal
      if (signal) {
        signal.addEventListener('abort', () => {
          xhr.abort();
          reject(new Error('Upload was cancelled'));
        });
      }

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress?.(percent);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`S3 upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during S3 upload'));
      });

      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });

    // 3. Notify server of upload completion
    const confirmResponse = await fetch('/api/upload/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
      signal,
    });

    if (!confirmResponse.ok) {
      throw new Error('Failed to notify upload completion');
    }

    const { url } = await confirmResponse.json();
    onComplete?.(url);
    return url;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    throw err;
  }
}

// React hook
function useS3Upload() {
  const [state, setState] = useState<{
    status: 'idle' | 'getting-url' | 'uploading' | 'confirming' | 'success' | 'error';
    progress: number;
    error?: string;
    url?: string;
  }>({
    status: 'idle',
    progress: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const upload = useCallback(async (file: File) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState({ status: 'getting-url', progress: 0 });

    try {
      const url = await uploadToS3({
        file,
        signal: controller.signal,
        onProgress: (percent) => {
          setState(prev => ({ ...prev, status: 'uploading', progress: percent }));
        },
      });

      setState({ status: 'success', progress: 100, url });
      return url;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setState({ status: 'error', progress: 0, error: message });
      throw error;
    }
  }, []);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setState({ status: 'idle', progress: 0 });
  }, []);

  return { ...state, upload, cancel };
}
```

---

## 6. Image Optimization and Client-Side Processing

### 6.1 Image Resizing with Canvas API

Resizing large images on the client side before uploading reduces upload time and server load. This shows a complete implementation of image resizing using the Canvas API.

```typescript
// Image resize configuration
interface ImageResizeOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;         // 0-1 (JPEG/WebP quality)
  outputFormat: 'image/jpeg' | 'image/png' | 'image/webp';
  maintainAspectRatio: boolean;
  backgroundColor?: string; // Background color for PNG transparency
}

const DEFAULT_RESIZE_OPTIONS: ImageResizeOptions = {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.85,
  outputFormat: 'image/jpeg',
  maintainAspectRatio: true,
};

// Image resizing function
async function resizeImage(
  file: File,
  options: Partial<ImageResizeOptions> = {}
): Promise<File> {
  const opts = { ...DEFAULT_RESIZE_OPTIONS, ...options };

  // Load the image
  const img = await loadImage(file);

  // Calculate new dimensions
  const { width, height } = calculateDimensions(
    img.naturalWidth,
    img.naturalHeight,
    opts.maxWidth,
    opts.maxHeight,
    opts.maintainAspectRatio
  );

  // Return as-is if resizing is not needed
  if (width === img.naturalWidth && height === img.naturalHeight) {
    return file;
  }

  // Resize with Canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Set background color (to fill transparent areas when converting PNG to JPEG)
  if (opts.backgroundColor) {
    ctx.fillStyle = opts.backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  // Settings for high-quality resize
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to Blob
  const blob = await canvasToBlob(canvas, opts.outputFormat, opts.quality);

  // Return as a File object
  const extension = opts.outputFormat.split('/')[1];
  const newFilename = file.name.replace(/\.[^.]+$/, `.${extension}`);

  return new File([blob], newFilename, {
    type: opts.outputFormat,
    lastModified: Date.now(),
  });
}

// Load an image
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

// Calculate dimensions
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number,
  maintainAspectRatio: boolean
): { width: number; height: number } {
  if (!maintainAspectRatio) {
    return {
      width: Math.min(originalWidth, maxWidth),
      height: Math.min(originalHeight, maxHeight),
    };
  }

  let width = originalWidth;
  let height = originalHeight;

  // Resize while maintaining aspect ratio
  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }

  return { width, height };
}

// Convert Canvas to Blob
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert Canvas to Blob'));
        }
      },
      type,
      quality
    );
  });
}
```

### 6.2 EXIF Data Processing

Photos taken on smartphones contain EXIF data, and failing to correctly handle the rotation information (Orientation) can cause images to display in an unintended direction.

```typescript
// Read EXIF Orientation
async function getExifOrientation(file: File): Promise<number> {
  const buffer = await file.slice(0, 65536).arrayBuffer();
  const view = new DataView(buffer);

  // Check JPEG marker
  if (view.getUint16(0) !== 0xFFD8) {
    return 1; // Not JPEG
  }

  let offset = 2;
  while (offset < view.byteLength) {
    const marker = view.getUint16(offset);
    offset += 2;

    if (marker === 0xFFE1) {
      // APP1 (EXIF) marker
      const length = view.getUint16(offset);
      offset += 2;

      // Check for "Exif\0\0"
      if (view.getUint32(offset) !== 0x45786966) {
        return 1;
      }
      offset += 6;

      const tiffOffset = offset;
      const bigEndian = view.getUint16(offset) === 0x4D4D;
      offset += 2;

      // Check magic number 42
      const magic = bigEndian
        ? view.getUint16(offset)
        : view.getUint16(offset, true);
      if (magic !== 42) return 1;
      offset += 2;

      // IFD0 offset
      const ifdOffset = bigEndian
        ? view.getUint32(offset)
        : view.getUint32(offset, true);
      offset = tiffOffset + ifdOffset;

      // Number of IFD entries
      const entries = bigEndian
        ? view.getUint16(offset)
        : view.getUint16(offset, true);
      offset += 2;

      for (let i = 0; i < entries; i++) {
        const tag = bigEndian
          ? view.getUint16(offset)
          : view.getUint16(offset, true);

        if (tag === 0x0112) {
          // Orientation tag
          return bigEndian
            ? view.getUint16(offset + 8)
            : view.getUint16(offset + 8, true);
        }

        offset += 12;
      }

      return 1;
    } else if ((marker & 0xFF00) === 0xFF00) {
      const length = view.getUint16(offset);
      offset += length;
    } else {
      break;
    }
  }

  return 1;
}

// Fix image orientation based on EXIF Orientation
async function fixImageOrientation(file: File): Promise<File> {
  const orientation = await getExifOrientation(file);

  // No processing needed if Orientation is 1 (normal)
  if (orientation <= 1) return file;

  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Set canvas size and transform based on Orientation
  switch (orientation) {
    case 2: // Horizontal flip
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.transform(-1, 0, 0, 1, img.naturalWidth, 0);
      break;
    case 3: // 180 degree rotation
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.transform(-1, 0, 0, -1, img.naturalWidth, img.naturalHeight);
      break;
    case 4: // Vertical flip
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.transform(1, 0, 0, -1, 0, img.naturalHeight);
      break;
    case 5: // 90 degree clockwise rotation + horizontal flip
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6: // 90 degree clockwise rotation
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      ctx.transform(0, 1, -1, 0, img.naturalHeight, 0);
      break;
    case 7: // 90 degree counter-clockwise rotation + horizontal flip
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      ctx.transform(0, -1, -1, 0, img.naturalHeight, img.naturalWidth);
      break;
    case 8: // 90 degree counter-clockwise rotation
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      ctx.transform(0, -1, 1, 0, 0, img.naturalWidth);
      break;
  }

  ctx.drawImage(img, 0, 0);
  const blob = await canvasToBlob(canvas, file.type, 0.92);
  return new File([blob], file.name, { type: file.type, lastModified: Date.now() });
}
```

### 6.3 Image Preview Component

```typescript
import { useState, useEffect, useCallback } from 'react';

// Image preview hook
function useImagePreview() {
  const [previews, setPreviews] = useState<Map<string, string>>(new Map());

  const generatePreview = useCallback(async (file: File): Promise<string> => {
    // Return cached preview if it exists
    const existingPreview = previews.get(file.name);
    if (existingPreview) return existingPreview;

    // Generate thumbnail for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviews(prev => new Map(prev).set(file.name, url));
      return url;
    }

    // Return icon URL for non-images
    return getFileTypeIcon(file.type);
  }, [previews]);

  const removePreview = useCallback((filename: string) => {
    setPreviews(prev => {
      const next = new Map(prev);
      const url = next.get(filename);
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
      next.delete(filename);
      return next;
    });
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      previews.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [previews]);

  return { previews, generatePreview, removePreview };
}

// Get icon by file type
function getFileTypeIcon(mimeType: string): string {
  const iconMap: Record<string, string> = {
    'application/pdf': '/icons/pdf.svg',
    'application/zip': '/icons/zip.svg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '/icons/doc.svg',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '/icons/xls.svg',
    'text/plain': '/icons/txt.svg',
    'text/csv': '/icons/csv.svg',
    'video/mp4': '/icons/video.svg',
    'audio/mpeg': '/icons/audio.svg',
  };

  return iconMap[mimeType] || '/icons/file.svg';
}

// Image preview component with lightbox
function ImagePreviewGallery({
  files,
  onRemove,
}: {
  files: { id: string; file: File; previewUrl: string }[];
  onRemove: (id: string) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  return (
    <>
      {/* Thumbnail grid */}
      <div className="grid grid-cols-4 gap-3">
        {files.map((item, index) => (
          <div key={item.id} className="relative group">
            <button
              type="button"
              onClick={() => setSelectedIndex(index)}
              className="w-full aspect-square overflow-hidden rounded-lg border
                hover:ring-2 hover:ring-blue-500 transition-all"
            >
              <img
                src={item.previewUrl}
                alt={item.file.name}
                className="w-full h-full object-cover"
              />
            </button>
            {/* Remove button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item.id);
              }}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white
                rounded-full text-xs flex items-center justify-center
                opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove"
            >
              x
            </button>
            {/* Filename */}
            <p className="mt-1 text-xs text-gray-500 truncate">{item.file.name}</p>
            <p className="text-xs text-gray-400">{formatFileSize(item.file.size)}</p>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {selectedIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setSelectedIndex(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={files[selectedIndex].previewUrl}
              alt={files[selectedIndex].file.name}
              className="max-w-full max-h-[90vh] object-contain"
            />
            {/* Navigation */}
            {selectedIndex > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIndex(selectedIndex - 1);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-3xl"
              >
                &lt;
              </button>
            )}
            {selectedIndex < files.length - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIndex(selectedIndex + 1);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-3xl"
              >
                &gt;
              </button>
            )}
            {/* Close button */}
            <button
              type="button"
              onClick={() => setSelectedIndex(null)}
              className="absolute top-4 right-4 text-white text-2xl"
            >
              x
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

### 6.4 WebP/AVIF Conversion

Converting to modern formats can significantly reduce file sizes.

```typescript
// Image format conversion utility
class ImageConverter {
  // Convert to WebP
  static async toWebP(file: File, quality = 0.85): Promise<File> {
    return this.convert(file, 'image/webp', quality, '.webp');
  }

  // Convert to JPEG
  static async toJPEG(file: File, quality = 0.9): Promise<File> {
    return this.convert(file, 'image/jpeg', quality, '.jpg');
  }

  // Convert to PNG (lossless)
  static async toPNG(file: File): Promise<File> {
    return this.convert(file, 'image/png', 1, '.png');
  }

  // General conversion method
  private static async convert(
    file: File,
    outputType: string,
    quality: number,
    extension: string
  ): Promise<File> {
    const img = await loadImage(file);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const blob = await canvasToBlob(canvas, outputType, quality);
    const newFilename = file.name.replace(/\.[^.]+$/, extension);

    return new File([blob], newFilename, {
      type: outputType,
      lastModified: Date.now(),
    });
  }

  // Check browser WebP support
  static async isWebPSupported(): Promise<boolean> {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  }

  // Check browser AVIF support
  static isAVIFSupported(): Promise<boolean> {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      // Minimal AVIF image (1x1 pixel)
      img.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErZ42';
    });
  }

  // Compress with the optimal format
  static async optimizeImage(
    file: File,
    options: {
      maxWidth?: number;
      maxHeight?: number;
      targetSizeKB?: number;
      preferredFormat?: 'webp' | 'jpeg' | 'auto';
    } = {}
  ): Promise<File> {
    const {
      maxWidth = 1920,
      maxHeight = 1080,
      targetSizeKB,
      preferredFormat = 'auto',
    } = options;

    // 1. Resize
    let processed = await resizeImage(file, { maxWidth, maxHeight });

    // 2. Format selection
    let format: 'image/webp' | 'image/jpeg' = 'image/jpeg';
    if (preferredFormat === 'webp' || (preferredFormat === 'auto' && await this.isWebPSupported())) {
      format = 'image/webp';
    }

    // 3. Quality adjustment (when target size is specified)
    if (targetSizeKB) {
      let quality = 0.92;
      let result = await this.convert(processed, format, quality, format === 'image/webp' ? '.webp' : '.jpg');

      // Binary search for optimal quality
      let minQuality = 0.1;
      let maxQuality = 0.95;

      for (let i = 0; i < 8; i++) {
        if (result.size > targetSizeKB * 1024) {
          maxQuality = quality;
        } else {
          minQuality = quality;
        }
        quality = (minQuality + maxQuality) / 2;
        result = await this.convert(processed, format, quality, format === 'image/webp' ? '.webp' : '.jpg');
      }

      return result;
    }

    // 4. Convert with default quality
    return this.convert(processed, format, 0.85, format === 'image/webp' ? '.webp' : '.jpg');
  }
}
```

| Format | Compression | Quality | Browser Support | Use Case |
|--------|-------------|---------|-----------------|----------|
| JPEG | High | Slight loss | All | Photos, natural images |
| PNG | Low | Lossless | All | Icons, transparent images |
| WebP | Very high | Good | Modern browsers | General use (recommended) |
| AVIF | Highest | Best | Limited | Next-generation format |
| GIF | Low | Limited | All | Animations |
| SVG | N/A | Perfect | All | Vector images |

---

## 7. Chunked Upload (Split Upload)

### 7.1 Chunked Upload Overview

When uploading large files (hundreds of MB to several GB), splitting the file into small chunks and uploading them sequentially is effective. Benefits include resumability on network failure, optimized memory usage, and improved accuracy of progress display.

```
Chunked Upload Flow:

  [Client]                    [Server]                  [Storage]
      |                          |                          |
      |-- 1. Start upload ------>|                          |
      |<-- 2. Return uploadId ---|                          |
      |                          |                          |
      |-- 3. Send chunk 1 ------>|-- Save temporarily ----->|
      |<-- 4. Chunk 1 accepted --|                          |
      |                          |                          |
      |-- 5. Send chunk 2 ------>|-- Save temporarily ----->|
      |<-- 6. Chunk 2 accepted --|                          |
      |                          |                          |
      |   ... interruption ...   |                          |
      |                          |                          |
      |-- 7. Resume request ---->|                          |
      |<-- 8. Completed chunks --|                          |
      |                          |                          |
      |-- 9. Send chunk N ------>|-- Save temporarily ----->|
      |<-- 10. Chunk N accepted--|                          |
      |                          |                          |
      |-- 11. Upload complete -->|-- Merge chunks --------->|
      |<-- 12. Return final URL--|                          |
```

### 7.2 Client-Side Chunked Upload Implementation

```typescript
// Chunked upload configuration
interface ChunkUploadConfig {
  chunkSize: number;          // Chunk size (bytes)
  maxRetries: number;         // Maximum retries per chunk
  retryDelay: number;         // Retry interval (milliseconds)
  concurrentChunks: number;   // Number of concurrent chunk uploads
  apiEndpoint: string;        // API endpoint
}

const DEFAULT_CHUNK_CONFIG: ChunkUploadConfig = {
  chunkSize: 5 * 1024 * 1024,  // 5MB
  maxRetries: 3,
  retryDelay: 1000,
  concurrentChunks: 3,
  apiEndpoint: '/api/upload/chunk',
};

// Chunk information
interface ChunkInfo {
  index: number;
  start: number;
  end: number;
  size: number;
  blob: Blob;
  status: 'pending' | 'uploading' | 'success' | 'error';
  retries: number;
  etag?: string;
}

// Chunked uploader class
class ChunkedUploader {
  private config: ChunkUploadConfig;
  private chunks: ChunkInfo[] = [];
  private uploadId: string | null = null;
  private abortController: AbortController | null = null;

  constructor(config: Partial<ChunkUploadConfig> = {}) {
    this.config = { ...DEFAULT_CHUNK_CONFIG, ...config };
  }

  // Split file into chunks
  private createChunks(file: File): ChunkInfo[] {
    const chunks: ChunkInfo[] = [];
    const totalChunks = Math.ceil(file.size / this.config.chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.config.chunkSize;
      const end = Math.min(start + this.config.chunkSize, file.size);

      chunks.push({
        index: i,
        start,
        end,
        size: end - start,
        blob: file.slice(start, end),
        status: 'pending',
        retries: 0,
      });
    }

    return chunks;
  }

  // Start upload
  async upload(
    file: File,
    callbacks: {
      onProgress?: (progress: {
        percent: number;
        uploadedBytes: number;
        totalBytes: number;
        uploadedChunks: number;
        totalChunks: number;
        speed: number;
      }) => void;
      onComplete?: (result: { url: string; key: string }) => void;
      onError?: (error: Error) => void;
      onChunkComplete?: (chunkIndex: number) => void;
    } = {}
  ): Promise<{ url: string; key: string }> {
    this.abortController = new AbortController();
    this.chunks = this.createChunks(file);

    try {
      // 1. Initialize upload session
      const initResponse = await fetch(`${this.config.apiEndpoint}/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size,
          contentType: file.type,
          totalChunks: this.chunks.length,
          chunkSize: this.config.chunkSize,
        }),
        signal: this.abortController.signal,
      });

      if (!initResponse.ok) {
        throw new Error('Failed to initialize upload');
      }

      const { uploadId } = await initResponse.json();
      this.uploadId = uploadId;

      // 2. Upload chunks in parallel
      let uploadedBytes = 0;
      const startTime = Date.now();

      const uploadChunk = async (chunk: ChunkInfo): Promise<void> => {
        chunk.status = 'uploading';

        for (let retry = 0; retry <= this.config.maxRetries; retry++) {
          try {
            const formData = new FormData();
            formData.append('chunk', chunk.blob);
            formData.append('chunkIndex', String(chunk.index));
            formData.append('uploadId', uploadId);

            const response = await fetch(`${this.config.apiEndpoint}/chunk`, {
              method: 'POST',
              body: formData,
              signal: this.abortController!.signal,
            });


            if (!response.ok) {
              throw new Error(`Failed to upload chunk ${chunk.index}`);
            }

            const result = await response.json();
            chunk.etag = result.etag;
            chunk.status = 'success';
            uploadedBytes += chunk.size;

            // Progress callback
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = uploadedBytes / elapsed;
            const completedChunks = this.chunks.filter(c => c.status === 'success').length;

            callbacks.onProgress?.({
              percent: Math.round((uploadedBytes / file.size) * 100),
              uploadedBytes,
              totalBytes: file.size,
              uploadedChunks: completedChunks,
              totalChunks: this.chunks.length,
              speed,
            });

            callbacks.onChunkComplete?.(chunk.index);
            return;
          } catch (error) {
            chunk.retries++;
            if (retry < this.config.maxRetries) {
              // Wait before retry (exponential backoff)
              await new Promise(resolve =>
                setTimeout(resolve, this.config.retryDelay * Math.pow(2, retry))
              );
            } else {
              chunk.status = 'error';
              throw error;
            }
          }
        }
      };

      // Limit concurrency with semaphore
      await this.runWithConcurrency(
        this.chunks.map(chunk => () => uploadChunk(chunk)),
        this.config.concurrentChunks
      );

      // 3. Notify upload completion
      const completeResponse = await fetch(`${this.config.apiEndpoint}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          parts: this.chunks.map(c => ({
            index: c.index,
            etag: c.etag,
          })),
        }),
        signal: this.abortController.signal,
      });

      if (!completeResponse.ok) {
        throw new Error('Failed to finalize upload');
      }

      const result = await completeResponse.json();
      callbacks.onComplete?.(result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      callbacks.onError?.(err);
      throw err;
    }
  }

  // Concurrency control
  private async runWithConcurrency(
    tasks: (() => Promise<void>)[],
    limit: number
  ): Promise<void> {
    const executing: Promise<void>[] = [];

    for (const task of tasks) {
      const p = task().then(() => {
        executing.splice(executing.indexOf(p), 1);
      });
      executing.push(p);

      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
  }

  // Resume (restart from interruption)
  async resume(
    file: File,
    uploadId: string,
    callbacks: {
      onProgress?: (progress: any) => void;
      onComplete?: (result: any) => void;
      onError?: (error: Error) => void;
    } = {}
  ): Promise<{ url: string; key: string }> {
    // Get information on completed chunks
    const statusResponse = await fetch(
      `${this.config.apiEndpoint}/status/${uploadId}`
    );

    if (!statusResponse.ok) {
      throw new Error('Failed to retrieve resume information');
    }

    const { completedChunks } = await statusResponse.json();
    const completedSet = new Set(completedChunks.map((c: any) => c.index));

    // Upload only incomplete chunks
    this.chunks = this.createChunks(file);
    this.chunks.forEach(chunk => {
      if (completedSet.has(chunk.index)) {
        chunk.status = 'success';
      }
    });

    this.uploadId = uploadId;
    // Upload remaining chunks (same logic as the upload method above)
    // ... (omitted: same processing as the latter half of the upload method)

    return { url: '', key: '' }; // Placeholder
  }

  // Cancel
  cancel(): void {
    this.abortController?.abort();

    // Also cancel the server-side upload session
    if (this.uploadId) {
      fetch(`${this.config.apiEndpoint}/abort`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: this.uploadId }),
      }).catch(() => {}); // Ignore errors
    }
  }

  // Get number of completed chunks
  getProgress(): { completed: number; total: number; percent: number } {
    const completed = this.chunks.filter(c => c.status === 'success').length;
    return {
      completed,
      total: this.chunks.length,
      percent: this.chunks.length > 0
        ? Math.round((completed / this.chunks.length) * 100)
        : 0,
    };
  }
}
```

### 7.3 S3 Multipart Upload (Server-Side)

```typescript
// Next.js API Routes: S3 multipart upload
// app/api/upload/chunk/init/route.ts
import {
  S3Client,
  CreateMultipartUploadCommand,
} from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'ap-northeast-1' });

export async function POST(request: Request) {
  const { filename, contentType, fileSize } = await request.json();

  // File size limit check (1GB)
  if (fileSize > 1024 * 1024 * 1024) {
    return Response.json(
      { error: 'File size must be 1GB or less' },
      { status: 400 }
    );
  }

  const key = `uploads/${crypto.randomUUID()}/${filename}`;

  const command = new CreateMultipartUploadCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
  });

  const { UploadId } = await s3.send(command);

  return Response.json({ uploadId: UploadId, key });
}

// app/api/upload/chunk/presign/route.ts
import { UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function POST(request: Request) {
  const { uploadId, key, partNumber } = await request.json();

  const command = new UploadPartCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });

  const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

  return Response.json({ presignedUrl });
}

// app/api/upload/chunk/complete/route.ts
import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';

export async function POST(request: Request) {
  const { uploadId, key, parts } = await request.json();

  const command = new CompleteMultipartUploadCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts.map((part: any) => ({
        PartNumber: part.partNumber,
        ETag: part.etag,
      })),
    },
  });

  const result = await s3.send(command);

  return Response.json({
    url: result.Location,
    key,
    etag: result.ETag,
  });
}

// app/api/upload/chunk/abort/route.ts
import { AbortMultipartUploadCommand } from '@aws-sdk/client-s3';

export async function POST(request: Request) {
  const { uploadId, key } = await request.json();

  const command = new AbortMultipartUploadCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    UploadId: uploadId,
  });

  await s3.send(command);

  return Response.json({ success: true });
}
```

### 7.4 Resumable Upload with the tus Protocol

tus is a standardized open protocol for resumable uploads.

```typescript
// Resumable upload using tus-js-client
import * as tus from 'tus-js-client';

function useTusUpload(endpoint: string) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'paused' | 'success' | 'error'>('idle');
  const uploadRef = useRef<tus.Upload | null>(null);

  const upload = useCallback((file: File) => {
    const tusUpload = new tus.Upload(file, {
      endpoint,
      retryDelays: [0, 1000, 3000, 5000], // Retry intervals
      chunkSize: 5 * 1024 * 1024, // 5MB chunks
      metadata: {
        filename: file.name,
        filetype: file.type,
        filesize: String(file.size),
      },
      // Hook before upload
      onBeforeRequest: (req) => {
        // Add authentication header
        const token = getAuthToken();
        if (token) {
          req.setHeader('Authorization', `Bearer ${token}`);
        }
      },
      // Progress
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
        setProgress(percentage);
      },
      // Success
      onSuccess: () => {
        setStatus('success');
        console.log('Upload complete:', tusUpload.url);
      },
      // Error
      onError: (error) => {
        setStatus('error');
        console.error('Upload error:', error);
      },
      // Chunk complete
      onChunkComplete: (chunkSize, bytesAccepted) => {
        console.log(`Chunk uploaded: ${formatFileSize(bytesAccepted)}`);
      },
    });

    uploadRef.current = tusUpload;
    setStatus('uploading');

    // Try to resume from a previous upload if one exists
    tusUpload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length > 0) {
        // Resume from the latest upload
        tusUpload.resumeFromPreviousUpload(previousUploads[0]);
      }
      tusUpload.start();
    });
  }, [endpoint]);

  const pause = useCallback(() => {
    uploadRef.current?.abort();
    setStatus('paused');
  }, []);

  const resume = useCallback(() => {
    uploadRef.current?.start();
    setStatus('uploading');
  }, []);

  const cancel = useCallback(() => {
    uploadRef.current?.abort();
    setStatus('idle');
    setProgress(0);
  }, []);

  return { progress, status, upload, pause, resume, cancel };
}
```

---

## 8. Server-Side File Processing

### 8.1 Receiving Files in Next.js App Router

```typescript
// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Upload configuration
const UPLOAD_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
  ],
  uploadDir: path.join(process.cwd(), 'uploads'),
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file was sent' },
        { status: 400 }
      );
    }

    // Validation
    const validationError = validateFile(file);
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    // Actual MIME type validation (magic byte check)
    const buffer = Buffer.from(await file.arrayBuffer());
    const actualMimeType = detectMimeType(buffer);

    if (!actualMimeType || !UPLOAD_CONFIG.allowedMimeTypes.includes(actualMimeType)) {
      return NextResponse.json(
        { error: 'Invalid file format. The actual file content does not match the extension.' },
        { status: 400 }
      );
    }

    // Generate a safe filename
    const uniqueId = crypto.randomUUID();
    const ext = getExtensionFromMimeType(actualMimeType);
    const safeFilename = `${uniqueId}${ext}`;

    // Create directory
    const dateDir = new Date().toISOString().split('T')[0];
    const uploadPath = path.join(UPLOAD_CONFIG.uploadDir, dateDir);
    await mkdir(uploadPath, { recursive: true });

    // Save the file
    const filePath = path.join(uploadPath, safeFilename);
    await writeFile(filePath, buffer);

    // Save metadata (DB)
    // await db.file.create({
    //   data: {
    //     originalName: file.name,
    //     storedName: safeFilename,
    //     mimeType: actualMimeType,
    //     size: file.size,
    //     path: filePath,
    //     url: `/uploads/${dateDir}/${safeFilename}`,
    //   },
    // });

    return NextResponse.json({
      url: `/uploads/${dateDir}/${safeFilename}`,
      filename: safeFilename,
      originalName: file.name,
      size: file.size,
      mimeType: actualMimeType,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'An error occurred during upload processing' },
      { status: 500 }
    );
  }
}

// File validation
function validateFile(file: File): string | null {
  // Size check
  if (file.size > UPLOAD_CONFIG.maxFileSize) {
    return `File size exceeds the limit (${formatFileSize(UPLOAD_CONFIG.maxFileSize)})`;
  }

  // Empty file check
  if (file.size === 0) {
    return 'Empty files cannot be uploaded';
  }

  // Filename check (path traversal prevention)
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return 'Invalid filename';
  }

  // Filename length check
  if (file.name.length > 255) {
    return 'Filename is too long (max 255 characters)';
  }

  return null;
}

// MIME type detection via magic bytes
function detectMimeType(buffer: Buffer): string | null {
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  // GIF: 47 49 46 38
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return 'image/gif';
  }

  // PDF: 25 50 44 46
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'application/pdf';
  }

  return null;
}

// Get extension from MIME type
function getExtensionFromMimeType(mimeType: string): string {
  const extensionMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'application/pdf': '.pdf',
  };
  return extensionMap[mimeType] || '.bin';
}
```

### 8.2 File Reception with Express.js + Multer

```typescript
// Implementation with Express.js + Multer
import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

const app = express();

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dateDir = new Date().toISOString().split('T')[0];
    const uploadPath = path.join(__dirname, 'uploads', dateDir);
    // Create directory if it doesn't exist
    require('fs').mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate a safe filename
    const uniqueId = crypto.randomUUID();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueId}${ext}`);
  },
});

// File filter
const fileFilter = (
  req: express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file format: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5, // Max 5 files
    fields: 10, // Max 10 fields
    fieldSize: 1 * 1024 * 1024, // Max field size: 1MB
  },
});

// Single file upload
app.post('/api/upload/single', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file was sent' });
  }

  res.json({
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mimeType: req.file.mimetype,
    path: req.file.path,
  });
});

// Multiple file upload
app.post('/api/upload/multiple', upload.array('files', 5), (req, res) => {
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files were sent' });
  }

  res.json({
    files: files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    })),
  });
});

// Multi-field file upload
app.post(
  '/api/upload/fields',
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'gallery', maxCount: 10 },
    { name: 'document', maxCount: 3 },
  ]),
  (req, res) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    res.json({
      avatar: files['avatar']?.[0],
      gallery: files['gallery'],
      documents: files['document'],
    });
  }
);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({ error: 'File size exceeds the limit' });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({ error: 'Number of files exceeds the limit' });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({ error: 'Invalid field name' });
      default:
        return res.status(400).json({ error: err.message });
    }
  }

  console.error('Upload error:', err);
  res.status(500).json({ error: 'An error occurred during upload processing' });
});
```

### 8.3 Server-Side Image Processing with Sharp

```typescript
// Server-side image processing with Sharp
import sharp from 'sharp';
import path from 'path';

// Image processing pipeline
interface ImageProcessingOptions {
  sizes: { name: string; width: number; height: number }[];
  formats: ('jpeg' | 'webp' | 'avif')[];
  quality: Record<string, number>;
  watermark?: {
    text: string;
    position: 'center' | 'bottom-right';
    opacity: number;
  };
}

const DEFAULT_PROCESSING: ImageProcessingOptions = {
  sizes: [
    { name: 'thumbnail', width: 150, height: 150 },
    { name: 'small', width: 320, height: 320 },
    { name: 'medium', width: 640, height: 640 },
    { name: 'large', width: 1280, height: 1280 },
    { name: 'original', width: 3840, height: 3840 },
  ],
  formats: ['jpeg', 'webp'],
  quality: {
    jpeg: 85,
    webp: 80,
    avif: 65,
  },
};

class ImageProcessor {
  private options: ImageProcessingOptions;

  constructor(options: Partial<ImageProcessingOptions> = {}) {
    this.options = { ...DEFAULT_PROCESSING, ...options };
  }

  // Generate image in multiple sizes and formats
  async processImage(
    inputPath: string,
    outputDir: string
  ): Promise<{
    variants: { name: string; format: string; path: string; size: number }[];
    metadata: sharp.Metadata;
  }> {
    const metadata = await sharp(inputPath).metadata();
    const variants: { name: string; format: string; path: string; size: number }[] = [];

    for (const sizeConfig of this.options.sizes) {
      for (const format of this.options.formats) {
        const outputFilename = `${sizeConfig.name}.${format}`;
        const outputPath = path.join(outputDir, outputFilename);

        let pipeline = sharp(inputPath)
          .rotate() // Apply EXIF rotation information
          .resize(sizeConfig.width, sizeConfig.height, {
            fit: 'inside',
            withoutEnlargement: true,
          });

        // Format conversion
        switch (format) {
          case 'jpeg':
            pipeline = pipeline.jpeg({
              quality: this.options.quality.jpeg,
              progressive: true,
              mozjpeg: true,
            });
            break;
          case 'webp':
            pipeline = pipeline.webp({
              quality: this.options.quality.webp,
              effort: 4,
            });
            break;
          case 'avif':
            pipeline = pipeline.avif({
              quality: this.options.quality.avif,
              effort: 4,
            });
            break;
        }

        const info = await pipeline.toFile(outputPath);

        variants.push({
          name: sizeConfig.name,
          format,
          path: outputPath,
          size: info.size,
        });
      }
    }

    return { variants, metadata: metadata };
  }

  // Get image metadata
  async getMetadata(inputPath: string): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
    hasAlpha: boolean;
    orientation?: number;
  }> {
    const metadata = await sharp(inputPath).metadata();
    const stats = await sharp(inputPath).stats();

    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: metadata.size || 0,
      hasAlpha: metadata.hasAlpha || false,
      orientation: metadata.orientation,
    };
  }

  // Strip EXIF data (privacy protection)
  async stripExif(inputPath: string, outputPath: string): Promise<void> {
    await sharp(inputPath)
      .rotate() // Apply rotation first
      .withMetadata({ orientation: undefined }) // Remove EXIF
      .toFile(outputPath);
  }
}
```

---

## 9. Security Measures

File upload is one of the most vulnerable features in web applications. Inadequate security measures can lead to serious vulnerabilities including remote code execution (RCE), directory traversal, cross-site scripting (XSS), and denial of service (DoS).

### 9.1 Threat Model and Attack Vectors

```
Major attacks against file upload:

  1. Malware upload
     → Distribution of viruses, trojans, ransomware
     → Countermeasure: Virus scanning, file type restrictions

  2. Web shell (remote code execution)
     → Upload .php, .jsp, .aspx files to execute on server
     → Countermeasure: Extension whitelist, remove execute permissions, serve from separate domain

  3. Directory traversal
     → Include "../" in filename to write to arbitrary paths
     → Countermeasure: Sanitize filenames, rename with UUID

  4. XSS (cross-site scripting)
     → Embed malicious scripts in SVG or HTML files
     → Countermeasure: Strict Content-Type settings, CSP headers

  5. DoS (denial of service)
     → Exhaust server resources with huge file uploads
     → Countermeasure: File size limits, rate limiting, timeouts

  6. MIME type spoofing
     → Executable files with .jpg extension, etc.
     → Countermeasure: Validate actual file content via magic bytes

  7. Zip bomb
     → Compressed files that expand to enormous size
     → Countermeasure: Limit expanded size, prohibit recursive expansion

  8. Metadata attack
     → Embed malicious payloads in EXIF data
     → Countermeasure: Strip metadata, re-encode
```

### 9.2 Server-Side Security Implementation

```typescript
// Secure file upload service
import crypto from 'crypto';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

class SecureFileUploadService {
  private readonly allowedMimeTypes: Set<string>;
  private readonly maxFileSize: number;
  private readonly uploadDir: string;

  constructor(config: {
    allowedMimeTypes: string[];
    maxFileSize: number;
    uploadDir: string;
  }) {
    this.allowedMimeTypes = new Set(config.allowedMimeTypes);
    this.maxFileSize = config.maxFileSize;
    this.uploadDir = config.uploadDir;
  }

  // Comprehensive file validation
  async validateFile(buffer: Buffer, originalName: string): Promise<{
    isValid: boolean;
    errors: string[];
    detectedMimeType: string | null;
  }> {
    const errors: string[] = [];

    // 1. File size check
    if (buffer.length === 0) {
      errors.push('File is empty');
    }
    if (buffer.length > this.maxFileSize) {
      errors.push(`File size exceeds the limit (${formatFileSize(this.maxFileSize)})`);
    }

    // 2. Filename sanitization check
    const filenameErrors = this.validateFilename(originalName);
    errors.push(...filenameErrors);

    // 3. MIME type validation via magic bytes
    const detectedMimeType = this.detectMimeTypeFromMagicBytes(buffer);
    if (!detectedMimeType) {
      errors.push('Could not determine file format');
    } else if (!this.allowedMimeTypes.has(detectedMimeType)) {
      errors.push(`File format is not allowed: ${detectedMimeType}`);
    }

    // 4. Check consistency between extension and MIME type
    if (detectedMimeType) {
      const ext = path.extname(originalName).toLowerCase();
      const expectedExtensions = this.getExpectedExtensions(detectedMimeType);
      if (!expectedExtensions.includes(ext)) {
        errors.push(
          `File extension (${ext}) does not match actual content (${detectedMimeType})`
        );
      }
    }

    // 5. Scan for dangerous content
    const dangerousContent = this.scanForDangerousContent(buffer);
    if (dangerousContent.length > 0) {
      errors.push(...dangerousContent);
    }

    return {
      isValid: errors.length === 0,
      errors,
      detectedMimeType,
    };
  }

  // Filename validation
  private validateFilename(filename: string): string[] {
    const errors: string[] = [];

    // Path traversal prevention
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      errors.push('Filename contains invalid string');
    }

    // NULL byte prevention
    if (filename.includes('\0')) {
      errors.push('Filename contains a NULL byte');
    }

    // Length check
    if (filename.length > 255) {
      errors.push('Filename is too long (max 255 characters)');
    }

    // Dangerous extension check
    const dangerousExtensions = [
      '.php', '.php3', '.php4', '.php5', '.phtml',
      '.jsp', '.jspx', '.jsw', '.jsv',
      '.asp', '.aspx', '.cer', '.csr',
      '.exe', '.dll', '.bat', '.cmd', '.com', '.msi',
      '.ps1', '.vbs', '.js', '.wsh', '.wsf',
      '.sh', '.bash', '.cgi', '.pl', '.py', '.rb',
      '.htaccess', '.htpasswd',
      '.svg', // When XSS risk is present
    ];

    const ext = path.extname(filename).toLowerCase();
    if (dangerousExtensions.includes(ext)) {
      errors.push(`Dangerous file extension detected: ${ext}`);
    }

    // Double extension check (e.g., file.php.jpg)
    const parts = filename.split('.');
    if (parts.length > 2) {
      for (let i = 0; i < parts.length - 1; i++) {
        const checkExt = `.${parts[i]}`;
        if (dangerousExtensions.includes(checkExt.toLowerCase())) {
          errors.push(`Double extension detected: ${filename}`);
          break;
        }
      }
    }

    return errors;
  }

  // MIME type detection via magic bytes
  private detectMimeTypeFromMagicBytes(buffer: Buffer): string | null {
    const signatures: Array<{
      bytes: number[];
      offset: number;
      mimeType: string;
    }> = [
      // JPEG
      { bytes: [0xFF, 0xD8, 0xFF], offset: 0, mimeType: 'image/jpeg' },
      // PNG
      { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0, mimeType: 'image/png' },
      // GIF87a
      { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], offset: 0, mimeType: 'image/gif' },
      // GIF89a
      { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], offset: 0, mimeType: 'image/gif' },
      // PDF
      { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0, mimeType: 'application/pdf' },
      // ZIP
      { bytes: [0x50, 0x4B, 0x03, 0x04], offset: 0, mimeType: 'application/zip' },
    ];

    // WebP special check (RIFF...WEBP)
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 &&
      buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 &&
      buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
      return 'image/webp';
    }

    for (const sig of signatures) {
      if (buffer.length < sig.offset + sig.bytes.length) continue;

      let match = true;
      for (let i = 0; i < sig.bytes.length; i++) {
        if (buffer[sig.offset + i] !== sig.bytes[i]) {
          match = false;
          break;
        }
      }

      if (match) return sig.mimeType;
    }

    return null;
  }

  // Scan for dangerous content
  private scanForDangerousContent(buffer: Buffer): string[] {
    const errors: string[] = [];
    const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 10240));

    // Detect script tags
    if (/<script[\s>]/i.test(content)) {
      errors.push('Script tag detected in file');
    }

    // Detect PHP tags
    if (/<\?php/i.test(content) || /<\?=/i.test(content)) {
      errors.push('PHP code detected in file');
    }

    // Detect event handlers (SVG/HTML)
    if (/\bon\w+\s*=/i.test(content)) {
      errors.push('Event handler detected in file');
    }

    return errors;
  }

  // Expected extension mapping
  private getExpectedExtensions(mimeType: string): string[] {
    const map: Record<string, string[]> = {
      'image/jpeg': ['.jpg', '.jpeg', '.jpe'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif'],
      'application/pdf': ['.pdf'],
      'application/zip': ['.zip'],
    };
    return map[mimeType] || [];
  }

  // Generate a safe filename
  generateSafeFilename(mimeType: string): string {
    const uuid = crypto.randomUUID();
    const ext = this.getExpectedExtensions(mimeType)[0] || '.bin';
    return `${uuid}${ext}`;
  }

  // Virus scan (ClamAV integration)
  async scanForVirus(filePath: string): Promise<{
    isClean: boolean;
    threat?: string;
  }> {
    try {
      // Use ClamAV's clamscan command
      const { stdout } = await execFileAsync('clamscan', [
        '--no-summary',
        '--infected',
        filePath,
      ]);

      return { isClean: true };
    } catch (error: any) {
      // clamscan returns exit code 1 when an infected file is found
      if (error.code === 1) {
        return {
          isClean: false,
          threat: error.stdout?.trim() || 'Malware detected',
        };
      }
      // Other errors (ClamAV unavailable, etc.)
      console.error('Virus scan error:', error);
      throw new Error('Virus scan failed');
    }
  }
}
```

### 9.3 Content-Disposition and Security Headers

```typescript
// Security header configuration when serving files
function getSecureFileHeaders(
  filename: string,
  mimeType: string,
  options: {
    inline?: boolean;
    noSniff?: boolean;
    csp?: string;
  } = {}
): Record<string, string> {
  const {
    inline = false,
    noSniff = true,
    csp = "default-src 'none'; img-src 'self'; style-src 'none'; script-src 'none'",
  } = options;

  // RFC 5987 compliant filename encoding
  const encodedFilename = encodeURIComponent(filename)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A');

  const headers: Record<string, string> = {
    // Content-Disposition: controls whether to download or display inline
    'Content-Disposition': inline
      ? `inline; filename="${filename}"; filename*=UTF-8''${encodedFilename}`
      : `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,

    // Content-Type: explicitly set MIME type
    'Content-Type': mimeType,

    // Cache-Control: for private files
    'Cache-Control': 'private, max-age=31536000, immutable',
  };

  // X-Content-Type-Options: prevent MIME sniffing
  if (noSniff) {
    headers['X-Content-Type-Options'] = 'nosniff';
  }

  // Content-Security-Policy: XSS prevention when displaying inline
  if (inline && csp) {
    headers['Content-Security-Policy'] = csp;
  }

  // X-Frame-Options: clickjacking prevention
  headers['X-Frame-Options'] = 'DENY';

  return headers;
}

// File serving with Express
app.get('/files/:id', async (req, res) => {
  const fileRecord = await db.file.findUnique({
    where: { id: req.params.id },
  });

  if (!fileRecord) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Access permission check
  if (!canAccessFile(req.user, fileRecord)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const headers = getSecureFileHeaders(
    fileRecord.originalName,
    fileRecord.mimeType,
    {
      // Allow inline display for images
      inline: fileRecord.mimeType.startsWith('image/'),
    }
  );

  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  res.sendFile(fileRecord.storedPath);
});
```

### 9.4 Rate Limiting and Resource Protection

```typescript
// Upload rate limiting
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// Rate limit: max 10 requests per user per minute
const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    error: 'Too many uploads. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
});

// Slow down: delay response when there are many requests
const uploadSlowDown = slowDown({
  windowMs: 60 * 1000,
  delayAfter: 5,
  delayMs: (hits) => hits * 200,
});

// Storage quota service
class StorageQuotaService {
  private readonly quotaPerUser: number; // bytes

  constructor(quotaGB: number = 5) {
    this.quotaPerUser = quotaGB * 1024 * 1024 * 1024;
  }

  async checkQuota(userId: string, additionalBytes: number): Promise<{
    allowed: boolean;
    currentUsage: number;
    quota: number;
    remainingBytes: number;
  }> {
    // Get current storage usage for the user
    const currentUsage = await this.getUserStorageUsage(userId);
    const remainingBytes = this.quotaPerUser - currentUsage;

    return {
      allowed: currentUsage + additionalBytes <= this.quotaPerUser,
      currentUsage,
      quota: this.quotaPerUser,
      remainingBytes: Math.max(0, remainingBytes),
    };
  }

  private async getUserStorageUsage(userId: string): Promise<number> {
    // Sum all file sizes for the user from the DB
    // const result = await db.file.aggregate({
    //   _sum: { size: true },
    //   where: { userId },
    // });
    // return result._sum.size || 0;
    return 0; // Placeholder
  }
}

// Integration into upload middleware
async function uploadMiddleware(req: any, res: any, next: any) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Storage capacity check
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  const quotaService = new StorageQuotaService();
  const quotaCheck = await quotaService.checkQuota(userId, contentLength);

  if (!quotaCheck.allowed) {
    return res.status(413).json({
      error: 'Insufficient storage space',
      currentUsage: formatFileSize(quotaCheck.currentUsage),
      quota: formatFileSize(quotaCheck.quota),
      remaining: formatFileSize(quotaCheck.remainingBytes),
    });
  }

  next();
}
```

### 9.5 Security Checklist

| Check Item | Priority | Countermeasure |
|------------|----------|---------------|
| File size limit | Required | Enforce limit on server side |
| File type restriction | Required | Use whitelist approach |
| Magic byte validation | Required | Validate binary content, not just extension |
| Filename sanitization | Required | Rename with UUID |
| Path traversal prevention | Required | Remove `..` `/` `\` |
| NULL byte removal | Required | Remove `\0` from filenames |
| Remove execute permissions | Required | Do not grant execute permissions to saved files |
| Fix Content-Type | Required | Server sets correct MIME type |
| X-Content-Type-Options | Required | Set `nosniff` header |
| Content-Disposition | Recommended | Set `attachment` when downloading |
| Serve from separate domain | Recommended | Serve files from CDN/separate domain |
| Virus scanning | Recommended | Scan with ClamAV etc. |
| Rate limiting | Recommended | Limit upload frequency per user |
| Storage quota | Recommended | Set storage limit per user |
| Double extension check | Recommended | Detect `file.php.jpg` etc. |
| Strip EXIF data | Recommended | For privacy protection |
| CSP header | Recommended | XSS prevention when displaying inline |
| Auto-delete temp files | Recommended | Manage temp files with TTL |

---

## 10. Upload Library Comparison

### 10.1 Frontend Library Comparison

| Library | Size | Features | Characteristics |
|---------|------|----------|----------------|
| react-dropzone | 8KB | D&D, validation | Simple, React hook |
| Uppy | 45KB+ | Full-featured | Plugin architecture |
| Filepond | 36KB | Image preview, conversion | Beautiful UI |
| Dropzone.js | 43KB | D&D, preview | jQuery/vanilla compatible |
| Fine Uploader | 100KB+ | Full-featured | Enterprise-grade |
| tus-js-client | 12KB | Resumable | tus protocol |

### 10.2 Backend Library Comparison

| Library | Language/FW | Features | Use Case |
|---------|-------------|----------|----------|
| Multer | Node/Express | multipart parsing | File upload for Express |
| Busboy | Node | Streaming parsing | Low-level multipart processing |
| Formidable | Node | File parsing, progress | General Node.js upload |
| Sharp | Node | Image processing | Resize/convert/optimize |
| @aws-sdk/client-s3 | Node | S3 operations | AWS S3 integration |
| tusd | Go | tus server | Resumable upload server |

### 10.3 Feature-Rich Upload UI with Uppy

```typescript
import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import XHRUpload from '@uppy/xhr-upload';
import ImageEditor from '@uppy/image-editor';
import Webcam from '@uppy/webcam';
import '@uppy/core/dist/style.css';
import '@uppy/dashboard/dist/style.css';
import '@uppy/image-editor/dist/style.css';
import '@uppy/webcam/dist/style.css';

// Uppy configuration
function createUppy(options: {
  uploadEndpoint: string;
  maxFiles: number;
  maxFileSize: number;
  allowedFileTypes: string[];
  onComplete: (results: any[]) => void;
}) {
  const uppy = new Uppy({
    id: 'file-uploader',
    autoProceed: false,
    restrictions: {
      maxFileSize: options.maxFileSize,
      maxNumberOfFiles: options.maxFiles,
      allowedFileTypes: options.allowedFileTypes,
    },
    locale: {
      strings: {
        dropPasteFiles: 'Drag & drop files here, or %{browseFiles}',
        browseFiles: 'browse files',
        uploadComplete: 'Upload complete',
        xFilesSelected: {
          0: '%{smart_count} file selected',
          1: '%{smart_count} files selected',
        },
      },
    },
  })
    // Dashboard UI
    .use(Dashboard, {
      inline: true,
      target: '#uppy-dashboard',
      width: '100%',
      height: 400,
      showProgressDetails: true,
      proudlyDisplayPoweredByUppy: false,
      note: `Up to ${options.maxFiles} files, each up to ${formatFileSize(options.maxFileSize)}`,
    })
    // Image editor
    .use(ImageEditor, {
      target: Dashboard,
      quality: 0.85,
      cropperOptions: {
        viewMode: 1,
        background: false,
        autoCropArea: 1,
        responsive: true,
      },
    })
    // Webcam
    .use(Webcam, {
      target: Dashboard,
      modes: ['picture'],
      mirror: true,
    })
    // XHR upload
    .use(XHRUpload, {
      endpoint: options.uploadEndpoint,
      formData: true,
      fieldName: 'file',
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });

  // Event handling
  uppy.on('complete', (result) => {
    const successful = result.successful?.map((file: any) => ({
      name: file.name,
      size: file.size,
      url: file.response?.body?.url,
    }));

    options.onComplete(successful || []);
  });

  uppy.on('upload-error', (file, error) => {
    console.error(`Upload error for ${file?.name}:`, error);
  });

  return uppy;
}

// Usage in React component
function UppyUploader() {
  useEffect(() => {
    const uppy = createUppy({
      uploadEndpoint: '/api/upload',
      maxFiles: 10,
      maxFileSize: 10 * 1024 * 1024,
      allowedFileTypes: ['image/*', '.pdf'],
      onComplete: (results) => {
        console.log('Uploaded files:', results);
      },
    });

    return () => {
      uppy.close();
    };
  }, []);

  return <div id="uppy-dashboard" />;
}
```

---

## 11. Troubleshooting

### 11.1 Common Issues and Solutions

```
Issue 1: Content-Type header misconfiguration

  Symptom: File is not correctly received by the server
  Cause: Manually setting Content-Type: multipart/form-data in fetch()

  // BAD: Manually setting Content-Type omits the boundary
  fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data', // This is the cause
    },
    body: formData,
  });

  // GOOD: Don't set Content-Type (browser sets it automatically)
  fetch('/api/upload', {
    method: 'POST',
    body: formData,  // Content-Type is set automatically
  });

---

Issue 2: CORS error

  Symptom: CORS error occurs during direct S3 upload
  Cause: Incorrect S3 bucket CORS configuration

  Check:
  - Does AllowedOrigins include the frontend domain?
  - Does AllowedMethods include PUT?
  - Does AllowedHeaders include Content-Type?
  - Check the actual error message in the browser developer tools

---

Issue 3: Timeout with large files

  Symptom: Upload times out for files larger than a few MB
  Cause: Server body size limit, proxy timeout settings

  Solutions:
  - Next.js: Set bodySize in route config
    export const config = { api: { bodyParser: { sizeLimit: '50mb' } } };
  - Nginx: Set client_max_body_size
    client_max_body_size 50M;
    proxy_read_timeout 300s;
  - Consider adopting chunked upload

---

Issue 4: Memory leak (Object URL)

  Symptom: Memory usage increases as preview images accumulate
  Cause: Not releasing URLs created by URL.createObjectURL()

  Solution: Call URL.revokeObjectURL(url) when component unmounts
  or when a file is deleted

---

Issue 5: Image rotation on iOS Safari

  Symptom: Images taken on iOS Safari display rotated
  Cause: Insufficient handling of EXIF Orientation tag

  Solutions:
  - Use CSS image-orientation: from-image;
  - Fix rotation with Canvas before upload
  - Use Sharp's .rotate() on the server side

---

Issue 6: File input reset doesn't work

  Symptom: onChange doesn't fire when selecting the same file consecutively
  Cause: The value of the input element is not cleared

  Solution:
  inputRef.current.value = ''; // Explicitly clear
  or change the key attribute in React to remount the input

---

Issue 7: req.file is undefined with Multer

  Symptom: Cannot receive file in Express + Multer
  Cause: Field name mismatch, Content-Type issue

  Check:
  - Does the FormData append key match the Multer .single('key') field name?
  - Are you manually setting Content-Type?
  - Is body-parser trying to process multipart?
```

### 11.2 Browser Compatibility Notes

| Feature | Chrome | Firefox | Safari | Edge | iOS Safari |
|---------|--------|---------|--------|------|-----------|
| File API | 6+ | 3.6+ | 5.1+ | 12+ | 6+ |
| FileReader | 6+ | 3.6+ | 6+ | 12+ | 7+ |
| FormData | 7+ | 4+ | 5+ | 12+ | 5+ |
| Drag & Drop | 4+ | 3.5+ | 3.1+ | 12+ | 11+ |
| multiple attribute | 5+ | 3.6+ | 4+ | 12+ | 5+ |
| accept attribute | 8+ | 4+ | 6+ | 12+ | 6+ |
| capture attribute | 25+ | - | 6+ | 12+ | 6+ |
| webkitdirectory | 11+ | 50+ | 11.1+ | 13+ | 14+ |
| Blob.slice | 13+ | 13+ | 7+ | 12+ | 7+ |
| URL.createObjectURL | 8+ | 4+ | 6+ | 12+ | 6+ |
| AbortController | 66+ | 57+ | 11.1+ | 16+ | 11.3+ |
| ReadableStream | 43+ | 65+ | 10.1+ | 14+ | 10.3+ |

### 11.3 Performance Optimization Tips

```typescript
// Performance optimization checklist
const performanceChecklist = {
  // Client-side
  client: [
    'Process files in Web Workers (do not block the main thread)',
    'Generate thumbnails at low resolution (e.g., Canvas 150x150)',
    'Call revokeObjectURL immediately after Object URLs are no longer needed',
    'For large files, use createObjectURL instead of FileReader',
    'Lazy-load preview images',
    'Use OffscreenCanvas for resizing (supported browsers only)',
  ],

  // Network
  network: [
    'Compress images client-side before uploading',
    'Split large files with chunked upload',
    'Limit concurrent uploads (3-5 connections)',
    'Use HTTP/2 to avoid head-of-line blocking',
    'Place upload endpoint on CDN',
    'Consider S3 Transfer Acceleration',
  ],

  // Server-side
  server: [
    'Use streaming processing to reduce memory usage',
    'Delegate image processing to async job queues',
    'Distribute file storage with sharding',
    'Scale image processing with Lambda/Cloud Functions',
    'Cache static files with CDN',
    'Consider on-demand image transformation (imgix, Cloudinary)',
  ],
};

// Image resizing in a Web Worker (without blocking the main thread)
// worker.ts
self.onmessage = async (event: MessageEvent) => {
  const { imageData, maxWidth, maxHeight, quality, format } = event.data;

  const canvas = new OffscreenCanvas(maxWidth, maxHeight);
  const ctx = canvas.getContext('2d')!;

  // Draw using ImageBitmap
  const bitmap = await createImageBitmap(imageData);
  const { width, height } = calculateDimensions(
    bitmap.width,
    bitmap.height,
    maxWidth,
    maxHeight,
    true
  );

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: format, quality });
  self.postMessage({ blob }, [await blob.arrayBuffer()]);
};

// Usage from the main thread
function resizeInWorker(file: File, options: any): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('/workers/image-resize.js');

    worker.onmessage = (event) => {
      resolve(event.data.blob);
      worker.terminate();
    };

    worker.onerror = (error) => {
      reject(error);
      worker.terminate();
    };

    worker.postMessage({
      imageData: file,
      ...options,
    });
  });
}
```

---

## 12. Architecture Patterns and Design Principles

### 12.1 Choosing a File Upload Architecture

```
Method 1: Server-proxied upload
  Client → Server → Storage
  Pros: Simple implementation, easy server-side processing
  Cons: Consumes server bandwidth, limited scalability
  Use case: Small to medium apps, files up to a few MB

Method 2: Direct upload to S3 via presigned URL
  Client → S3 (presigned URL)
  Pros: Saves server bandwidth, leverages S3 scalability
  Cons: CORS configuration required, more complex client-side logic
  Use case: Medium to large apps, image/video uploads

Method 3: Chunked upload
  Client → Server (chunks × N)
  Pros: Resumable, handles large files
  Cons: Complex implementation, server-side state management required
  Use case: Large files (100MB+), video uploads

Method 4: CDN/edge upload
  Client → CDN Edge → Origin Storage
  Pros: Upload to geographically close edge, best performance
  Cons: Higher cost, dependency on CDN provider
  Use case: Global services, real-time processing
```

### 12.2 Image Processing Pipeline Design

```
Recommended architecture:

  [Upload]
      ↓
  [Save original] → S3 (originals/)
      ↓
  [Trigger event] → S3 Event / SQS
      ↓
  [Lambda image processing]
      ├── Resize: thumbnail (150x150)
      ├── Resize: small (320x320)
      ├── Resize: medium (640x640)
      ├── Resize: large (1280x1280)
      ├── Format conversion: WebP
      ├── Format conversion: AVIF
      └── Metadata removal: EXIF strip
      ↓
  [Save processed] → S3 (processed/)
      ↓
  [CDN delivery] → CloudFront

Alternative: On-demand transformation
  [Request] → CDN → [Lambda@Edge / Cloudinary]
                           ↓
                  Real-time transformation (cached)
```

### 12.3 Database Model Design

```typescript
// Prisma schema: file management
// prisma/schema.prisma

/*
model File {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])

  // Original file info
  originalName  String
  storedName    String   @unique
  mimeType      String
  size          Int      // Bytes
  hash          String   // SHA-256 hash (for duplicate detection)

  // Storage info
  storageKey    String   @unique  // S3 key
  bucket        String
  region        String

  // Metadata
  width         Int?     // For images
  height        Int?     // For images
  duration      Float?   // For video/audio (seconds)

  // Status
  status        FileStatus @default(PENDING)
  scanResult    ScanResult?
  scanDate      DateTime?

  // Variants (resized versions, etc.)
  variants      FileVariant[]
  parentId      String?
  parent        File?    @relation("FileVariants", fields: [parentId], references: [id])
  children      File[]   @relation("FileVariants")

  // Timestamps
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?

  // Indexes
  @@index([userId])
  @@index([hash])
  @@index([status])
  @@index([createdAt])
}

model FileVariant {
  id         String @id @default(cuid())
  fileId     String
  file       File   @relation(fields: [fileId], references: [id])

  name       String  // "thumbnail", "small", "medium", "large"
  format     String  // "jpeg", "webp", "avif"
  width      Int
  height     Int
  size       Int
  storageKey String @unique
  url        String

  @@unique([fileId, name, format])
}

enum FileStatus {
  PENDING      // Immediately after upload
  PROCESSING   // Image processing in progress
  ACTIVE       // Available for use
  QUARANTINED  // Virus detected
  DELETED      // Soft-deleted
}

enum ScanResult {
  CLEAN
  INFECTED
  ERROR
}
*/
```

---

## Summary

### Implementation Pattern Quick Reference

| Pattern | Use Case | Difficulty | Recommended For |
|---------|----------|------------|-----------------|
| `<input type="file">` + FormData | Basic upload | Low | Small forms |
| react-dropzone | Drag & drop | Low-Medium | General React apps |
| XMLHttpRequest + progress | Progress display | Medium | UX-focused apps |
| S3 Presigned URL | Reduce server load | Medium | Medium to large apps |
| Canvas API | Client-side resize | Medium | Image uploads |
| Chunked upload | Large file support | High | Video/large files |
| tus protocol | Resumable | Medium | Unstable networks |
| Uppy | Full-featured UI | Low | Feature-rich uploads |
| Sharp | Server-side image processing | Medium | Image optimization |
| Lambda + S3 Event | Async image processing | High | Large-scale services |

### Best Practices Summary

1. **Client-side**: Input restrictions with accept attribute, preview display, client-side resizing
2. **Network**: Progress display, cancel functionality, retry mechanism
3. **Server-side**: Magic byte validation, filename sanitization, capacity limits
4. **Security**: MIME validation, virus scanning, CSP headers, serve from separate domain
5. **Performance**: CDN delivery, on-demand transformation, Web Worker utilization

### Anti-Patterns

| Anti-Pattern | Problem | Correct Implementation |
|--------------|---------|------------------------|
| Manually setting Content-Type | boundary is missing | Let the browser set it automatically |
| Using filename as-is | Path traversal risk | Rename with UUID |
| Validating only by extension | MIME spoofing possible | Validate actual content with magic bytes |
| Not releasing Object URLs | Memory leak | Always call revokeObjectURL() |
| Routing large files through server | Wastes server bandwidth | Use direct S3 upload |
| Synchronous image processing | Delays server response | Delegate to async job queue |
| Insufficient error handling | User encounters unexplained failures | Display detailed error messages |
| Unlimited uploads | DoS attack risk | Set size, frequency, and capacity limits |

---

## Frequently Asked Questions (FAQ)

### Q1. How should chunked upload of large files be implemented?

**A:** For uploading large files (100MB or more), **chunked upload (split upload)** is essential. This provides the following benefits:

- **Resilient against network failures**: If disconnected midway, only the failed chunk needs to be resent
- **Accurate progress display**: Progress can be tracked per chunk
- **Avoid timeouts**: A single request does not run for a long time

**Basic implementation pattern:**

```typescript
interface UploadChunkParams {
  file: File;
  chunkSize: number; // 5MB recommended
  onProgress: (progress: number) => void;
}

async function uploadFileInChunks({ file, chunkSize, onProgress }: UploadChunkParams) {
  const totalChunks = Math.ceil(file.size / chunkSize);
  const uploadId = crypto.randomUUID(); // Upload session ID

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('chunkIndex', String(chunkIndex));
    formData.append('totalChunks', String(totalChunks));
    formData.append('uploadId', uploadId);
    formData.append('fileName', file.name);

    const response = await fetch('/api/upload-chunk', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Chunk ${chunkIndex} upload failed`);
    }

    onProgress(Math.round(((chunkIndex + 1) / totalChunks) * 100));
  }

  // After all chunks complete, merge the file on the server side
  await fetch('/api/finalize-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId, fileName: file.name }),
  });
}
```

**Server-side implementation (Next.js App Router):**

```typescript
// app/api/upload-chunk/route.ts
import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const chunk = formData.get('chunk') as File;
  const chunkIndex = Number(formData.get('chunkIndex'));
  const uploadId = formData.get('uploadId') as string;

  const uploadDir = path.join(process.cwd(), 'uploads', 'temp', uploadId);
  await fs.mkdir(uploadDir, { recursive: true });

  const chunkPath = path.join(uploadDir, `chunk-${chunkIndex}`);
  const buffer = Buffer.from(await chunk.arrayBuffer());
  await fs.writeFile(chunkPath, buffer);

  return Response.json({ success: true });
}

// app/api/finalize-upload/route.ts
export async function POST(request: NextRequest) {
  const { uploadId, fileName } = await request.json();

  const uploadDir = path.join(process.cwd(), 'uploads', 'temp', uploadId);
  const files = await fs.readdir(uploadDir);
  const sortedFiles = files.sort((a, b) => {
    const aIndex = Number(a.split('-')[1]);
    const bIndex = Number(b.split('-')[1]);
    return aIndex - bIndex;
  });

  const finalPath = path.join(process.cwd(), 'uploads', fileName);
  const writeStream = createWriteStream(finalPath);

  for (const file of sortedFiles) {
    const chunkPath = path.join(uploadDir, file);
    const chunkData = await fs.readFile(chunkPath);
    writeStream.write(chunkData);
  }

  writeStream.end();

  // Delete temporary files
  await fs.rm(uploadDir, { recursive: true });

  return Response.json({ success: true, filePath: finalPath });
}
```

**Chunked upload with AWS S3 (recommended):**

Using S3's **Multipart Upload API** eliminates the need for server-side implementation:

```typescript
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: 'us-east-1' });

async function uploadToS3InChunks(file: File) {
  const chunkSize = 5 * 1024 * 1024; // 5MB
  const totalChunks = Math.ceil(file.size / chunkSize);

  // 1. Start Multipart Upload
  const { UploadId } = await s3Client.send(
    new CreateMultipartUploadCommand({
      Bucket: 'my-bucket',
      Key: file.name,
    })
  );

  const uploadedParts = [];

  // 2. Upload each chunk
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    const { ETag } = await s3Client.send(
      new UploadPartCommand({
        Bucket: 'my-bucket',
        Key: file.name,
        UploadId,
        PartNumber: i + 1,
        Body: await chunk.arrayBuffer(),
      })
    );

    uploadedParts.push({ ETag, PartNumber: i + 1 });
  }

  // 3. Complete upload
  await s3Client.send(
    new CompleteMultipartUploadCommand({
      Bucket: 'my-bucket',
      Key: file.name,
      UploadId,
      MultipartUpload: { Parts: uploadedParts },
    })
  );
}
```

### Q2. How should drag & drop upload be implemented?

**A:** Drag & drop is implemented by combining the following three events:

**Basic implementation:**

```typescript
function FileDropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(droppedFiles);
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
    >
      {files.length > 0 ? (
        <ul>
          {files.map((file, i) => (
            <li key={i}>{file.name}</li>
          ))}
        </ul>
      ) : (
        <p>Drag & drop files here</p>
      )}
    </div>
  );
}
```

**Implementation with react-dropzone (recommended):**

```typescript
import { useDropzone } from 'react-dropzone';

function FileDropZone() {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
    },
    maxFiles: 5,
    maxSize: 10 * 1024 * 1024, // 10MB
    onDrop: (acceptedFiles) => {
      console.log(acceptedFiles);
    },
  });

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      {isDragActive ? (
        <p>Drop the files here</p>
      ) : (
        <p>Drag & drop files here, or click to select</p>
      )}
    </div>
  );
}
```

**Directory drop support:**

```typescript
const handleDrop = async (e: React.DragEvent) => {
  e.preventDefault();

  const items = Array.from(e.dataTransfer.items);
  const files: File[] = [];

  for (const item of items) {
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry();
      if (entry?.isDirectory) {
        await readDirectory(entry as FileSystemDirectoryEntry, files);
      } else {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
  }

  setFiles(files);
};

async function readDirectory(directory: FileSystemDirectoryEntry, files: File[]) {
  const reader = directory.createReader();
  const entries = await new Promise<FileSystemEntry[]>((resolve) => {
    reader.readEntries(resolve);
  });

  for (const entry of entries) {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve) => {
        (entry as FileSystemFileEntry).file(resolve);
      });
      files.push(file);
    } else if (entry.isDirectory) {
      await readDirectory(entry as FileSystemDirectoryEntry, files);
    }
  }
}
```

### Q3. How should a progress bar be implemented?

**A:** A progress bar is implemented using the `upload.onprogress` event of `XMLHttpRequest` (Fetch API currently does not support progress events for uploads):

**XMLHttpRequest version:**

```typescript
function uploadWithProgress(file: File, onProgress: (progress: number) => void) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error'));

    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  });
}

// Usage example
function FileUploader() {
  const [progress, setProgress] = useState(0);

  const handleUpload = async (file: File) => {
    await uploadWithProgress(file, setProgress);
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files![0])} />
      {progress > 0 && <progress value={progress} max={100} />}
    </div>
  );
}
```

**Pseudo progress display with Fetch API (using chunked upload):**

```typescript
async function uploadWithChunkProgress(file: File, onProgress: (progress: number) => void) {
  const chunkSize = 1024 * 1024; // 1MB
  const totalChunks = Math.ceil(file.size / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);

    await fetch('/api/upload-chunk', {
      method: 'POST',
      body: chunk,
    });

    onProgress(Math.round(((i + 1) / totalChunks) * 100));
  }
}
```

**shadcn/ui Progress component:**

```typescript
import { Progress } from '@/components/ui/progress';

function FileUploader() {
  const [progress, setProgress] = useState(0);

  return (
    <div>
      <Progress value={progress} className="w-full" />
      <p>{progress}%</p>
    </div>
  );
}
```

---

## What to Read Next

---

## References
1. MDN Web Docs. "File API." developer.mozilla.org, 2024.
2. MDN Web Docs. "Using FormData Objects." developer.mozilla.org, 2024.
3. MDN Web Docs. "HTML Drag and Drop API." developer.mozilla.org, 2024.
4. react-dropzone. "Simple HTML5 drag-drop zone." react-dropzone.js.org, 2024.
5. AWS. "Presigned URLs." docs.aws.amazon.com, 2024.
6. AWS. "Multipart Upload Overview." docs.aws.amazon.com, 2024.
7. tus. "tus - resumable file uploads." tus.io, 2024.
8. Sharp. "High performance Node.js image processing." sharp.pixelplumbing.com, 2024.
9. Uppy. "The next open source file uploader for web browsers." uppy.io, 2024.
10. OWASP. "File Upload Cheat Sheet." cheatsheetseries.owasp.org, 2024.
11. Multer. "Node.js middleware for handling multipart/form-data." github.com/expressjs/multer, 2024.
12. Cloudinary. "Image and Video Upload, Storage, Optimization and CDN." cloudinary.com, 2024.
