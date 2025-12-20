# Apollo Frontend

The frontend for Apollo is a modern, responsive web application built with **Next.js 15**. It provides a sleek interface for users to record audio, view identification results, and explore the song library.

## ✨ Features

-   **Glassmorphism Design**: A premium, dark-themed UI with translucent elements.
-   **Interactive Animations**: Smooth transitions and micro-interactions powered by `framer-motion`.
-   **Real-Time Log Console**: A terminal-like component that streams backend logs via Server-Sent Events (SSE).
-   **Audio Visualization**: Visual feedback during recording.
-   **"How It Works" Carousel**: An educational, draggable carousel explaining the underlying technology.

## 🛠️ Tech Stack

-   **Framework**: Next.js 15 (App Router)
-   **Language**: JavaScript (ES6+)
-   **Styling**: Tailwind CSS v4
-   **Animations**: Framer Motion
-   **Icons**: Lucide React
-   **Font**: Geist Sans & Mono

## 🚀 Getting Started

### Prerequisites

-   Node.js (v18+)
-   npm or yarn

### Installation

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Run the development server:
    ```bash
    npm run dev
    ```

4.  Open [http://localhost:3000](http://localhost:3000) with your browser.

## 🧱 Key Components

-   **`AudioCapture.js`**: The core component handling microphone access, recording, and API communication.
-   **`LogConsole.js`**: Connects to the backend SSE stream to display real-time processing logs with syntax highlighting.
-   **`HowItWorksButton.js`**: Navigates to the educational carousel page.
-   **`ResultCard.js`**: Displays the identified song details with a confidence score.

## 🎨 Design System

The application uses a custom dark theme defined in `globals.css`. Key design tokens include:

-   **Background**: Deep black/gray (`#0a0a0a`, `#121212`)
-   **Accents**: Gradients of White to Gray for text, and subtle primary colors for actions.
-   **Glass Effect**: `backdrop-blur` utilities combined with semi-transparent backgrounds.

---

Part of the **Apollo Music Identifier** project.
