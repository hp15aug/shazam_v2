# Apollo Music Identifier

![Apollo Banner](https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=2070&auto=format&fit=crop)

> **Identify songs instantly with high-accuracy audio fingerprinting.**

Apollo is a robust music recognition system inspired by Shazam. It uses advanced signal processing (FFT, spectral peak detection) to create unique audio fingerprints and matches them against a database in real-time.

Built with performance and accuracy in mind, Apollo features a modern, glassmorphic UI and a powerful backend capable of handling noise and distortion.

## 🚀 Key Features

-   **High-Accuracy Recognition**: Uses multi-scale FFT analysis and robust hashing to identify songs even in noisy environments.
-   **Real-Time Visualization**: Watch the identification process live with a terminal-style log console.
-   **Interactive "How It Works"**: Learn the magic behind the technology with an interactive, draggable carousel.
-   **Modern UI**: Sleek, dark-themed interface with glassmorphism and smooth animations using Framer Motion.
-   **Song Library**: Manage your recognized songs and expand the database with new tracks.

## 🛠️ Tech Stack

-   **Frontend**: Next.js 15, React 19, Tailwind CSS v4, Framer Motion
-   **Backend**: Node.js, Express, FFT.js
-   **Database**: Supabase (PostgreSQL)
-   **Audio Processing**: Web Audio API (Frontend), FFmpeg (Backend)

## 🏁 Quick Start

### Prerequisites

-   Node.js (v18+)
-   npm or yarn
-   Supabase account and project

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/hp15aug/shazam_v2.git
    cd shazam_v2
    ```

2.  **Install dependencies**
    ```bash
    # Install backend dependencies
    cd backend
    npm install

    # Install frontend dependencies
    cd ../frontend
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the `backend` directory with your Supabase credentials:
    ```env
    SUPABASE_URL=your_supabase_url
    SUPABASE_KEY=your_supabase_anon_key
    ```

4.  **Run the Application**
    You need to run both the backend and frontend servers.

    **Backend (Terminal 1)**
    ```bash
    cd backend
    npm run dev
    ```

    **Frontend (Terminal 2)**
    ```bash
    cd frontend
    npm run dev
    ```

5.  **Open Apollo**
    Visit `http://localhost:3000` in your browser.

## 📂 Project Structure

```
shazam_v2/
├── backend/            # Express server & Audio processing logic
│   ├── addSongs/       # Fingerprint generation & storage
│   ├── identifySongs/  # Matching algorithm
│   └── lib/            # Database connection
├── frontend/           # Next.js application
│   ├── app/            # Pages & Components
│   └── public/         # Static assets
└── README.md           # You are here
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Made with ❤️ by [hp15aug](https://github.com/hp15aug)
