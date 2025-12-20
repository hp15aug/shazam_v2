import AudioCapture from "./components/AudioCapture";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md">
        <AudioCapture />
      </div>
    </div>
  );
}
