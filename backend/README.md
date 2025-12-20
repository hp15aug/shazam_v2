# Apollo Backend

The backend for Apollo is a high-performance **Node.js** application responsible for audio processing, fingerprint generation, and database matching. It implements a Shazam-like algorithm to identify songs with high accuracy.

## 🧠 The Algorithm

Apollo uses a sophisticated audio fingerprinting technique:

1.  **Spectrogram Generation**: The audio is converted to the frequency domain using **Multi-Scale FFT** (Fast Fourier Transform). This analyzes the audio at multiple resolutions (window sizes) to capture both transient and sustained features.
2.  **Peak Detection**: We identify "constellation points" — local maxima in the spectrogram (peaks in frequency/magnitude).
3.  **Fingerprint Hashing**: Pairs of peaks are connected to form unique hashes based on their frequencies and the time delta between them.
    -   **Robust Hashing**: We generate "fuzzy" hashes that include neighboring values to ensure matches even in the presence of noise or slight speed variations.
4.  **Matching**: These hashes are queried against a **Supabase** database. A histogram of time offsets is built to find the largest cluster of coherent matches.

## 🛠️ Tech Stack

-   **Runtime**: Node.js
-   **Framework**: Express.js
-   **Database**: Supabase (PostgreSQL)
-   **DSP Library**: `fft.js`
-   **File Handling**: `multer` (for audio uploads)

## 🚀 Getting Started

### Prerequisites

-   Node.js (v18+)
-   Supabase Project

### Installation

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  **Configuration**: Create a `.env` file in the `backend` directory:
    ```env
    SUPABASE_URL=your_supabase_project_url
    SUPABASE_KEY=your_supabase_anon_key
    ```

4.  Run the server:
    ```bash
    npm run dev
    ```
    The server will start on `http://localhost:4000`.

## 📡 API Endpoints

### `POST /api/identify`
Accepts an audio file and returns the identified song.
-   **Body**: `form-data` with `audio` file.
-   **Response**: JSON object with song details and confidence score.

### `POST /api/add-song`
Adds a new song to the database.
-   **Body**: `form-data` with `audio` file, `name`, and `artist`.

### `GET /api/songs`
Retrieves the list of all songs in the library.

### `GET /api/logs/stream`
Server-Sent Events (SSE) endpoint for streaming real-time processing logs to the frontend.

---

Part of the **Apollo Music Identifier** project.
