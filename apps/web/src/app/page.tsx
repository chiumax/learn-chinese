import { StudyView } from "@/components/study/study-view";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 px-4 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold">学中文</h1>
        <p className="text-muted-foreground mt-1">
          Offline-first spaced repetition · powered by FSRS
        </p>
      </header>
      <StudyView />
    </main>
  );
}
