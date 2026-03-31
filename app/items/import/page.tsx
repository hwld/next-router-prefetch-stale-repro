import Link from "next/link";

export default function ImportPage() {
  return (
    <main className="p-8 space-y-4">
      <h1>/items/import</h1>
      <p>
        This page exposes a default-prefetch Link back to <code>/items</code>.
      </p>
      <p>
        If the bug hits, clicking back will reuse the old <code>/items</code>{" "}
        render with no new RSC request.
      </p>
      <Link id="back-link" href="/items" className="text-blue-600 underline">
        Back to /items
      </Link>
    </main>
  );
}
