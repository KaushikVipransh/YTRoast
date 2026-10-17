import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-6 px-4 py-16">
      <h1 className="text-3xl font-black">nothing here. or someone&apos;s hiding something.</h1>
      <Link href="/roast" className="border-2 border-ink bg-butter px-6 py-3 font-black uppercase">
        roast me
      </Link>
    </main>
  );
}
