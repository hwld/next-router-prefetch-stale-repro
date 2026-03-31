import Link from "next/link";

export default function HomePage() {
  return (
    <main className="p-8 space-y-4">
      <h1>next-router-prefetch-stale-repro</h1>
      <p>
        Start from this page, then navigate to <code>/items</code> with a
        client-side Link that has <code>prefetch={"{false}"}</code>.
      </p>
      <Link
        id="to-items"
        href="/items"
        prefetch={false}
        className="text-blue-600 underline"
      >
        Open /items with Link prefetch=false
      </Link>
    </main>
  );
}
